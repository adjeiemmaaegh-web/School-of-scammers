/** Bounded response obligations over deterministic simulated PLC scans. Educational only. */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory} from './ladder';
import type {VectorStep} from './ladder-sequences';
export type ResponseRule={id:string;trigger:string;triggerValue:boolean;response:string;responseValue:boolean;withinScans:number;edgeOnly?:boolean};
export type ResponseFinding={rule:string;triggerScan:number;deadlineScan:number;resolvedScan?:number;status:'met'|'late'|'pending';message:string};
export type ResponseReport={passed:boolean;complete:boolean;scans:number;findings:ResponseFinding[];met:number;late:number;pending:number;truncated:boolean};
const tag=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z][\w.]{0,79}$/.test(v);
export function checkTemporalResponses(doc:LadderDocument,steps:readonly VectorStep[],rules:readonly ResponseRule[],deltaMs=20):ResponseReport{
 const errors=validateLadder(doc);if(errors.length)throw Error(errors.join('; '));
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw RangeError('Invalid scan interval');
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw RangeError('Sequence must contain 1..100 steps');
 if(!Array.isArray(rules)||rules.length<1||rules.length>30)throw RangeError('Specify 1..30 response rules');
 const coils=new Set(doc.rungs.map(r=>r.coil));const ids=new Set<string>();
 for(const r of rules){
  if(!r||!tag(r.id)||ids.has(r.id))throw Error('Invalid or duplicate response rule ID');ids.add(r.id);
  if(!tag(r.trigger)||!tag(r.response)||typeof r.triggerValue!=='boolean'||typeof r.responseValue!=='boolean'||(r.edgeOnly!==undefined&&typeof r.edgeOnly!=='boolean'))throw Error(`${r.id}: invalid signals`);
  if(!Number.isSafeInteger(r.withinScans)||r.withinScans<0||r.withinScans>10000)throw RangeError(`${r.id}: invalid deadline`);
  // Inputs and outputs may be observed, but outputs cannot be forced by the test vector.
 }
 let inputs:Record<string,boolean>={};let outputs:Record<string,boolean>={};let memory:LadderMemory={};let scans=0;
 const prev=new Map<string,boolean>();const active:ResponseFinding[]=[];const findings:ResponseFinding[]=[];let truncated=false;
 const value=(name:string)=>coils.has(name)?outputs[name]===true:inputs[name]===true;
 for(const [index,step] of steps.entries()){
  if(!step||!Number.isSafeInteger(step.scans)||step.scans<1||step.scans>1000||scans+step.scans>10000)throw RangeError(`Step ${index+1}: scan budget exceeded`);
  if(!step.inputs||typeof step.inputs!=='object'||Array.isArray(step.inputs)||Object.keys(step.inputs).length>64)throw Error(`Step ${index+1}: invalid input map`);
  for(const [name,v] of Object.entries(step.inputs))if(!tag(name)||typeof v!=='boolean'||coils.has(name))throw Error(`Step ${index+1}: invalid input ${name}`);
  inputs={...inputs,...step.inputs};
  for(let n=0;n<step.scans;n++){
   const next=executeLadder(doc,inputs,outputs,memory,deltaMs);outputs=next.outputs;memory=next.memory;scans++;
   for(const r of rules){
    const isTrigger=value(r.trigger)===r.triggerValue;const wasTrigger=prev.get(r.id)??false;
    if(isTrigger&&(!r.edgeOnly||!wasTrigger)){
     if(findings.length<2000){const f:ResponseFinding={rule:r.id,triggerScan:scans,deadlineScan:scans+r.withinScans,status:'pending',message:'Awaiting response'};findings.push(f);active.push(f);}else truncated=true;
    }
    prev.set(r.id,isTrigger);
   }
   for(let i=active.length-1;i>=0;i--){
    const f=active[i];const r=rules.find(x=>x.id===f.rule)!;
    if(value(r.response)===r.responseValue){f.status='met';f.resolvedScan=scans;f.message='Response observed within deadline';active.splice(i,1);}
    else if(scans>=f.deadlineScan){f.status='late';f.resolvedScan=scans;f.message=`Response missing by scan ${f.deadlineScan}`;active.splice(i,1);}
   }
  }
 }
 const met=findings.filter(f=>f.status==='met').length,late=findings.filter(f=>f.status==='late').length,pending=findings.filter(f=>f.status==='pending').length;
 return {passed:late===0&&pending===0&&!truncated,complete:pending===0&&!truncated,scans,findings,met,late,pending,truncated};
}
export function temporalResponseCsv(report:ResponseReport):string{
 const q=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`;
 return [['rule','trigger_scan','deadline_scan','resolved_scan','status','message'],...report.findings.map(f=>[f.rule,f.triggerScan,f.deadlineScan,f.resolvedScan??'',f.status,f.message])].map(row=>row.map(q).join(',')).join('\r\n');
}
export const RESPONSE_RULE_EXAMPLE:ResponseRule[]=[{id:'start-response',trigger:'Start',triggerValue:true,response:'RunLatch',responseValue:true,withinScans:1,edgeOnly:true},{id:'stop-response',trigger:'Stop',triggerValue:true,response:'RunLatch',responseValue:false,withinScans:1,edgeOnly:true}];
