import {describe,it,expect} from 'vitest';
import {analyzeSequenceCoverage,sequenceCoverageCsv} from '../src/engineering/sequence-coverage';
const doc={id:'coverage',version:'1',rungs:[{id:'r1',elements:[{type:'contact' as const,tag:'Start'}],coil:'Motor'}]};
const steps=[{scans:2,inputs:{Start:false}},{scans:3,inputs:{Start:true}},{scans:1,inputs:{Start:false}}];
describe('sequential output coverage',()=>{
 it('counts every scan and both states',()=>{const r=analyzeSequenceCoverage(doc,steps);expect(r.totalScans).toBe(6);expect(r.rows[0].trueScans).toBe(3);expect(r.rows[0].falseScans).toBe(3);expect(r.rows[0].transitions).toBe(2);expect(r.branchCoveragePercent).toBe(100);});
 it('identifies unobserved output states',()=>{const r=analyzeSequenceCoverage(doc,[{scans:3,inputs:{Start:true}}]);expect(r.uncovered).toEqual(['r1: never OFF']);expect(r.branchCoveragePercent).toBe(0);});
 it('rejects output forcing and invalid scan budgets',()=>{expect(()=>analyzeSequenceCoverage(doc,[{scans:1,inputs:{Motor:true}}])).toThrow();expect(()=>analyzeSequenceCoverage(doc,[{scans:1001,inputs:{Start:true}}])).toThrow();});
 it('exports parseable CSV with scan counts',()=>{const csv=sequenceCoverageCsv(analyzeSequenceCoverage(doc,steps));expect(csv).toContain('"r1","Motor","3","3","2"');});
});
