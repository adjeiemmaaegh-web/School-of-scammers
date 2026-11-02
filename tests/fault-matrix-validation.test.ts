import {describe,it,expect} from 'vitest';
import {runFaultMatrix,faultMatrixCsv} from '../src/engineering/fault-matrix';
import type {LadderDocument} from '../src/engineering/ladder';
const doc:LadderDocument={id:'fault-matrix-validation',version:'1',rungs:[{id:'r1',elements:[{type:'contact',tag:'Start',normallyClosed:false}],coil:'Run'}]};
const steps=[{scans:3,inputs:{Start:false},expect:{Run:false}},{scans:3,inputs:{Start:true},expect:{Run:true}}];
describe('fault matrix completeness and input validation',()=>{
 it('identifies capped scenarios rather than implying complete coverage',()=>{const r=runFaultMatrix(doc,steps,['Start'],2);expect(r.plannedCases).toBe(6);expect(r.cases).toHaveLength(2);expect(r.truncated).toBe(true);expect(r.baselinePassed).toBe(true);expect(faultMatrixCsv(r)).toContain('planned_cases');});
 it('reports complete campaigns accurately',()=>{const r=runFaultMatrix(doc,steps,['Start'],6);expect(r.cases).toHaveLength(6);expect(r.truncated).toBe(false);});
 it('rejects unknown input tags',()=>expect(()=>runFaultMatrix(doc,steps,['Typo'])).toThrow(/Unknown external PLC input/));
 it('rejects output tags as fault inputs',()=>expect(()=>runFaultMatrix(doc,steps,['Run'])).toThrow(/Unknown external PLC input/));
 it('rejects failing baseline expectations',()=>expect(()=>runFaultMatrix(doc,[{scans:1,inputs:{Start:false},expect:{Run:true}}],['Start'])).toThrow(/Baseline sequence assertions/));
 it('rejects invalid step maps before expanding scans',()=>expect(()=>runFaultMatrix(doc,[{scans:1,inputs:{Start:'yes' as unknown as boolean}}],['Start'])).toThrow(/invalid signal/));
});
