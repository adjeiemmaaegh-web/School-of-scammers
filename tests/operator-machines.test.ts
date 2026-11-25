import { describe, expect, it } from 'vitest';
import { freshWorld } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { STATIC_SOLID_KINDS, staticSolidSize } from '../src/plant/world/solid-geometry';
import type { EquipmentPlacement, World } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, y: number, params: Record<string, number> = {}, yawDeg: 0 | 90 | 180 | 270 = 0): EquipmentPlacement => ({ id, kind, originMm: vec(x, y, 0), yawDeg, params });
const person = (x: number, y: number, goal: { x: number; y: number }): World => ({
  ...freshWorld(),
  trainingOperator: { id: 'training-operator', shape: 'cylinder', size: vec(400, 400, 1800), massKg: 75, pos: vec(x, y, 0), yawDeg: 0, vel: vec(), supportedBy: null, tags: { material: 'person', training: true } },
  operatorGoal: goal,
});
const walk = (items: EquipmentPlacement[], world: World, scans: number) => {
  let r = freshRuntime(world, items, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, {});
  return r.world.trainingOperator!.pos;
};

describe('R24 machinery stops a person', () => {
  for (const kind of STATIC_SOLID_KINDS.filter(k => k !== 'shelf' && k !== 'process-tank')) {
    it(`a ${kind} is not walked through: the operator is held on this side of it`, () => {
      const size = staticSolidSize(kind)!;
      const end = walk([P('m', kind, 1500, 0)], person(0, 0, { x: 3000, y: 0 }), 120);
      expect(end.x).toBeLessThan(1500 - size.x / 2 + 5);                                 // never inside its envelope
      expect(end.x).toBeGreaterThan(1500 - size.x / 2 - 450);                            // and did get right up to it
    });
  }
  it('a production station is a machine frame: it blocks, using its own length and width settings', () => {
    const wide = walk([P('st', 'process-station', 1500, 0, { lengthMm: 800, widthMm: 400 })], person(0, 0, { x: 3000, y: 0 }), 120);
    expect(wide.x).toBeLessThan(1500 - 400 + 5);
    const narrow = walk([P('st', 'process-station', 1500, 0, { lengthMm: 200, widthMm: 400 })], person(0, 0, { x: 3000, y: 0 }), 120);
    expect(narrow.x).toBeLessThan(1500 - 100 + 5); expect(narrow.x).toBeGreaterThan(wide.x + 200);
  });
  it('machines far from the path do not matter, and a goal beside a machine is reachable by walking around it', () => {
    expect(walk([P('m', 'robot-arm', 1500, 3000)], person(0, 0, { x: 3000, y: 0 }), 120).x).toBeGreaterThan(2900);
    const around = walk([P('m', 'robot-arm', 1500, 0)], person(0, -1500, { x: 3000, y: -1500 }), 120);
    expect(around.x).toBeGreaterThan(2900);
  });
  it('the rotated envelope of a machine is used: a quarter-turned palletizer is long in y, not x', () => {
    const straight = walk([P('m', 'palletizer', 1500, 0)], person(0, 0, { x: 3000, y: 0 }), 120);
    const turned = walk([P('m', 'palletizer', 1500, 0, {}, 90)], person(0, 0, { x: 3000, y: 0 }), 120);
    expect(turned.x).toBeGreaterThan(straight.x);                                        // 1000 deep in x when turned vs 1300
  });
  it('a conveyor is stepped over (low, carries people through), but a belt-mounted station still blocks', () => {
    const over = walk([P('b', 'belt-conveyor', 1500, 0, { lengthMm: 1000 })], person(0, 0, { x: 3000, y: 0 }), 120);
    expect(over.x).toBeGreaterThan(2900);
  });
});
