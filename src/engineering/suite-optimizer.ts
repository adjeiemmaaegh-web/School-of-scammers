/** Greedy set-cover reduction of reviewed regression cases, based on completed mutation evidence. */
import type {RegressionCase} from './regression-suite';
import type {SuiteMutationReport} from './suite-mutation';
export type SuiteOptimization={selectedIds:string[];removedIds:string[];coveredMutantIds:string[];uncoveredMutantIds:string[];originalCases:number;selectedCases:number;preservedDetections:number;warnings:string[]};
export function optimizeRegressionSuite(cases:readonly RegressionCase[],report:SuiteMutationReport):SuiteOptimization{
 if(!Array.isArray(cases)||cases.length<1||cases.length>20)throw RangeError('Expected 1..20 cases');
 if(!report||!Array.isArray(report.rows)||report.truncated)throw Error('A complete mutation campaign is required before optimizing');
 const ids=cases.map(c=>c?.id);
 if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw Error('Invalid or duplicate case IDs');
 const known=new Set(ids);const detected=report.rows.filter(r=>r.detected);
 if(detected.some(r=>!Array.isArray(r.detectedBy)||!r.detectedBy.length||r.detectedBy.some(id=>!known.has(id))))throw Error('Mutation evidence does not match these cases');
 if(new Set(report.rows.map(r=>r.id)).size!==report.rows.length)throw Error('Duplicate mutation evidence');
 const uncovered=new Set(detected.map(r=>r.id));const selected:string[]=[];
 while(uncovered.size){
  let best:string|undefined;let bestGain=0;
  for(const id of ids){if(selected.includes(id))continue;
   const gain=detected.filter(r=>uncovered.has(r.id)&&r.detectedBy.includes(id)).length;
   if(gain>bestGain){best=id;bestGain=gain;}
  }
  if(!best||!bestGain)throw Error('Inconsistent mutation detection evidence');
  selected.push(best);
  for(const r of detected)if(r.detectedBy.includes(best))uncovered.delete(r.id);
 }
 // If no mutants were detected, retain one reviewed case rather than generating an empty suite.
 if(!selected.length)selected.push(ids[0]);
 const chosen=new Set(selected);
 return {selectedIds:selected,removedIds:ids.filter(id=>!chosen.has(id)),coveredMutantIds:detected.map(r=>r.id),uncoveredMutantIds:report.rows.filter(r=>!r.detected).map(r=>r.id),originalCases:ids.length,selectedCases:selected.length,preservedDetections:detected.length,warnings:['Greedy set cover preserves observed mutation detections only; it does not preserve every behavioral requirement or guarantee a mathematically minimum suite.','Review removed cases before applying. Undetected mutants remain undetected.']};
}
export function suiteOptimizationCsv(result:SuiteOptimization):string{
 const q=(x:unknown)=>`"${String(x).replace(/"/g,'""')}"`;
 return [['case','status'],...result.selectedIds.map(id=>[id,'keep']),...result.removedIds.map(id=>[id,'suggest_remove'])].map(row=>row.map(q).join(',')).join('\r\n');
}
