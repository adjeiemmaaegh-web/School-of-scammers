/** Bounded, deterministic sequential PLC test vectors; all inputs are simulated. */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory} from './ladder';
export type VectorStep={scans:number;inputs:Record<string,boolean>;expect?:Record<string,boolean>};
export type VectorResult={step:number;scan:number;timeMs:number;inputs:Record<string,boolean>;outputs:Record<string,boolean>;passed:boolean;failures:string[];memory:LadderMemory};
export type SequenceResult={passed:boolean;totalScans:number;rows:VectorResult[]};
const tagOK=(s:string)=>/^[A-Za-z][\w.]{0,79}$/.test(s);
export function runLadderSequence(doc:LadderDocument,steps:readonly VectorStep[],deltaMs=20):SequenceResult{
 const errors=validateLadder(doc);if(errors.length)throw Error(errors.join('; '));
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw RangeError('Invalid scan interval');
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw RangeError('Sequence must have 1..100 steps');
 let total=0;let memory:LadderMemory={};let outputs:Record<string,boolean>={};let inputs:Record<string,boolean>={};const rows:VectorResult[]=[];
 const outputTags=new Set(doc.rungs.map(r=>r.coil));
 for(const [index,step] of steps.entries()){
  if(!step||!Number.isSafeInteger(step.scans)||step.scans<1||step.scans>1000||total+step.scans>10000)throw RangeError(`Step ${index+1}: scan budget exceeded`);
  for(const group of [step.inputs,step.expect??{}]){
   if(!group||typeof group!=='object'||Array.isArray(group)||Object.keys(group).length>64)throw Error(`Step ${index+1}: invalid signal map`);
   for(const [tag,value] of Object.entries(group))if(!tagOK(tag)||typeof value!=='boolean')throw Error(`Step ${index+1}: invalid signal ${tag}`);
  }
  for(const tag of Object.keys(step.inputs))if(outputTags.has(tag))throw Error(`Step ${index+1}: cannot force output ${tag}`);
  for(const tag of Object.keys(step.expect??{}))if(!outputTags.has(tag))throw Error(`Step ${index+1}: unknown expected output ${tag}`);
  inputs={...inputs,...step.inputs};
  for(let n=0;n<step.scans;n++){const result=executeLadder(doc,inputs,outputs,memory,deltaMs);outputs=result.outputs;memory=result.memory;total++;}
  const failures=Object.entries(step.expect??{}).filter(([tag,want])=>outputs[tag]!==want).map(([tag,want])=>`${tag}: expected ${want}, observed ${outputs[tag]}`);
  rows.push({step:index+1,scan:total,timeMs:total*deltaMs,inputs:{...inputs},outputs:{...outputs},passed:failures.length===0,failures,memory:{...memory}});
 }
 return {passed:rows.every(r=>r.passed),totalScans:total,rows};
}
export function sequenceCsv(result:SequenceResult):string{
 const cell=(x:unknown)=>`"${String(x).replace(/"/g,'""')}"`;
 return [['step','scan','time_ms','passed','inputs','outputs','failures'].map(cell).join(','),...result.rows.map(r=>[r.step,r.scan,r.timeMs,r.passed,JSON.stringify(r.inputs),JSON.stringify(r.outputs),r.failures.join('; ')].map(cell).join(','))].join('\r\n');
}
export const SEQUENCE_EXAMPLES:Readonly<Record<string,readonly VectorStep[]>>={
 'start-stop':[{scans:1,inputs:{EStopOK:true,GuardClosed:true,Start:false,Stop:false},expect:{RunLatch:false}},{scans:1,inputs:{Start:true},expect:{RunLatch:true}},{scans:1,inputs:{Start:false},expect:{RunLatch:true}},{scans:1,inputs:{Stop:true},expect:{RunLatch:false}}],
};
