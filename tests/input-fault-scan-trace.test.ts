import {describe,it,expect} from 'vitest';
import {traceInputFaultScans,scanFaultTraceCsv} from '../src/engineering/input-fault-scan-trace';
import {SEQUENCE_EXAMPLES} from '../src/engineering/ladder-sequences';
const doc={id:'fault-trace-test',version:'1',rungs:[{id:'start',elements:[{type:'contact' as const,tag:'Start'}],coil:'RunLatch'}]};
const steps=SEQUENCE_EXAMPLES['start-stop'];
describe('per-scan fault observation',()=>{
 it('detects the first altered scan',()=>{const r=traceInputFaultScans(doc,steps,{tag:'Start',startScan:2,durationScans:1,mode:'stuck-off'});expect(r.firstDifferenceScan).toBe(2);expect(r.differentScans).toBeGreaterThan(0)});
 it('preserves source sequence',()=>{const before=JSON.stringify(steps);traceInputFaultScans(doc,steps,{tag:'Start',startScan:2,durationScans:1,mode:'stuck-off'});expect(JSON.stringify(steps)).toBe(before)});
 it('reports no differences for a no-op fault',()=>{const r=traceInputFaultScans(doc,steps,{tag:'Start',startScan:1,durationScans:1,mode:'stuck-off'});expect(r.differentScans).toBe(0)});
 it('rejects invalid evidence cap',()=>expect(()=>traceInputFaultScans(doc,steps,{tag:'Start',startScan:2,durationScans:1,mode:'invert'},0)).toThrow());
 it('exports CSV',()=>expect(scanFaultTraceCsv(traceInputFaultScans(doc,steps,{tag:'Start',startScan:2,durationScans:1,mode:'stuck-off'}))).toContain('baseline_inputs'));
});
