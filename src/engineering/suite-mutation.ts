/** Bounded mutation campaign across independent, reviewed regression cases. */
import {generateLadderMutants} from './ladder-mutation';
import {runLadderSequence} from './ladder-sequences';
import type {LadderDocument} from './ladder';
import type {RegressionCase} from './regression-suite';
export type SuiteMutationRow={id:string;rungId:string;description:string;detected:boolean;detectedBy:string[];firstFailingStep:number|null};
export type SuiteMutationReport={total:number;detected:number;survived:number;scorePercent:number;rows:SuiteMutationRow[];caseContributions:{id:string;detected:number;unique:number}[];simulatedScans:number;truncated:boolean;warnings:string[]};
/** The candidate must pass every independently asserted baseline case before mutations are scored. */
export function assessSuiteMutations(doc:LadderDocument,cases:readonly RegressionCase[],deltaMs=20,maxScanWork=150000):SuiteMutationReport{
 if(!Array.isArray(cases)||cases.length<1||cases.length>20)throw RangeError('Provide 1..20 regression cases');
 if(!Number.isSafeInteger(maxScanWork)||maxScanWork<1||maxScanWork>1000000)throw RangeError('Invalid scan-work budget');
 const ids=new Set<string>();let scans=0;let assertions=0;
 for(const c of cases){
  if(!c||typeof c.id!=='string'||!/^[A-Za-z][\w-]{0,63}$/.test(c.id)||ids.has(c.id))throw Error('Invalid or duplicate case ID');
  ids.add(c.id);
  assertions+=c.steps?.reduce((sum,s)=>sum+Object.keys(s.expect??{}).length,0)??0;
  const result=runLadderSequence(doc,c.steps,deltaMs);scans+=result.totalScans;
  if(!result.passed)throw Error(`Baseline case ${c.id} fails expected-output assertions`);
 }
 if(!assertions)throw Error('At least one independently reviewed expected-output assertion is required');
 if(scans>maxScanWork)throw RangeError('Baseline exceeds mutation scan-work budget');
 const mutants=generateLadderMutants(doc);const rows:SuiteMutationRow[]=[];
 let truncated=false;
 for(const m of mutants){
  // Reserve the full baseline scan cost per mutant, so no partial mutant can be misclassified.
  if(scans+cases.reduce((n,c)=>n+c.steps.reduce((k,s)=>k+s.scans,0),0)>maxScanWork){truncated=true;break;}
  const detectedBy:string[]=[];let firstFailingStep:number|null=null;
  for(const c of cases){
   const result=runLadderSequence(m.document,c.steps,deltaMs);scans+=result.totalScans;
   const failed=result.rows.find(r=>!r.passed);
   if(failed){detectedBy.push(c.id);if(firstFailingStep===null)firstFailingStep=failed.step;}
  }
  rows.push({id:m.id,rungId:m.rungId,description:m.description,detected:detectedBy.length>0,detectedBy,firstFailingStep});
 }
 const detected=rows.filter(r=>r.detected).length;
 return {total:rows.length,detected,survived:rows.length-detected,scorePercent:rows.length?Math.round(detected/rows.length*10000)/100:0,rows,caseContributions:cases.map(c=>({id:c.id,detected:rows.filter(r=>r.detectedBy.includes(c.id)).length,unique:rows.filter(r=>r.detectedBy.length===1&&r.detectedBy[0]===c.id).length})),simulatedScans:scans,truncated,warnings:[truncated?'Mutation campaign stopped at scan-work budget; score covers evaluated mutants only.':'All generated mutants evaluated.', 'Mutation score is an educational test-quality indicator, not a safety or correctness guarantee.']};
}
export function suiteMutationCsv(report:SuiteMutationReport):string{
 const q=(v:unknown)=>`"${String(v).replace(/"/g,'""')}"`;
 return [['mutant','rung','description','detected','detected_by','first_failing_step'],...report.rows.map(r=>[r.id,r.rungId,r.description,r.detected,r.detectedBy.join(';'),r.firstFailingStep??''])].map(row=>row.map(q).join(',')).join('\r\n');
}
