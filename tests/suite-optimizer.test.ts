import {describe,it,expect} from 'vitest';
import {optimizeRegressionSuite,suiteOptimizationCsv} from '../src/engineering/suite-optimizer';
import type {RegressionCase} from '../src/engineering/regression-suite';
import type {SuiteMutationReport} from '../src/engineering/suite-mutation';
const cases=[{id:'A',steps:[]},{id:'B',steps:[]},{id:'C',steps:[]} ] as RegressionCase[];
const report={truncated:false,rows:[{id:'m1',detected:true,detectedBy:['A','B']},{id:'m2',detected:true,detectedBy:['B']},{id:'m3',detected:false,detectedBy:[]}]} as SuiteMutationReport;
describe('regression suite optimizer',()=>{
 it('retains all detected mutants with fewer cases',()=>{const r=optimizeRegressionSuite(cases,report);expect(r.selectedIds).toEqual(['B']);expect(r.removedIds).toEqual(['A','C']);expect(r.preservedDetections).toBe(2);});
 it('rejects truncated evidence',()=>expect(()=>optimizeRegressionSuite(cases,{...report,truncated:true})).toThrow());
 it('rejects mismatched case evidence',()=>expect(()=>optimizeRegressionSuite(cases,{...report,rows:[{...report.rows[0],detectedBy:['unknown']}]})).toThrow());
 it('keeps one case if no mutation is detected',()=>expect(optimizeRegressionSuite(cases,{...report,rows:[]}).selectedIds).toEqual(['A']));
 it('exports a case review CSV',()=>expect(suiteOptimizationCsv(optimizeRegressionSuite(cases,report))).toContain('suggest_remove'));
});
