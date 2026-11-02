import {describe,it,expect} from 'vitest';
import {diagnoses,setupFault,repairFault,faultPresent,startDiagnosis,recordObservation,submitDiagnosis} from '../src/engineering/diagnostics';
import {stepWorkcell} from '../src/engineering/workcell';
describe('fault diagnosis laboratory',()=>{
 it('has ten unique scenarios',()=>expect(new Set(diagnoses.map(x=>x.id)).size).toBe(10));
 for(const scenario of diagnoses){it(`injects and repairs ${scenario.id}`,()=>{
  let state=setupFault(scenario.id);expect(faultPresent(state,scenario.id)).toBe(true);
  const rec=startDiagnosis(scenario.id,state);
  expect(submitDiagnosis(rec,state,scenario.id).verified).toBe(false);
  state=stepWorkcell(state,'tick');const observed=recordObservation(rec,state);
  expect(observed.observations).toHaveLength(1);
  state=stepWorkcell(state,'isolate-power');state=repairFault(state,scenario.id);
  expect(faultPresent(state,scenario.id)).toBe(false);
  expect(submitDiagnosis(observed,state,scenario.id).verified).toBe(true);
  expect(submitDiagnosis(observed,state,diagnoses.find(x=>x.id!==scenario.id)!.id).verified).toBe(false);
 });}
});
