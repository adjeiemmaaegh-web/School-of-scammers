import { describe, expect, it } from 'vitest';
import { solveDiscrete24V } from '../src/engineering/electrical';
import { measureDC24 } from '../src/electrical/panel-meter';
import { COMPONENTS } from '../src/components/registry';
import { createWorld, latchProgram, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

// The same 10-device, 16-terminal-wire teaching layout exposed by the UI.
const devices: Command[] = [
  {k:'place',kind:'supply',id:'ps',at:{x:25,y:25}},
  {k:'place',kind:'breaker',id:'cb',at:{x:175,y:25}},
  {k:'place',kind:'estop',id:'es',at:{x:160,y:245}},
  {k:'place',kind:'plc',id:'plc',at:{x:345,y:25}},
  {k:'place',kind:'start',id:'start',at:{x:35,y:400}},
  {k:'place',kind:'stop',id:'stop',at:{x:285,y:245}},
  {k:'place',kind:'overload',id:'ol',at:{x:510,y:245}},
  {k:'place',kind:'contactor',id:'con',at:{x:605,y:25}},
  {k:'place',kind:'motor',id:'motor',at:{x:855,y:25}},
  {k:'place',kind:'lamp',id:'lamp',at:{x:815,y:245}},
];
const pairs:[string,string][] = [
  ['ps.P24','cb.IN'],['cb.OUT','es.A'],
  ['es.B','plc.L+'],['es.B','start.A'],['es.B','stop.A'],['es.B','con.13'],
  ['ps.M0','plc.M'],['ps.M0','con.A2'],['ps.M0','motor.M-'],['ps.M0','lamp.M-'],
  ['start.B','plc.I0.0'],['stop.B','plc.I0.1'],
  ['plc.Q0.0','ol.95'],['ol.96','con.A1'],
  ['con.14','motor.L+'],['con.14','lamp.L+'],
];
function fixture(excluded:number[]=[]):WorldState {
  const wires:Command[]=pairs.flatMap(([from,to],i)=>excluded.includes(i)?[]:
    [{k:'wire',id:`w${i}`,from,to}]);
  return tick(createWorld(),[...devices,...wires,{k:'loadProgram',program:latchProgram()}]).world;
}
function scans(w:WorldState,n=1) {for(let i=0;i<n;i++)w=tick(w).world;return w;}
function start(w:WorldState){
  return scans(tick(w,[{k:'operate',id:'start',pressed:true},{k:'run'}]).world,4);
}
function release(w:WorldState){return tick(w,[{k:'operate',id:'start',pressed:false}]).world;}
describe('P4 protected educational motor panel and worker-owned meter',()=>{
  it('runs a correctly wired DOL motor and its parallel pilot lamp via contactor',()=>{
    let w=release(start(fixture()));
    expect(w.coils.Run).toBe(true);
    expect(w.contactorOn).toBe(true);
    expect(w.motorOn).toBe(true);
    expect(w.lampOn).toBe(true);
    expect(w.powered).toBe(true);
    expect(w.breakerTripped).toBe(false);
    expect(w.overloadTripped).toBe(false);
    expect(renderSnapshot(w).lampOn).toBe(true);
    expect(w.project.wires).toHaveLength(16);
  });
  it('opens NC 95-96 on overload training trip, drops real contactor + lamp, no auto restart on reset',()=>{
    let w=release(start(fixture()));
    w=tick(w,[{k:'operateProtection',id:'ol',action:'trip'}]).world;
    w=scans(w,4);
    expect(w.overloadTripped).toBe(true);
    expect(w.contactorOn).toBe(false);
    expect(w.motorOn).toBe(false);
    expect(w.lampOn).toBe(false);
    expect(w.coils.Run).toBe(false);
    w=tick(w,[{k:'operateProtection',id:'ol',action:'reset'}]).world;
    w=scans(w,4);
    expect(w.overloadTripped).toBe(false);
    expect(w.motorOn).toBe(false);
    w=scans(tick(w,[{k:'operate',id:'start',pressed:true}]).world,4);
    expect(w.motorOn).toBe(true);
  });
  it('latching training E-stop opens hardwired supply and prevents PLC and motor operation',()=>{
    let w=release(start(fixture()));
    w=tick(w,[{k:'operate',id:'es',pressed:true}]).world;
    w=scans(w,4);
    expect(w.powered).toBe(false);
    expect(w.motorOn).toBe(false);
    expect(w.lampOn).toBe(false);
    expect(w.inputs.StopOK).toBe(false);
    expect(w.project.components.find(c=>c.id==='es')?.pressed).toBe(true);
    w=scans(w,4);
    expect(w.motorOn).toBe(false);
    w=tick(w,[{k:'operate',id:'es',pressed:false}]).world;
    w=scans(w,4);
    expect(w.powered).toBe(true);
    expect(w.motorOn).toBe(false); // must press START again
  });
  it('trips closed breaker on real isolated downstream direct short and latches protection',()=>{
    let w=fixture();
    w=tick(w,[{k:'wire',id:'fault',from:'cb.OUT',to:'ps.M0'},{k:'run'}]).world;
    expect(w.breakerTripped).toBe(true);
    expect(w.powered).toBe(false);
    expect(w.motorOn).toBe(false);
    expect(w.diagnostics).toEqual(expect.arrayContaining([expect.stringMatching(/breaker open/i)]));
    // Cannot reset into a still-present direct short, even paused.
    w=tick(w,[{k:'pause'},{k:'operateProtection',id:'cb',action:'reset'}]).world;
    expect(w.breakerTripped).toBe(true);
    expect(w.lastError).toMatch(/Remove the short/);
    expect(w.scanTrace.length).toBeGreaterThan(0);
    w=tick(w,[{k:'unwire',id:'fault'},{k:'operateProtection',id:'cb',action:'reset'}]).world;
    expect(w.breakerTripped).toBe(false);
    w=scans(tick(w,[{k:'run'}]).world,3);
    expect(w.powered).toBe(true);
  });
  it('does not falsely credit a branch breaker for an unfused upstream supply short',()=>{
    const w=tick(fixture(),[{k:'wire',id:'upstream',from:'ps.P24',to:'ps.M0'},{k:'run'}]).world;
    expect(w.breakerTripped).toBe(false);
    expect(w.powered).toBe(false);
    expect(w.diagnostics.some(d=>d.startsWith('Supply short'))).toBe(true);
    expect(w.motorOn).toBe(false);
  });
  it('reading 24, -24, 0 and floating is based on terminal graph, not arbitrary display math',()=>{
    let w=fixture();
    w=tick(w,[{k:'setMeterProbe',lead:'positive',terminal:'es.B'},
      {k:'setMeterProbe',lead:'negative',terminal:'ps.M0'}]).world;
    expect(w.meter).toMatchObject({status:'measured',volts:24});
    w=tick(w,[{k:'setMeterProbe',lead:'positive',terminal:'ps.M0'},
      {k:'setMeterProbe',lead:'negative',terminal:'es.B'}]).world;
    expect(w.meter).toMatchObject({status:'measured',volts:-24});
    w=tick(w,[{k:'setMeterProbe',lead:'negative',terminal:'ps.M0'}]).world;
    expect(w.meter).toMatchObject({status:'measured',volts:0});
    w=tick(w,[{k:'operate',id:'es',pressed:true},
      {k:'setMeterProbe',lead:'positive',terminal:'es.B'}]).world;
    expect(w.meter).toMatchObject({status:'floating',volts:null});
    const raw=solveDiscrete24V({devices:[{id:'s',kind:'supply',positive:'p',negative:'n',volts:24}],
      wires:[['p','n']]});
    expect(measureDC24(raw.voltage,raw.diagnostics,'p','n').status).toBe('short');
  });
  it('refuses orphan meter leads and unknown protection controls without changing circuit',()=>{
    let w=fixture();
    const oldProject=w.project;
    w=tick(w,[{k:'setMeterProbe',lead:'positive',terminal:'unknown.A'}]).world;
    expect(w.lastError).toMatch(/Meter probe/);
    expect(w.meter.positive).toBeNull();
    w=tick(w,[{k:'operateProtection',id:'ps',action:'trip'}]).world;
    expect(w.lastError).toMatch(/Invalid breaker/);
    expect(w.project).toEqual(oldProject);
    const error=tick(w,[{k:'operate',id:'motor',pressed:true}]).world;
    expect(error.lastError).toMatch(/Only pushbuttons/);
  });
  it('manual breaker trip isolates the actual branch and cancels retained PLC motor latch',()=>{
    let w=release(start(fixture()));
    w=tick(w,[{k:'operateProtection',id:'cb',action:'trip'}]).world;
    w=scans(w,4);
    expect(w.breakerTripped).toBe(true);
    expect(w.powered).toBe(false);
    expect(w.motorOn).toBe(false);
    w=tick(w,[{k:'operateProtection',id:'cb',action:'reset'}]).world;
    w=scans(w,4);
    expect(w.motorOn).toBe(false);
  });
  it('rejects duplicate protection elements and persists old v1 projects',()=>{
    const w=fixture();
    for(const kind of ['breaker','overload','estop'] as const) {
      const duplicate=tick(w,[{k:'place',kind,id:'bad',at:{x:900,y:450}}]).world;
      expect(duplicate.lastError).toMatch(/one of each station/);
    }
    const bad={...w.project,components:[...w.project.components,
      {...w.project.components.find(c=>c.kind==='breaker')!,id:'cb2'}]};
    expect(()=>validateProject(bad)).toThrow(/Only one breaker/);
    const valid=validateProject(w.project);
    expect(valid.formatVersion).toBe(1);
    expect(COMPONENTS.estop.terminals.map(t=>t.name)).toEqual(['A','B']);
    const reset=tick(start(w),[{k:'reset'}]).world;
    expect(reset.breakerTripped).toBe(false);
    expect(reset.overloadTripped).toBe(false);
    expect(reset.lampOn).toBe(false);
  });
  it('is deterministic for the exact same break, meter, trip and recovery command sequence',()=>{
    const run=()=>{
      let w=release(start(fixture()));
      const states=[];
      for(const cmds of [
        [{k:'setMeterProbe',lead:'positive',terminal:'cb.OUT'},
         {k:'setMeterProbe',lead:'negative',terminal:'ps.M0'}],
        [{k:'operateProtection',id:'ol',action:'trip'}],[],[],[],
        [{k:'operateProtection',id:'ol',action:'reset'}],[],[],[],
      ] as Command[][]) {
        w=tick(w,cmds).world;
        states.push([w.tick,w.motorOn,w.lampOn,w.breakerTripped,w.overloadTripped,
          w.meter.status,w.meter.volts]);
      }
      return states;
    };
    expect(run()).toEqual(run());
  });
});
