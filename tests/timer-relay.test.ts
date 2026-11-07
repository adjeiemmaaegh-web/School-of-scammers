import { describe, expect, it } from 'vitest';
import { faultTargetOptions } from '../src/sim/faults';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x = 10, y = 10): Command => ({ k: 'place', id, kind, at: { x, y } });
const wires = (pairs: [string, string][]): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));
const scan = (w: WorldState, n: number): WorldState => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const run = (w: WorldState) => tick(w, [{ k: 'run' }]).world;
const press = (w: WorldState, id: string, on = true, settle = 2) => scan(tick(w, [{ k: 'operate', id, pressed: on }]).world, settle);
const timer = (w: WorldState) => renderSnapshot(w).timers.t;

/** START feeds the timer coil while held. A "late" lamp is on its NO contact and an "early" lamp on its NC contact. */
const bench = (extra: Command[] = []): WorldState => {
  const w = tick(createWorld(), [
    place('ps', 'supply'), place('go', 'start'), place('t', 'timerelay'), place('late', 'lamp'), place('early', 'lamp'),
    ...wires([['ps.P24', 'go.A'], ['go.B', 't.A1'], ['t.A2', 'ps.M0'], ['ps.P24', 't.13'], ['t.14', 'late.L+'], ['late.M-', 'ps.M0'],
      ['ps.P24', 't.21'], ['t.22', 'early.L+'], ['early.M-', 'ps.M0']]), ...extra]).world;
  expect(w.lastError).toBeNull();
  return w;
};
const setDelay = (w: WorldState, value: number) => tick(w, [{ k: 'setParam', id: 't', key: 'delayMs', value }]).world;

describe('device settings (params)', () => {
  it('a timer relay defaults to 2 s and the default is not stored in the project', () => {
    const w = bench();
    expect(timer(w).delayMs).toBe(2000);
    expect(w.project.params).toBeUndefined();
  });
  it('setParam stores a non-default value, shows it in the snapshot and round-trips through save/reload', () => {
    const w = setDelay(bench(), 500);
    expect(w.lastError).toBeNull();
    expect(w.project.params).toEqual({ t: { delayMs: 500 } });
    expect(timer(w).delayMs).toBe(500);
    const reloaded = tick(createWorld(), [{ k: 'loadProject', project: validateProject(JSON.parse(JSON.stringify(w.project))) } as Command]).world;
    expect(reloaded.project.params).toEqual({ t: { delayMs: 500 } });
  });
  it('setting it back to the default removes the entry', () => {
    const w = setDelay(setDelay(bench(), 500), 2000);
    expect(w.project.params).toBeUndefined();
  });
  it('rejects out-of-range, off-step, non-numeric values, unknown settings and devices without settings', () => {
    let w = bench();
    for (const value of [0, 50, 60100, 150, Number.NaN, Infinity]) {
      const r = setDelay(w, value);
      expect(r.lastError, String(value)).not.toBeNull();
      expect(r.project.params).toBeUndefined();
    }
    expect(tick(w, [{ k: 'setParam', id: 't', key: 'bogus', value: 100 }]).world.lastError).not.toBeNull();
    expect(tick(w, [{ k: 'setParam', id: 'late', key: 'delayMs', value: 100 }]).world.lastError).not.toBeNull();
    expect(tick(w, [{ k: 'setParam', id: 'nope', key: 'delayMs', value: 100 }]).world.lastError).not.toBeNull();
    w = setDelay(w, 100); expect(w.lastError).toBeNull(); // the bounds themselves are allowed
    w = setDelay(w, 60000); expect(w.lastError).toBeNull();
  });
  it('can only be changed while paused', () => {
    const w = run(bench());
    const r = setDelay(w, 500);
    expect(r.lastError).not.toBeNull();
    expect(timer(r).delayMs).toBe(2000);
  });
  it('hand-edited project files with bad settings are refused', () => {
    const project = JSON.parse(JSON.stringify(bench().project));
    for (const params of [{ t: { delayMs: 10 } }, { t: { delayMs: 'fast' } }, { t: { other: 100 } }, { late: { delayMs: 500 } }, { ghost: { delayMs: 500 } }, [], { t: [] }]) {
      expect(() => validateProject({ ...project, params }), JSON.stringify(params)).toThrow();
    }
    expect(() => validateProject({ ...project, params: { t: { delayMs: 500 } } })).not.toThrow();
  });
  it('a file that spells out the default is normalised, so equal projects stay byte-identical', () => {
    const project = JSON.parse(JSON.stringify(bench().project));
    expect(validateProject({ ...project, params: { t: { delayMs: 2000 } } }).params).toBeUndefined();
    expect(validateProject({ ...project, params: { t: { delayMs: 2500 } } }).params).toEqual({ t: { delayMs: 2500 } });
  });
  it('removing the device removes its settings', () => {
    const w = tick(setDelay(bench(), 500), [{ k: 'remove', id: 't' }]).world;
    expect(w.project.params).toBeUndefined();
  });
});

describe('on-delay relay', () => {
  it('before the coil is energised the NC contact passes power and the NO contact does not', () => {
    const w = scan(run(bench()), 4);
    expect(w.deviceOn).toMatchObject({ late: false, early: true });
    expect(timer(w)).toMatchObject({ elapsedMs: 0, done: false });
  });
  it('after the delay the NO contact closes and the NC opens, and not a scan sooner', () => {
    let w = setDelay(bench(), 1000);
    w = press(run(w), 'go', true, 9); // 10 scans: 0.5 s into the delay
    expect(timer(w).elapsedMs).toBe(500);
    expect(w.deviceOn).toMatchObject({ late: false, early: true });
    w = scan(w, 8); // 0.9 s
    expect(timer(w).done).toBe(false);
    expect(w.deviceOn).toMatchObject({ late: false, early: true });
    w = scan(w, 4); // past 1.0 s plus the one-scan contact delay
    expect(timer(w)).toMatchObject({ elapsedMs: 1000, done: true });
    expect(w.deviceOn).toMatchObject({ late: true, early: false });
  });
  it('the delay setting really changes the timing', () => {
    const lateAfter = (ms: number) => {
      let w = press(run(setDelay(bench(), ms)), 'go', true, 1);
      let n = 1;
      while (!w.deviceOn.late && n < 1500) { w = scan(w, 1); n++; }
      return n;
    };
    const short = lateAfter(500), long = lateAfter(3000);
    expect(short).toBeGreaterThanOrEqual(10); expect(short).toBeLessThanOrEqual(12);
    expect(long).toBeGreaterThanOrEqual(60); expect(long).toBeLessThanOrEqual(62);
  });
  it('releasing the coil mid-delay resets the timer, so the next press starts from zero', () => {
    let w = setDelay(bench(), 1000);
    w = press(run(w), 'go', true, 14); // 0.7 s
    expect(timer(w).elapsedMs).toBeGreaterThan(600);
    w = press(w, 'go', false, 2);
    expect(timer(w).elapsedMs).toBe(0);
    w = press(w, 'go', true, 14); // another 0.7 s: would be past 1 s if the first press had counted
    expect(w.deviceOn.late).toBe(false);
    expect(timer(w).elapsedMs).toBeLessThan(1000);
  });
  it('the contacts release as soon as the coil drops (on-delay, no off-delay)', () => {
    let w = setDelay(bench(), 500);
    w = press(run(w), 'go', true, 20);
    expect(w.deviceOn.late).toBe(true);
    w = press(w, 'go', false, 3);
    expect(w.deviceOn).toMatchObject({ late: false, early: true });
  });
  it('pausing holds the timer where it is (a halted scan), and reset clears it but keeps the setting', () => {
    let w = setDelay(bench(), 1000);
    w = press(run(w), 'go', true, 9);
    w = tick(w, [{ k: 'pause' }]).world;
    expect(timer(w).elapsedMs).toBe(500);
    w = scan(w, 5);
    expect(timer(w).elapsedMs).toBe(500);
    w = tick(w, [{ k: 'reset' }]).world;
    expect(timer(w)).toMatchObject({ elapsedMs: 0, delayMs: 1000, done: false });
  });
  it('an open coil never starts timing; welded contacts stay transferred', () => {
    let w = bench([{ k: 'injectFault', kind: 'contactor-coil-open', target: 't', hidden: false }]);
    w = setDelay(w, 500);
    w = press(run(w), 'go', true, 40);
    expect(timer(w)).toMatchObject({ elapsedMs: 0, done: false });
    expect(w.deviceOn.late).toBe(false);
    w = bench([{ k: 'injectFault', kind: 'contactor-welded', target: 't', hidden: false }]);
    w = scan(run(setDelay(w, 500)), 4);
    expect(w.deviceOn).toMatchObject({ late: true, early: false }); // contacts transferred with the coil never energised
  });
  it('is offered as a fault target', () => {
    const w = bench();
    expect(faultTargetOptions(w.project, 'contactor-coil-open').map(o => o.id)).toContain('t');
    expect(faultTargetOptions(w.project, 'contactor-welded').map(o => o.id)).toContain('t');
  });
  it('a hard-wired star-style sequence works with no PLC: START runs motor A at once and motor B only after the delay', () => {
    // K (plain relay) seals in on START. Its NO contact feeds motor A and the timer coil; the timer's NO contact feeds motor B.
    let w = tick(createWorld(), [
      place('ps', 'supply'), place('start', 'start'), place('stop', 'stop'), place('k', 'relay'), place('t', 'timerelay'), place('ma', 'lamp'), place('mb', 'lamp'),
      ...wires([['ps.P24', 'stop.A'], ['stop.B', 'start.A'], ['stop.B', 'k.13'], ['start.B', 'k.A1'], ['k.14', 'k.A1'], ['k.A2', 'ps.M0'],
        ['ps.P24', 'k.23'], ['k.24', 'ma.L+'], ['ma.M-', 'ps.M0'], ['k.24', 't.A1'], ['t.A2', 'ps.M0'],
        ['ps.P24', 't.13'], ['t.14', 'mb.L+'], ['mb.M-', 'ps.M0']]),
      { k: 'setParam', id: 't', key: 'delayMs', value: 1000 }]).world;
    expect(w.lastError).toBeNull();
    w = press(run(w), 'start', true, 4);
    w = press(w, 'start', false, 4);
    expect(w.deviceOn).toMatchObject({ k: true, ma: true, mb: false });
    w = scan(w, 24);
    expect(w.deviceOn).toMatchObject({ ma: true, mb: true });
    w = press(w, 'stop', true, 4);
    expect(w.deviceOn).toMatchObject({ k: false, ma: false, mb: false });
  });
  it('is deterministic and replays identically', () => {
    const play = () => JSON.stringify(renderSnapshot(press(run(setDelay(bench(), 700)), 'go', true, 25)));
    expect(play()).toBe(play());
  });
});
