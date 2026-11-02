import {describe,it,expect} from 'vitest';
import {checkSafetyInvariants,safetyReportCsv} from '../src/engineering/safety-invariants';
import {INSTRUCTION_EXERCISES} from '../src/engineering/instruction-lab';
import {SEQUENCE_EXAMPLES} from '../src/engineering/ladder-sequences';
const doc=INSTRUCTION_EXERCISES.find(x=>x.id==='conveyor-batch')!.program;
describe('scan invariant monitor',()=>{
 it('accepts valid interlock example',()=>{const r=checkSafetyInvariants(doc,SEQUENCE_EXAMPLES['start-stop'],[{id:'guard',kind:'requires',output:'RunLatch',input:'GuardClosed',equals:true}]);expect(r.passed).toBe(true)});
 it('detects violated interlock',()=>{const r=checkSafetyInvariants(doc,[{scans:2,inputs:{PowerOK:true,GuardClosed:true,SensorOK:true,Start:true,Stop:false}}],[{id:'bad',kind:'requires',output:'RunLatch',input:'GuardClosed',equals:false}]);expect(r.violations.length).toBeGreaterThan(0)});
 it('detects overlong energized duration once',()=>{const r=checkSafetyInvariants(doc,[{scans:5,inputs:{PowerOK:true,GuardClosed:true,SensorOK:true,Start:true,Stop:false}}],[{id:'duration',kind:'max-on-scans',output:'RunLatch',limit:2}]);expect(r.violations.filter(v=>v.rule==='duration')).toHaveLength(1)});
 it('rejects unknown output',()=>expect(()=>checkSafetyInvariants(doc,SEQUENCE_EXAMPLES['start-stop'],[{id:'bad',kind:'max-on-scans',output:'Missing',limit:1}])).toThrow());
 it('exports CSV',()=>{const r=checkSafetyInvariants(doc,SEQUENCE_EXAMPLES['start-stop'],[{id:'guard',kind:'requires',output:'RunLatch',input:'GuardClosed',equals:true}]);expect(safetyReportCsv(r)).toContain('rule')});
});
