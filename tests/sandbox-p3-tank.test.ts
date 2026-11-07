import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tankProgram, tick, validateProject, validateSandboxProgram } from '../src/sim/orchestrator';
import { freshTank, stepTank, tankMounted, TANK_CAPACITY_ML } from '../src/plant/tank-process';
import type { Command, WorldState } from '../src/sim/signals';

const components: Command[] = [
  { k:'place',kind:'supply',id:'supply',at:{x:25,y:25} },
  { k:'place',kind:'plc',id:'plc',at:{x:310,y:25} },
  { k:'place',kind:'stop',id:'stop',at:{x:225,y:245} },
  { k:'place',kind:'tank',id:'tank',at:{x:680,y:290} },
  { k:'place',kind:'pump',id:'pump',at:{x:525,y:280} },
  { k:'place',kind:'levelprobe',id:'probe',at:{x:700,y:360} },
  { k:'place',kind:'drainvalve',id:'drain',at:{x:840,y:360} },
];
const wires = [
  ['supply.P24','plc.L+'], ['supply.M0','plc.M'],
  ['supply.P24','stop.A'], ['stop.B','plc.I0.1'],
  ['supply.P24','probe.L+'], ['supply.M0','probe.M'],
  ['probe.OUT','plc.I0.3'],
  ['plc.Q0.2','pump.L+'], ['supply.M0','pump.M-'],
  ['plc.Q0.3','drain.A1'], ['supply.M0','drain.A2'],
] as const;
function setup(exclude: number[] = []) {
  const w=tick(createWorld(),[
    ...components,
    ...wires.flatMap(([from,to],index): Command[] =>
      exclude.includes(index)?[]:[{k:'wire',id:`w${index}`,from,to}]),
  ]).world;
  return tick(w,[{k:'loadProgram',program:tankProgram()}]).world;
}
function scan(initial: WorldState,n: number): WorldState {
  let w=initial;for(let i=0;i<n;i++)w=tick(w).world;return w;
}
function running(w: WorldState) { return tick(w,[{k:'run'}]).world; }
const tagged = (w: WorldState) => w.inputs.TankHigh;

describe('P3 3D tank loop driven by electrically wired PLC outputs',()=>{
  it('executes a real 24V pump, detects high level on wired I0.3 and opens wired drain',()=>{
    expect(validateSandboxProgram(tankProgram())).toEqual([]);
    let w=running(setup()), sawPump=false,sawProbe=false,sawDrain=false,sawClear=false;
    const events:string[]=[];
    for(let i=0;i<195;i++){
      const r=tick(w);w=r.world;
      sawPump ||= w.pumpOn;sawProbe ||= tagged(w);sawDrain ||= w.drainOn;
      if(sawProbe && !tagged(w))sawClear=true;
      events.push(...r.events.map(x=>x.detail));
    }
    expect(sawPump).toBe(true);
    expect(sawProbe).toBe(true);
    expect(sawDrain).toBe(true);
    expect(sawClear).toBe(true);
    expect(events.some(e=>e.includes('Tank level switch HIGH'))).toBe(true);
    expect(events.some(e=>e.includes('Tank level switch CLEAR'))).toBe(true);
    expect(w.tank.levelMl).toBeGreaterThan(500);
    expect(w.tank.levelMl).toBeLessThan(850);
    expect(w.tank.filledMl).toBeGreaterThan(w.tank.drainedMl);
  });
  it('does not invent liquid when the real pump output wire is disconnected',()=>{
    const w=scan(running(setup([7])),90);
    expect(w.coils.Fill).toBe(true);
    expect(w.pumpOn).toBe(false);
    expect(w.tank.levelMl).toBe(0);
    expect(w.tank.filledMl).toBe(0);
  });
  it('never drains without a real Q0.3 to drain valve coil circuit',()=>{
    let w=running(setup([9]));
    w=scan(w,160);
    expect(w.coils.Fill).toBe(false);
    expect(w.coils.Drain).toBe(true);
    expect(w.drainOn).toBe(false);
    expect(w.tank.levelMl).toBeGreaterThanOrEqual(750);
    expect(w.tank.levelMl).toBeLessThan(850);
  });
  it('does not falsely publish TankHigh when probe OUT, L+ or M wiring is broken',()=>{
    for(const index of [4,5,6]){
      const w=scan(running(setup([index])),160);
      expect(w.inputs.TankHigh).toBe(false);
      expect(w.tank.levelMl).toBe(TANK_CAPACITY_ML);
      expect(w.pumpOn).toBe(true);
      expect(w.coils.Drain).toBe(false);
    }
  });
  it('shows incorrect learner logic by keeping tank empty even though pump is correctly wired',()=>{
    const program=tankProgram(),wrong={...program,rungs:program.rungs.map(r=>
      r.coil==='Fill'?{...r,elements:[{type:'contact' as const,tag:'Unused'}]}:r)};
    expect(validateSandboxProgram(wrong)).toEqual([]);
    const state=tick(setup(),[{k:'loadProgram',program:wrong}]).world;
    const w=scan(running(state),100);
    expect(w.tank.levelMl).toBe(0);
    expect(w.coils.Fill).toBe(false);
  });
  it('moving the pump too far prevents hydraulic fill despite powered circuit',()=>{
    let w=tick(setup(),[{k:'move',id:'pump',to:{x:120,y:490}}]).world;
    expect(tankMounted(w.project.components.find(c=>c.kind==='tank'),
      w.project.components.find(c=>c.kind==='pump'))).toBe(false);
    w=scan(running(w),95);
    expect(w.pumpOn).toBe(true);
    expect(w.tank.levelMl).toBe(0);
  });
  it('moving the levelprobe away cancels tank HIGH but cannot fabricate a sensor input',()=>{
    let w=tick(setup(),[{k:'move',id:'probe',to:{x:180,y:400}}]).world;
    w=scan(running(w),145);
    expect(w.tank.highLevel).toBe(false);
    expect(w.inputs.TankHigh).toBe(false);
    expect(w.tank.levelMl).toBe(1000);
  });
  it('pushbutton STOP deenergizes pump and valve after the bounded scan propagation delay',()=>{
    let w=scan(running(setup()),30);
    const before=w.tank.levelMl;
    w=tick(w,[{k:'operate',id:'stop',pressed:true}]).world;
    w=scan(w,4);
    expect(w.coils.Fill).toBe(false);
    expect(w.coils.Drain).toBe(false);
    expect(w.pumpOn).toBe(false);
    expect(w.drainOn).toBe(false);
    expect(w.tank.levelMl).toBeGreaterThanOrEqual(before);
    const held=w.tank.levelMl;
    w=scan(w,12);
    expect(w.tank.levelMl).toBe(held);
  });
  it('supports user-authored bounded ST with the same real pump, probe and drain circuit',()=>{
    const source=[
      'VAR_INPUT',
      ' StopOK : BOOL;',
      ' TankHigh : BOOL;',
      'END_VAR',
      'VAR_OUTPUT',
      ' Run : BOOL;',
      ' Fill : BOOL;',
      ' Drain : BOOL;',
      'END_VAR',
      'Run := FALSE;',
      'Fill := StopOK AND NOT TankHigh;',
      'Drain := StopOK AND TankHigh;',
    ].join('\n');
    let w=tick(setup(),[{k:'loadST',source}]).world;
    expect(w.project.language).toBe('st');
    w=scan(running(w),110);
    expect(w.tank.filledMl).toBeGreaterThan(750);
    expect(w.tank.drainedMl).toBeGreaterThan(0);
  });
  it('clamps tank capacity, switches with deterministic hysteresis and tracks bounded volume',()=>{
    const mounted=setup().project.components;
    let t=freshTank(),seenTrip=false,seenClear=false;
    for(let i=0;i<120;i++){
      const result=stepTank(t,mounted,true,false,50);t=result.tank;
      seenTrip ||= t.highLevel;
    }
    expect(seenTrip).toBe(true);
    expect(t.levelMl).toBe(1000);
    for(let i=0;i<40;i++){
      const result=stepTank(t,mounted,false,true,50);t=result.tank;
      if(!t.highLevel)seenClear=true;
    }
    expect(seenClear).toBe(true);
    expect(t.levelMl).toBeGreaterThanOrEqual(0);
    expect(t.levelMl).toBeLessThanOrEqual(TANK_CAPACITY_ML);
  });
  it('restores a fresh tank on Reset and isolates immutable render snapshots',()=>{
    let w=scan(running(setup()),25);
    const snap=renderSnapshot(w),old=w.tank.levelMl;
    snap.tank.levelMl=99999;
    expect(w.tank.levelMl).toBe(old);
    w=tick(w,[{k:'reset'}]).world;
    expect(w.tank).toEqual(freshTank());
    expect(w.tick).toBe(0);
    expect(validateProject(w.project).components).toHaveLength(7);
  });
  it('allows several tanks, pumps, probes and valves (each tank is its own vessel) and preserves old project contracts',()=>{
    const w=setup();
    for(const kind of ['tank','pump','levelprobe','drainvalve'] as const){
      const result=tick(w,[{k:'place',kind,id:`second-${kind}`,at:{x:700,y:490}}]).world;
      expect(result.project.components).toHaveLength(8);
      expect(result.lastError).toBeNull();
    }
    expect(tick(createWorld(),[{k:'step'}]).snapshot.tank).toEqual(freshTank());
  });
  it('replays the exact same bounded tank/PLC sequence on duplicate inputs',()=>{
    const cycle=()=>{
      let w=running(setup());const history=[];
      for(let i=0;i<180;i++){
        w=tick(w).world;
        history.push([w.tank.levelMl,w.inputs.TankHigh,w.coils.Fill,w.coils.Drain,w.pumpOn,w.drainOn]);
      }
      return history;
    };
    expect(cycle()).toEqual(cycle());
  });
});
