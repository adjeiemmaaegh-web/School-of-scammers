import {describe,it,expect} from 'vitest';
import {validateTrialEvidence,parseTrialPortfolio,trialSummary} from '../src/engineering/field-trial';
const record={format:'plc-skills-lab-anonymous-trial',schemaVersion:1,role:'instructor',scenario:'starter-faults',completed:true,diagnosisCorrect:true,isolationObserved:true,rating:4,minutes:35,notes:'Reviewed fault recovery',declaredIndependent:true};
describe('anonymous real-human study evidence contract',()=>{
 it('retains only known validated fields and never infers independent verification',()=>{
  const r=validateTrialEvidence({...record,privateEmail:'do-not-copy'});
  expect(r).not.toHaveProperty('privateEmail');
  expect(trialSummary([r])).toMatchObject({trials:1,instructors:1,independentDeclared:1,verifiedIndependent:false});
 });
 it('rejects inconsistent score, duration, unsupported scenarios and oversized notes',()=>{
  for(const invalid of [{...record,rating:6},{...record,minutes:0},{...record,scenario:'pretend'}, {...record,notes:'x'.repeat(351)}])expect(()=>validateTrialEvidence(invalid)).toThrow();
 });
 it('round trips actual supplied evidence and counts only supplied observations',()=>{
  const validated=validateTrialEvidence(record);
  expect(parseTrialPortfolio(JSON.stringify([record]))).toEqual([validated]);
  const s=trialSummary([validated,validateTrialEvidence({...record,role:'learner',completed:false,declaredIndependent:false})]);
  expect(s).toMatchObject({trials:2,instructors:1,learners:1,completed:1,independentDeclared:1,verifiedIndependent:false});
  expect(trialSummary([])).toMatchObject({trials:0,meanRating:0,verifiedIndependent:false});
 });
 it('rejects oversized and unstructured imports without inventing participants',()=>{
  expect(()=>parseTrialPortfolio('x'.repeat(50001))).toThrow(/50 KB/);
  expect(()=>parseTrialPortfolio('{}')).toThrow(/at most 50/);
  expect(()=>parseTrialPortfolio('invalid json')).toThrow(/JSON/);
 });
});
