/** Deterministic bounded reduction of a PLC regression counterexample. */
import {compareLadderPrograms,type DifferentialReport} from './ladder-differential';
import type {LadderDocument} from './ladder';
import type {VectorStep} from './ladder-sequences';
export type MinimizedRegression={steps:VectorStep[];report:DifferentialReport;originalSteps:number;originalScans:number;evaluations:number;targetOutput:string;warnings:string[]};
export function minimizeDifferential(reference:LadderDocument,candidate:LadderDocument,source:readonly VectorStep[],deltaMs=20,maxEvaluations=200):MinimizedRegression{
 if(!Number.isSafeInteger(maxEvaluations)||maxEvaluations<1||maxEvaluations>1000)throw RangeError('Evaluation budget must be 1..1000');
 const baseline=compareLadderPrograms(reference,candidate,source,deltaMs,1);
 if(!baseline.divergences.length)throw Error('No divergence to minimize');
 const target=baseline.divergences[0].tag;
 let evaluations=0;
 const test=(steps:VectorStep[]):DifferentialReport|null=>{
  if(evaluations>=maxEvaluations)return null;
  evaluations++;
  const result=compareLadderPrograms(reference,candidate,steps,deltaMs,1);
  return result.divergences.some(d=>d.tag===target)?result:null;
 };
 let steps=source.map(s=>({scans:s.scans,inputs:{...s.inputs}}));
 let chunk=Math.max(1,Math.floor(steps.length/2));
 while(chunk>=1&&evaluations<maxEvaluations){
  let reduced=false;
  for(let i=0;i<steps.length&&evaluations<maxEvaluations;i+=chunk){
   const candidateSteps=steps.filter((_,j)=>j<i||j>=i+chunk);
   if(!candidateSteps.length)continue;
   if(test(candidateSteps)){steps=candidateSteps;reduced=true;break;}
  }
  if(!reduced)chunk=Math.floor(chunk/2);
 }
 // Reduce scan durations, retaining the first observed output disagreement.
 for(let i=0;i<steps.length&&evaluations<maxEvaluations;i++){
  let low=1,high=steps[i].scans;
  while(low<high&&evaluations<maxEvaluations){
   const mid=Math.floor((low+high)/2);
   const trial=steps.map((s,j)=>j===i?{...s,scans:mid}:s);
   if(test(trial)){steps=trial;high=mid;}else low=mid+1;
  }
 }
 // Drop redundant input assignments, including inherited values when safe.
 for(let i=0;i<steps.length&&evaluations<maxEvaluations;i++){
  for(const tag of Object.keys(steps[i].inputs).sort()){
   if(evaluations>=maxEvaluations)break;
   const trial=steps.map(s=>({...s,inputs:{...s.inputs}}));
   delete trial[i].inputs[tag];
   if(test(trial))steps=trial;
  }
 }
 const report=compareLadderPrograms(reference,candidate,steps,deltaMs,250);
 if(!report.divergences.some(d=>d.tag===target))throw Error('Reduction failed to preserve target disagreement');
 return {steps,report,originalSteps:source.length,originalScans:baseline.scans,evaluations,targetOutput:target,warnings:['Reduced steps are a simulation counterexample, not a safety proof.','Removed input assignments inherit prior simulated values; review the reduced sequence before reuse.',...(evaluations>=maxEvaluations?['Evaluation budget reached; result may not be minimal.']:[])]};
}
