import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { arcContains, arcExit, arcOf, arcTangent } from '../src/plant/world/arc';
import type { EquipmentPlacement } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, y: number, yawDeg: 0 | 90 | 180 | 270 = 0, params: Record<string, number> = {}): EquipmentPlacement => ({ id, kind, originMm: vec(x, y, 0), yawDeg, params });
const run = (items: EquipmentPlacement[], bodies: Array<{ x: number; y: number; carrier?: string; size?: [number, number, number] }>, inputs: Record<string, Record<string, boolean | number>>, scans: number, each?: (r: ReturnType<typeof stepScene>, i: number) => void) => {
  let w = freshWorld();
  for (const b of bodies) w = spawnBody(w, 't', { size: vec(...(b.size ?? [80, 80, 60])), massKg: 1, pos: vec(b.x, b.y, 120), supportedBy: b.carrier ?? null });
  let r = freshRuntime(w, items, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) { r = stepScene(r, items, PLANT_EQUIPMENT, inputs); each?.(r, i); }
  return r;
};

describe('R03 curved belt geometry', () => {
  const left = P('c', 'curved-conveyor', 0, 0, 0, { radiusMm: 600, widthMm: 300 });
  it('the arc starts heading +x and ends heading +y (a left turn); exit and tangent agree', () => {
    const a = arcOf(left);
    const entry = { x: a.cx, y: a.cy - 600, z: 0 };
    expect(arcContains(left, entry)).toBe(true);
    expect(arcTangent(left, entry).x).toBeCloseTo(1, 6); expect(arcTangent(left, entry).y).toBeCloseTo(0, 6);
    const exit = arcExit(left);
    expect(exit.headingDeg).toBe(90);
    expect(arcTangent(left, { x: exit.x, y: exit.y, z: 0 }).y).toBeCloseTo(1, 6);
  });
  it('points off the belt (inside the bend, outside the radius, behind the entry) are not on it', () => {
    const a = arcOf(left);
    expect(arcContains(left, { x: a.cx + 100, y: a.cy - 100, z: 0 })).toBe(false);          // inside the inner radius
    expect(arcContains(left, { x: a.cx + 900, y: a.cy, z: 0 })).toBe(false);                // outside the outer radius
    expect(arcContains(left, { x: a.cx - 300, y: a.cy - 520, z: 0 })).toBe(false);          // before the entry
  });
  it('a right-hand belt mirrors the left one and every yaw rotates the same arc', () => {
    const right = P('r', 'curved-conveyor', 0, 0, 0, { turnRight: 1 });
    expect(arcExit(right).headingDeg).toBe(270);
    const turned = P('t', 'curved-conveyor', 0, 0, 90);
    expect(arcExit(turned).headingDeg).toBe(180);
  });
});

describe('R03 a body really follows the curve', () => {
  const belt = P('c', 'curved-conveyor', 0, 0, 0, { radiusMm: 600, widthMm: 300, speedMmS: 400 });
  it('carried round the 90-degree bend: it ends up heading +y at the exit, staying on the belt all the way', () => {
    const a = arcOf(belt);
    const start = { x: a.cx + 0, y: a.cy - 600 };
    let off = 0, maxRadiusErr = 0;
    const r = run([belt], [{ x: start.x + 30, y: start.y, carrier: 'c' }], { c: { run: true } }, 80, rr => {
      const b = rr.world.bodies[0]; if (!b) return;
      const radius = Math.hypot(b.pos.x - a.cx, b.pos.y - a.cy);
      if (b.supportedBy === 'c') maxRadiusErr = Math.max(maxRadiusErr, Math.abs(radius - 600)); else off++;
    });
    const b = r.world.bodies[0];
    expect(b.pos.y).toBeGreaterThan(a.cy - 100);                  // travelled well round the bend (towards the exit side)
    expect(b.vel.y).toBeGreaterThan(300);                        // heading +y by the end
    expect(maxRadiusErr).toBeLessThan(40);                       // followed the arc, did not cut the corner
    expect(off).toBeLessThan(60);                                // left the belt only at the exit (then coasts on)
  });
  it('a stopped curve carries nothing; a reversed one runs backwards', () => {
    const a = arcOf(belt);
    const mid = { x: a.cx + 600 * Math.cos(-Math.PI / 4), y: a.cy + 600 * Math.sin(-Math.PI / 4) };
    expect(run([belt], [{ ...mid, carrier: 'c' }], { c: {} }, 10).world.bodies[0].pos.x).toBeCloseTo(mid.x, 3);
    const back = run([belt], [{ ...mid, carrier: 'c' }], { c: { run: true, reverse: true } }, 5).world.bodies[0];
    expect(back.vel.x).toBeLessThan(0);
  });
  it('a straight belt feeds the curve and a second straight belt takes the load away round the corner (a real L-shaped line)', () => {
    const a = arcOf(belt), exit = arcExit(belt);
    const feeder = P('in', 'belt-conveyor', a.cx - 400, a.cy - 600, 0, { lengthMm: 800, speedMmS: 400, widthMm: 300 });
    const out = P('out', 'belt-conveyor', exit.x, exit.y + 400, 90, { lengthMm: 800, speedMmS: 400, widthMm: 300 });
    const r = run([feeder, belt, out], [{ x: a.cx - 700, y: a.cy - 600, carrier: 'in' }], { in: { run: true }, c: { run: true }, out: { run: true } }, 220);
    const b = r.world.bodies[0];
    expect(b.pos.y).toBeGreaterThan(exit.y + 300);                  // delivered onto the outgoing belt
    expect(Math.abs(b.pos.x - exit.x)).toBeLessThan(60);
  });
});

describe('R15 powered directional transfer: pop-up wheel and chain', () => {
  const unit = (params: Record<string, number> = {}) => P('t', 'transfer-unit', 0, 0, 0, { lengthMm: 600, widthMm: 400, speedMmS: 300, ...params });
  it('without the transfer command the load goes straight; with it, sideways', () => {
    const straight = run([unit()], [{ x: -100, y: 0, carrier: 't' }], { t: { run: true } }, 6).world.bodies[0];
    expect(straight.vel.x).toBeGreaterThan(200); expect(Math.abs(straight.vel.y)).toBeLessThan(1);
    const chain = run([unit()], [{ x: -100, y: 0, carrier: 't' }], { t: { transfer: true } }, 6).world.bodies[0];
    expect(Math.abs(chain.vel.x)).toBeLessThan(1); expect(chain.vel.y).toBeGreaterThan(200);
  });
  it('the side parameter picks the discharge side, and 45 degrees is a diagonal pop-up wheel push', () => {
    const rightSide = run([unit({ side: 1 })], [{ x: -100, y: 0, carrier: 't' }], { t: { transfer: true } }, 6).world.bodies[0];
    expect(rightSide.vel.y).toBeLessThan(-200);
    const popup = run([unit({ transferAngleDeg: 45 })], [{ x: -100, y: 0, carrier: 't' }], { t: { transfer: true } }, 8).world.bodies[0];
    expect(popup.vel.x).toBeGreaterThan(100); expect(popup.vel.y).toBeGreaterThan(100);
    expect(Math.abs(popup.vel.x - popup.vel.y)).toBeLessThan(5);
  });
  it('a sorter lane: a PLC-style command diverts only the selected load to the side belt', () => {
    const main = P('main', 'belt-conveyor', -600, 0, 0, { lengthMm: 800, speedMmS: 300 });
    const t = P('t', 'transfer-unit', 0, 0, 0, { lengthMm: 400, widthMm: 400, speedMmS: 300 });
    const through = P('through', 'belt-conveyor', 600, 0, 0, { lengthMm: 800, speedMmS: 300 });
    const side = P('side', 'belt-conveyor', 0, 500, 90, { lengthMm: 600, speedMmS: 300 });
    const items = [main, t, through, side];
    const go = (divert: boolean) => {
      const r = run(items, [{ x: -900, y: 0, carrier: 'main' }], { main: { run: true }, through: { run: true }, side: { run: true }, t: { run: true, transfer: divert } }, 120);
      return r.world.bodies[0];
    };
    expect(go(false).pos.x).toBeGreaterThan(300);                    // passed straight through
    const diverted = go(true);
    expect(diverted.pos.y).toBeGreaterThan(200);                     // went onto the side belt
    expect(diverted.pos.x).toBeLessThan(200);
  });
  it('a faulted transfer unit (stuck or dead) cannot divert', () => {
    for (const fault of ['transfer-stuck', 'motor-dead']) {
      const r = stepScene(freshRuntime(freshWorld(), [unit()], PLANT_EQUIPMENT), [unit()], PLANT_EQUIPMENT, { t: { transfer: true } }, { t: fault });
      expect(r.world.model.t.done, fault).toBe(false);
    }
    expect(stepScene(freshRuntime(freshWorld(), [unit()], PLANT_EQUIPMENT), [unit()], PLANT_EQUIPMENT, { t: { transfer: true } }, {}).world.model.t.done).toBe(true);
  });
});

describe('R15 merge: two feeder lines join one belt', () => {
  it('bodies from both side branches arrive on the shared belt, none lost', () => {
    const main = P('main', 'belt-conveyor', 0, 0, 0, { lengthMm: 1400, speedMmS: 300, widthMm: 300 });
    const a = P('a', 'belt-conveyor', -300, 450, 270, { lengthMm: 600, speedMmS: 300, widthMm: 300 });
    const b = P('b', 'belt-conveyor', 300, -450, 90, { lengthMm: 600, speedMmS: 300, widthMm: 300 });
    const bin = P('bin', 'collector', 900, 0, 0, {});
    const r = run([main, a, b, bin], [{ x: -300, y: 600, carrier: 'a' }, { x: 300, y: -600, carrier: 'b' }],
      { main: { run: true }, a: { run: true }, b: { run: true }, bin: { enable: true } }, 260);
    expect(r.world.spawnedCount).toBe(2);
    expect(r.world.despawnedCount + r.world.bodies.length).toBe(2);
    expect(r.world.despawnedCount).toBe(2);
  });
});
