import {describe,it,expect} from 'vitest';
import {runFaultMatrix,faultMatrixCsv} from '../src/engineering/fault-matrix';
const tags=['A','B','C','D','E','F','G','H'];
const doc={id:'balanced',version:'1',rungs:tags.map(tag=>({id:tag,elements:[{type:'contact' as const,tag}],coil:`Out${tag}`}))};
const steps=[{scans:2,inputs:Object.fromEntries(tags.map(tag=>[tag,false]))}];
describe('capped campaign input coverage',()=>{
 it('covers every selected tag with default cap',()=>{const m=runFaultMatrix(doc,steps,tags);expect(m.cases).toHaveLength(24);expect(m.plannedCases).toBe(48);expect(m.evaluatedTags).toEqual(tags);expect(m.omittedTags).toEqual([])});
 it('spreads a smaller cap across distinct tags',()=>{const m=runFaultMatrix(doc,steps,tags,3);expect(m.evaluatedTags).toEqual(tags.slice(0,3));expect(m.omittedTags).toEqual(tags.slice(3));expect(m.truncated).toBe(true)});
 it('covers all three fault modes before repeating a window',()=>{const m=runFaultMatrix(doc,steps,tags);expect(m.evaluatedModes).toEqual(['stuck-on','stuck-off','invert'])});
 it('retains six cases per tag without truncation',()=>{const m=runFaultMatrix(doc,steps,['A']);expect(m.cases).toHaveLength(6);expect(m.truncated).toBe(false)});
 it('exports explicit evaluated and omitted tag metadata',()=>{const csv=faultMatrixCsv(runFaultMatrix(doc,steps,tags,3));expect(csv).toContain('omitted_tags');expect(csv).toContain('D;E;F;G;H')});
});
