import { describe, expect, it } from 'vitest';
import { executeLadder, validateLadder, type LadderDocument } from '../src/engineering/ladder';
const program = (kind:'ton'|'tof'|'ctu', preset:number): LadderDocument => ({id:'advanced',version:'1',rungs:[{id:'r1',elements:[{type:'contact',tag:'Start'}],coil:'Done',operation:kind==='ctu'?{kind,preset}:{kind,presetMs:preset}}]});
describe('deterministic ladder instructions',()=>{
 it('TON accumulates scan time and resets on false',()=>{const p=program('ton',60);let a=executeLadder(p,{Start:true},{},{},20);expect(a.outputs.Done).toBe(false);a=executeLadder(p,{Start:true},a.outputs,a.memory,20);a=executeLadder(p,{Start:true},a.outputs,a.memory,20);expect(a.outputs.Done).toBe(true);a=executeLadder(p,{Start:false},a.outputs,a.memory,20);expect(a.outputs.Done).toBe(false);expect(a.memory.r1.elapsedMs).toBe(0);});
 it('TOF remains active until the delay expires',()=>{const p=program('tof',60);let a=executeLadder(p,{Start:true});expect(a.outputs.Done).toBe(true);a=executeLadder(p,{Start:false},a.outputs,a.memory,20);expect(a.outputs.Done).toBe(true);a=executeLadder(p,{Start:false},a.outputs,a.memory,20);expect(a.outputs.Done).toBe(true);a=executeLadder(p,{Start:false},a.outputs,a.memory,20);expect(a.outputs.Done).toBe(false);});
 it('CTU counts only rising edges',()=>{const p=program('ctu',2);let a=executeLadder(p,{Start:true});expect(a.memory.r1.count).toBe(1);a=executeLadder(p,{Start:true},a.outputs,a.memory);expect(a.memory.r1.count).toBe(1);a=executeLadder(p,{Start:false},a.outputs,a.memory);a=executeLadder(p,{Start:true},a.outputs,a.memory);expect(a.outputs.Done).toBe(true);expect(a.memory.r1.count).toBe(2);});
 it('validates TP and CTD presets and external loader requirements',()=>{
  const p:LadderDocument={id:'tp',version:'1',rungs:[{id:'p',coil:'Pulse',elements:[{type:'contact',tag:'Enable'}],operation:{kind:'tp',presetMs:0}}]};
  expect(validateLadder(p).join(' ')).toContain('timer preset');
  const d:LadderDocument={id:'ctd',version:'1',rungs:[{id:'d',coil:'Done',elements:[{type:'contact',tag:'Sensor'}],operation:{kind:'ctd',preset:3,loadTag:'LoadCount'}}]};
  expect(validateLadder(d)).toEqual([]);
  expect(validateLadder({...d,rungs:[{...d.rungs[0],operation:{kind:'ctd',preset:0,loadTag:'LoadCount'}}]}).join(' ')).toContain('counter preset');
  expect(validateLadder({...d,rungs:[{...d.rungs[0],operation:{kind:'ctd',preset:3,loadTag:'bad-tag'}}]}).join(' ')).toContain('load tag');
  expect(validateLadder({...d,rungs:[{...d.rungs[0],operation:{kind:'ctd',preset:3,loadTag:'Done'}}]}).join(' ')).toContain('load tag');
  const malformed=structuredClone(d) as LadderDocument;(malformed.rungs[0].operation as any).loadTag=undefined;
  expect(validateLadder(malformed).join(' ')).toContain('load tag');
 });
 it('CTD replay produces deterministic trace and coil at zero',()=>{
  const d:LadderDocument={id:'ctd',version:'1',rungs:[{id:'d',coil:'Done',elements:[{type:'contact',tag:'Sensor'}],operation:{kind:'ctd',preset:2,loadTag:'LoadCount'}}]};
  const run=()=>{let s=executeLadder(d,{LoadCount:true,Sensor:false});s=executeLadder(d,{LoadCount:false,Sensor:true},s.outputs,s.memory);s=executeLadder(d,{LoadCount:false,Sensor:false},s.outputs,s.memory);return executeLadder(d,{LoadCount:false,Sensor:true},s.outputs,s.memory);};
  expect(run()).toEqual(run());expect(run().outputs.Done).toBe(true);expect(run().steps[0].count).toBe(0);
 });
 it('rejects duplicate output tags',()=>{const p=program('ton',50);expect(validateLadder({...p,rungs:[...p.rungs,{...p.rungs[0],id:'r2'}]})).toContain('Rung 1: duplicate output tag Done');});
 it('rejects invalid timer presets',()=>expect(validateLadder(program('ton',0)).length).toBeGreaterThan(0));
 it('replay produces identical memory and trace',()=>{const p=program('ton',40);const run=()=>{let a=executeLadder(p,{Start:true});return executeLadder(p,{Start:true},a.outputs,a.memory)};expect(run()).toEqual(run());});
});
