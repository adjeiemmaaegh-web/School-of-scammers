import { describe, expect, it } from 'vitest';
import { emptySnapshot, scan, validateProgram, type Program } from '../src/core/plc';
const program: Program = { id: 'test', version: '1', instructions: [
 { kind: 'contact', input: 'Start', target: 'start' },
 { kind: 'ton', enable: 'start', timer: 'T1', presetMs: 100, done: 'ready' },
 { kind: 'coil', condition: 'ready', output: 'Motor' }
] };
describe('PLC kernel', () => {
 it('is deterministic and timer completion occurs at exact scan boundary', () => {
  const a = scan(program, emptySnapshot(), { Start: true }, 50);
  const b = scan(program, a.snapshot, { Start: true }, 50);
  expect(a.trace.outputs.Motor).toBe(false);
  expect(b.trace.outputs.Motor).toBe(true);
  expect(scan(program, a.snapshot, { Start: true }, 50)).toEqual(b);
 });
 it('resets timer when enable drops', () => {
  const a = scan(program, emptySnapshot(), { Start: true }, 50);
  const b = scan(program, a.snapshot, { Start: false }, 50);
  expect(b.snapshot.timers.T1.elapsedMs).toBe(0);
  expect(b.trace.outputs.Motor).toBe(false);
 });
 it('counts rising edges and resets', () => {
  const p: Program = { id:'counter', version:'1', instructions:[
   { kind:'contact', input:'Pulse', target:'pulse' },
   { kind:'contact', input:'Reset', target:'reset' },
   { kind:'ctu', countInput:'pulse', resetInput:'reset', counter:'C1', preset:2, done:'complete' }
  ]};
  let s = emptySnapshot();
  for (const pulse of [true,true,false,true]) s = scan(p,s,{Pulse:pulse,Reset:false},10).snapshot;
  expect(s.counters.C1).toMatchObject({value:2,done:true});
  s=scan(p,s,{Pulse:false,Reset:true},10).snapshot;
  expect(s.counters.C1.value).toBe(0);
 });
 it('rejects malformed programs and scan durations', () => {
  expect(validateProgram({id:'x',version:'1',instructions:[{kind:'ton',enable:'x',timer:'T',presetMs:-1,done:'d'}]})).not.toHaveLength(0);
  expect(()=>scan(program,emptySnapshot(),{},0)).toThrow();
 });
});
