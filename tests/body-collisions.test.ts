import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';

type Spec = { x: number; vx: number; mass: number; tags?: Record<string, string | number | boolean>; y?: number; vy?: number };
function world(specs: Spec[]) {
  let w = freshWorld();
  for (const s of specs) w = spawnBody(w, 't', { size: vec(100, 100, 100), massKg: s.mass, pos: vec(s.x, s.y ?? 0, 0), tags: { frictionMu: 0.001, floorDynamics: true, ...(s.tags ?? {}) } });
  return { ...w, bodies: w.bodies.map((b, i) => ({ ...b, vel: vec(specs[i].vx, specs[i].vy ?? 0, 0) })) };
}
/** Run until just after the first collision and return the bodies. */
function afterHit(specs: Spec[], scans = 8) {
  let r = freshRuntime(world(specs), [], PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, [], PLANT_EQUIPMENT, {});
  return r.world.bodies;
}
const near = (a: number, b: number, tol = 12) => Math.abs(a - b) <= tol;

describe('R01 collisions between bodies: momentum, restitution and rolling', () => {
  it('without restitution a collision is perfectly inelastic: the bodies move off together (the original rule)', () => {
    const [a, b] = afterHit([{ x: 0, vx: 600, mass: 1 }, { x: 150, vx: 0, mass: 1 }]);
    expect(near(a.vel.x, 300, 20)).toBe(true); expect(near(b.vel.x, 300, 20)).toBe(true);
  });
  it('a perfectly elastic collision of equal masses hands the whole speed to the struck body', () => {
    const [a, b] = afterHit([{ x: 0, vx: 600, mass: 1, tags: { restitution: 0.95 } }, { x: 150, vx: 0, mass: 1, tags: { restitution: 0.95 } }]);
    expect(a.vel.x).toBeLessThan(40); expect(b.vel.x).toBeGreaterThan(540);                 // about e = 0.95: (1-e)/2 and (1+e)/2 of 600
  });
  it('momentum is conserved at every restitution, and the bodies separate faster the bouncier they are', () => {
    const run = (e: number) => afterHit([{ x: 0, vx: 600, mass: 2, tags: { restitution: e } }, { x: 160, vx: 0, mass: 1, tags: { restitution: e } }], 8);
    for (const e of [0, 0.3, 0.6, 0.9]) {
      const [a, b] = run(e);
      expect(a.massKg * a.vel.x + b.massKg * b.vel.x).toBeGreaterThan(1200 * 0.93); expect(a.massKg * a.vel.x + b.massKg * b.vel.x).toBeLessThanOrEqual(1200 * 1.001);
    }
    const sep = (e: number) => { const [a, b] = run(e); return b.vel.x - a.vel.x; };
    expect(sep(0)).toBeLessThan(sep(0.3) + 1); expect(sep(0.3)).toBeLessThan(sep(0.6)); expect(sep(0.6)).toBeLessThan(sep(0.9));
  });
  it('the separation speed is e times the closing speed (the definition of restitution)', () => {
    const [a, b] = afterHit([{ x: 0, vx: 800, mass: 3, tags: { restitution: 0.5 } }, { x: 160, vx: 0, mass: 1, tags: { restitution: 0.5 } }], 8);
    const closing = 800;
    expect((b.vel.x - a.vel.x) / closing).toBeGreaterThan(0.45); expect((b.vel.x - a.vel.x) / closing).toBeLessThan(0.52);
  });
  it('a light body hitting a heavy one bounces back; a heavy one hitting a light one barely slows', () => {
    const [light, heavy] = afterHit([{ x: 0, vx: 600, mass: 1, tags: { restitution: 0.9 } }, { x: 150, vx: 0, mass: 20, tags: { restitution: 0.9 } }], 8);
    expect(light.vel.x).toBeLessThan(-300); expect(heavy.vel.x).toBeGreaterThan(20);
    const [h, l] = afterHit([{ x: 0, vx: 600, mass: 20, tags: { restitution: 0.9 } }, { x: 160, vx: 0, mass: 1, tags: { restitution: 0.9 } }], 8);
    expect(h.vel.x).toBeGreaterThan(500); expect(l.vel.x).toBeGreaterThan(h.vel.x);
  });
  it('the lower of the two restitution values rules: one dead body makes the collision inelastic', () => {
    const [a, b] = afterHit([{ x: 0, vx: 600, mass: 1, tags: { restitution: 0.9 } }, { x: 150, vx: 0, mass: 1 }]);
    expect(near(a.vel.x, 300, 20)).toBe(true); expect(near(b.vel.x, 300, 20)).toBe(true);
  });
  it('rolling resistance is far lower than sliding friction: a rolling body travels much further', () => {
    const dist = (tags: Record<string, string | number | boolean>) => {
      let r = freshRuntime(world([{ x: 0, vx: 1000, mass: 1, tags: { frictionMu: 0.4, ...tags } }]), [], PLANT_EQUIPMENT);
      for (let i = 0; i < 400; i++) r = stepScene(r, [], PLANT_EQUIPMENT, {});
      return r.world.bodies[0].pos.x;
    };
    const sliding = dist({}), rolling = dist({ rolling: true });
    expect(sliding).toBeCloseTo(1000 * 1000 / (2 * 0.4 * 9810), -1);                          // v^2 / (2 mu g) = 127 mm
    expect(rolling).toBeGreaterThan(sliding * 8);                                              // mu 0.03 vs 0.4
    const heavyRoll = dist({ rolling: true, rollingMu: 0.1 });
    expect(heavyRoll).toBeLessThan(rolling); expect(heavyRoll).toBeGreaterThan(sliding);
  });
  it('collisions work along y as well as x', () => {
    const [a, b] = afterHit([{ x: 0, y: 0, vx: 0, vy: 600, mass: 1, tags: { restitution: 0.95 } }, { x: 0, y: 150, vx: 0, vy: 0, mass: 1, tags: { restitution: 0.95 } }]);
    expect(a.vel.y).toBeLessThan(40); expect(b.vel.y).toBeGreaterThan(540);
    expect(Math.abs(a.vel.x)).toBeLessThan(1); expect(Math.abs(b.vel.x)).toBeLessThan(1);
  });
  it('an out-of-range restitution is clamped: a collision never creates energy', () => {
    const [a, b] = afterHit([{ x: 0, vx: 600, mass: 1, tags: { restitution: 5 } }, { x: 150, vx: 0, mass: 1, tags: { restitution: 5 } }]);
    const energy = 0.5 * a.massKg * a.vel.x ** 2 + 0.5 * b.massKg * b.vel.x ** 2;
    expect(energy).toBeLessThanOrEqual(0.5 * 600 ** 2 * 1.001);
    expect(b.vel.x - a.vel.x).toBeLessThanOrEqual(600 * 0.96);
  });
});
