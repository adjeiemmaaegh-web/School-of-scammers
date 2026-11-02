import {describe,it,expect} from 'vitest';
import {runFaultMatrix,faultMatrixCsv} from '../src/engineering/fault-matrix';
const doc={id:'assertions',version:'1',rungs:[{id:'r1',elements:[{type:'contact' as const,tag:'Start'}],coil:'Motor'}]};
describe('fault observability versus test detection',()=>{
 it('does not claim a test assertion caught output divergence when there are no assertions',()=>{const m=runFaultMatrix(doc,[{scans:2,inputs:{Start:false}},{scans:2,inputs:{Start:true}}],['Start']);expect(m.detected).toBeGreaterThan(0);expect(m.assertionFailures).toBe(0);expect(m.observableButNotAsserted).toBe(m.detected)});
 it('reports assertion failures separately when an expected output is violated',()=>{const m=runFaultMatrix(doc,[{scans:2,inputs:{Start:false},expect:{Motor:false}},{scans:2,inputs:{Start:true},expect:{Motor:true}}],['Start']);expect(m.assertionFailures).toBeGreaterThan(0);expect(m.cases.some(c=>c.assertionFailed&&c.failedCheckpoints>0)).toBe(true)});
 it('does not mutate test steps',()=>{const steps=[{scans:2,inputs:{Start:false},expect:{Motor:false}},{scans:2,inputs:{Start:true},expect:{Motor:true}}];const before=JSON.stringify(steps);runFaultMatrix(doc,steps,['Start']);expect(JSON.stringify(steps)).toBe(before)});
 it('includes separate assertion detection evidence in CSV',()=>{const csv=faultMatrixCsv(runFaultMatrix(doc,[{scans:2,inputs:{Start:false}}],['Start']));expect(csv).toContain('assertion_failed');expect(csv).toContain('failed_checkpoints')});
});
