import { describe, expect, it } from 'vitest';
import { faultTargetOptions } from '../src/sim/faults';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command, FaultKind, WorldState } from '../src/sim/signals';

const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x = 10, y = 10): Command => ({ k: 'place', id, kind, at: { x, y } });
const wires = (pairs: [string, string][]): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));
const scan = (w: WorldState, n: number): WorldState => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const run = (w: WorldState) => tick(w, [{ k: 'run' }]).world;
const press = (w: WorldState, id: string, on = true, settle = 6) => scan(tick(w, [{ k: 'operate', id, pressed: on }]).world, settle);

/** Supply, a cylinder, two pushbuttons straight onto the solenoids, and a lamp on each limit switch. */
const bench = (): WorldState => {
  const w = tick(createWorld(), [
    place('ps', 'supply'), place('cyl', 'cylinder'), place('ext', 'start'), place('ret', 'start'), place('lx', 'lamp'), place('lr', 'lamp'),
    ...wires([['ps.P24', 'ext.A'], ['ext.B', 'cyl.EXT+'], ['ps.P24', 'ret.A'], ['ret.B', 'cyl.RET+'], ['ps.M0', 'cyl.M-'], ['ps.P24', 'cyl.L+'],
      ['cyl.EXT_LS', 'lx.L+'], ['lx.M-', 'ps.M0'], ['cyl.RET_LS', 'lr.L+'], ['lr.M-', 'ps.M0']])]).world;
  expect(w.lastError).toBeNull();
  return w;
};
const cyl = (w: WorldState) => renderSnapshot(w).cylinders.cyl;
const withFault = (kind: FaultKind) => tick(bench(), [{ k: 'injectFault', kind, target: 'cyl', hidden: false }]).world;

describe('cylinder faults', () => {
  it('all four are offered, and only for cylinders', () => {
    const w = bench();
    for (const kind of ['cylinder-no-air', 'cylinder-jammed', 'cylinder-ext-switch-dead', 'cylinder-ret-switch-dead'] as FaultKind[]) {
      expect(faultTargetOptions(w.project, kind).map(o => o.id)).toEqual(['cyl']);
    }
    expect(faultTargetOptions(w.project, 'motor-open-winding').map(o => o.id)).not.toContain('cyl');
  });
  it('no air: the solenoid is energised but the rod never moves and the alarm says why', () => {
    const w = press(run(withFault('cylinder-no-air')), 'ext', true, 40);
    expect(cyl(w).position).toBe(0);
    expect(cyl(w).alarm).toBe('AIR PRESSURE UNAVAILABLE');
  });
  it('jammed: the rod stays put and the travel timeout alarm trips after 2.5 s', () => {
    let w = press(run(withFault('cylinder-jammed')), 'ext', true, 20); // 1 s: not yet
    expect(cyl(w).position).toBe(0);
    expect(cyl(w).alarm).toBeNull();
    w = scan(w, 40);
    expect(cyl(w).position).toBe(0);
    expect(cyl(w).alarm).toBe('CYLINDER TRAVEL TIMEOUT');
  });
  it('dead EXTENDED switch: the rod gets there but the switch never closes (a PLC waiting on it would time out)', () => {
    const w = press(run(withFault('cylinder-ext-switch-dead')), 'ext', true, 60);
    expect(cyl(w)).toMatchObject({ position: 1, extendLimit: false });
    expect(w.deviceOn.lx).toBe(false);
    expect(cyl(w).alarm).not.toBeNull(); // still commanded after 2.5 s of travel/hold → timeout alarm
  });
  it('dead RETRACTED switch: closed at rest in a healthy cylinder, never closes here', () => {
    expect(scan(run(bench()), 4).deviceOn.lr).toBe(true);
    const w = scan(run(withFault('cylinder-ret-switch-dead')), 4);
    expect(cyl(w)).toMatchObject({ position: 0, retractLimit: false });
    expect(w.deviceOn.lr).toBe(false);
  });
  it('the sensor faults leave the other switch alone', () => {
    const w = press(run(withFault('cylinder-ret-switch-dead')), 'ext', true, 40);
    expect(cyl(w)).toMatchObject({ position: 1, extendLimit: true });
    expect(w.deviceOn.lx).toBe(true);
  });
  it('repair (paused) clears the fault AND the latched alarm, and the cylinder then works', () => {
    let w = press(run(withFault('cylinder-no-air')), 'ext', true, 20);
    expect(cyl(w).alarm).not.toBeNull();
    w = press(w, 'ext', false, 3);
    w = tick(tick(w, [{ k: 'pause' }]).world, [{ k: 'repair', target: 'cyl' }]).world;
    expect(w.lastError).toBeNull();
    expect(cyl(w).alarm).toBeNull();
    w = press(run(w), 'ext', true, 40);
    expect(cyl(w)).toMatchObject({ position: 1, alarm: null });
  });
  it('clearing the fault from the instructor panel also resets the alarm', () => {
    let w = press(run(withFault('cylinder-no-air')), 'ext', true, 20);
    const id = w.project.faults![0].id;
    w = tick(press(w, 'ext', false, 3), [{ k: 'clearFault', id }]).world;
    expect(cyl(w).alarm).toBeNull();
  });
  it('a hidden fault produces symptoms but is not named in events', () => {
    let w = tick(bench(), [{ k: 'injectFault', kind: 'cylinder-jammed', target: 'cyl', hidden: true }]).world;
    const details: string[] = [];
    w = tick(run(w), [{ k: 'operate', id: 'ext', pressed: true }]).world;
    for (let i = 0; i < 60; i++) { const r = tick(w); w = r.world; details.push(...r.events.map(e => e.detail)); }
    expect(cyl(w).position).toBe(0);
    expect(details.join('|')).not.toMatch(/jam/i);
  });
  it('is deterministic and survives save/reload', () => {
    const play = () => JSON.stringify(renderSnapshot(press(run(withFault('cylinder-jammed')), 'ext', true, 70)));
    expect(play()).toBe(play());
    expect(() => validateProject(JSON.parse(JSON.stringify(withFault('cylinder-no-air').project)))).not.toThrow();
  });
  it('seeded random injection can pick a cylinder fault on a plant that has a cylinder', () => {
    const w = bench();
    const picked = new Set<string>();
    for (let seed = 1; seed < 80; seed++) {
      const r = tick(w, [{ k: 'injectSeededFault', seed, hidden: false }]).world;
      for (const f of r.project.faults ?? []) picked.add(f.kind);
    }
    expect([...picked].some(k => k.startsWith('cylinder-'))).toBe(true);
  });
});

describe('stack light', () => {
  const light = (): WorldState => {
    const w = tick(createWorld(), [
      place('ps', 'supply'), place('sl', 'stacklight'), place('r', 'start'), place('g', 'start'),
      ...wires([['ps.P24', 'r.A'], ['r.B', 'sl.R'], ['ps.P24', 'g.A'], ['g.B', 'sl.G'], ['ps.M0', 'sl.M-']])]).world;
    expect(w.lastError).toBeNull();
    return w;
  };
  it('has three independent lamps: each lights only when its own terminal is fed', () => {
    let w = run(light());
    expect(w.deviceOn).toMatchObject({ 'sl-R': false, 'sl-Y': false, 'sl-G': false });
    w = press(w, 'r');
    expect(w.deviceOn).toMatchObject({ 'sl-R': true, 'sl-Y': false, 'sl-G': false });
    w = press(w, 'g');
    expect(w.deviceOn).toMatchObject({ 'sl-R': true, 'sl-Y': false, 'sl-G': true });
    w = press(press(w, 'r', false), 'g', false);
    expect(w.deviceOn).toMatchObject({ 'sl-R': false, 'sl-G': false });
  });
  it('without the common M- connection nothing lights', () => {
    const w0 = light();
    const cut = w0.project.wires.find(x => x.to === 'sl.M-')!;
    const w = press(run(tick(w0, [{ k: 'unwire', id: cut.id }]).world), 'r');
    expect(w.deviceOn['sl-R']).toBe(false);
  });
  it('is a normal project part: saves, reloads, and is removed with its wires', () => {
    const w = light();
    expect(() => validateProject(JSON.parse(JSON.stringify(w.project)))).not.toThrow();
    const removed = tick(w, [{ k: 'remove', id: 'sl' }]).world;
    expect(removed.project.wires.every(x => !x.from.startsWith('sl.') && !x.to.startsWith('sl.'))).toBe(true);
  });
  it('a PLC drives it from its outputs', () => {
    const w0 = tick(createWorld(), [
      place('ps', 'supply'), place('p', 'plc16', 250), place('go', 'start'), place('sl', 'stacklight', 600),
      ...wires([['ps.P24', 'p.L+'], ['ps.M0', 'p.M'], ['ps.P24', 'go.A'], ['go.B', 'p.I0.0'], ['p.Q0.0', 'sl.G'], ['p.Q0.1', 'sl.R'], ['ps.M0', 'sl.M-']]),
      { k: 'configureIo', plc: 'p', io: { inputs: { 'I0.0': 'Go' }, outputs: { 'Q0.0': 'Green', 'Q0.1': 'Red' } } },
      { k: 'loadST', source: ['VAR_INPUT', '  Go : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Green : BOOL;', '  Red : BOOL;', 'END_VAR', 'Green := Go;', 'Red := NOT Go;'].join('\n') }]).world;
    expect(w0.lastError).toBeNull();
    let w = scan(run(w0), 6);
    expect(w.deviceOn).toMatchObject({ 'sl-R': true, 'sl-G': false });
    w = press(w, 'go');
    expect(w.deviceOn).toMatchObject({ 'sl-R': false, 'sl-G': true });
  });
});
