import {describe,it,expect} from 'vitest';
import {diagnoses} from '../src/engineering/diagnostics';
import {createAssessment,advanceAssessment,observeAssessment,isolateAssessment,repairAssessment,gradeAssessment,summarizeReports,parsePortfolio} from '../src/engineering/assessment-suite';
describe('full local assessment suite',()=>{
 it.each(diagnoses)('completes $id with real scan evidence',({id})=>{let a=createAssessment(id);a=advanceAssessment(a,2);a=observeAssessment(a);a=isolateAssessment(a);a=repairAssessment(a);a=advanceAssessment(a);a=observeAssessment(a);a=gradeAssessment(a,id);expect(a.report?.passed).toBe(true);expect(a.report?.score).toBe(100);expect(parsePortfolio(JSON.stringify([a.report]))).toHaveLength(1);});
 it('rejects unobserved attempts',()=>{let a=createAssessment('fuse-open');a=isolateAssessment(a);a=repairAssessment(a);a=gradeAssessment(a,'fuse-open');expect(a.report?.passed).toBe(false);});
 it('penalizes unsafe attempts and cannot pass',()=>{let a=createAssessment('overload');a=repairAssessment(a);a=advanceAssessment(a);a=observeAssessment(a);a=isolateAssessment(a);a=repairAssessment(a);a=gradeAssessment(a,'overload');expect(a.report?.passed).toBe(false);expect(a.report?.unsafeRepairAttempts).toBe(1);});
 it('prevents post-submission mutation',()=>{let a=createAssessment('belt-slip');a=gradeAssessment(a,'belt-slip');expect(advanceAssessment(a)).toEqual(a);expect(repairAssessment(a)).toEqual(a);});
 it('rejects invalid import',()=>{expect(()=>parsePortfolio('[{"scenario":"fuse-open"}]')).toThrow();expect(()=>parsePortfolio('{}')).toThrow();});
 it('aggregates latest report per scenario',()=>{let a=createAssessment('fuse-open');a=gradeAssessment(a,'fuse-open');const s=summarizeReports([a.report!,a.report!]);expect(s.completed).toBe(1);expect(s.total).toBe(10);});
});
