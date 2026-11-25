import { describe, expect, it } from 'vitest';
import { DemoBuilder } from '../src/plant/demos/builder';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';
import { customMaterialsOf } from '../src/sim/p3-plant-bridge';
import { composeShape, type CustomShapeDef } from '../src/plant/world/custom-shapes';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { MATERIALS } from '../src/plant/world/materials';
import type { Command, ProjectFile, WorldState } from '../src/sim/signals';

const N = MATERIALS.length;
/** An L-shaped bracket: a 100 x 60 x 20 base with a 20 x 60 x 80 upright at one end. */
const lbar: CustomShapeDef = { id: 'my-bracket', label: 'My bracket', massKg: 3, frictionMu: 0.35, blocks: [{ x: 0, y: 0, z: 0, w: 100, d: 60, h: 20 }, { x: 0, y: 0, z: 20, w: 20, d: 60, h: 80 }] };
const tall: CustomShapeDef = { id: 'my-post', label: 'My post', massKg: 1, blocks: [{ x: 0, y: 0, z: 0, w: 40, d: 40, h: 300 }] };

function line(materialId: number, extra: Partial<ProjectFile> = {}, collect?: number): ProjectFile {
  const b = new DemoBuilder();
  b.place('feed', 'box-feeder', -300, 0, { materialId, rateMs: 500, quantity: 1 }).place('belt', 'belt-conveyor', 100, 0, { lengthMm: 1200 })
    .place('bin', 'collector', 900, 0, collect ? { acceptMaterial: collect } : {});
  b.hardEnable('feed', 'enable').hardEnable('bin', 'enable').hardEnable('belt', 'run');
  return { ...b.build('VAR_INPUT In0 : BOOL; END_VAR VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := In0;'), ...extra };
}
const load = (p: ProjectFile): WorldState => {
  const w = tick(createWorld(), [{ k: 'loadProject', project: p }]).world;
  expect(w.lastError).toBeNull();
  return tick(w, [{ k: 'run' }]).world;
};
const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const send = (w: WorldState, ...c: Command[]) => tick(w, c).world;

describe('R02 learner-authored shapes live in the project and reach the plant', () => {
  it('a project with no shapes is unchanged: no customShapes field and no extra materials', () => {
    expect(customMaterialsOf({})).toEqual([]);
    expect(validateProject(line(0)).customShapes).toBeUndefined();
  });
  it('a feeder set to the first custom index spawns the learner\'s composite: parts, mass, envelope and friction', () => {
    const w = scans(load(line(N + 1, { customShapes: [lbar] })), 20);
    const spec = composeShape(lbar);
    expect(w.plantWorld.world.spawnedCount).toBe(1);
    const b = w.plantWorld.world.bodies[0];
    expect(b.parts?.length).toBe(2);
    expect(b.massKg).toBeCloseTo(3, 6);
    expect(b.size).toEqual(spec.sizeMm);
    expect(b.tags.material).toBe('my-bracket');
    expect(b.tags.frictionMu).toBe(0.35);
  });
  it('the second custom index spawns the second shape, and a collector accepts only the shape it is set to', () => {
    const p = line(N + 2, { customShapes: [lbar, tall] }, N + 2);
    let w = scans(load(p), 400);
    expect(w.plantWorld.world.model.bin.count).toBe(1);                      // its own shape was collected
    const wrong = line(N + 2, { customShapes: [lbar, tall] }, N + 1);
    w = scans(load(wrong), 400);
    expect(w.plantWorld.world.model.bin.count).toBe(0);                      // the bin wants the bracket, the feeder makes posts
    expect(w.plantWorld.world.bodies.some(b => b.size.z === 300)).toBe(true);
  });
  it('a device may not name a custom shape that does not exist, and shapes are validated like any saved data', () => {
    expect(() => validateProject(line(N + 1))).toThrow(/not defined in this project/);
    expect(() => validateProject(line(N + 2, { customShapes: [lbar] }))).toThrow(/not defined/);
    expect(() => validateProject(line(N + 1, { customShapes: [{ ...lbar, massKg: 0 }] }))).toThrow(/mass/);
    expect(() => validateProject(line(0, { customShapes: [lbar, lbar] }))).toThrow(/twice/);
    expect(() => validateProject(line(0, { customShapes: [{ ...lbar, id: MATERIALS[0].id }] }))).toThrow(/catalogue material/);
    expect(() => validateProject(line(0, { customShapes: Array.from({ length: 9 }, (_, i) => ({ ...tall, id: 's' + i })) }))).toThrow(/at most 8/);
    expect(() => validateProject(line(0, { customShapes: [{ ...lbar, blocks: [lbar.blocks[0], { x: 500, y: 500, z: 500, w: 10, d: 10, h: 10 }] }] }))).toThrow(/touch or overlap/);
  });
  it('defineShape adds, replaces and removeShape deletes, while paused, with a clear error for bad input', () => {
    let w = tick(createWorld(), [{ k: 'loadProject', project: line(0) }]).world;
    w = send(w, { k: 'defineShape', shape: lbar });
    expect(w.lastError).toBeNull(); expect(w.project.customShapes).toEqual([lbar]);
    w = send(w, { k: 'defineShape', shape: { ...lbar, massKg: 5 } });                     // same id: replaced, not duplicated
    expect(w.project.customShapes).toHaveLength(1); expect(w.project.customShapes![0].massKg).toBe(5);
    w = send(w, { k: 'defineShape', shape: tall });
    expect(w.project.customShapes!.map(s => s.id)).toEqual(['my-bracket', 'my-post']);
    w = send(w, { k: 'defineShape', shape: { ...tall, id: 'Bad Id' } });
    expect(w.lastError).toMatch(/id must be/); expect(w.project.customShapes).toHaveLength(2);
    w = send(w, { k: 'removeShape', id: 'my-post' });
    expect(w.project.customShapes!.map(s => s.id)).toEqual(['my-bracket']);
    w = send(w, { k: 'removeShape', id: 'my-bracket' });
    expect(w.project.customShapes).toBeUndefined();
    w = send(w, { k: 'removeShape', id: 'ghost' });
    expect(w.lastError).toMatch(/No custom shape ghost/);
    const running = tick(w, [{ k: 'run' }]).world;
    expect(send(running, { k: 'defineShape', shape: lbar }).lastError).toMatch(/Pause/);
  });
  it('removal is refused while a device still uses the shape or one after it (positions must not shift under a device)', () => {
    let w = tick(createWorld(), [{ k: 'loadProject', project: line(N + 2, { customShapes: [lbar, tall] }) }]).world;
    expect(w.lastError).toBeNull();
    w = send(w, { k: 'removeShape', id: 'my-bracket' });                                   // the feeder uses #2, which would shift to #1
    expect(w.lastError).toMatch(/still uses/); expect(w.project.customShapes).toHaveLength(2);
    w = send(w, { k: 'removeShape', id: 'my-post' });
    expect(w.lastError).toMatch(/still uses/);
    w = send(w, { k: 'setParam', id: 'feed', key: 'materialId', value: 0 });
    w = send(w, { k: 'removeShape', id: 'my-post' });
    expect(w.lastError).toBeNull(); expect(w.project.customShapes).toHaveLength(1);
  });
  it('shapes survive save and load, and a loaded project still spawns them', () => {
    const p = line(N + 1, { customShapes: [lbar] });
    const copy = JSON.parse(JSON.stringify(validateProject(p))) as ProjectFile;
    expect(copy.customShapes).toEqual([lbar]);
    const w = scans(load(copy), 20);
    expect(w.plantWorld.world.spawnedCount).toBe(1);
  });
  it('replacing a shape changes what NEW parts look like (mass and envelope follow the definition)', () => {
    const heavy = { ...lbar, massKg: 40 };
    const w = scans(load(line(N + 1, { customShapes: [heavy] })), 20);
    const b = w.plantWorld.world.bodies[0];
    expect(b.massKg).toBeCloseTo(40, 6);
  });
  it('the feeder keeps the exit clear for the custom shape\'s own size: a wide part waits for a body a default-sized part would clear', () => {
    const feeder = (shape: CustomShapeDef) => ({ id: 'f', kind: 'box-feeder', originMm: vec(0, 0, 0), yawDeg: 0 as const, params: { materialId: N + 1 } });
    const spawnedWith = (shape: CustomShapeDef): number => {
      let w = spawnBody(freshWorld(), 't', { shape: 'box', size: vec(100, 100, 100), massKg: 1, pos: vec(400, 0, 120), supportedBy: null });
      const item = feeder(shape);
      let r = freshRuntime(w, [item], PLANT_EQUIPMENT);
      r = stepScene(r, [item], PLANT_EQUIPMENT, { f: { feed: true } }, {}, 50, [composeShape(shape)]);
      return r.world.spawnedCount - 1;                                                // minus the parked body
    };
    expect(spawnedWith({ id: 'wide', label: 'wide', massKg: 1, blocks: [{ x: 0, y: 0, z: 0, w: 1000, d: 100, h: 100 }] })).toBe(0);   // 1000 wide + 100: overlaps the body 400 mm away
    expect(spawnedWith({ id: 'slim', label: 'slim', massKg: 1, blocks: [{ x: 0, y: 0, z: 0, w: 50, d: 50, h: 100 }] })).toBe(1);       // 50 wide clears it
  });
});
