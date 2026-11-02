/** Compare two ladder implementations against identical simulated inputs, with isolated scan memory. */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory} from './ladder';
import type {VectorStep} from './ladder-sequences';
export type Divergence={scan:number;step:number;timeMs:number;tag:string;reference:boolean;candidate:boolean;inputs:Record<string,boolean>};
export type DifferentialReport={scans:number;steps:number;comparedOutputs:string[];divergences:Divergence[];truncated:boolean;warnings:string[]};
export function compareLadderPrograms(reference:LadderDocument,candidate:LadderDocument,steps:readonly VectorStep[],deltaMs=20,maxDifferences=250):DifferentialReport{
 for(const [label,doc] of [['reference',reference],['candidate',candidate]] as const){const errors=validateLadder(doc);if(errors.length)throw Error(`${label}: ${errors.join('; ')}`);}
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw RangeError('Scan interval must be 1..1000 ms');
 if(!Number.isSafeInteger(maxDifferences)||maxDifferences<1||maxDifferences>1000)throw RangeError('Difference limit must be 1..1000');
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw RangeError('Sequence must have 1..100 steps');
 const refOutputs=new Set(reference.rungs.map(r=>r.coil)),candidateOutputs=new Set(candidate.rungs.map(r=>r.coil));
 const comparedOutputs=[...refOutputs].filter(tag=>candidateOutputs.has(tag)).sort();
 if(!comparedOutputs.length)throw Error('Programs share no output tags to compare');
 const outputTags=new Set([...refOutputs,...candidateOutputs]);
 let refState:Record<string,boolean>={},candidateState:Record<string,boolean>={},refMemory:LadderMemory={},candidateMemory:LadderMemory={},inputs:Record<string,boolean>={},scans=0;
 const divergences:Divergence[]=[];let truncated=false;
 for(const [index,step] of steps.entries()){
  if(!step||!Number.isSafeInteger(step.scans)||step.scans<1||step.scans>1000||scans+step.scans>10000)throw RangeError(`Step ${index+1}: scan budget exceeded`);
  if(!step.inputs||typeof step.inputs!=='object'||Array.isArray(step.inputs)||Object.keys(step.inputs).length>64)throw Error(`Step ${index+1}: invalid input map`);
  for(const [tag,value] of Object.entries(step.inputs))if(!/^[A-Za-z][\w.]{0,79}$/.test(tag)||typeof value!=='boolean'||outputTags.has(tag))throw Error(`Step ${index+1}: invalid or output-controlled input ${tag}`);
  inputs={...inputs,...step.inputs};
  for(let n=0;n<step.scans;n++){
   const a=executeLadder(reference,inputs,refState,refMemory,deltaMs),b=executeLadder(candidate,inputs,candidateState,candidateMemory,deltaMs);
   refState=a.outputs;refMemory=a.memory;candidateState=b.outputs;candidateMemory=b.memory;scans++;
   for(const tag of comparedOutputs)if(a.outputs[tag]!==b.outputs[tag]){
    if(divergences.length<maxDifferences)divergences.push({scan:scans,step:index+1,timeMs:scans*deltaMs,tag,reference:a.outputs[tag],candidate:b.outputs[tag],inputs:{...inputs}});
    else truncated=true;
   }
  }
 }
 return {scans,steps:steps.length,comparedOutputs,divergences,truncated,warnings:[...refOutputs].filter(t=>!candidateOutputs.has(t)).map(t=>`Reference-only output not compared: ${t}`).concat([...candidateOutputs].filter(t=>!refOutputs.has(t)).map(t=>`Candidate-only output not compared: ${t}`),['Matching simulated outputs do not prove either program is correct or safe. Review the reference independently.'])};
}
export function differentialCsv(report:DifferentialReport):string{
 const quote=(x:unknown)=>`"${String(x).replace(/"/g,'""')}"`;
 return [['scan','step','time_ms','output','reference','candidate','inputs'],...report.divergences.map(d=>[d.scan,d.step,d.timeMs,d.tag,d.reference,d.candidate,JSON.stringify(d.inputs)])].map(row=>row.map(quote).join(',')).join('\r\n');
}
