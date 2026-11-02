import {describe,it,expect} from 'vitest';
import {checkTemporalResponses,temporalResponseCsv,type ResponseRule} from '../src/engineering/temporal-response';
import type {LadderDocument} from '../src/engineering/ladder';
const doc:LadderDocument={id:'response-demo',version:'1.0',rungs:[{id:'q',elements:[{type:'contact',tag:'A'}],coil:'Q'}]};
const rule:ResponseRule={id:'start',trigger:'A',triggerValue:true,response:'Q',responseValue:true,withinScans:0,edgeOnly:true};
describe('temporal response checker',()=>{
 it('meets immediate response at same scan',()=>{const r=checkTemporalResponses(doc,[{scans:2,inputs:{A:true}}],[rule]);expect(r.met).toBe(1);expect(r.passed).toBe(true);});
 it('records late deadline',()=>{const r=checkTemporalResponses(doc,[{scans:1,inputs:{A:true}}],[{...rule,responseValue:false}]);expect(r.late).toBe(1);expect(r.passed).toBe(false);});
 it('distinguishes pending from passing',()=>{const r=checkTemporalResponses(doc,[{scans:1,inputs:{A:true}}],[{...rule,responseValue:false,withinScans:3}]);expect(r.pending).toBe(1);expect(r.complete).toBe(false);});
 it('re-arms after trigger goes false',()=>{const r=checkTemporalResponses(doc,[{scans:1,inputs:{A:true}},{scans:1,inputs:{A:false}},{scans:1,inputs:{A:true}}],[rule]);expect(r.met).toBe(2);});
 it('rejects invalid deadlines',()=>expect(()=>checkTemporalResponses(doc,[{scans:1,inputs:{A:true}}],[{...rule,withinScans:-1}])).toThrow());
 it('exports CSV',()=>expect(temporalResponseCsv(checkTemporalResponses(doc,[{scans:1,inputs:{A:true}}],[rule]))).toContain('trigger_scan'));
});
