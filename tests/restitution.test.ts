import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { composeShape, shapeErrors, type CustomShapeDef } from '../src/plant/world/custom-shapes';
import { materialSpawn } from '../src/plant/world/materials';
import { vec } from '../src/plant/world/math';

/** Drop a body from `z0` and record its height each scan. */
function drop(z0: number, tags: Record<string, string | number | boolean> = {}, scans = 200) {
  const w = spawnBody(freshWorld(), 't', { size: vec(80, 80, 80), massKg: 1, pos: vec(0, 0, z0), supportedBy: null, tags });
  let r = freshRuntime(w, [], PLANT_EQUIPMENT);
  const zs: number[] = [], vs: number[] = [];
  for (let i = 0; i < scans; i++) { r = stepScene(r, [], PLANT_EQUIPMENT, {}); zs.push(r.world.bodies[0].pos.z); vs.push(r.world.bodies[0].vel.z); }
  return { zs, vs, end: r.world.bodies[0] };
}
/** Peak height reached after the first floor contact. */
const reboundPeak = (zs: number[]): number => { const hit = zs.findIndex(z => z === 0); return hit < 0 ? 0 : Math.max(...zs.slice(hit)); };

describe('R01 bounce on the floor (opt-in restitution)', () => {
  it('a body without the tag stops dead on landing, exactly as before', () => {
    const { zs, end } = drop(200);
    expect(reboundPeak(zs)).toBe(0); expect(end.pos.z).toBe(0); expect(end.vel.z).toBe(0);
  });
  it('a bouncy body rebounds to about e squared of its drop height', () => {
    const half = reboundPeak(drop(200, { restitution: 0.5 }).zs);
    expect(half).toBeGreaterThan(200 * 0.25 * 0.8); expect(half).toBeLessThan(200 * 0.25 * 1.2);
    const high = reboundPeak(drop(200, { restitution: 0.8 }).zs);
    expect(high).toBeGreaterThan(200 * 0.64 * 0.8); expect(high).toBeLessThan(200 * 0.64 * 1.2);
    expect(high).toBeGreaterThan(half * 2);
  });
  it('a higher drop bounces higher and a restitution of zero does not bounce', () => {
    expect(reboundPeak(drop(150, { restitution: 0.5 }).zs)).toBeLessThan(reboundPeak(drop(200, { restitution: 0.5 }).zs));
    expect(reboundPeak(drop(200, { restitution: 0 }).zs)).toBe(0);
  });
  it('successive bounces decay and the body comes to rest on the floor (no endless jitter)', () => {
    const { zs, end } = drop(200, { restitution: 0.5 }, 400);
    const peaks: number[] = [];
    for (let i = 1; i < zs.length - 1; i++) if (zs[i] > zs[i - 1] && zs[i] >= zs[i + 1] && zs[i] > 0) peaks.push(zs[i]);
    expect(peaks.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < peaks.length; i++) expect(peaks[i]).toBeLessThan(peaks[i - 1]);
    expect(end.pos.z).toBe(0); expect(end.vel.z).toBe(0);
  });
  it('a gentle landing (a few mm of drop) does not bounce, and an out-of-range tag is clamped, never amplifying', () => {
    expect(reboundPeak(drop(1, { restitution: 0.9 }).zs)).toBe(0);
    const peak = reboundPeak(drop(200, { restitution: 5 }).zs);                      // clamped to 0.95
    expect(peak).toBeLessThan(200);                                                  // never gains energy
    expect(peak).toBeGreaterThan(200 * 0.9 * 0.8);
  });
  it('custom shapes can set restitution; it is validated and reaches the spawned body', () => {
    const shape: CustomShapeDef = { id: 'ball', label: 'Ball', massKg: 1, restitution: 0.6, blocks: [{ x: 0, y: 0, z: 0, w: 60, d: 60, h: 60 }] };
    expect(shapeErrors(shape)).toEqual([]);
    expect(shapeErrors({ ...shape, restitution: 1 })[0]).toMatch(/restitution/);
    expect(shapeErrors({ ...shape, restitution: -0.1 })[0]).toMatch(/restitution/);
    const spawn = materialSpawn(composeShape(shape), vec(0, 0, 200));
    expect(spawn.tags?.restitution).toBe(0.6);
    expect(composeShape({ ...shape, restitution: undefined }).extraTags).toBeUndefined();
    expect(reboundPeak(drop(200, { restitution: 0.6 }).zs)).toBeGreaterThan(30);
  });
});
