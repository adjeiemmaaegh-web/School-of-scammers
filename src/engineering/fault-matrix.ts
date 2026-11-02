/** Bounded, reproducible simulated input-fault matrix for a ladder test sequence. */
import type {LadderDocument} from './ladder';
import {runLadderSequence,type VectorStep} from './ladder-sequences';
import {logicBenchInputTags} from './instruction-lab';
import {traceInputFaultScans} from './input-fault-scan-trace';
import {injectInputFault,type InputFault} from './input-fault-campaign';
export type FaultMatrixCase={fault:InputFault;changedScans:number;totalScans:number;firstDifferenceScan:number|null;affectedOutputs:string[];evidenceTruncated:boolean;postFaultDifferentScans:number;recoveredByEnd:boolean;longestImpactScans:number;impactBeyondFault:boolean;assertionFailed:boolean;failedCheckpoints:number};
export type FaultMatrix={cases:FaultMatrixCase[];detected:number;undetected:number;totalScansPerCase:number;affectedOutputs:string[];plannedCases:number;truncated:boolean;baselinePassed:boolean;assertionFailures:number;observableButNotAsserted:number;evaluatedTags:string[];omittedTags:string[];evaluatedModes:InputFault['mode'][]};
export function runFaultMatrix(doc:LadderDocument,steps:readonly VectorStep[],tags:readonly string[],maxCases=24):FaultMatrix{
 if(!Array.isArray(tags)||!tags.length||tags.length>8||tags.some(t=>typeof t!=='string'||!t.trim())||new Set(tags).size!==tags.length)throw RangeError('Provide 1..8 distinct input tags');
 if(!Number.isSafeInteger(maxCases)||maxCases<1||maxCases>24)throw RangeError('Case limit must be 1..24');
 const validInputs=new Set(logicBenchInputTags(doc));
 for(const tag of tags)if(!validInputs.has(tag))throw Error(`Unknown external PLC input: ${tag}`);
 const baseline=runLadderSequence(doc,steps);
 if(!baseline.passed)throw Error('Baseline sequence assertions must pass before running a fault matrix');
 const total=steps.reduce((sum,s)=>sum+s.scans,0);
 if(!Number.isSafeInteger(total)||total<1||total>10000)throw RangeError('Sequence must contain 1..10000 scans');
 const windows=[{startScan:1,durationScans:total},{startScan:Math.floor((total+1)/2),durationScans:Math.min(2,total-Math.floor((total+1)/2)+1)}];
 const modes:InputFault['mode'][]=['stuck-on','stuck-off','invert'];
 const plannedCases=tags.length*windows.length*modes.length;
 const cases:FaultMatrixCase[]=[];const all=new Set<string>();
 // Round-robin across input tags before repeating a tag, so capped campaigns do not silently exclude later inputs.
 for(const window of windows)for(const mode of modes)for(const tag of tags){
  if(cases.length>=maxCases)break;
  const fault={tag,...window,mode};
  const trace=traceInputFaultScans(doc,steps,fault,1000);
  const altered=runLadderSequence(doc,injectInputFault(steps,fault));
  const failedCheckpoints=altered.rows.filter(row=>row.failures.length>0).length;
  const affected=[...new Set(trace.impactWindows.map(w=>w.output))].sort();
  for(const output of affected)all.add(output);
  cases.push({fault,changedScans:trace.differentScans,totalScans:trace.totalScans,firstDifferenceScan:trace.firstDifferenceScan,affectedOutputs:affected,evidenceTruncated:trace.truncated,postFaultDifferentScans:trace.postFaultDifferentScans,recoveredByEnd:trace.recoveredByEnd,longestImpactScans:Math.max(0,...trace.impactWindows.map(w=>w.durationScans)),impactBeyondFault:trace.impactWindows.some(w=>w.extendsBeyondFault),assertionFailed:!altered.passed,failedCheckpoints});
 }
 return {cases,detected:cases.filter(c=>c.changedScans>0).length,undetected:cases.filter(c=>c.changedScans===0).length,totalScansPerCase:total,affectedOutputs:[...all].sort(),plannedCases,truncated:cases.length<plannedCases,baselinePassed:baseline.passed,assertionFailures:cases.filter(c=>c.assertionFailed).length,observableButNotAsserted:cases.filter(c=>c.changedScans>0&&!c.assertionFailed).length,evaluatedTags:tags.filter(tag=>cases.some(c=>c.fault.tag===tag)),omittedTags:tags.filter(tag=>!cases.some(c=>c.fault.tag===tag)),evaluatedModes:modes.filter(mode=>cases.some(c=>c.fault.mode===mode))};
}
export function faultMatrixCsv(matrix:FaultMatrix):string{
 const q=(v:unknown)=>`"${String(v).replace(/"/g,'""')}"`;
 return [['tag','mode','start_scan','duration_scans','changed_scans','first_difference_scan','affected_outputs','evidence_truncated','post_fault_changed_scans','recovered_by_end','longest_impact_scans','impact_beyond_fault','campaign_truncated','planned_cases','assertion_failed','failed_checkpoints','evaluated_tags','omitted_tags','evaluated_modes'].map(q).join(','),...matrix.cases.map(c=>[c.fault.tag,c.fault.mode,c.fault.startScan,c.fault.durationScans,c.changedScans,c.firstDifferenceScan??'',c.affectedOutputs.join(';'),c.evidenceTruncated,c.postFaultDifferentScans,c.recoveredByEnd,c.longestImpactScans,c.impactBeyondFault,matrix.truncated,matrix.plannedCases,c.assertionFailed,c.failedCheckpoints,matrix.evaluatedTags.join(';'),matrix.omittedTags.join(';'),matrix.evaluatedModes.join(';')].map(q).join(','))].join('\r\n');
}
