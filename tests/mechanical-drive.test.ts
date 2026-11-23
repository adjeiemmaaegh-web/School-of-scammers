import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene, type SceneRuntime } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { freshProjectPlant, plantPlacements, stepProjectPlant } from '../src/sim/p3-plant-bridge';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';
import { removeComponent } from '../src/sim/panels';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement } from '../src/plant/world/types';
import type { Command, ProjectFile, WorldState } from '../src/sim/signals';

const P = (id: string, kind: string, x: number, params: Record<string, number> = {}): EquipmentPlacement => ({ id, kind, originMm: vec(x, 0, 0), yawDeg: 0, params });
type Cmd = Record<string, boolean | number>;
describe('R14/R28 drive component', () => {
  const run = (cmd: (i: number) => Cmd, scans: number, params: Record<string, number> = {}, faults: Record<string, string | null> = {}): SceneRuntime => {
    const items = [P('d', 'drive', 0, params)];
    let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
    for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { d: cmd(i) }, faults);
    return r;
  };
  it('ramps its shaft speed up to the target over the ramp time rather than jumping, and coasts down the same way', () => {
    const mid = run(() => ({ run: true }), 10);                                  // 0.5 s of a 1 s ramp to 1500 rpm
    expect(mid.signals.d.rpm as number).toBeGreaterThan(600); expect(mid.signals.d.rpm as number).toBeLessThan(900);
    expect(mid.signals.d.atSpeed).toBe(false);
    const full = run(() => ({ run: true }), 40);
    expect(full.signals.d.rpm).toBe(1500); expect(full.signals.d.atSpeed).toBe(true); expect(full.signals.d.running).toBe(true);
    const down = run(i => ({ run: i < 40 }), 50);                                 // 0.5 s after the stop
    expect(down.signals.d.rpm as number).toBeGreaterThan(0); expect(down.signals.d.rpm as number).toBeLessThan(900);
    expect(run(i => ({ run: i < 40 }), 90).signals.d.rpm).toBe(0);
  });
  it('speedPct scales the target (default 100 %), the rated speed and ramp time are settings, and a trip stops it', () => {
    expect(run(() => ({ run: true, speedPct: 40 }), 80).signals.d.rpm).toBe(600);
    expect(run(() => ({ run: true }), 80, { maxRpm: 3000 }).signals.d.rpm).toBe(3000);
    expect(run(() => ({ run: true }), 10, { rampMs: 5000 }).signals.d.rpm as number).toBeLessThan(400);
    const tripped = run(() => ({ run: true }), 80, {}, { d: 'drive-trip' });
    expect(tripped.signals.d.rpm).toBe(0); expect(tripped.signals.d.tripped).toBe(true);
    expect(() => run(() => ({ run: true, speedPct: 150 }), 1)).toThrow(/Invalid numeric/);
  });
});

describe('R14/R28 mechanical links: a drive turns a belt', () => {
  const project = (links: ProjectFile['mechanicalLinks'], extra: Partial<ProjectFile> = {}): ProjectFile => ({
    formatVersion: 1, program: { id: 'p', version: '1', rungs: [{ id: 'r', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' }] } as never,
    components: [{ id: 'd', kind: 'drive', x: 100, y: 100, pressed: false }, { id: 'belt', kind: 'belt-conveyor', x: 300, y: 100, pressed: false }, { id: 'belt2', kind: 'roller-conveyor', x: 500, y: 100, pressed: false }],
    wires: [], ...(links ? { mechanicalLinks: links } : {}), ...extra,
  });
  const load = (p: ProjectFile): WorldState => { const w = tick(createWorld(), [{ k: 'loadProject', project: p }]).world; expect(w.lastError).toBeNull(); return w; };
  const send = (w: WorldState, ...c: Command[]) => tick(w, c).world;

  it('validation: only a drive can turn a belt-type conveyor, once, with a bounded ratio', () => {
    expect(() => validateProject(project([{ drive: 'd', target: 'belt', mmPerRev: 200 }]))).not.toThrow();
    const bad = (l: unknown, re: RegExp) => expect(() => validateProject(project(l as never))).toThrow(re);
    bad([{ drive: 'belt', target: 'belt2', mmPerRev: 200 }], /not a drive/);
    bad([{ drive: 'ghost', target: 'belt', mmPerRev: 200 }], /not a drive/);
    bad([{ drive: 'd', target: 'd', mmPerRev: 200 }], /not a belt/);
    bad([{ drive: 'd', target: 'belt', mmPerRev: 5 }], /10 to 2000/);
    bad([{ drive: 'd', target: 'belt', mmPerRev: 99999 }], /10 to 2000/);
    bad([{ drive: 'd', target: 'belt', mmPerRev: NaN }], /10 to 2000/);
    bad([{ drive: 'd', target: 'belt', mmPerRev: 200 }, { drive: 'd', target: 'belt', mmPerRev: 100 }], /already has a drive/);
    bad('nope', /Invalid mechanical links/);
    bad(Array.from({ length: 17 }, () => ({ drive: 'd', target: 'belt', mmPerRev: 200 })), /at most 16/);
    expect(validateProject(project(undefined)).mechanicalLinks).toBeUndefined();
  });
  it('setMechanicalLink connects, re-ratios and disconnects while paused, and refuses bad input', () => {
    let w = load(project(undefined));
    w = send(w, { k: 'setMechanicalLink', drive: 'd', target: 'belt', mmPerRev: 200 });
    expect(w.lastError).toBeNull(); expect(w.project.mechanicalLinks).toEqual([{ drive: 'd', target: 'belt', mmPerRev: 200 }]);
    w = send(w, { k: 'setMechanicalLink', drive: 'd', target: 'belt', mmPerRev: 300 });
    expect(w.project.mechanicalLinks).toEqual([{ drive: 'd', target: 'belt', mmPerRev: 300 }]);       // replaced, not duplicated
    w = send(w, { k: 'setMechanicalLink', drive: 'd', target: 'belt2', mmPerRev: 100 });
    expect(w.project.mechanicalLinks).toHaveLength(2);
    expect(send(w, { k: 'setMechanicalLink', drive: 'belt', target: 'belt2', mmPerRev: 100 }).lastError).toMatch(/not a drive/);
    w = send(w, { k: 'setMechanicalLink', drive: 'd', target: 'belt', mmPerRev: null });
    expect(w.project.mechanicalLinks).toEqual([{ drive: 'd', target: 'belt2', mmPerRev: 100 }]);
    w = send(w, { k: 'setMechanicalLink', drive: 'd', target: 'belt2', mmPerRev: null });
    expect(w.project.mechanicalLinks).toBeUndefined();
    const running = tick(load(project([{ drive: 'd', target: 'belt', mmPerRev: 200 }])), [{ k: 'run' }]).world;
    expect(send(running, { k: 'setMechanicalLink', drive: 'd', target: 'belt', mmPerRev: null }).lastError).toMatch(/Pause/);
  });
  it('removing the drive or the belt drops the connection', () => {
    const p = project([{ drive: 'd', target: 'belt', mmPerRev: 200 }, { drive: 'd', target: 'belt2', mmPerRev: 100 }]);
    expect(removeComponent(p, 'd')!.mechanicalLinks).toBeUndefined();
    expect(removeComponent(p, 'belt')!.mechanicalLinks).toEqual([{ drive: 'd', target: 'belt2', mmPerRev: 100 }]);
  });

  /** The real project plant bridge: the drive's 24V command energised or not, one part riding the belt. */
  function runBridge(p: ProjectFile, loads: string[], scans: number) {
    let rt = freshProjectPlant(p);
    const belt = plantPlacements(p).find(i => i.id === 'belt')!;
    rt = { ...rt, world: spawnBody(rt.world, 't', { size: vec(80, 80, 60), massKg: 1, pos: vec(belt.originMm.x - 400, belt.originMm.y, 120), supportedBy: 'belt' }) };
    const startX = rt.world.bodies[0].pos.x;
    for (let i = 0; i < scans; i++) rt = stepProjectPlant(rt, p, loads, 50).runtime;
    return { rt, travelled: rt.world.bodies[0].pos.x - startX };
  }
  const geared = (extra: Partial<ProjectFile> = {}) => project([{ drive: 'd', target: 'belt', mmPerRev: 60 }],
    { params: { d: { maxRpm: 600, rampMs: 100 }, belt: { lengthMm: 1200 } }, ...extra });
  it('the belt follows the drive: speed = rpm / 60 x mm per revolution (600 rpm x 60 mm = 600 mm/s) and it carries a part at that speed', () => {
    const r = runBridge(geared(), ['d-CMD_run'], 40);
    expect(r.rt.world.model.d.value).toBe(600);
    expect(r.rt.signals.belt.speed as number).toBeCloseTo(600, 0);
    expect(r.travelled).toBeGreaterThan(1000); expect(r.travelled).toBeLessThan(1200);                // 2 s at 600 mm/s less the ramp and one scan of lag
  });
  it('the ratio sets the belt speed: double the travel per revolution, double the speed', () => {
    const slow = runBridge(project([{ drive: 'd', target: 'belt', mmPerRev: 30 }], { params: { d: { maxRpm: 600, rampMs: 100 }, belt: { lengthMm: 1200 } } }), ['d-CMD_run'], 40);
    const fast = runBridge(geared(), ['d-CMD_run'], 40);
    expect(fast.rt.signals.belt.speed as number).toBeCloseTo((slow.rt.signals.belt.speed as number) * 2, 0);
  });
  it('a stopped drive stops the belt; an unlinked belt ignores the drive entirely', () => {
    const off = runBridge(geared(), [], 40);
    expect(off.rt.world.model.d.value).toBe(0); expect(off.travelled).toBe(0);
    const unlinked = runBridge(project(undefined, { params: { d: { maxRpm: 600, rampMs: 100 }, belt: { lengthMm: 1200 } } }), ['d-CMD_run'], 40);
    expect(unlinked.rt.world.model.d.value).toBe(600); expect(unlinked.travelled).toBe(0);              // the belt has no run command of its own
  });
  it('a tripped drive stops the belt, and the belt speed is capped at the belt rating', () => {
    expect(runBridge(geared({ plantFaults: { d: 'drive-trip' } }), ['d-CMD_run'], 40).travelled).toBe(0);
    const fastRatio = runBridge(project([{ drive: 'd', target: 'belt', mmPerRev: 2000 }], { params: { d: { maxRpm: 600, rampMs: 100 }, belt: { lengthMm: 1200 } } }), ['d-CMD_run'], 40);
    expect(fastRatio.rt.signals.belt.speed as number).toBeLessThanOrEqual(1000);
  });
});
