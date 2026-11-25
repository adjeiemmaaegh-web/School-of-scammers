import { describe, expect, it } from 'vitest';
import { DemoBuilder } from '../src/plant/demos/builder';
import { COMPONENTS } from '../src/components/registry';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { Command, ProjectFile, WorldState } from '../src/sim/signals';

const load = (project: ProjectFile, extra: Command[] = []): WorldState => {
  let w = tick(createWorld(), [{ k: 'loadProject', project }, ...extra]).world;
  expect(w.lastError).toBeNull();
  return tick(w, [{ k: 'run' }]).world;
};
const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const sig = (w: WorldState, id: string, name: string) => w.plantWorld.signals[id]?.[name];

describe('R13 PLC analog outputs (AO0/AO1) drive numeric device inputs', () => {
  it('the PLC16 has two analog output terminals with the analog-output role', () => {
    const ao = COMPONENTS.plc16.terminals.filter(t => t.name.startsWith('AO'));
    expect(ao.map(t => [t.name, t.role])).toEqual([['AO0', 'analog-output'], ['AO1', 'analog-output']]);
  });
  const scaling = (): ProjectFile => {
    const b = new DemoBuilder();
    b.place('pot', 'potentiometer', -400, 0).place('valve', 'proportional-valve', 0, 0).place('disp', 'numeric-display', 400, 0, { decimals: 1, fullScale: 100 });
    b.power('pot').power('valve');
    b.wire('pot.AN_volts', 'plc.AI0'); b.wire('plc.AO0', 'valve.SET_openingPct'); b.wire('plc.AO1', 'disp.SET_value');
    return b.build(`VAR_INPUT Analog0 : REAL; END_VAR
      VAR_OUTPUT AnalogOut0 : REAL; AnalogOut1 : REAL; END_VAR
      AnalogOut0 := SCALE(Analog0, 0.0, 10.0, 0.0, 100.0);
      AnalogOut1 := LIMIT(0.0, Analog0 * 12.5, 100.0);`);
  };
  it('open loop: turning the knob scales through the program into a valve opening and a display, live', () => {
    let w = scans(load(scaling()), 80);
    expect(sig(w, 'valve', 'openingPct')).toBe(0);
    w = tick(w, [{ k: 'setOperator', id: 'pot', key: 'positionPct', value: 60 }]).world;
    w = scans(w, 200);
    expect(sig(w, 'valve', 'openingPct') as number).toBeGreaterThan(58);        // 6 V -> 60 % (the valve travels there at 45 %/s)
    expect(sig(w, 'disp', 'shown')).toBe(75);                                    // 6 V x 12.5
    w = tick(w, [{ k: 'setOperator', id: 'pot', key: 'positionPct', value: 100 }]).world;
    w = scans(w, 200);
    expect(sig(w, 'disp', 'shown')).toBe(100);                                   // clamped by LIMIT in the program
    expect(sig(w, 'valve', 'openingPct')).toBe(100);
  });
  it('the output follows the running program, and a PLC that loses power stops driving: the valve closes', () => {
    let w = load(scaling());
    w = tick(w, [{ k: 'setOperator', id: 'pot', key: 'positionPct', value: 60 }]).world;
    w = scans(w, 250);
    expect(sig(w, 'valve', 'openingPct') as number).toBeGreaterThan(55);
    const supplyWire = w.project.wires.find(x => x.to === 'plc.L+')!;
    w = tick(w, [{ k: 'pause' }, { k: 'unwire', id: supplyWire.id }, { k: 'run' }]).world;
    expect(w.lastError).toBeNull();
    w = scans(w, 300);
    expect(w.plcs.plc?.powered ?? false).toBe(false);
    expect(sig(w, 'valve', 'openingPct')).toBe(0);
  });
  it('a dead potentiometer wiper reads 0 V, so the programmed output and the valve stay closed', () => {
    const dead = scans(load(scaling(), [{ k: 'setPlantFault', id: 'pot', fault: 'wiper-open' }]), 60);
    expect(sig(dead, 'valve', 'openingPct')).toBe(0);
  });
  const loopProject = (gains: string) => {
    const b = new DemoBuilder();
    b.place('tank', 'process-tank', 0, 0, { capacityMl: 10000, fillMlS: 1000 });
    b.power('tank'); b.drive(0, 'tank', 'fill', 'FillOn');
    b.wire('tank.AN_levelMl', 'plc.AI0'); b.wire('plc.AO0', 'tank.SET_inletPct');
    return b.build(`VAR_INPUT Analog0 : REAL; END_VAR
      VAR_OUTPUT FillOn : BOOL; AnalogOut0 : REAL; END_VAR
      VAR loop : PID; END_VAR
      FillOn := TRUE;
      loop(PV := Analog0, SP := 5000.0, ${gains}, KD := 0.0, OUT_MIN := 0.0, OUT_MAX := 100.0);
      AnalogOut0 := loop.OUT;`);
  };
  const level = (w: WorldState) => w.plantWorld.world.model.tank.levelMl;
  it('closed loop: the PLC modulates the inlet continuously (not on/off) and the level settles on the setpoint with no overshoot', () => {
    const w = scans(load(loopProject('KP := 0.01, KI := 0.0')), 1200);
    expect(Math.abs(level(w) - 5000)).toBeLessThan(150);
    const out = w.plcs.plc.tagValues.AnalogOut0 as number;
    expect(out).toBeGreaterThanOrEqual(0); expect(out).toBeLessThan(3);                    // the inlet has throttled right back
    let max = 0; let probe = load(loopProject('KP := 0.01, KI := 0.0'));
    for (let i = 0; i < 1200; i++) { probe = tick(probe).world; max = Math.max(max, level(probe)); }
    expect(max).toBeLessThan(5100);
  });
  it('a leak disturbs a P-only loop (steady offset about 1500 ml) and integral action removes it', () => {
    const p = scans(load(loopProject('KP := 0.01, KI := 0.0'), [{ k: 'setPlantFault', id: 'tank', fault: 'leak' }]), 2000);
    expect(level(p)).toBeGreaterThan(3200); expect(level(p)).toBeLessThan(3800);          // 150 ml/s leak -> inflow 0.1 x error -> 1500 ml short
    const pi = scans(load(loopProject('KP := 0.01, KI := 0.002'), [{ k: 'setPlantFault', id: 'tank', fault: 'leak' }]), 4000);
    expect(Math.abs(level(pi) - 5000)).toBeLessThan(400);
    const inlet = pi.plcs.plc.tagValues.AnalogOut0 as number;
    expect(inlet).toBeGreaterThan(10); expect(inlet).toBeLessThan(25);                    // about 15 % just balances the leak
  });
  it('type and wiring safety: an analog output cannot be a BOOL, cannot feed a digital input, and an input takes one source', () => {
    const b = new DemoBuilder().place('disp', 'numeric-display', 0, 0);
    const bad = b.build('VAR_OUTPUT AnalogOut0 : BOOL; END_VAR AnalogOut0 := TRUE;');
    const w = tick(createWorld(), [{ k: 'loadProject', project: bad }]).world;
    expect(w.lastError).toMatch(/analog output|REAL/i);
    let ok = tick(createWorld(), [{ k: 'loadProject', project: new DemoBuilder().place('disp', 'numeric-display', 0, 0).build('VAR_OUTPUT y : BOOL; END_VAR y := TRUE;') }]).world;
    ok = tick(ok, [{ k: 'wire', id: 'x1', from: 'plc.AO0', to: 'plc.I0.0' }]).world;
    expect(ok.lastError).toMatch(/24V and numeric wires cannot mix/);
    ok = tick(ok, [{ k: 'wire', id: 'x2', from: 'plc.AO0', to: 'disp.SET_value' }]).world;
    expect(ok.lastError).toBeNull();
    ok = tick(ok, [{ k: 'wire', id: 'x3', from: 'plc.AO1', to: 'disp.SET_value' }]).world;
    expect(ok.lastError).toMatch(/exactly one signal source/);
  });
});
