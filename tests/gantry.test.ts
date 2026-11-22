import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene, type SceneRuntime } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, y: number, params: Record<string, number> = {}): EquipmentPlacement => ({ id, kind, originMm: vec(x, y, 0), yawDeg: 0, params });
const table = P('table', 'belt-conveyor', 0, 0, { lengthMm: 2400, widthMm: 600 });          // a big, stopped carrier under the gantry
const setup = (gantry: Record<string, number> = {}, mass = 5) => {
  const items = [table, P('g', 'gantry', 0, 0, gantry)];
  const w = spawnBody(freshWorld(), 't', { size: vec(80, 80, 60), massKg: mass, pos: vec(0, 0, 120), supportedBy: 'table' });
  return { items, r: freshRuntime(w, items, PLANT_EQUIPMENT) };
};
type Cmd = Record<string, boolean | number>;
function run(s: ReturnType<typeof setup>, cmd: (i: number) => Cmd, scans: number, faults: Record<string, string | null> = {}, each?: (r: SceneRuntime, i: number) => void) {
  let r = s.r;
  for (let i = 0; i < scans; i++) { r = stepScene(r, s.items, PLANT_EQUIPMENT, { g: cmd(i) }, faults); each?.(r, i); }
  return r;
}
const sig = (r: SceneRuntime, n: string) => r.signals.g[n];

describe('R27 three-axis gantry', () => {
  it('reaches an X/Y/Z target and reports in position; a target outside the travel is refused', () => {
    const r = run(setup(), () => ({ xTargetMm: 600, yTargetMm: 300, zTargetMm: 100 }), 120);
    expect([sig(r, 'xMm'), sig(r, 'yMm'), sig(r, 'zMm')]).toEqual([600, 300, 100]);
    expect(sig(r, 'inPosition')).toBe(true);
    expect(() => run(setup(), () => ({ xTargetMm: 99999, yTargetMm: 0, zTargetMm: 0 }), 1)).toThrow(/Invalid numeric/);
  });
  it('lifts to the safe height before any sideways travel, travels with the gripper clear, then lowers to the commanded Z', () => {
    let sidewaysBelowSafe = false, liftedFirst = false, loweredBeforeArrival = false, px = 0, py = 0, moved = 0;
    const r = run(setup({ safeZMm: 400 }), () => ({ xTargetMm: 600, yTargetMm: 300, zTargetMm: 0 }), 200, {}, r2 => {
      const x = sig(r2, 'xMm') as number, y = sig(r2, 'yMm') as number, z = sig(r2, 'zMm') as number;
      if ((x !== px || y !== py) && z < 399.99) sidewaysBelowSafe = true;             // moved sideways while below the safe height
      if (x !== px || y !== py) moved++;
      if (z > 0 && x === 0 && y === 0) liftedFirst = true;
      if (z < 399.99 && moved > 0 && (x < 600 || y < 300)) loweredBeforeArrival = true;  // dropped before getting there
      px = x; py = y;
    });
    expect(moved).toBeGreaterThan(10);
    expect(liftedFirst).toBe(true);
    expect(sidewaysBelowSafe).toBe(false);
    expect(loweredBeforeArrival).toBe(false);
    expect([sig(r, 'xMm'), sig(r, 'yMm'), sig(r, 'zMm')]).toEqual([600, 300, 0]);       // and it ended lowered at the target
  });
  it('a pure height change needs no lift: it goes straight to Z', () => {
    let sidewaysSeen = false;
    const r = run(setup(), () => ({ xTargetMm: 0, yTargetMm: 0, zTargetMm: 600 }), 80, {}, r2 => { if ((sig(r2, 'xMm') as number) > 0) sidewaysSeen = true; });
    expect(sig(r, 'zMm')).toBe(600); expect(sidewaysSeen).toBe(false);
  });
  it('picks a part, carries it to another place and releases it there', () => {
    const s = setup();
    // grip at the pickup (x 0, y 0, z 0), then carry to (700, 400, 0), release
    const carry: Cmd = { xTargetMm: 700, yTargetMm: 400, zTargetMm: 0 };
    const r = run(s, i => i < 5 ? { grip: true } : i < 220 ? { grip: true, ...carry } : carry, 260);
    const b = r.world.bodies[0];
    expect(b.pos.x).toBeCloseTo(700, 0); expect(b.pos.y).toBeCloseTo(400, 0);
    expect(sig(r, 'partHeld')).toBe(false);                                   // released at the end
    let held = false;
    run(setup(), i => ({ grip: true, xTargetMm: 700, yTargetMm: 400, zTargetMm: 0 }), 200, {}, r2 => { if (sig(r2, 'partHeld')) held = true; });
    expect(held).toBe(true);
  });
  it('payload: a part over the limit is refused with an overload signal; within the limit it is lifted', () => {
    const heavy = run(setup({ payloadKg: 20 }, 30), () => ({ grip: true, zTargetMm: 300 }), 60);
    expect(sig(heavy, 'partHeld')).toBe(false); expect(sig(heavy, 'overload')).toBe(true);
    expect(heavy.world.bodies[0].supportedBy).toBe('table');                  // it never left the table
    const light = run(setup({ payloadKg: 50 }, 30), () => ({ grip: true, zTargetMm: 300 }), 60);
    expect(sig(light, 'partHeld')).toBe(true); expect(sig(light, 'overload')).toBe(false);
  });
  it('an overweight part is refused on the very first scan: it never leaves the table, not even for one step', () => {
    const r = run(setup({ payloadKg: 20 }, 30), () => ({ grip: true, zTargetMm: 300 }), 1);
    expect(r.world.bodies[0].supportedBy).toBe('table');
    expect(r.signals.g.overload).toBe(true);
  });
  it('a safe height above the Z travel is clamped to the travel, so the gantry can still move sideways', () => {
    let highest = 0;
    const r = run(setup({ safeZMm: 2000, riseMm: 800 }), () => ({ xTargetMm: 600, yTargetMm: 0, zTargetMm: 0 }), 300, {}, r2 => { highest = Math.max(highest, sig(r2, 'zMm') as number); });
    expect(sig(r, 'xMm')).toBe(600);
    expect(highest).toBeLessThanOrEqual(800);                                  // never past the physical Z travel
  });
  it('gripping with nothing under it holds nothing', () => {
    const items = [table, P('g', 'gantry', 0, 0)];
    const r = (() => { let rt = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT); for (let i = 0; i < 10; i++) rt = stepScene(rt, items, PLANT_EQUIPMENT, { g: { grip: true } }); return rt; })();
    expect(sig(r, 'partHeld')).toBe(false); expect(sig(r, 'overload')).toBe(false);
  });
  it('faults: a stuck servo does not move, a leaking gripper cannot hold, a slipping axis is slower', () => {
    const stuck = run(setup(), () => ({ xTargetMm: 600, yTargetMm: 0, zTargetMm: 0 }), 100, { g: 'servo-stuck' });
    expect([sig(stuck, 'xMm'), sig(stuck, 'zMm')]).toEqual([0, 0]);
    const leak = run(setup(), () => ({ grip: true }), 20, { g: 'gripper-leak' });
    expect(sig(leak, 'partHeld')).toBe(false);
    const healthy = run(setup(), () => ({ xTargetMm: 1500, yTargetMm: 0, zTargetMm: 0 }), 60);
    const slow = run(setup(), () => ({ xTargetMm: 1500, yTargetMm: 0, zTargetMm: 0 }), 60, { g: 'axis-slip' });
    expect(sig(slow, 'xMm') as number).toBeLessThan((sig(healthy, 'xMm') as number) * 0.6);
  });
  it('the speed setting scales every axis', () => {
    const fast = run(setup({ speedMmS: 800 }), () => ({ xTargetMm: 0, yTargetMm: 0, zTargetMm: 800 }), 20);
    const slow = run(setup({ speedMmS: 200 }), () => ({ xTargetMm: 0, yTargetMm: 0, zTargetMm: 800 }), 20);
    expect(sig(fast, 'zMm') as number).toBeGreaterThan((sig(slow, 'zMm') as number) * 3);
  });
});
