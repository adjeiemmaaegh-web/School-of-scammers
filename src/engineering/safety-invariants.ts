/** Educational scan-by-scan temporal invariant checker; not a certified safety tool. */
import {executeLadder,validateLadder,type LadderDocument,type LadderMemory} from './ladder';
import type {VectorStep} from './ladder-sequences';
export type SafetyRule=
 |{id:string;kind:'mutex';a:string;b:string}
 |{id:string;kind:'requires';output:string;input:string;equals:boolean}
 |{id:string;kind:'max-on-scans';output:string;limit:number};
export type SafetyViolation={rule:string;scan:number;step:number;message:string;inputs:Record<string,boolean>;outputs:Record<string,boolean>};
export type SafetyReport={passed:boolean;scans:number;violations:SafetyViolation[];truncated:boolean;rules:number};
const validTag=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z][\w.]{0,79}$/.test(x);
export function checkSafetyInvariants(doc:LadderDocument,steps:readonly VectorStep[],rules:readonly SafetyRule[],deltaMs=20):SafetyReport{
 const errors=validateLadder(doc);if(errors.length)throw Error(errors.join('; '));
 if(!Number.isSafeInteger(deltaMs)||deltaMs<1||deltaMs>1000)throw RangeError('Invalid scan interval');
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw RangeError('Sequence must contain 1..100 steps');
 if(!Array.isArray(rules)||rules.length<1||rules.length>30)throw RangeError('Specify 1..30 safety rules');
 const coils=new Set(doc.rungs.map(r=>r.coil));const ids=new Set<string>();
 for(const rule of rules){
  if(!rule||!validTag(rule.id)||ids.has(rule.id))throw Error('Invalid or duplicate safety rule ID');ids.add(rule.id);
  if(rule.kind==='mutex'){if(!coils.has(rule.a)||!coils.has(rule.b)||rule.a===rule.b)throw Error(`${rule.id}: invalid mutex outputs`);}
  else if(rule.kind==='requires'){if(!coils.has(rule.output)||!validTag(rule.input)||coils.has(rule.input)||typeof rule.equals!=='boolean')throw Error(`${rule.id}: invalid interlock`);}
  else if(rule.kind==='max-on-scans'){if(!coils.has(rule.output)||!Number.isSafeInteger(rule.limit)||rule.limit<1||rule.limit>10000)throw Error(`${rule.id}: invalid duration limit`);}
  else throw Error(`${rule.id}: unknown rule kind`);
 }
 let inputs:Record<string,boolean>={};let outputs:Record<string,boolean>={};let memory:LadderMemory={};let scans=0;
 const streak=new Map<string,number>();const violations:SafetyViolation[]=[];let truncated=false;
 for(const [index,step] of steps.entries()){
  if(!step||!Number.isSafeInteger(step.scans)||step.scans<1||step.scans>1000||scans+step.scans>10000)throw RangeError(`Step ${index+1}: scan budget exceeded`);
  if(!step.inputs||typeof step.inputs!=='object'||Array.isArray(step.inputs)||Object.keys(step.inputs).length>64)throw Error(`Step ${index+1}: invalid inputs`);
  for(const [tag,value] of Object.entries(step.inputs))if(!validTag(tag)||typeof value!=='boolean'||coils.has(tag))throw Error(`Step ${index+1}: invalid input ${tag}`);
  inputs={...inputs,...step.inputs};
  for(let n=0;n<step.scans;n++){
   const result=executeLadder(doc,inputs,outputs,memory,deltaMs);outputs=result.outputs;memory=result.memory;scans++;
   for(const rule of rules){
    let message='';
    if(rule.kind==='mutex'&&outputs[rule.a]&&outputs[rule.b])message=`${rule.a} and ${rule.b} energized together`;
    if(rule.kind==='requires'&&outputs[rule.output]&&inputs[rule.input]!==rule.equals)message=`${rule.output} energized without ${rule.input}=${rule.equals}`;
    if(rule.kind==='max-on-scans'){
     const count=outputs[rule.output]?(streak.get(rule.id)??0)+1:0;streak.set(rule.id,count);
     if(count===rule.limit+1)message=`${rule.output} exceeded ${rule.limit} consecutive ON scans`;
    }
    if(message){if(violations.length<100)violations.push({rule:rule.id,scan:scans,step:index+1,message,inputs:{...inputs},outputs:{...outputs}});else truncated=true;}
   }
  }
 }
 return {passed:violations.length===0,scans,violations,truncated,rules:rules.length};
}
export function safetyReportCsv(report:SafetyReport):string{
 const q=(x:unknown)=>`"${String(x).replace(/"/g,'""')}"`;
 return [['rule','scan','step','message','inputs','outputs'],...report.violations.map(v=>[v.rule,v.scan,v.step,v.message,JSON.stringify(v.inputs),JSON.stringify(v.outputs)])].map(row=>row.map(q).join(',')).join('\r\n');
}
export const SAFETY_RULE_EXAMPLE:SafetyRule[]=[{id:'guard-interlock',kind:'requires',output:'RunLatch',input:'GuardClosed',equals:true},{id:'estop-interlock',kind:'requires',output:'RunLatch',input:'EStopOK',equals:true}];
