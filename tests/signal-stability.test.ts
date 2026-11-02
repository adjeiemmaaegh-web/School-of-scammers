import {describe,it,expect} from 'vitest';
import {checkSignalStability,stabilityCsv,type StabilityRule} from '../src/engineering/signal-stability';
import type {LadderDocument} from '../src/engineering/ladder';
const doc:LadderDocument={id:'stability-demo',version:'1',rungs:[{id:'q',elements:[{type:'contact',tag:'A'}],coil:'Q'}]};
const rule:StabilityRule={id:'hold',signal:'Q',value:true,minScans:3};
describe('signal stability',()=>{
 it('passes a three-scan stable output',()=>{const r=checkSignalStability(doc,[{scans:3,inputs:{A:true}}],[rule]);expect(r.met).toBe(1);expect(r.passed).toBe(true);});
 it('flags a premature falling edge',()=>{const r=checkSignalStability(doc,[{scans:1,inputs:{A:true}},{scans:1,inputs:{A:false}}],[rule]);expect(r.glitches).toBe(1);expect(r.passed).toBe(false);});
 it('does not mistake a truncated observation for success',()=>{const r=checkSignalStability(doc,[{scans:2,inputs:{A:true}}],[rule]);expect(r.pending).toBe(1);expect(r.complete).toBe(false);});
 it('rearms on another rising edge',()=>{const r=checkSignalStability(doc,[{scans:3,inputs:{A:true}},{scans:1,inputs:{A:false}},{scans:3,inputs:{A:true}}],[rule]);expect(r.met).toBe(2);});
 it('supports an external trigger and reports an absent response',()=>{const r=checkSignalStability(doc,[{scans:1,inputs:{A:true}}],[{...rule,signal:'Missing',trigger:'A',triggerValue:true}]);expect(r.glitches).toBe(1);});
 it('rejects invalid duration',()=>expect(()=>checkSignalStability(doc,[{scans:1,inputs:{A:true}}],[{...rule,minScans:1}])).toThrow());
 it('exports CSV evidence',()=>expect(stabilityCsv(checkSignalStability(doc,[{scans:3,inputs:{A:true}}],[rule]))).toContain('required_scans'));
});
