import {describe,it,expect} from 'vitest';
import {analyzeConditionIndependence,conditionIndependenceCsv} from '../src/engineering/condition-independence';
import type {LadderDocument} from '../src/engineering/ladder';
const andDoc:LadderDocument={id:'and',version:'1',rungs:[{id:'r1',elements:[{type:'contact',tag:'A'},{type:'contact',tag:'B'}],coil:'Y'}]};
const steps=[{scans:1,inputs:{A:false,B:true}},{scans:1,inputs:{A:true,B:true}},{scans:1,inputs:{A:true,B:false}}];
describe('unique-cause condition independence',()=>{
 it('credits independent effects for both AND conditions',()=>{const r=analyzeConditionIndependence(andDoc,steps);expect(r.covered).toBe(2);expect(r.rows.every(x=>x.firstScan!==x.secondScan)).toBe(true);});
 it('does not credit toggles that never affect the output',()=>expect(analyzeConditionIndependence(andDoc,[{scans:1,inputs:{A:false,B:false}},{scans:1,inputs:{A:true,B:false}}]).covered).toBe(0));
 it('excludes stateful instructions',()=>expect(analyzeConditionIndependence({...andDoc,rungs:[{...andDoc.rungs[0],operation:{kind:'ton',presetMs:40}}]},steps).excluded).toHaveLength(1));
 it('excludes internal feedback',()=>expect(analyzeConditionIndependence({...andDoc,rungs:[{...andDoc.rungs[0],elements:[{type:'contact',tag:'Y'}]}]},steps).excluded).toHaveLength(1));
 it('rejects forcing coil outputs',()=>expect(()=>analyzeConditionIndependence(andDoc,[{scans:1,inputs:{Y:true}}])).toThrow());
 it('exports scan evidence',()=>expect(conditionIndependenceCsv(analyzeConditionIndependence(andDoc,steps))).toContain('Observed unique-cause'));
});
