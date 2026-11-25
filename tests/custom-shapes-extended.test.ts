import { describe, expect, it } from 'vitest';
import { composeShape, shapeErrors, type CustomShapeDef } from '../src/plant/world/custom-shapes';
import { materialSpawn } from '../src/plant/world/materials';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { centreOfMassHeight, partBoxes } from '../src/plant/world/geometry';
import { vec } from '../src/plant/world/math';

const def = (blocks: CustomShapeDef['blocks'], extra: Partial<CustomShapeDef> = {}): CustomShapeDef => ({ id: 'x', label: 'X', massKg: 2, blocks, ...extra });
const c45 = Math.SQRT1_2;

describe('R02 rotated blocks', () => {
  it('a block turned about its own centre is collided as its bounding box and drawn at its true size and angle', () => {
    const spec = composeShape(def([{ x: 0, y: 0, z: 0, w: 200, d: 40, h: 50, yawDeg: 45 }]));
    expect(spec.sizeMm.x).toBeCloseTo(240 * c45, 6); expect(spec.sizeMm.y).toBeCloseTo(240 * c45, 6); expect(spec.sizeMm.z).toBe(50);
    expect(spec.parts).toHaveLength(1);
    expect(spec.parts![0].visual).toEqual({ w: 200, d: 40, yawDeg: 45 });
    expect(spec.parts![0].sx).toBeCloseTo(240 * c45, 6);
  });
  it('90 degrees swaps width and depth exactly; 0 and an absent turn are the plain block', () => {
    const turned = composeShape(def([{ x: 0, y: 0, z: 0, w: 200, d: 40, h: 50, yawDeg: 90 }]));
    expect(turned.sizeMm.x).toBeCloseTo(40, 6); expect(turned.sizeMm.y).toBeCloseTo(200, 6);
    const plain = composeShape(def([{ x: 0, y: 0, z: 0, w: 200, d: 40, h: 50 }, { x: 0, y: 0, z: 50, w: 50, d: 40, h: 50 }]));
    expect(plain.parts![0].visual).toBeUndefined();
    expect(composeShape(def([{ x: 0, y: 0, z: 0, w: 200, d: 40, h: 50, yawDeg: 0 }])).parts).toBeUndefined();
  });
  it('the turn is about the block\'s own centre, so its position in the shape does not move', () => {
    const spec = composeShape(def([{ x: 0, y: 0, z: 0, w: 100, d: 100, h: 20 }, { x: 60, y: 30, z: 0, w: 100, d: 40, h: 20, yawDeg: 90 }]));
    const [a, b] = spec.parts!;
    expect(b.dx - a.dx).toBeCloseTo(60, 6);                                              // centres (50,50) and (110,50)
    expect(b.dy - a.dy).toBeCloseTo(0, 6);
  });
  it('connectivity is judged on the turned bounds: blocks that touch only once one is turned are accepted', () => {
    const gap = (yawDeg?: number) => def([{ x: 0, y: 0, z: 0, w: 100, d: 100, h: 20 }, { x: 115, y: 0, z: 0, w: 100, d: 100, h: 20, ...(yawDeg ? { yawDeg } : {}) }]);
    expect(shapeErrors(gap())[0]).toMatch(/touch or overlap/);                             // 15 mm apart
    expect(shapeErrors(gap(45))).toEqual([]);                                              // turned 45 degrees its bounds reach 14.6 mm further
  });
  it('the 5000 mm envelope limit is measured on the turned bounds', () => {
    expect(shapeErrors(def([{ x: 0, y: 0, z: 0, w: 5000, d: 5000, h: 10 }]))).toEqual([]);
    expect(shapeErrors(def([{ x: 0, y: 0, z: 0, w: 5000, d: 5000, h: 10, yawDeg: 45 }]))[0]).toMatch(/envelope exceeds 5000/);   // 7071 mm across
  });
  it('a bad turn or an invalid shape name is refused with the block number', () => {
    expect(shapeErrors(def([{ x: 0, y: 0, z: 0, w: 10, d: 10, h: 10, yawDeg: 400 }]))[0]).toMatch(/block 1: turn/);
    expect(shapeErrors(def([{ x: 0, y: 0, z: 0, w: 10, d: 10, h: 10, yawDeg: NaN }]))[0]).toMatch(/non-finite|turn/);
    expect(shapeErrors(def([{ x: 0, y: 0, z: 0, w: 10, d: 10, h: 10, shape: 'cone' as never }]))[0]).toMatch(/block 1: shape must be/);
  });
});

describe('R02 curved parts: spheres and cylinders', () => {
  it('a sphere block becomes a sphere part, collided as its bounding cube', () => {
    const spec = composeShape(def([{ x: 0, y: 0, z: 0, w: 80, d: 80, h: 80, shape: 'sphere' }]));
    expect(spec.parts).toHaveLength(1); expect(spec.parts![0].shape).toBe('sphere');
    expect([spec.sizeMm.x, spec.sizeMm.y, spec.sizeMm.z]).toEqual([80, 80, 80]);
    const body = spawnBody(freshWorld(), 't', materialSpawn(spec, vec(0, 0, 0))).bodies[0];
    const boxes = partBoxes(body);
    expect(boxes).toHaveLength(1); expect(boxes[0].shape).toBe('box'); expect(boxes[0].half).toEqual({ x: 40, y: 40, z: 40 });
  });
  it('a freely rotated body with a sphere part still collides it as a cube', () => {
    const spec = composeShape(def([{ x: 0, y: 0, z: 0, w: 80, d: 80, h: 80, shape: 'sphere' }]));
    const body = spawnBody(freshWorld(), 't', { ...materialSpawn(spec, vec(0, 0, 0)), headingDeg: 30 }).bodies[0];
    expect(partBoxes(body)[0].shape).toBe('box');
  });
  it('a sphere must have equal width, depth and height', () => {
    expect(shapeErrors(def([{ x: 0, y: 0, z: 0, w: 80, d: 60, h: 80, shape: 'sphere' }]))[0]).toMatch(/block 1: a sphere needs equal/);
    expect(shapeErrors(def([{ x: 0, y: 0, z: 0, w: 80, d: 80, h: 80, shape: 'sphere' }]))).toEqual([]);
  });
  it('a sphere weighs less of the envelope than a box in the centre of mass: a round part on a post is lighter on top', () => {
    const post = composeShape(def([{ x: 0, y: 0, z: 0, w: 40, d: 40, h: 100 }, { x: -20, y: -20, z: 100, w: 80, d: 80, h: 80, shape: 'sphere' }]));
    const cube = composeShape(def([{ x: 0, y: 0, z: 0, w: 40, d: 40, h: 100 }, { x: -20, y: -20, z: 100, w: 80, d: 80, h: 80 }]));
    const high = (spec: ReturnType<typeof composeShape>) => centreOfMassHeight(spawnBody(freshWorld(), 't', materialSpawn(spec, vec(0, 0, 0))).bodies[0]);
    expect(high(post)).toBeLessThan(high(cube));                                         // pi/6 of the cube's volume sits up there instead of all of it
  });
  it('a custom ball bounces, rolls on, and carries its curved part through the real plant', () => {
    const ball = composeShape(def([{ x: 0, y: 0, z: 0, w: 80, d: 80, h: 80, shape: 'sphere' }], { restitution: 0.7, rolling: true }));
    expect(ball.extraTags).toEqual({ restitution: 0.7, rolling: true });
    let w = spawnBody(freshWorld(), 't', { ...materialSpawn(ball, vec(0, 0, 400)), tags: { ...materialSpawn(ball, vec(0, 0, 400)).tags, floorDynamics: true } });
    w = { ...w, bodies: w.bodies.map(b => ({ ...b, vel: vec(800, 0, 0) })) };
    let r = freshRuntime(w, [], PLANT_EQUIPMENT);
    let bounced = false, landed = false;
    for (let i = 0; i < 400; i++) {
      r = stepScene(r, [], PLANT_EQUIPMENT, {});
      const b = r.world.bodies[0];
      if (b.pos.z === 0) landed = true; else if (landed) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(r.world.bodies[0].parts![0].shape).toBe('sphere');
    expect(r.world.bodies[0].pos.x).toBeGreaterThan(800);                                // it rolled a long way (a box with mu 0.4 would stop within ~100 mm)
  });
  it('cylinder blocks keep working and a turned cylinder needs no visual override', () => {
    const spec = composeShape(def([{ x: 0, y: 0, z: 0, w: 60, d: 60, h: 100, shape: 'cylinder', yawDeg: 30 }]));
    expect(spec.parts![0].shape).toBe('cylinder'); expect(spec.parts![0].visual).toBeUndefined();
  });
});
