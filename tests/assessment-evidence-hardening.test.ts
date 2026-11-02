import {describe,it,expect} from 'vitest';
import {diagnoses} from '../src/engineering/diagnostics';
import {createAssessment,advanceAssessment,observeAssessment,isolateAssessment,repairAssessment,gradeAssessment,parsePortfolio} from '../src/engineering/assessment-suite';
describe('assessment before/after evidence and import integrity',()=>{
 it.each(diagnoses)('passes $id only with independent pre/post evidence',({id})=>{let a=createAssessment(id);a=observeAssessment(advanceAssessment(a));a=isolateAssessment(a);a=repairAssessment(a);a=observeAssessment(advanceAssessment(a));a=gradeAssessment(a,id);expect(a.report?.passed).toBe(true);expect(a.report?.score).toBe(100);});
 it('rejects repairs without initial evidence',()=>{let a=isolateAssessment(createAssessment('fuse-open'));expect(repairAssessment(a).repairCount).toBe(0);});
 it('does not pass with only pre-repair evidence',()=>{let a=observeAssessment(advanceAssessment(createAssessment('fuse-open')));a=repairAssessment(isolateAssessment(a));a=gradeAssessment(a,'fuse-open');expect(a.report?.passed).toBe(false);});
 it('rejects tampered totals, duplicates and oversized payloads',()=>{let a=observeAssessment(advanceAssessment(createAssessment('fuse-open')));a=repairAssessment(isolateAssessment(a));a=observeAssessment(advanceAssessment(a));const report=gradeAssessment(a,'fuse-open').report!;expect(()=>parsePortfolio(JSON.stringify([{...report,score:99}]))).toThrow();expect(()=>parsePortfolio(JSON.stringify([report,report]))).toThrow();expect(()=>parsePortfolio(' '.repeat(300001))).toThrow();});
});
