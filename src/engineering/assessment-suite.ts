import {diagnoses,setupFault,repairFault,recordObservation,startDiagnosis,submitDiagnosis,type FaultId,type DiagnosisRecord} from './diagnostics';
import {stepWorkcell,type WorkcellState} from './workcell';

/** A reproducible, local-only examination. No wall-clock or server dependency. */
export type AttemptPhase='investigate'|'repair'|'complete';
export type AssessmentAttempt={id:string;scenario:FaultId;phase:AttemptPhase;machine:WorkcellState;record:DiagnosisRecord;startedScan:number;inspectionCount:number;preRepairObservations:number;postRepairObservations:number;repairScan:number|null;repairCount:number;unsafeRepairAttempts:number;hintsUsed:number;report:AssessmentReport|null};
export type AssessmentReport={schema:1;scenario:FaultId;title:string;passed:boolean;score:number;maximum:number;criteria:readonly {id:string;label:string;earned:number;maximum:number;reason:string}[];scanCount:number;observations:readonly string[];diagnosisAttempts:number;repairCount:number;unsafeRepairAttempts:number;hintsUsed:number;limitations:string};
const find=(id:FaultId)=>{const d=diagnoses.find(x=>x.id===id);if(!d)throw Error('Unknown assessment scenario');return d;};
export function createAssessment(id:FaultId):AssessmentAttempt {find(id);const machine=setupFault(id);return {id:`${id}-${machine.scan}`,scenario:id,phase:'investigate',machine,record:startDiagnosis(id,machine),startedScan:machine.scan,inspectionCount:0,preRepairObservations:0,postRepairObservations:0,repairScan:null,repairCount:0,unsafeRepairAttempts:0,hintsUsed:0,report:null};}
export function advanceAssessment(a:AssessmentAttempt,scans=1):AssessmentAttempt {if(a.phase==='complete')return a;if(!Number.isSafeInteger(scans)||scans<1||scans>500)throw Error('Scan count out of range');let machine=a.machine;for(let i=0;i<scans;i++)machine=stepWorkcell(machine,'tick');return {...a,machine};}
export function observeAssessment(a:AssessmentAttempt):AssessmentAttempt {if(a.phase==='complete')return a;const record=recordObservation(a.record,a.machine);const fresh=record.observations.length>a.record.observations.length?1:0;return {...a,record,inspectionCount:a.inspectionCount+fresh,preRepairObservations:a.preRepairObservations+(a.repairCount===0?fresh:0),postRepairObservations:a.postRepairObservations+(a.repairCount>0?fresh:0)};}
export function hintAssessment(a:AssessmentAttempt):AssessmentAttempt {return a.phase==='complete'?a:{...a,hintsUsed:a.hintsUsed+1};}
export function isolateAssessment(a:AssessmentAttempt):AssessmentAttempt {return a.phase==='complete'?a:{...a,machine:stepWorkcell(a.machine,'isolate-power')};}
export function repairAssessment(a:AssessmentAttempt):AssessmentAttempt {if(a.phase==='complete')return a;if(a.machine.powerOn)return {...a,unsafeRepairAttempts:a.unsafeRepairAttempts+1};if(a.preRepairObservations===0)return a;const machine=repairFault(a.machine,a.scenario);return {...a,machine,repairScan:machine.scan,phase:'repair',repairCount:a.repairCount+1};}
export function gradeAssessment(a:AssessmentAttempt,cause:FaultId):AssessmentAttempt {if(a.phase==='complete')return a;find(cause);const record=submitDiagnosis(a.record,a.machine,cause);const verified=record.verified&&a.preRepairObservations>0&&a.postRepairObservations>0&&a.repairScan!==null;const criteria=[
{id:'evidence',label:'Fresh PLC observation',earned:a.preRepairObservations>0&&a.postRepairObservations>0?20:0,maximum:20,reason:a.preRepairObservations>0&&a.postRepairObservations>0?'Captured before-and-after repair scans':'Missing pre-repair or post-repair evidence'},
{id:'diagnosis',label:'Correct root cause',earned:cause===a.scenario?25:0,maximum:25,reason:cause===a.scenario?'Cause matches injected fault':'Selected cause does not match fault'},
{id:'repair',label:'Verified equipment repair',earned:verified?30:0,maximum:30,reason:verified?'Fault cleared with post-repair observation':'Fault remains, or post-repair verification is missing'},
{id:'safety',label:'Isolation discipline',earned:a.unsafeRepairAttempts===0&&a.repairCount>0?15:0,maximum:15,reason:a.unsafeRepairAttempts===0&&a.repairCount>0?'Repair initiated under simulated isolation':'Unsafe attempt or no repair'},
{id:'method',label:'Diagnostic efficiency',earned:a.hintsUsed===0&&record.attempts===1?10:a.hintsUsed<=1&&record.attempts<=2?5:0,maximum:10,reason:`${a.hintsUsed} hints; ${record.attempts} submission(s)`}
];const score=criteria.reduce((s,c)=>s+c.earned,0);const passed=verified&&score>=80&&a.unsafeRepairAttempts===0;const report:AssessmentReport={schema:1,scenario:a.scenario,title:find(a.scenario).title,passed,score,maximum:100,criteria,scanCount:a.machine.scan-a.startedScan,observations:[...record.observations],diagnosisAttempts:record.attempts,repairCount:a.repairCount,unsafeRepairAttempts:a.unsafeRepairAttempts,hintsUsed:a.hintsUsed,limitations:'Educational deterministic simulation. Not a safety qualification or verified industrial competency.'};return {...a,record,phase:'complete',report};}
export function summarizeReports(reports:readonly AssessmentReport[]){const latest=new Map<FaultId,AssessmentReport>();for(const report of reports){find(report.scenario);latest.set(report.scenario,report);}const values=[...latest.values()];return {completed:values.length,total:diagnoses.length,passed:values.filter(x=>x.passed).length,average:values.length?Math.round(values.reduce((s,x)=>s+x.score,0)/values.length):0,bySystem:diagnoses.reduce<Record<string,{total:number;completed:number;passed:number}>>((acc,d)=>{const v=acc[d.system]??{total:0,completed:0,passed:0};v.total++;if(latest.has(d.id))v.completed++;if(latest.get(d.id)?.passed)v.passed++;acc[d.system]=v;return acc;},{})};}
const criterionLimits:Readonly<Record<string,number>>={evidence:20,diagnosis:25,repair:30,safety:15,method:10};
function validCriterion(raw:unknown):raw is AssessmentReport['criteria'][number]{if(!raw||typeof raw!=='object')return false;const c=raw as Record<string,unknown>;return typeof c.id==='string'&&Object.hasOwn(criterionLimits,c.id)&&c.maximum===criterionLimits[c.id]&&typeof c.earned==='number'&&Number.isInteger(c.earned)&&c.earned>=0&&c.earned<=c.maximum&&typeof c.label==='string'&&c.label.length<=200&&typeof c.reason==='string'&&c.reason.length<=500;}
export function validateReport(raw:unknown):raw is AssessmentReport {
 if(!raw||typeof raw!=='object')return false;
 const x=raw as Partial<AssessmentReport>;
 if(x.schema!==1||typeof x.scenario!=='string'||!diagnoses.some(d=>d.id===x.scenario)||typeof x.title!=='string'||x.title.length>200||typeof x.limitations!=='string'||x.limitations.length>1000||typeof x.passed!=='boolean'||x.maximum!==100)return false;
 if(!Array.isArray(x.criteria)||x.criteria.length!==5||!x.criteria.every(validCriterion)||new Set(x.criteria.map(c=>c.id)).size!==5)return false;
 if(typeof x.score!=='number'||!Number.isInteger(x.score)||x.score!==x.criteria.reduce((n,c)=>n+c.earned,0))return false;
 if(!Array.isArray(x.observations)||x.observations.length>25||!x.observations.every(y=>typeof y==='string'&&y.length<=500))return false;
 for(const n of [x.scanCount,x.diagnosisAttempts,x.repairCount,x.unsafeRepairAttempts,x.hintsUsed])if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>1000000)return false;
 if(x.passed&&(x.score<80||x.unsafeRepairAttempts!==0||x.criteria.find(c=>c.id==='repair')?.earned!==30))return false;
 return true;
}
export function parsePortfolio(raw:string):AssessmentReport[]{
 if(raw.length>300000)throw Error('Portfolio exceeds maximum size');
 const parsed:unknown=JSON.parse(raw);
 if(!Array.isArray(parsed)||parsed.length>100||!parsed.every(validateReport))throw Error('Invalid portfolio');
 const seen=new Set<string>();for(const report of parsed){if(seen.has(report.scenario))throw Error('Duplicate scenario in portfolio');seen.add(report.scenario);}
 return parsed;
}
