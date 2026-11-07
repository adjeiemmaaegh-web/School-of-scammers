import { describe, expect, it } from 'vitest';
import { blankProgram, createWorld, latchProgram, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const add = (w: WorldState, n = 1, at?: { x: number; y: number }): WorldState => {
  let out = w;
  for (let i = 0; i < n; i++) out = tick(out, [{ k: 'addPanel', template: 'motor-starter', ...(at ? { at } : {}) }]).world;
  return out;
};
const withPanels = (n: number): WorldState => { const w = add(createWorld(), n); expect(w.lastError).toBeNull(); return w; };
const scan = (w: WorldState, n: number): WorldState => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const run = (w: WorldState) => tick(w, [{ k: 'run' }]).world;
const press = (w: WorldState, id: string, settle = 10) => scan(tick(w, [{ k: 'operate', id, pressed: true }]).world, settle);
const release = (w: WorldState, id: string, settle = 10) => scan(tick(w, [{ k: 'operate', id, pressed: false }]).world, settle);
const rm = (w: WorldState, id: string) => tick(w, [{ k: 'remove', id }]).world;
const ids = (w: WorldState) => w.project.components.map(c => c.id);
const valid = (w: WorldState) => expect(() => validateProject(JSON.parse(JSON.stringify(w.project)))).not.toThrow();

describe('addPanel: a ready-made, pre-wired starter panel', () => {
  it('on an empty project adds six parts and eleven wires, and the panel really works', () => {
    const w = withPanels(1);
    expect(ids(w)).toEqual(['supply-1', 'plc-1', 'contactor-1', 'start-1', 'stop-1', 'motor-1']);
    expect(w.project.wires).toHaveLength(11);
    expect(w.project.program.rungs[0].elements).toHaveLength(2); // the first PLC gets the latch in the legacy field
    let r = release(press(run(w), 'start-1'), 'start-1', 20);
    expect(r.deviceOn['motor-1']).toBe(true);
    r = release(press(r, 'stop-1', 20), 'stop-1', 20);
    expect(r.deviceOn['motor-1']).toBe(false);
    valid(w);
  });
  it('a second panel is a second, independent controller with its own program', () => {
    const w = withPanels(2);
    expect(w.project.components.filter(c => c.kind === 'plc').map(c => c.id)).toEqual(['plc-1', 'plc-2']);
    expect(w.project.plcPrograms?.['plc-2']?.program.rungs[0].elements).toHaveLength(2);
    const r = release(press(run(w), 'start-2'), 'start-2', 20);
    expect(r.deviceOn['motor-2']).toBe(true);
    expect(r.deviceOn['motor-1']).toBe(false);
    valid(w);
  });
  it('fills the four floor slots without overlap, then says there is no space', () => {
    const w = withPanels(4);
    const plcs = w.project.components.filter(c => c.kind === 'plc').map(c => [c.x, c.y]);
    expect(new Set(plcs.map(p => p.join(','))).size).toBe(4);
    const full = tick(w, [{ k: 'addPanel', template: 'motor-starter' }]).world;
    expect(full.lastError).toMatch(/No free space/);
    expect(full.project.components).toHaveLength(24);
  });
  it('an explicit position bypasses the slots, up to the 6-PLC limit', () => {
    let w = withPanels(4);
    w = add(w, 1, { x: 100, y: 100 });
    w = add(w, 1, { x: 300, y: 300 });
    expect(w.lastError).toBeNull();
    expect(w.project.components.filter(c => c.kind === 'plc')).toHaveLength(6);
    const seventh = tick(w, [{ k: 'addPanel', template: 'motor-starter', at: { x: 50, y: 50 } }]).world;
    expect(seventh.lastError).toMatch(/At most 6 PLCs/);
  });
  it('picks fresh ids when the user already placed devices called motor-1 and p1-w0', () => {
    const w0 = tick(createWorld(), [{ k: 'place', id: 'motor-1', kind: 'motor', at: { x: 900, y: 500 } },
      { k: 'wire', id: 'p1-w0', from: 'motor-1.L+', to: 'motor-1.M-' }]).world;
    const w = add(w0);
    expect(w.lastError).toBeNull();
    expect(ids(w).filter(i => i === 'motor-1')).toHaveLength(1);
    expect(ids(w)).toContain('motor-2');
    expect(new Set(w.project.wires.map(x => x.id)).size).toBe(w.project.wires.length);
    valid(w);
  });
  it('reuses a slot after its panel is removed', () => {
    let w = withPanels(2);
    for (const id of ['supply-1', 'plc-1', 'contactor-1', 'start-1', 'stop-1', 'motor-1']) w = rm(w, id);
    expect(w.project.components).toHaveLength(6);
    w = add(w);
    expect(w.lastError).toBeNull();
    expect(ids(w)).toContain('plc-1'); // the freed id is reused
    expect(w.project.components).toHaveLength(12);
  });
  it('is refused while the simulation is running, and for an unknown template or bad position', () => {
    const w = run(withPanels(1));
    expect(tick(w, [{ k: 'addPanel', template: 'motor-starter' }]).world.lastError).toMatch(/Pause simulation/);
    const p = withPanels(0);
    expect(tick(p, [{ k: 'addPanel', template: 'nope' as unknown as 'motor-starter' }]).world.lastError).toMatch(/Unknown panel template/);
    expect(tick(p, [{ k: 'addPanel', template: 'motor-starter', at: { x: -5, y: 0 } }]).world.lastError).toMatch(/Unknown panel template or position/);
  });
  it('respects the project size limits', () => {
    let w = createWorld();
    for (let i = 0; i < 6; i++) w = tick(w, [{ k: 'place', id: `x${i}`, kind: 'lamp', at: { x: 10 + i, y: 10 } }]).world;
    const parts: Command[] = Array.from({ length: 50 }, (_, i) => ({ k: 'place', id: `m${i}`, kind: 'motor', at: { x: 10, y: 10 + i } }));
    w = tick(w, parts).world;
    expect(w.project.components.length).toBeGreaterThan(54);
    expect(tick(w, [{ k: 'addPanel', template: 'motor-starter' }]).world.lastError).toMatch(/Not enough room/);
  });
});

describe('remove: deleting a device cleans up everything that depended on it', () => {
  it('removes the device and exactly the wires on its terminals', () => {
    const w = rm(withPanels(1), 'motor-1');
    expect(ids(w)).not.toContain('motor-1');
    expect(w.project.components).toHaveLength(5);
    expect(w.project.wires).toHaveLength(9); // motor.L+ and motor.M- wires are gone
    expect(w.project.wires.some(x => x.from.startsWith('motor-1.') || x.to.startsWith('motor-1.'))).toBe(false);
    valid(w);
  });
  it('is refused while running, and for an unknown id', () => {
    expect(rm(run(withPanels(1)), 'motor-1').lastError).toMatch(/Pause simulation/);
    expect(rm(withPanels(1), 'ghost').lastError).toMatch(/Unknown component/);
  });
  it('the other panel keeps working after one panel\'s motor is removed', () => {
    const w = rm(withPanels(2), 'motor-1');
    const r = release(press(run(w), 'start-2'), 'start-2', 20);
    expect(r.deviceOn['motor-2']).toBe(true);
    expect(r.deviceOn['motor-1']).toBeUndefined();
  });
  it('removing a non-first PLC drops its program entry (and the key when none are left)', () => {
    const w = rm(withPanels(2), 'plc-2');
    expect(w.project.plcPrograms).toBeUndefined();
    expect(Object.hasOwn(w.project, 'plcPrograms')).toBe(false);
    expect(Object.keys(renderSnapshot(w).plcs)).toEqual(['plc-1']);
    valid(w);
  });
  it('removing the FIRST PLC promotes the next one: its program and language become the legacy fields', () => {
    const st = ['VAR_INPUT', ' Start : BOOL;', ' StopOK : BOOL;', 'END_VAR', 'VAR_OUTPUT', ' Run : BOOL;', 'END_VAR',
      'Run := (Start OR Run) AND StopOK;'].join('\n');
    let w = withPanels(3);
    w = tick(w, [{ k: 'loadST', source: st, plc: 'plc-2' }, ]).world;
    w = tick(w, [{ k: 'loadProgram', program: blankProgram(), plc: 'plc-3' }]).world;
    const before2 = w.project.plcPrograms!['plc-2'];
    expect(before2.language).toBe('st');
    w = rm(w, 'plc-1');
    expect(w.project.language).toBe('st'); // plc-2 is the first PLC now and its ST is the legacy program
    expect(w.project.stSource).toBe(st);
    expect(Object.keys(w.project.plcPrograms ?? {})).toEqual(['plc-3']);
    expect(w.project.plcPrograms!['plc-3'].program.rungs[0].elements).toHaveLength(1); // untouched blank
    expect(Object.keys(renderSnapshot(w).plcs)).toEqual(['plc-2', 'plc-3']);
    // plc-2 still behaves as it did: ST latch drives panel 2.
    const r = release(press(run(w), 'start-2'), 'start-2', 20);
    expect(r.deviceOn['motor-2']).toBe(true);
    valid(w);
  });
  it('removing the only PLC keeps the program so the project stays valid', () => {
    const w = rm(withPanels(1), 'plc-1');
    expect(w.project.program.rungs[0].elements).toHaveLength(2);
    expect(w.project.components.some(c => c.kind === 'plc')).toBe(false);
    valid(w);
  });
  it('clears faults on the removed device and on wires that went with it, keeps unrelated faults', () => {
    let w = withPanels(2);
    w = tick(w, [
      { k: 'injectFault', kind: 'contactor-coil-open', target: 'contactor-1', hidden: false },
      { k: 'injectFault', kind: 'contactor-welded', target: 'contactor-2', hidden: false },
      { k: 'injectFault', kind: 'wire-open', target: 'p1-w9', hidden: false }, // contactor-1.14 -> motor-1.L+
    ]).world;
    expect(w.project.faults).toHaveLength(3);
    w = rm(w, 'contactor-1');
    expect(w.project.faults?.map(f => f.target)).toEqual(['contactor-2']); // p1-w9 died with its wire
    valid(w);
    w = rm(w, 'contactor-2');
    expect(w.project.faults).toBeUndefined();
    expect(Object.hasOwn(w.project, 'faults')).toBe(false);
  });
  it('meter probes on the removed device are disconnected; probes elsewhere are kept', () => {
    let w = withPanels(2);
    w = tick(w, [{ k: 'setMeterProbe', lead: 'positive', terminal: 'motor-1.L+' },
      { k: 'setMeterProbe', lead: 'negative', terminal: 'supply-2.M0' }]).world;
    w = rm(w, 'motor-1');
    expect(w.meter.positive).toBeNull();
    expect(w.meter.negative).toBe('supply-2.M0');
    expect(w.meter.status).toBe('select');
  });
  it('per-device runtime state does not linger for a removed device', () => {
    let w = release(press(run(withPanels(2)), 'start-2'), 'start-2', 20);
    expect(w.deviceOn['motor-2']).toBe(true);
    w = tick(w, [{ k: 'pause' }]).world;
    w = rm(w, 'motor-2');
    expect(w.deviceOn).toEqual({});
    expect(w.running).toBe(false);
    const snap = renderSnapshot(scan(run(w), 3));
    expect(Object.keys(snap.deviceOn)).not.toContain('motor-2');
  });
  it('removing everything leaves a valid empty project', () => {
    let w = withPanels(2);
    for (const c of [...w.project.components]) w = rm(w, c.id);
    expect(w.project.components).toEqual([]);
    expect(w.project.wires).toEqual([]);
    valid(w);
  });
});

describe('determinism', () => {
  it('building the same plant twice gives identical projects', () => {
    const build = () => JSON.stringify(rm(withPanels(3), 'plc-1').project);
    expect(build()).toBe(build());
  });
});
