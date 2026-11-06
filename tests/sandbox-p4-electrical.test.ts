import { describe, expect, it } from 'vitest';
import { createWorld, latchProgram, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { emptyMeter, measureDC24 } from '../src/electrical/panel-meter';
import type { Command, WorldState } from '../src/sim/signals';

const components: Command[] = [
  {k:'place',kind:'supply',id:'supply',at:{x:25,y:25}},
  {k:'place',kind:'breaker',id:'breaker',at:{x:175,y:25}},
  {k:'place',kind:'plc',id:'plc',at:{x:340,y:25}},
  {k:'place',kind:'start',id:'start',at:{x:40,y:245}},
  {k:'place',kind:'stop',id:'stop',at:{x:240,y:245}},
  {k:'place',kind:'overload',id:'overload',at:{x:450,y:245}},
  {k:'place',kind:'contactor',id:'contactor',at:{x:600,y:25}},
  {k:'place',kind:'motor',id:'motor',at:{x:830,y:25}},
  {k:'place',kind:'lamp',id:'lamp',at:{x:810,y:245}},
];
const pairs = [
  ['supply.P24','breaker.IN'], ['breaker.OUT','plc.L+'],
  ['supply.M0','plc.M'], ['breaker.OUT','start.A'],
  ['start.B','plc.I0.0'], ['breaker.OUT','stop.A'],
  ['stop.B','plc.I0.1'], ['plc.Q0.0','overload.95'],
  ['overload.96','contactor.A1'], ['supply.M0','contactor.A2'],
  ['breaker.OUT','contactor.13'], ['contactor.14','motor.L+'],
  ['supply.M0','motor.M-'], ['contactor.14','lamp.L+'],
  ['supply.M0','lamp.M-'],
] as const;
const circuit = (missing:number[]=[]):WorldState => {
  const commands = [...components,...pairs.flatMap(([from,to],i):Command[] =>
    missing.includes(i)?[]:[{k:'wire',id:`w${i}`,from,to}]),{k:'loadProgram',program:latchProgram()}] as Command[];
  return tick(createWorld(),commands).world;
};
const scans=(world:WorldState,n=1):WorldState=>{
  let w=world;for(let i=0;i<n;i++)w=tick(w).world;return w;
};
const start=(world:WorldState)=>scans(tick(world,[{k:'operate',id:'start',pressed:true},{k:'run'}]).world,5);

describe('P4 electrical/panel: real 24V safety-isolation teaching model',()=>{
  it('powers a protected motor and pilot lamp using actual PLC/NC overload wiring',()=>{
    let w=start(circuit());
    expect(w.coils.Run).toBe(true);
    expect(w.powered).toBe(true);
    expect(w.motorOn).toBe(true);
    expect(w.lampOn).toBe(true);
    expect(w.breakerTripped).toBe(false);
    expect(w.overloadTripped).toBe(false);
    w=scans(tick(w,[{k:'operate',id:'start',pressed:false}]).world,3);
    expect(w.motorOn).toBe(true);
    expect(renderSnapshot(w).lampOn).toBe(true);
  });
  it('manual overload trip breaks 95-96 coil power WITHOUT inventing PLC logic failure',()=>{
    let w=start(circuit());
    w=scans(tick(w,[{k:'operateProtection',id:'overload',action:'trip'}]).world,4);
    expect(w.coils.Run).toBe(true);
    expect(w.overloadTripped).toBe(true);
    expect(w.contactorOn).toBe(false);
    expect(w.motorOn).toBe(false);
    expect(w.lampOn).toBe(false);
    expect(w.diagnostics.some(x=>x.includes('overload auxiliary'))).toBe(true);
    w=scans(tick(w,[{k:'operateProtection',id:'overload',action:'reset'}]).world,4);
    expect(w.overloadTripped).toBe(false);
    expect(w.motorOn).toBe(true);
    expect(w.lampOn).toBe(true);
  });
  it('a downstream direct short trips its protective breaker and isolates the source',()=>{
    let w=start(circuit());
    w=tick(w,[{k:'pause'}]).world;
    w=tick(w,[{k:'wire',id:'fault-short',from:'breaker.OUT',to:'supply.M0'}]).world;
    w=tick(w,[{k:'run'}]).world;
    expect(w.breakerTripped).toBe(true);
    expect(w.powered).toBe(false);
    expect(w.motorOn).toBe(false);
    expect(w.lampOn).toBe(false);
    expect(w.diagnostics.some(x=>x.includes('Branch breaker open'))).toBe(true);
    // The still-present short re-trips after a manual reset.
    w=tick(w,[{k:'operateProtection',id:'breaker',action:'reset'}]).world;
    expect(w.breakerTripped).toBe(true);
    w=tick(w,[{k:'pause'},{k:'unwire',id:'fault-short'},
      {k:'operateProtection',id:'breaker',action:'reset'}]).world;
    expect(w.breakerTripped).toBe(false);
    expect(w.project.wires).toHaveLength(15);
    w=start(w);
    expect(w.motorOn).toBe(true);
  });
  it('an UPSTREAM short is not falsely isolated by a downstream breaker',()=>{
    let w=circuit();
    w=tick(w,[{k:'wire',id:'upstream',from:'supply.P24',to:'supply.M0'}]).world;
    w=tick(w,[{k:'run'}]).world;
    expect(w.breakerTripped).toBe(false);
    expect(w.diagnostics.some(x=>x.startsWith('Supply short'))).toBe(true);
    expect(w.powered).toBe(false);
    expect(w.motorOn).toBe(false);
  });
  it('a missing 95-96 or pilot lamp wire drops only the correct actual load',()=>{
    let w=start(circuit([8]));
    expect(w.coils.Run).toBe(true);
    expect(w.contactorOn).toBe(false);
    expect(w.motorOn).toBe(false);
    expect(w.lampOn).toBe(false);
    w=start(circuit([13]));
    expect(w.motorOn).toBe(true);
    expect(w.lampOn).toBe(false);
  });
  it('real meter reads differential +24, 0 and -24 across wired terminals while paused',()=>{
    let w=circuit();
    w=tick(w,[{k:'setMeterProbe',lead:'positive',terminal:'supply.P24'},
      {k:'setMeterProbe',lead:'negative',terminal:'supply.M0'}]).world;
    expect(w.tick).toBe(0);
    expect(w.meter).toMatchObject({volts:24,status:'measured'});
    w=tick(w,[{k:'setMeterProbe',lead:'positive',terminal:'supply.M0'}]).world;
    expect(w.meter.volts).toBe(0);
    w=tick(w,[{k:'setMeterProbe',lead:'negative',terminal:'supply.P24'}]).world;
    expect(w.meter.volts).toBe(-24);
  });
  it('meter reports floating or short-circuit states rather than inventing voltages',()=>{
    let w=circuit();
    w=tick(w,[{k:'setMeterProbe',lead:'positive',terminal:'contactor.14'},
      {k:'setMeterProbe',lead:'negative',terminal:'supply.M0'}]).world;
    expect(w.meter).toMatchObject({status:'floating',volts:null});
    w=tick(w,[{k:'wire',id:'bare-short',from:'supply.P24',to:'supply.M0'}]).world;
    expect(w.meter).toMatchObject({status:'short',volts:null});
    expect(measureDC24({'a':24,'b':0},[], 'a','b').volts).toBe(24);
    expect(measureDC24({}, [],null,'b')).toEqual({...emptyMeter(),negative:'b'});
  });
  it('manual opening of protective contacts is observable without modifying source project',()=>{
    let w=start(circuit());
    const original=JSON.stringify(w.project);
    w=tick(w,[{k:'operateProtection',id:'breaker',action:'trip'}]).world;
    w=scans(w,3);
    expect(w.breakerTripped).toBe(true);
    expect(w.motorOn).toBe(false);
    expect(JSON.stringify(w.project)).toBe(original);
  });
  it('rejects invalid protection controls, bad probe endpoints and duplicated imported breakers',()=>{
    let w=circuit();
    w=tick(w,[{k:'operateProtection',id:'missing',action:'trip'}]).world;
    expect(w.lastError).toMatch(/Invalid breaker/);
    w=tick(w,[{k:'setMeterProbe',lead:'positive',terminal:'missing.BAD'}]).world;
    expect(w.lastError).toMatch(/existing terminal/);
    expect(w.meter).toEqual(emptyMeter());
    const bad={...w.project,components:[...w.project.components,{
      id:'breaker-two',kind:'breaker',x:400,y:400,pressed:false,
    }]};
    expect(()=>validateProject(bad)).toThrow(/Only one breaker/);
    const result=tick(w,[{k:'loadProject',project:bad}]).world;
    expect(result.project).toEqual(w.project);
  });
  it('reset clears protection state and does not mutate old P3/P2 projects',()=>{
    let w=start(circuit());
    w=tick(w,[{k:'operateProtection',id:'overload',action:'trip'}]).world;
    w=tick(w,[{k:'reset'}]).world;
    expect(w.breakerTripped).toBe(false);
    expect(w.overloadTripped).toBe(false);
    expect(w.lampOn).toBe(false);
    expect(w.meter).toEqual(emptyMeter());
    expect(validateProject(w.project).wires).toHaveLength(15);
    expect(renderSnapshot(createWorld()).breakerTripped).toBe(false);
  });
  it('identical fault/recovery commands produce deterministic state and events',()=>{
    const sequence:Command[][]=[
      [{k:'operate',id:'start',pressed:true},{k:'run'}],[],[],[],
      [{k:'operateProtection',id:'overload',action:'trip'}],[],[],[],
      [{k:'operateProtection',id:'overload',action:'reset'}],[],[],[],
    ];
    const run=()=>sequence.reduce((acc,cs)=>{
      const out=tick(acc.world,cs);
      return {world:out.world,events:[...acc.events,...out.events]};
    },{world:circuit(),events:[] as {tick:number;kind:string;detail:string}[]});
    expect(run()).toEqual(run());
  });
});
