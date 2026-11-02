/** Deterministic scan-level signal stability and debounce observation; simulation only. */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory} from './ladder';
import type {VectorStep} from './ladder-sequences';
export type StabilityRule={id:string;signal:string;value:boolean;minScans:number;trigger?:string;triggerValue?:boolean};
export type StabilityFinding={rule:string;startScan:number;endScan:number;observedScans:number;requiredScans:number;status:'met'|'glitch'|'pending';message:string};
export type StabilityReport={passed:boolean;complete:boolean;scans:number;met:number;glitches:number;pending:number;findings:StabilityFinding[];truncated:boolean};
const validTag=(s:unknown):s is string=>typeof s==='string'&&/^[A-Za-z][\w.]{0,79}$/.test(s);
export function checkSignalStability(doc:LadderDocument,steps:readonly VectorStep[],rules:readonly StabilityRule[],deltaMs=20):StabilityReport{
 const errors=validateLadder(doc);if(errors.length)throw Error(errors.join('; '));
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw RangeError('Invalid scan interval');
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw RangeError('Sequence must contain 1..100 steps');
 if(!Array.isArray(rules)||rules.length<1||rules.length>30)throw RangeError('Specify 1..30 stability rules');
 const ids=new Set<string>(),coils=new Set(doc.rungs.map(r=>r.coil));
 for(const r of rules){
  if(!r||!validTag(r.id)||ids.has(r.id)||!validTag(r.signal)||typeof r.value!=='boolean'||!Number.isSafeInteger(r.minScans)||r.minScans<2||r.minScans>10000)throw Error('Invalid or duplicate stability rule');
  if((r.trigger===undefined)!==(r.triggerValue===undefined)||r.trigger!==undefined&&(!validTag(r.trigger)||typeof r.triggerValue!=='boolean'))throw Error(`${r.id}: invalid trigger`);
  ids.add(r.id);
 }
 let inputs:Record<string,boolean>={},outputs:Record<string,boolean>={},memory:LadderMemory={},scans=0,truncated=false;
 const previous=new Map<string,boolean>(),active=new Map<string,StabilityFinding>(),findings:StabilityFinding[]=[];
 const read=(name:string)=>coils.has(name)?outputs[name]===true:inputs[name]===true;
 for(const [i,step] of steps.entries()){
  if(!step||!Number.isSafeInteger(step.scans)||step.scans<1||step.scans>1000||scans+step.scans>10000)throw RangeError(`Step ${i+1}: scan budget exceeded`);
  if(!step.inputs||typeof step.inputs!=='object'||Array.isArray(step.inputs)||Object.keys(step.inputs).length>64)throw Error(`Step ${i+1}: invalid inputs`);
  for(const [name,v] of Object.entries(step.inputs))if(!validTag(name)||typeof v!=='boolean'||coils.has(name))throw Error(`Step ${i+1}: invalid input ${name}`);
  inputs={...inputs,...step.inputs};
  for(let n=0;n<step.scans;n++){
   const result=executeLadder(doc,inputs,outputs,memory,deltaMs);outputs=result.outputs;memory=result.memory;scans++;
   for(const r of rules){
    const signal=read(r.signal)===r.value;
    const trigger=r.trigger===undefined?signal:read(r.trigger)===r.triggerValue;
    const was=previous.get(r.id)??false;
    let current=active.get(r.id);
    // A new observation starts on a qualifying rising edge, never repeatedly while held.
    if(!current&&trigger&&!was){
     if(findings.length<2000){current={rule:r.id,startScan:scans,endScan:scans,observedScans:0,requiredScans:r.minScans,status:'pending',message:'Awaiting stable signal'};findings.push(current);active.set(r.id,current);}else truncated=true;
    }
    previous.set(r.id,trigger);
    if(!current)continue;
    if(!signal){current.status='glitch';current.endScan=scans;current.message=`Signal failed stability at scan ${scans}`;active.delete(r.id);continue;}
    current.observedScans++;current.endScan=scans;
    if(current.observedScans>=r.minScans){current.status='met';current.message='Required consecutive stable scans observed';active.delete(r.id);}
   }
  }
 }
 const met=findings.filter(f=>f.status==='met').length,glitches=findings.filter(f=>f.status==='glitch').length,pending=findings.filter(f=>f.status==='pending').length;
 return {passed:glitches===0&&pending===0&&!truncated,complete:pending===0&&!truncated,scans,met,glitches,pending,findings,truncated};
}
export function stabilityCsv(report:StabilityReport):string{
 const q=(x:unknown)=>`"${String(x??'').replace(/"/g,'""')}"`;
 return [['rule','start_scan','end_scan','observed_scans','required_scans','status','message'],...report.findings.map(f=>[f.rule,f.startScan,f.endScan,f.observedScans,f.requiredScans,f.status,f.message])].map(row=>row.map(q).join(',')).join('\r\n');
}
export const STABILITY_RULE_EXAMPLE:StabilityRule[]=[{id:'run-hold',signal:'RunLatch',value:true,minScans:3}];
