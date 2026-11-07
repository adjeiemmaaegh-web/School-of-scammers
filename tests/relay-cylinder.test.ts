import { describe, expect, it } from 'vitest';
import { faultTargetOptions } from '../src/sim/faults';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x = 10, y = 10): Command => ({ k: 'place', id, kind, at: { x, y } });
const wires = (pairs: [string, string][], prefix = 'w'): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `${prefix}${i}`, from, to }));
const scan = (w: WorldState, n: number): WorldState => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const run = (w: WorldState) => tick(w, [{ k: 'run' }]).world;
const press = (w: WorldState, id: string, on = true, settle = 6) => scan(tick(w, [{ k: 'operate', id, pressed: on }]).world, settle);

/**
 * A classic hard-wired start/stop seal-in. NO PLC and NO program anywhere: START and the relay's own 13-14 contact are in
 * parallel, STOP (NC) is in series, the second NO contact lights a RUN lamp and the NC contact an IDLE lamp.
 */
const hardwired = (extra: Command[] = []): WorldState => {
  const w = tick(createWorld(), [
    place('ps', 'supply'), place('start', 'start'), place('stop', 'stop'), place('k', 'relay'), place('run', 'lamp'), place('idle', 'lamp'),
    ...wires([
      ['ps.P24', 'stop.A'], ['stop.B', 'start.A'], ['stop.B', 'k.13'], ['start.B', 'k.A1'], ['k.14', 'k.A1'], ['k.A2', 'ps.M0'],
      ['ps.P24', 'k.23'], ['k.24', 'run.L+'], ['run.M-', 'ps.M0'],
      ['ps.P24', 'k.21'], ['k.22', 'idle.L+'], ['idle.M-', 'ps.M0']]), ...extra]).world;
  expect(w.lastError).toBeNull();
  return w;
};

describe('control relay', () => {
  it('is a three-pole device: coil, two NO contacts and one NC contact', () => {
    const t = tick(createWorld(), [place('k', 'relay')]).world.project.components.find(c => c.id === 'k')!;
    expect(t.kind).toBe('relay');
  });
  it('a hard-wired start/stop seal-in works with NO PLC and NO program', () => {
    let w = run(hardwired());
    expect(w.project.components.some(c => c.kind === 'plc' || c.kind === 'plc16')).toBe(false);
    expect(w.deviceOn).toMatchObject({ run: false, idle: true });
    w = press(w, 'start');
    expect(w.deviceOn.k).toBe(true);
    expect(w.deviceOn).toMatchObject({ run: true, idle: false }); // NO closed, NC open
    w = press(w, 'start', false, 12);
    expect(w.deviceOn).toMatchObject({ k: true, run: true, idle: false }); // sealed in by its own 13-14 contact
    w = press(w, 'stop', true, 8);
    expect(w.deviceOn).toMatchObject({ k: false, run: false, idle: true });
    w = press(w, 'stop', false, 12);
    expect(w.deviceOn.k).toBe(false); // STOP released does not restart it: the seal-in is gone
  });
  it('the contacts really are isolated from the coil: they switch whatever circuit the user wires', () => {
    // Coil from the START button; the contact switches a separate lamp fed from the same supply.
    let w = run(hardwired());
    w = press(w, 'start');
    expect(renderSnapshot(w).voltages['k.24']).toBe(24); // contact 23-24 passes 24 V
    expect(renderSnapshot(w).voltages['k.22']).toBeNull(); // contact 21-22 is open: floating downstream
  });
  it('an open coil never pulls in; welded contacts stay on and cannot be stopped', () => {
    let w = run(hardwired([{ k: 'injectFault', kind: 'contactor-coil-open', target: 'k', hidden: false }]));
    w = press(w, 'start', true, 12);
    expect(w.deviceOn.k).toBe(false);
    expect(w.deviceOn.run).toBe(false);
    w = run(hardwired([{ k: 'injectFault', kind: 'contactor-welded', target: 'k', hidden: false }]));
    w = scan(w, 8);
    expect(w.deviceOn).toMatchObject({ run: true, idle: false }); // energised contacts with nobody pressing anything
    w = press(w, 'stop', true, 10);
    expect(w.deviceOn.run).toBe(true); // cannot be stopped
  });
  it('relays are offered as fault targets', () => {
    const w = hardwired();
    expect(faultTargetOptions(w.project, 'contactor-coil-open').map(o => o.id)).toContain('k');
    expect(faultTargetOptions(w.project, 'contactor-welded').map(o => o.id)).toContain('k');
  });
  it('two relays interlock each other through their NC contacts, so only one can be on', () => {
    // Each relay's coil is fed through the OTHER relay's NC contact.
    let w = tick(createWorld(), [
      place('ps', 'supply'), place('a', 'start'), place('b', 'start'), place('ka', 'relay'), place('kb', 'relay'),
      ...wires([['ps.P24', 'a.A'], ['ps.P24', 'b.A'], ['a.B', 'kb.21'], ['kb.22', 'ka.A1'], ['b.B', 'ka.21'], ['ka.22', 'kb.A1'],
        ['ka.A2', 'ps.M0'], ['kb.A2', 'ps.M0']])]).world;
    expect(w.lastError).toBeNull();
    w = run(w);
    w = press(w, 'a', true, 8);
    expect(w.deviceOn).toMatchObject({ ka: true, kb: false });
    w = press(w, 'b', true, 8); // A is on, so A's NC contact is open and B cannot get power
    expect(w.deviceOn).toMatchObject({ ka: true, kb: false });
    w = press(press(w, 'a', false, 8), 'b', true, 8);
    expect(w.deviceOn).toMatchObject({ ka: false, kb: true });
  });
  it('is a normal project part: saves, reloads, and is removed with its wires', () => {
    const w = hardwired();
    expect(() => validateProject(JSON.parse(JSON.stringify(w.project)))).not.toThrow();
    const removed = tick(w, [{ k: 'remove', id: 'k' }]).world;
    expect(removed.project.wires.every(x => !x.from.startsWith('k.') && !x.to.startsWith('k.'))).toBe(true);
    expect(removed.project.components.some(c => c.id === 'k')).toBe(false);
  });
});

/** Supply, a cylinder, two pushbuttons straight onto the solenoids, and a lamp on each limit switch. */
const bench = (extra: Command[] = []): WorldState => {
  const w = tick(createWorld(), [
    place('ps', 'supply'), place('cyl', 'cylinder'), place('ext', 'start'), place('ret', 'start'), place('lx', 'lamp'), place('lr', 'lamp'),
    ...wires([['ps.P24', 'ext.A'], ['ext.B', 'cyl.EXT+'], ['ps.P24', 'ret.A'], ['ret.B', 'cyl.RET+'], ['ps.M0', 'cyl.M-'], ['ps.P24', 'cyl.L+'],
      ['cyl.EXT_LS', 'lx.L+'], ['lx.M-', 'ps.M0'], ['cyl.RET_LS', 'lr.L+'], ['lr.M-', 'ps.M0']]), ...extra]).world;
  expect(w.lastError).toBeNull();
  return w;
};
const cyl = (w: WorldState) => renderSnapshot(w).cylinders.cyl;

describe('pneumatic cylinder', () => {
  it('starts retracted: the RETRACTED limit switch is closed and the EXTENDED one is open', () => {
    const w = scan(run(bench()), 3);
    expect(cyl(w)).toMatchObject({ position: 0, retractLimit: true, extendLimit: false });
    expect(w.deviceOn).toMatchObject({ lr: true, lx: false });
  });
  it('before it has ever run, the multimeter already shows a retracted rod: RETRACTED switch live, EXTENDED switch open', () => {
    const w = bench();
    expect(w.running).toBe(false);
    const read = (pos: string) => tick(w, [{ k: 'setMeterProbe', lead: 'positive', terminal: pos }, { k: 'setMeterProbe', lead: 'negative', terminal: 'ps.M0' }]).world.meter;
    expect(read('cyl.RET_LS')).toMatchObject({ status: 'measured', volts: 24 });
    expect(read('cyl.EXT_LS')).toMatchObject({ status: 'floating' });
  });
  it('extends over about 1.2 s with neither limit closed in between, then holds and closes the EXTENDED switch', () => {
    let w = press(run(bench()), 'ext', true, 12);
    expect(cyl(w).position).toBeGreaterThan(0.3);
    expect(cyl(w).position).toBeLessThan(0.7);
    expect(w.deviceOn).toMatchObject({ lx: false, lr: false }); // mid-travel: both limit switches open
    w = scan(w, 20);
    expect(cyl(w)).toMatchObject({ position: 1, extendLimit: true, retractLimit: false });
    expect(w.deviceOn).toMatchObject({ lx: true, lr: false });
    w = press(w, 'ext', false, 30);
    expect(cyl(w).position).toBe(1); // spring-centred valve holds the rod
  });
  it('retracts (a little faster) when the other solenoid is energised, and closes the RETRACTED switch', () => {
    let w = press(run(bench()), 'ext', true, 40);
    w = press(w, 'ext', false, 3);
    w = press(w, 'ret', true, 10);
    expect(cyl(w).position).toBeLessThan(1);
    w = scan(w, 20);
    expect(cyl(w)).toMatchObject({ position: 0, retractLimit: true });
    expect(w.deviceOn.lr).toBe(true);
  });
  it('energising both solenoids holds the rod and reports the conflict once', () => {
    let w = press(run(bench()), 'ext', true, 12);
    const held = cyl(w).position;
    const events: string[] = [];
    const first = tick(w, [{ k: 'operate', id: 'ret', pressed: true }]); // the conflict starts on THIS scan
    w = first.world; events.push(...first.events.filter(e => e.kind === 'cylinder').map(e => e.detail));
    for (let i = 0; i < 20; i++) { const r = tick(w); w = r.world; events.push(...r.events.filter(e => e.kind === 'cylinder').map(e => e.detail)); }
    expect(cyl(w).position).toBe(held);
    expect(cyl(w).conflict).toBe(true);
    expect(events.filter(e => /Both solenoids/.test(e))).toHaveLength(1);
    w = press(w, 'ret', false, 3); // release one: it moves again
    expect(cyl(w).conflict).toBe(false);
    expect(cyl(w).position).toBeGreaterThan(held);
  });
  it('reports reaching each limit as events', () => {
    let w = run(bench());
    const seen: string[] = [];
    w = tick(w, [{ k: 'operate', id: 'ext', pressed: true }]).world;
    for (let i = 0; i < 40; i++) { const r = tick(w); w = r.world; seen.push(...r.events.filter(e => e.kind === 'cylinder').map(e => e.detail)); }
    expect(seen.some(e => /cyl: Cylinder reached the EXTENDED limit/.test(e))).toBe(true);
  });
  it('with no power on the solenoid supply nothing moves', () => {
    const w0 = bench();
    const cut = w0.project.wires.find(x => x.from === 'ext.B')!;
    const w = press(run(tick(w0, [{ k: 'unwire', id: cut.id }]).world), 'ext', true, 40);
    expect(cyl(w).position).toBe(0);
  });
  it('a PLC drives it through its limit switches: extend until the limit, hold, retract on release', () => {
    const plc = tick(createWorld(), [
      place('ps', 'supply'), place('p', 'plc16', 250), place('go', 'start'), place('c', 'cylinder', 600),
      ...wires([['ps.P24', 'p.L+'], ['ps.M0', 'p.M'], ['ps.P24', 'go.A'], ['go.B', 'p.I0.0'], ['ps.P24', 'c.L+'], ['c.EXT_LS', 'p.I0.1'], ['c.RET_LS', 'p.I0.2'],
        ['p.Q0.0', 'c.EXT+'], ['p.Q0.1', 'c.RET+'], ['ps.M0', 'c.M-']]),
      { k: 'configureIo', plc: 'p', io: { inputs: { 'I0.0': 'Go', 'I0.1': 'Extended', 'I0.2': 'Retracted' }, outputs: { 'Q0.0': 'Ext', 'Q0.1': 'Ret' } } },
      { k: 'loadST', source: ['VAR_INPUT', '  Go : BOOL;', '  Extended : BOOL;', '  Retracted : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Ext : BOOL;', '  Ret : BOOL;', 'END_VAR',
        'Ext := Go AND NOT Extended;', 'Ret := NOT Go AND NOT Retracted;'].join('\n') }]).world;
    expect(plc.lastError).toBeNull();
    const rod = (w: WorldState) => renderSnapshot(w).cylinders.c;
    let w = scan(run(plc), 4);
    expect(rod(w).position).toBe(0);
    w = press(w, 'go', true, 60); // 60 scans = 3 s, long enough to extend fully
    expect(rod(w)).toMatchObject({ position: 1, extendLimit: true });
    expect(renderSnapshot(w).plcs.p.outputs['Q0.0']).toBe(false); // the PLC dropped the solenoid at the limit
    w = press(w, 'go', false, 60);
    expect(rod(w)).toMatchObject({ position: 0, retractLimit: true });
  });
  it('swapping the two solenoid wires reverses the direction (a real wiring mistake with a real effect)', () => {
    const w0 = bench();
    const a = w0.project.wires.find(x => x.from === 'ext.B')!, b = w0.project.wires.find(x => x.from === 'ret.B')!;
    const swapped = tick(w0, [{ k: 'unwire', id: a.id }, { k: 'unwire', id: b.id }, { k: 'wire', id: 'x1', from: 'ext.B', to: 'cyl.RET+' }, { k: 'wire', id: 'x2', from: 'ret.B', to: 'cyl.EXT+' }]).world;
    const w = press(run(swapped), 'ext', true, 40); // "extend" button now drives the retract solenoid: a retracted rod stays put
    expect(cyl(w).position).toBe(0);
    const w2 = press(run(swapped), 'ret', true, 40); // the other button extends it
    expect(cyl(w2).position).toBe(1);
  });
  it('is a normal project part: saves, reloads, is removed with its state, replays identically', () => {
    const w = press(run(bench()), 'ext', true, 40);
    expect(() => validateProject(JSON.parse(JSON.stringify(w.project)))).not.toThrow();
    const removed = tick(tick(w, [{ k: 'pause' }]).world, [{ k: 'remove', id: 'cyl' }]).world;
    expect(renderSnapshot(removed).cylinders).toEqual({});
    const play = () => JSON.stringify(renderSnapshot(press(run(bench()), 'ext', true, 25)));
    expect(play()).toBe(play());
  });
});
