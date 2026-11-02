import type { Machine } from './simulation';
export interface Criterion { id: string; label: string; max: number; earned: number; reason: string; }
export interface Rubric { version: string; passMark: number; criticalSafetyLimit: number; weights: Record<'diagnosis'|'correction'|'diagnostics'|'verification'|'safety'|'process',number>; }
export const rubric: Rubric={version:'1.0.0',passMark:70,criticalSafetyLimit:0,weights:{diagnosis:20,correction:25,diagnostics:15,verification:20,safety:15,process:5}};
export function grade(s: Machine, r: Rubric=rubric){
 const criteria:Criterion[]=[
 {id:'diagnosis',label:'Fault diagnosis',max:r.weights.diagnosis,earned:s.diagnosed?r.weights.diagnosis:0,reason:s.diagnosed?'Inspection and PLC evidence captured':'Inspect machine, then read PLC diagnostics'},
 {id:'correction',label:'Technical correction',max:r.weights.correction,earned:s.repaired?r.weights.correction:0,reason:s.repaired?'Fault repaired':'Sensor fault not corrected'},
 {id:'diagnostics',label:'Diagnostic tools',max:r.weights.diagnostics,earned:s.plcRead?r.weights.diagnostics:0,reason:s.plcRead?'PLC inputs inspected':'PLC diagnostics not used'},
 {id:'verification',label:'Functional verification',max:r.weights.verification,earned:s.verified?r.weights.verification:0,reason:s.verified?'Motor running and diagnostics verified':'Functional verification incomplete'},
 {id:'safety',label:'Safe work procedure',max:r.weights.safety,earned:s.unsafeAttempts===0?r.weights.safety:0,reason:s.unsafeAttempts===0?'No unsafe attempted actions':`${s.unsafeAttempts} unsafe attempted action(s)`},
 {id:'process',label:'Process discipline',max:r.weights.process,earned:s.inspected&&s.plcRead&&s.repaired&&s.verified?r.weights.process:0,reason:'Complete inspection, diagnostics, repair and verification'}];
 const score=criteria.reduce((n,c)=>n+c.earned,0);return {score,max:criteria.reduce((n,c)=>n+c.max,0),passed:score>=r.passMark&&s.unsafeAttempts<=r.criticalSafetyLimit&&s.verified,criteria,safetyHold:s.unsafeAttempts>r.criticalSafetyLimit};
}
