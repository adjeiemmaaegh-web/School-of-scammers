/**
 * A complete, user-authored, multi-device industrial scenario, built from an EMPTY project with nothing but
 * the commands a student has: place, wire and write a program. No template, no fixture project.
 *
 *   Line A: supply, PLC, START/STOP, contactor, conveyor, photoeye, diverter, run lamp. Sorts marked parcels.
 *   Station B: its own supply behind its own breaker, PLC, STOP, tank, pump, level switch, drain valve.
 *   Interlock: B may only fill while line A is running. A's "Run" output is wired into B's input I0.0, over a
 *   shared common (the two supplies are isolated otherwise). Two PLCs, two supplies, two programs.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const PLC_A = ['VAR_INPUT', '  Start : BOOL;', '  StopOK : BOOL;', '  Photoeye : BOOL;', 'END_VAR',
  'VAR_OUTPUT', '  Run : BOOL;', '  Sort : BOOL;', 'END_VAR',
  'Run := StopOK AND (Start OR Run);', 'Sort := Run AND Photoeye;'].join('\n');
// Station B fills only while A is running (Start here is A's Run output) and while its own STOP is healthy.
const PLC_B = ['VAR_INPUT', '  Start : BOOL;', '  StopOK : BOOL;', '  TankHigh : BOOL;', 'END_VAR',
  'VAR_OUTPUT', '  Run : BOOL;', '  Fill : BOOL;', '  Drain : BOOL;', 'END_VAR',
  'Run := StopOK;', 'Fill := Start AND StopOK AND NOT TankHigh;', 'Drain := StopOK AND TankHigh;'].join('\n');

const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x: number, y: number): Command => ({ k: 'place', id, kind, at: { x, y } });
const LAYOUT: Command[] = [
  // line A
  place('ps1', 'supply', 25, 20), place('plc1', 'plc', 315, 20), place('start1', 'start', 60, 120), place('stop1', 'stop', 325, 120),
  place('con1', 'contactor', 555, 20), place('belt1', 'conveyor', 610, 60), place('eye1', 'photoeye', 690, 160),
  place('gate1', 'diverter', 750, 120), place('lamp1', 'lamp', 880, 20),
  // station B
  place('ps2', 'supply', 25, 300), place('cb2', 'breaker', 200, 300), place('plc2', 'plc', 330, 300), place('stop2', 'stop', 330, 420),
  place('tank', 'tank', 680, 300), place('pump', 'pump', 525, 290), place('probe', 'levelprobe', 700, 370), place('drain', 'drainvalve', 840, 370),
];
const WIRING: [string, string][] = [
  // line A power, controls, belt, sensor, diverter, lamp
  ['ps1.P24', 'plc1.L+'], ['ps1.M0', 'plc1.M'], ['ps1.P24', 'start1.A'], ['start1.B', 'plc1.I0.0'], ['ps1.P24', 'stop1.A'], ['stop1.B', 'plc1.I0.1'],
  ['ps1.P24', 'con1.13'], ['ps1.M0', 'con1.A2'], ['plc1.Q0.0', 'con1.A1'], ['con1.14', 'belt1.L+'], ['ps1.M0', 'belt1.M-'],
  ['ps1.P24', 'eye1.L+'], ['ps1.M0', 'eye1.M'], ['eye1.OUT', 'plc1.I0.2'], ['plc1.Q0.1', 'gate1.A1'], ['ps1.M0', 'gate1.A2'],
  ['con1.14', 'lamp1.L+'], ['lamp1.M-', 'ps1.M0'],
  // station B: everything downstream of the breaker
  ['ps2.P24', 'cb2.IN'], ['cb2.OUT', 'plc2.L+'], ['cb2.OUT', 'stop2.A'], ['cb2.OUT', 'probe.L+'],
  ['ps2.M0', 'plc2.M'], ['ps2.M0', 'probe.M'], ['ps2.M0', 'pump.M-'], ['ps2.M0', 'drain.A2'],
  ['stop2.B', 'plc2.I0.1'], ['probe.OUT', 'plc2.I0.3'], ['plc2.Q0.2', 'pump.L+'], ['plc2.Q0.3', 'drain.A1'],
  // the interlock: a shared common, and A's Run output into B's input
  ['ps1.M0', 'ps2.M0'], ['plc1.Q0.0', 'plc2.I0.0'],
];
const wires = (pairs: [string, string][]): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));

/** Author the whole plant from an empty project. */
function authored(options: { wiring?: [string, string][] } = {}): WorldState {
  let w = createWorld();
  expect(w.project.components).toHaveLength(0);
  w = tick(w, LAYOUT).world;
  w = tick(w, wires(options.wiring ?? WIRING)).world;
  w = tick(w, [{ k: 'loadST', source: PLC_A }, { k: 'loadST', source: PLC_B, plc: 'plc2' }]).world;
  expect(w.lastError).toBeNull();
  return w;
}
const scan = (w: WorldState, n: number): WorldState => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const run = (w: WorldState) => tick(w, [{ k: 'run' }]).world;
const press = (w: WorldState, id: string, settle = 8) => scan(tick(w, [{ k: 'operate', id, pressed: true }]).world, settle);
const release = (w: WorldState, id: string, settle = 8) => scan(tick(w, [{ k: 'operate', id, pressed: false }]).world, settle);
const startLine = (w: WorldState) => release(press(w, 'start1'), 'start1');
const meter = (w: WorldState, pos: string, neg: string) => tick(w, [
  { k: 'setMeterProbe', lead: 'positive', terminal: pos }, { k: 'setMeterProbe', lead: 'negative', terminal: neg }]).world.meter;

describe('a user-authored multi-device plant, from an empty project', () => {
  it('is built from nothing: 17 devices, 32 wires, two PLCs, two supplies, two programs', () => {
    const w = authored();
    expect(w.project.components).toHaveLength(17);
    expect(w.project.wires).toHaveLength(32);
    expect(w.project.components.filter(c => c.kind === 'plc')).toHaveLength(2);
    expect(w.project.components.filter(c => c.kind === 'supply')).toHaveLength(2);
    expect(w.project.language).toBe('st');
    expect(w.project.plcPrograms?.plc2?.language).toBe('st');
    expect(w.project.stSource).toContain('Sort := Run AND Photoeye');
    expect(w.project.plcPrograms?.plc2?.stSource).toContain('Fill := Start AND StopOK AND NOT TankHigh');
  });

  it('can be checked with the multimeter before it ever runs', () => {
    const w = authored();
    expect(meter(w, 'plc1.L+', 'plc1.M')).toMatchObject({ status: 'measured', volts: 24 });
    expect(meter(w, 'cb2.OUT', 'ps2.M0')).toMatchObject({ status: 'measured', volts: 24 }); // through the closed breaker
    expect(meter(w, 'plc2.L+', 'plc2.M')).toMatchObject({ status: 'measured', volts: 24 });
    expect(meter(w, 'con1.14', 'ps1.M0')).toMatchObject({ status: 'floating' }); // contactor open, nothing past it yet
  });

  it('nothing moves until the operator starts line A, and the tank waits for the belt', () => {
    let w = scan(run(authored()), 60);
    expect(w.deviceOn.belt1).toBe(false);
    expect(w.deviceOn.lamp1).toBe(false);
    expect(w.vessels.tank.levelMl).toBe(0); // interlocked: line A is not running
    expect(renderSnapshot(w).plcs.plc2.inputs.Start).toBe(false);
    w = startLine(w);
    expect(w.deviceOn.belt1).toBe(true);
    expect(w.deviceOn.lamp1).toBe(true);
    expect(renderSnapshot(w).plcs.plc2.inputs.Start).toBe(true); // 24 V crossed from PLC 1 to PLC 2 over the common
  });

  it('sorts parcels on line A and fills the tank on station B, at the same time', () => {
    let w = startLine(run(authored()));
    w = tick(w, [{ k: 'feedParcel', kind: 'marked' }]).world;
    for (let i = 0; i < 160 && w.lanes.belt1.parcel; i++) w = tick(w).world;
    w = tick(w, [{ k: 'feedParcel', kind: 'plain' }]).world;
    for (let i = 0; i < 160 && w.lanes.belt1.parcel; i++) w = tick(w).world;
    expect(w.lanes.belt1).toMatchObject({ rejected: 1, accepted: 1, parcel: null }); // the diverter acted on the marked one only
    expect(w.vessels.tank.filledMl).toBeGreaterThan(200); // station B was filling meanwhile
  });

  it('station B runs its own cycle: fill to HIGH, drain until the switch clears, fill again', () => {
    let w = startLine(run(authored()));
    let highs = 0, prev = false, drained = false;
    for (let i = 0; i < 420; i++) {
      w = tick(w).world;
      const high = w.vessels.tank.highLevel;
      if (high && !prev) highs++;
      prev = high;
      if (high && w.deviceOn.drain) drained = true;
    }
    expect(highs).toBeGreaterThanOrEqual(2);
    expect(drained).toBe(true);
    expect(w.vessels.tank.spills).toBe(0);
  });

  it('stopping line A halts filling (the interlock), without touching station B\'s own STOP', () => {
    let w = scan(startLine(run(authored())), 20);
    expect(w.deviceOn.pump).toBe(true);
    const level = w.vessels.tank.levelMl;
    w = press(w, 'stop1', 10);
    expect(w.deviceOn.belt1).toBe(false);
    expect(w.deviceOn.pump).toBe(false);
    expect(w.vessels.tank.levelMl).toBeLessThanOrEqual(level + 40); // only the scans before the signal dropped
    expect(renderSnapshot(w).plcs.plc2.inputs.StopOK).toBe(true); // B's STOP was never pressed
  });

  it('station B\'s own STOP halts its pump and drain without stopping line A', () => {
    let w = scan(startLine(run(authored())), 20);
    w = press(w, 'stop2', 10);
    expect(w.deviceOn.pump).toBe(false);
    expect(w.deviceOn.belt1).toBe(true);
  });

  it('a faulty contactor on line A is found with the meter and repaired', () => {
    let w = authored();
    w = tick(w, [{ k: 'injectFault', kind: 'contactor-coil-open', target: 'con1', hidden: true }]).world;
    w = startLine(run(w));
    // Symptom: the PLC commands the belt (Q0.0 is on) but nothing moves.
    expect(renderSnapshot(w).plcs.plc1.outputs['Q0.0']).toBe(true);
    expect(w.deviceOn.belt1).toBe(false);
    expect(w.deviceOn.lamp1).toBe(false);
    // Diagnosis: 24 V across the coil, yet it has not pulled in, so the coil is dead.
    expect(meter(w, 'con1.A1', 'con1.A2')).toMatchObject({ status: 'measured', volts: 24 });
    // Repair needs the plant isolated.
    w = tick(w, [{ k: 'pause' }]).world;
    w = tick(w, [{ k: 'repair', target: 'con1' }]).world;
    expect(w.project.faults).toBeUndefined();
    w = scan(tick(w, [{ k: 'run' }]).world, 12);
    expect(w.deviceOn.belt1).toBe(true);
    expect(w.deviceOn.lamp1).toBe(true);
  });

  it('a short on station B trips B\'s breaker only: line A keeps running', () => {
    let w = startLine(run(authored()));
    expect(w.deviceOn.belt1).toBe(true);
    w = tick(w, [{ k: 'pause' }]).world;
    w = tick(w, [{ k: 'wire', id: 'oops', from: 'cb2.OUT', to: 'ps2.M0' }]).world;
    w = scan(tick(w, [{ k: 'run' }]).world, 6);
    expect(w.tripped.cb2).toBe(true);
    expect(renderSnapshot(w).plcs.plc2.powered).toBe(false); // station B is dead behind its breaker
    expect(w.deviceOn.belt1).toBe(true); // line A is unaffected
    expect(w.deviceOn.lamp1).toBe(true);
    // The breaker cannot be reset into a standing short; removing the wire lets it reset.
    w = tick(w, [{ k: 'pause' }]).world;
    expect(tick(w, [{ k: 'operateProtection', id: 'cb2', action: 'reset' }]).world.lastError).toMatch(/Remove the short/);
    w = tick(w, [{ k: 'unwire', id: 'oops' }, { k: 'operateProtection', id: 'cb2', action: 'reset' }]).world;
    expect(w.tripped.cb2).toBe(false);
    w = scan(tick(w, [{ k: 'run' }]).world, 10);
    expect(renderSnapshot(w).plcs.plc2.powered).toBe(true);
  });

  it('a wiring mistake has a real consequence: without the shared common, the interlock signal cannot cross', () => {
    const miswired = WIRING.filter(([a, b]) => !(a === 'ps1.M0' && b === 'ps2.M0'));
    const w = scan(startLine(run(authored({ wiring: miswired }))), 60);
    expect(w.deviceOn.belt1).toBe(true);
    expect(renderSnapshot(w).plcs.plc2.inputs.Start).toBe(false);
    expect(w.vessels.tank.levelMl).toBe(0); // station B never gets the go-ahead
  });

  it('saves and reloads as an ordinary project file, then behaves identically', () => {
    const w = authored();
    const copy = validateProject(JSON.parse(JSON.stringify(w.project)));
    expect(copy.components).toHaveLength(17);
    const reloaded = tick(createWorld(), [{ k: 'loadProject', project: copy }]).world;
    expect(reloaded.lastError).toBeNull();
    const r = startLine(run(reloaded));
    expect(r.deviceOn.belt1).toBe(true);
    expect(renderSnapshot(scan(r, 20)).plcs.plc2.inputs.Start).toBe(true);
  });

  it('replays to identical snapshots (deterministic)', () => {
    const play = () => {
      let w = startLine(run(authored()));
      w = tick(w, [{ k: 'feedParcel', kind: 'marked' }]).world;
      return JSON.stringify(renderSnapshot(scan(w, 120)));
    };
    expect(play()).toBe(play());
  });
});
