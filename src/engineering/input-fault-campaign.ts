/** Scan-bounded simulated input faults; does not modify physical I/O or the source sequence. */
import {runLadderSequence,type VectorStep} from './ladder-sequences';
import type {LadderDocument} from './ladder';
export type InputFault={tag:string;startScan:number;durationScans:number;mode:'stuck-on'|'stuck-off'|'invert'};
export type FaultComparison={scan:number;step:number;tag:string;normal:boolean;faulted:boolean};
export type FaultCampaign={fault:InputFault;totalScans:number;normalPassed:boolean;faultedPassed:boolean;differences:FaultComparison[];changedCheckpoints:number;injected:VectorStep[]};
const validTag=(s:unknown):s is string=>typeof s==='string'&&/^[A-Za-z][\w.]{0,79}$/.test(s);
export function injectInputFault(steps:readonly VectorStep[],fault:InputFault):VectorStep[]{
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw RangeError('Sequence must have 1..100 steps');
 if(!fault||!validTag(fault.tag)||!['stuck-on','stuck-off','invert'].includes(fault.mode)||!Number.isSafeInteger(fault.startScan)||fault.startScan<1||!Number.isSafeInteger(fault.durationScans)||fault.durationScans<1||fault.durationScans>10000)throw RangeError('Invalid fault configuration');
 let total=0;const original:VectorStep[]=[];const inputs:Record<string,boolean>={};
 for(const [i,step] of steps.entries()){
  if(!step||!Number.isSafeInteger(step.scans)||step.scans<1||step.scans>1000||!step.inputs||typeof step.inputs!=='object'||Array.isArray(step.inputs)||Object.keys(step.inputs).length>64)throw Error(`Invalid step ${i+1}`);
  for(const [tag,value] of Object.entries(step.inputs))if(!validTag(tag)||typeof value!=='boolean')throw Error(`Invalid input ${tag}`);
  if(step.expect){if(typeof step.expect!=='object'||Array.isArray(step.expect)||Object.entries(step.expect).some(([tag,value])=>!validTag(tag)||typeof value!=='boolean'))throw Error(`Invalid expectation in step ${i+1}`);}
  total+=step.scans;if(total>10000)throw RangeError('Sequence exceeds 10000 scans');
  original.push({scans:step.scans,inputs:{...step.inputs},...(step.expect?{expect:{...step.expect}}:{})});
  Object.assign(inputs,step.inputs);
 }
 if(fault.startScan>total||fault.startScan+fault.durationScans-1>total)throw RangeError('Fault window must be fully inside sequence');
 if(!Object.prototype.hasOwnProperty.call(inputs,fault.tag))throw Error('Fault tag must be explicitly assigned in the sequence');
 const result:VectorStep[]=[];let scan=0;let normal:Record<string,boolean>={};let applied:Record<string,boolean>={};
 const end=fault.startScan+fault.durationScans-1;
 for(const step of original){
  const start=scan+1;const finish=scan+step.scans;const nextNormal={...normal,...step.inputs};
  const cuts=[start,finish+1,fault.startScan,end+1].filter(n=>n>=start&&n<=finish+1).sort((a,b)=>a-b);
  const unique=[...new Set(cuts)];
  for(let j=0;j<unique.length-1;j++){
   const a=unique[j],b=unique[j+1],active=a>=fault.startScan&&a<=end;
   const effective=active?(fault.mode==='stuck-on'?true:fault.mode==='stuck-off'?false:!nextNormal[fault.tag]):nextNormal[fault.tag];
   const desired={...nextNormal,[fault.tag]:effective};const changes:Record<string,boolean>={};
   for(const [tag,value] of Object.entries(desired))if(applied[tag]!==value)changes[tag]=value;
   const last=b===finish+1;
   result.push({scans:b-a,inputs:changes,...(last&&step.expect?{expect:{...step.expect}}:{})});
   applied=desired;
  }
  normal=nextNormal;scan=finish;
 }
 if(result.length>100)throw RangeError('Injected fault would exceed 100 test steps');
 return result;
}
export function compareInputFault(doc:LadderDocument,steps:readonly VectorStep[],fault:InputFault):FaultCampaign{
 const injected=injectInputFault(steps,fault);
 const normal=runLadderSequence(doc,steps);const altered=runLadderSequence(doc,injected);
 const normalByScan=new Map(normal.rows.map(r=>[r.scan,r]));
 const differences:FaultComparison[]=[];let changedCheckpoints=0;
 for(const row of altered.rows){const base=normalByScan.get(row.scan);if(!base)continue;
  let changed=false;
  for(const tag of new Set([...Object.keys(base.outputs),...Object.keys(row.outputs)])){
   if(base.outputs[tag]!==row.outputs[tag]){changed=true;if(differences.length<200)differences.push({scan:row.scan,step:base.step,tag,normal:base.outputs[tag]??false,faulted:row.outputs[tag]??false});}
  }
  if(changed)changedCheckpoints++;
 }
 return {fault:{...fault},totalScans:normal.totalScans,normalPassed:normal.passed,faultedPassed:altered.passed,differences,changedCheckpoints,injected};
}
export const INPUT_FAULT_EXAMPLE:InputFault={tag:'Start',startScan:2,durationScans:2,mode:'stuck-off'};
