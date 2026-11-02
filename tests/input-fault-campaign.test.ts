import {describe,it,expect} from 'vitest';
import {injectInputFault,compareInputFault} from '../src/engineering/input-fault-campaign';
import {SEQUENCE_EXAMPLES} from '../src/engineering/ladder-sequences';
import {INSTRUCTION_EXERCISES} from '../src/engineering/instruction-lab';
const steps=SEQUENCE_EXAMPLES['start-stop'];
describe('scan-bounded input faults',()=>{
 it('preserves original sequence',()=>{const snapshot=JSON.stringify(steps);injectInputFault(steps,{tag:'Start',startScan:2,durationScans:2,mode:'stuck-off'});expect(JSON.stringify(steps)).toBe(snapshot)});
 it('restores input at window end',()=>{const r=injectInputFault(steps,{tag:'Start',startScan:2,durationScans:1,mode:'stuck-off'});expect(r.map(s=>s.scans).reduce((a,b)=>a+b,0)).toBe(4);expect(r[1].inputs.Start).toBe(false)});
 it('rejects out of bounds fault',()=>expect(()=>injectInputFault(steps,{tag:'Start',startScan:4,durationScans:2,mode:'invert'})).toThrow());
 it('rejects unassigned tag',()=>expect(()=>injectInputFault(steps,{tag:'Unknown',startScan:2,durationScans:1,mode:'stuck-on'})).toThrow());
 it('compares reference and injected sequence',()=>{const program=INSTRUCTION_EXERCISES.find(x=>x.id==='start-stop')?.program;if(program){const r=compareInputFault(program,steps,{tag:'Start',startScan:2,durationScans:2,mode:'stuck-off'});expect(r.totalScans).toBe(4);expect(r.injected.length).toBeGreaterThan(0)}});
});
