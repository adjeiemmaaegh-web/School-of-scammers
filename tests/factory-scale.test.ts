import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody, conserved } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { MAX_BODIES, MAX_SCENE_EQUIPMENT } from '../src/plant/world/types';
import { PHYSICS_DEBUG } from '../src/plant/world/physics';
import type { EquipmentPlacement } from '../src/plant/world/types';
import { createWorld, MAX_COMPONENTS, MAX_WIRES, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command } from '../src/sim/signals';

/** A grid of belts, each carrying `perBelt` cartons: a busy factory floor with real carrier lookups and contact checks. */
function factory(belts: number, bodies: number) {
  const items: EquipmentPlacement[] = Array.from({ length: belts }, (_, i) => ({
    id: `belt${i}`, kind: 'belt-conveyor' as const, originMm: vec((i % 20) * 700, Math.floor(i / 20) * 500, 0), yawDeg: 0,
    params: { lengthMm: 600, widthMm: 300, speedMmS: 250 } }));
  let w = freshWorld(1);
  for (let i = 0; i < bodies; i++) {
    const b = i % belts;
    w = spawnBody(w, 'feeder', { size: vec(100, 100, 80), massKg: 4, pos: vec((b % 20) * 700 + 100 + (Math.floor(i / belts) * 120), Math.floor(b / 20) * 500, 120), supportedBy: `belt${b}`, tags: { origin: 'feeder', material: 'cardboard' } });
  }
  return { items, runtime: freshRuntime(w, items, PLANT_EQUIPMENT) };
}
const inputsFor = (items: EquipmentPlacement[]) => Object.fromEntries(items.map(i => [i.id, { run: true }]));
function run(belts: number, bodies: number, scans: number) {
  const { items, runtime } = factory(belts, bodies);
  const inputs = inputsFor(items);
  let r = runtime;
  const t0 = performance.now();
  for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, inputs);
  return { r, msPerScan: (performance.now() - t0) / scans };
}
const profile: Record<string, number> = {};

describe('R10 factory scale: caps raised and profiled', () => {
  it('the caps are well above the old 60/60/60 limits', () => {
    expect(MAX_COMPONENTS).toBeGreaterThanOrEqual(250); expect(MAX_WIRES).toBeGreaterThanOrEqual(1000);
    expect(MAX_BODIES).toBeGreaterThanOrEqual(240); expect(MAX_SCENE_EQUIPMENT).toBeGreaterThanOrEqual(200);
  });
  it('a maximum-size plant (200 devices, 240 moving bodies) steps correctly, conserves bodies and is deterministic', () => {
    const a = run(MAX_SCENE_EQUIPMENT, MAX_BODIES, 20), b = run(MAX_SCENE_EQUIPMENT, MAX_BODIES, 20);
    expect(a.r.world.bodies).toHaveLength(MAX_BODIES);
    expect(conserved(a.r.world)).toBe(true);
    expect(JSON.stringify(a.r.world)).toBe(JSON.stringify(b.r.world));
    expect(a.r.world.timeMs).toBe(20 * 50);
    profile.plantMaxMsPerScan = Math.round(a.msPerScan * 100) / 100;
    // Resource guard: a scan must cost well under its 50 ms period or the simulator cannot keep real time at x1.
    expect(a.msPerScan).toBeLessThan(50);
  });
  it('plant cost grows gently with size (no runaway): 4x the bodies costs far less than 40x', () => {
    const small = run(50, 60, 20), big = run(MAX_SCENE_EQUIPMENT, MAX_BODIES, 20);
    profile.plant60BodyMsPerScan = Math.round(small.msPerScan * 100) / 100;
    expect(big.msPerScan / Math.max(small.msPerScan, 0.05)).toBeLessThan(40);
  });
  it('refuses to exceed the plant caps instead of degrading unboundedly', () => {
    expect(() => factory(MAX_SCENE_EQUIPMENT + 1, 1)).toThrow(/Too many plant devices/);
    expect(() => factory(MAX_SCENE_EQUIPMENT, 1)).not.toThrow();
    let w = freshWorld(1);
    for (let i = 0; i < MAX_BODIES + 5; i++) w = spawnBody(w, 'feeder', { size: vec(10, 10, 10), massKg: 1, pos: vec((i % 50) * 20, Math.floor(i / 50) * 20, 0) });
    expect(w.bodies).toHaveLength(MAX_BODIES);
  });
});

describe('R10 the spatial broad phase changes speed, never results', () => {
  /** Seeded dense scene: cartons packed on belts with stoppers, so many pairs interact across grid-cell boundaries. */
  function dense(seed: number) {
    let state = seed >>> 0;
    const rnd = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
    const items: EquipmentPlacement[] = [];
    for (let i = 0; i < 6; i++) items.push({ id: `belt${i}`, kind: 'belt-conveyor', originMm: vec(0, i * 360, 0), yawDeg: 0, params: { lengthMm: 1600, widthMm: 300, speedMmS: 250 + 10 * Math.floor(rnd() * 40), contactMode: rnd() < 0.5 ? 1 : 0 } });
    for (let i = 0; i < 3; i++) items.push({ id: `stop${i}`, kind: 'stopper', originMm: vec(900 + Math.floor(rnd() * 500), i * 720, 0), yawDeg: 0, params: {} });
    let w = freshWorld(1);
    for (let i = 0; i < 90; i++) {
      const b = Math.floor(rnd() * 6);
      w = spawnBody(w, 'feeder', { size: vec(60 + Math.floor(rnd() * 90), 60 + Math.floor(rnd() * 90), 70), massKg: 2 + Math.floor(rnd() * 8),
        pos: vec(40 + Math.floor(rnd() * 1300), b * 360 + Math.floor(rnd() * 120) - 60, 120), supportedBy: `belt${b}`, tags: { origin: 'feeder', material: 'cardboard' } });
    }
    return { items, runtime: freshRuntime(w, items, PLANT_EQUIPMENT) };
  }
  const simulate = (seed: number, broadPhase: boolean) => {
    const previous = PHYSICS_DEBUG.broadPhase;
    PHYSICS_DEBUG.broadPhase = broadPhase;
    try {
      const { items, runtime } = dense(seed);
      const inputs: Record<string, Record<string, boolean>> = {};
      for (const it of items) inputs[it.id] = it.kind === 'stopper' ? { extend: true } : { run: true };
      let r = runtime;
      for (let i = 0; i < 60; i++) r = stepScene(r, items, PLANT_EQUIPMENT, inputs);
      return r;
    } finally { PHYSICS_DEBUG.broadPhase = previous; }
  };
  it('ten dense seeded factories end byte-identical with the broad phase on and off, and really exercise contact', () => {
    let jams = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const fast = simulate(seed, true), reference = simulate(seed, false);
      expect(JSON.stringify(fast.world), `seed ${seed}`).toBe(JSON.stringify(reference.world));
      expect(conserved(fast.world)).toBe(true);
      jams += fast.world.bodies.filter(b => b.tags.jammed === true).length;
    }
    expect(jams).toBeGreaterThan(0); // the comparison is meaningful: bodies actually queued against each other
  });
});

describe('R10 the electrical project at the component cap', () => {
  /** MAX_COMPONENTS parts: lamps wired in parallel across one supply (2 wires each + the supply). */
  function bigProject() {
    const lamps = MAX_COMPONENTS - 1;
    const cmds: Command[] = [{ k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } }];
    for (let i = 0; i < lamps; i++) cmds.push({ k: 'place', id: `l${i}`, kind: 'lamp', at: { x: 10 + (i % 25) * 40, y: 100 + Math.floor(i / 25) * 40 } });
    for (let i = 0; i < lamps; i++) cmds.push({ k: 'wire', id: `a${i}`, from: 'ps.P24', to: `l${i}.L+` }, { k: 'wire', id: `b${i}`, from: `l${i}.M-`, to: 'ps.M0' });
    return cmds;
  }
  it('builds, validates, round-trips and scans a 250-component, ~500-wire project; every lamp is lit', () => {
    let w = tick(createWorld(), bigProject()).world;
    expect(w.lastError).toBeNull();
    expect(w.project.components).toHaveLength(MAX_COMPONENTS);
    expect(w.project.wires.length).toBeGreaterThanOrEqual(2 * (MAX_COMPONENTS - 1));
    const reloaded = validateProject(JSON.parse(JSON.stringify(w.project)));
    expect(reloaded.components).toHaveLength(MAX_COMPONENTS);
    w = tick(w, [{ k: 'run' }]).world;
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) w = tick(w).world;
    const ms = (performance.now() - t0) / 20;
    profile.project250MsPerScan = Math.round(ms * 100) / 100;
    const lit = Object.entries(renderSnapshot(w).deviceOn).filter(([id, on]) => id.startsWith('l') && on).length;
    expect(lit).toBe(MAX_COMPONENTS - 1);
    expect(ms).toBeLessThan(50);
  });
  it('one component more than the cap is refused by the engine', () => {
    let w = tick(createWorld(), bigProject()).world;
    w = tick(w, [{ k: 'place', id: 'extra', kind: 'lamp', at: { x: 5, y: 5 } }]).world;
    expect(w.lastError).toMatch(/Invalid component placement/);
    expect(w.project.components).toHaveLength(MAX_COMPONENTS);
  });
  it('keeps a profile of the measured costs for the run', () => {
    expect(Object.keys(profile).length).toBeGreaterThan(0);
  });
});
