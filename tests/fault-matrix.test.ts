import {describe,it,expect} from 'vitest';
import {runFaultMatrix,faultMatrixCsv} from '../src/engineering/fault-matrix';
const doc={id:'matrix',version:'1',rungs:[{id:'r1',elements:[{type:'contact' as const,tag:'Start'}],coil:'Motor'}]};
const steps=[{scans:2,inputs:{Start:false}},{scans:2,inputs:{Start:true}}];
describe('input fault matrix',()=>{
 it('generates six scenarios per input',()=>expect(runFaultMatrix(doc,steps,['Start']).cases).toHaveLength(6));
 it('detects output changes',()=>expect(runFaultMatrix(doc,steps,['Start']).detected).toBeGreaterThan(0));
 it('preserves source steps',()=>{const before=JSON.stringify(steps);runFaultMatrix(doc,steps,['Start']);expect(JSON.stringify(steps)).toBe(before)});
 it('rejects duplicate tags',()=>expect(()=>runFaultMatrix(doc,steps,['Start','Start'])).toThrow());
 it('rejects unassigned tags',()=>expect(()=>runFaultMatrix(doc,steps,['Missing'])).toThrow());
 it('exports CSV',()=>expect(faultMatrixCsv(runFaultMatrix(doc,steps,['Start']))).toContain('changed_scans'));
});
describe('fault matrix recovery evidence',()=>{
 it('reports post-fault differences and recovery',()=>{const rows=runFaultMatrix(doc,steps,['Start']).cases;expect(rows.every(r=>typeof r.postFaultDifferentScans==='number')).toBe(true);expect(rows.every(r=>typeof r.recoveredByEnd==='boolean')).toBe(true)});
 it('reports bounded impact duration',()=>{const rows=runFaultMatrix(doc,steps,['Start']).cases;expect(rows.every(r=>r.longestImpactScans>=0&&r.longestImpactScans<=4)).toBe(true)});
 it('exports recovery columns',()=>expect(faultMatrixCsv(runFaultMatrix(doc,steps,['Start']))).toContain('post_fault_changed_scans'));
});
