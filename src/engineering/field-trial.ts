/** Anonymous, self-declared field trial notes. Validation verifies file shape,
 * not that independent humans or physical safety tests took place.
 */
export type TrialRole='instructor'|'learner';
export type TrialRating=1|2|3|4|5;
export type TrialEvidence={
 format:'plc-skills-lab-anonymous-trial';schemaVersion:1;role:TrialRole;
 scenario:string;completed:boolean;diagnosisCorrect:boolean;isolationObserved:boolean;
 rating:TrialRating;minutes:number;notes:string;declaredIndependent:boolean;
};
const scenarios=new Set(['conveyor-start','ladder-motor','sensor-wiring','starter-faults','sorter-commission','tank-level','dc-network','pneumatics','scene-composer']);
export const TRIAL_SCENARIOS=Object.freeze([...scenarios]);
export function validateTrialEvidence(input:unknown):TrialEvidence{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid trial record');
 const x=input as Record<string,unknown>;
 if(x.format!=='plc-skills-lab-anonymous-trial'||x.schemaVersion!==1||!['learner','instructor'].includes(String(x.role))||!scenarios.has(String(x.scenario)))throw Error('Unsupported trial identity or scenario');
 for(const key of ['completed','diagnosisCorrect','isolationObserved','declaredIndependent'])
  if(typeof x[key]!=='boolean')throw Error('Invalid observation '+key);
 if(!Number.isSafeInteger(x.rating)||Number(x.rating)<1||Number(x.rating)>5||!Number.isSafeInteger(x.minutes)||Number(x.minutes)<1||Number(x.minutes)>240)throw Error('Invalid trial rating or duration');
 if(typeof x.notes!=='string'||x.notes.length>350||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x.notes))throw Error('Invalid notes');
 return {format:'plc-skills-lab-anonymous-trial',schemaVersion:1,role:x.role as TrialRole,scenario:x.scenario as string,
  completed:x.completed as boolean,diagnosisCorrect:x.diagnosisCorrect as boolean,isolationObserved:x.isolationObserved as boolean,
  rating:x.rating as TrialRating,minutes:x.minutes as number,notes:x.notes as string,declaredIndependent:x.declaredIndependent as boolean};
}
export function parseTrialPortfolio(text:string):TrialEvidence[]{
 if(typeof text!=='string'||text.length>50000)throw RangeError('Trial portfolio exceeds 50 KB');
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw Error('Invalid trial evidence JSON');}
 if(!Array.isArray(raw)||raw.length>50)throw Error('Trial evidence requires a list of at most 50 records');
 return raw.map(validateTrialEvidence);
}
export function trialSummary(rows:readonly TrialEvidence[]){
 const records=rows.map(validateTrialEvidence);
 const independentDeclared=records.filter(x=>x.declaredIndependent).length;
 const completed=records.filter(x=>x.completed).length;
 const accurate=records.filter(x=>x.diagnosisCorrect).length;
 const isolation=records.filter(x=>x.isolationObserved).length;
 const rating=records.length?records.reduce((sum,x)=>sum+x.rating,0)/records.length:0;
 return {trials:records.length,instructors:records.filter(x=>x.role==='instructor').length,
  learners:records.filter(x=>x.role==='learner').length,independentDeclared,completed,accurate,isolation,meanRating:Math.round(rating*100)/100,
  verifiedIndependent:false as const};
}
