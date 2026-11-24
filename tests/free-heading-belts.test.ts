import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene, type SceneRuntime } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { footprintOf } from '../src/workspace/floor-plan';
import { editWorkspace, isFreeRotation } from '../src/workspace/editor';
import { plantPlacements } from '../src/sim/p3-plant-bridge';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';
import { vec } from '../src/plant/world/math';
import { arcContains, arcExit, arcOf } from '../src/plant/world/arc';
import type { EquipmentPlacement } from '../src/plant/world/types';
import type { PlacedComponent, ProjectFile } from '../src/sim/signals';

const B = (id: string, x: number, y: number, headingDeg?: number, params: Record<string, number> = {}, yawDeg: 0 | 90 | 180 | 270 = 0, kind = 'belt-conveyor'): EquipmentPlacement =>
  ({ id, kind, originMm: vec(x, y, 0), yawDeg, params: { lengthMm: 1200, speedMmS: 400, ...params }, ...(headingDeg ? { headingDeg } : {}) });
function run(items: EquipmentPlacement[], bodies: Array<{ x: number; y: number; carrier: string }>, scans: number, cmd: Record<string, Record<string, boolean | number>> = {}, each?: (r: SceneRuntime, i: number) => void) {
  let w = freshWorld();
  for (const b of bodies) w = spawnBody(w, 't', { size: vec(80, 80, 60), massKg: 1, pos: vec(b.x, b.y, 120), supportedBy: b.carrier });
  let r = freshRuntime(w, items, PLANT_EQUIPMENT);
  const on = Object.fromEntries(items.map(i => [i.id, { run: true, ...(cmd[i.id] ?? {}) }]));
  for (let i = 0; i < scans; i++) { r = stepScene(r, items, PLANT_EQUIPMENT, on); each?.(r, i); }
  return r;
}
const c45 = Math.SQRT1_2;

describe('R21/R22 conveyors with a free heading', () => {
  it('a belt turned 45 degrees carries a part along the diagonal at belt speed', () => {
    const r = run([B('b', 0, 0, 45)], [{ x: -300, y: -300, carrier: 'b' }], 20);
    const body = r.world.bodies[0];
    expect(body.pos.x - -300).toBeGreaterThan(80); expect(body.pos.y - -300).toBeGreaterThan(80);
    expect(Math.abs((body.pos.x + 300) - (body.pos.y + 300))).toBeLessThan(15);              // equal travel in x and y: a true diagonal
    expect(Math.hypot(body.vel.x, body.vel.y)).toBeGreaterThan(300); expect(Math.hypot(body.vel.x, body.vel.y)).toBeLessThan(420);
    expect(body.vel.x).toBeCloseTo(body.vel.y, 0);
  });
  it('any angle works, including past 90 degrees and combined with the quarter-turn placement', () => {
    const at = (heading: number, yaw: 0 | 90 | 180 | 270, start: [number, number]) => run([B('b', 0, 0, heading, {}, yaw)], [{ x: start[0], y: start[1], carrier: 'b' }], 20).world.bodies[0].vel;
    const v120 = at(30, 90, [0, 0]);                                                      // 90 + 30 = 120 degrees
    expect(v120.x).toBeLessThan(-150); expect(v120.y).toBeGreaterThan(300);
    const v200 = at(20, 180, [0, 0]);                                                     // 200 degrees
    expect(v200.x).toBeLessThan(-300); expect(v200.y).toBeLessThan(-100);
    const v10 = at(10, 0, [0, 0]);
    expect(v10.x).toBeGreaterThan(350); expect(v10.y).toBeGreaterThan(40); expect(v10.y).toBeLessThan(90);
  });
  it('the surface is the true rotated rectangle: a corner the turned belt covers carries a part, a corner it no longer covers does not', () => {
    // 1200 x 300 belt at 45 degrees: the point (400, 400) is 566 mm along it (inside), the point (400, -400) is 566 mm ACROSS it (outside)
    const inside = run([B('b', 0, 0, 45)], [{ x: 400, y: 400, carrier: 'b' }], 2).world.bodies[0];
    expect(inside.supportedBy).toBe('b');
    const outside = run([B('b', 0, 0, 45)], [{ x: 400, y: -400, carrier: 'b' }], 3).world.bodies[0];
    expect(outside.supportedBy).toBeNull();                                                 // not on it any more: it falls
    // and the unrotated rectangle would have covered (500, 0) but the turned belt's width does not reach it
    const side = run([B('b', 0, 0, 45)], [{ x: 500, y: 0, carrier: 'b' }], 3).world.bodies[0];
    expect(side.supportedBy).toBeNull();
    const flat = run([B('b', 0, 0)], [{ x: 500, y: 0, carrier: 'b' }], 3).world.bodies[0];
    expect(flat.supportedBy).toBe('b');
  });
  it('a part is handed from one turned belt to the next along the same diagonal', () => {
    const d = 1200 * c45;                                                                   // belt length projected on each axis
    const items = [B('a', 0, 0, 45), B('b', d, d, 45)];
    const r = run(items, [{ x: -200, y: -200, carrier: 'a' }], 90);
    const body = r.world.bodies[0];
    expect(body.supportedBy).toBe('b');
    expect(body.pos.x).toBeGreaterThan(d);                                                  // it crossed onto the second belt
    expect(Math.abs(body.pos.x - body.pos.y)).toBeLessThan(20);                             // and stayed on the line
  });
  it('an inclined belt with a free heading rises along its own axis, not along x', () => {
    const items = [B('b', 0, 0, 45, { inclineDeg: 15 })];
    const r = run(items, [{ x: -200, y: -200, carrier: 'b' }], 30);
    const body = r.world.bodies[0];
    expect(body.pos.z).toBeGreaterThan(130);                                               // climbed from the start height
    expect(body.supportedBy).toBe('b');
  });
  it('the incline follows the heading: a belt turned to 90 degrees rises along y, so height depends on y and not on x', () => {
    const item = B('b', 0, 0, 90, { inclineDeg: 15 });
    const zAt = (x: number, y: number) => run([item], [{ x, y, carrier: 'b' }], 1).world.bodies[0].pos.z;
    expect(zAt(0, 400) - zAt(0, -400)).toBeCloseTo(800 * Math.tan(15 * Math.PI / 180), 0);  // 800 mm along the belt x tan 15
    expect(Math.abs(zAt(100, 0) - zAt(-100, 0))).toBeLessThan(1);                          // across it the surface is level
  });
  it('the plant context carries the heading to every device that draws or senses with it', async () => {
    const { ctxOf } = await import('../src/plant/world/equipment');
    expect(ctxOf(B('b', 0, 0, 45)).headingDeg).toBe(45);
    expect(ctxOf(B('b', 0, 0)).headingDeg).toBeUndefined();
  });
  it('a transfer unit with a free heading carries along its turned axis and pushes sideways relative to it', () => {
    const unit = (heading: number, transfer: boolean) => run([B('u', 0, 0, heading, { transferAngleDeg: 90, lengthMm: 600 }, 0, 'transfer-unit')], [{ x: 0, y: 0, carrier: 'u' }], 20, { u: { transfer } }).world.bodies[0].vel;
    const along = unit(45, false);
    expect(along.x).toBeGreaterThan(150); expect(along.y).toBeGreaterThan(150); expect(Math.abs(along.x - along.y)).toBeLessThan(20);
    const sideways = unit(45, true);                                                    // 45 + 90 = 135 degrees: up-left
    expect(sideways.x).toBeLessThan(-150); expect(sideways.y).toBeGreaterThan(150);
  });
  it('a curved belt with a free heading is the same arc turned: its centre, exit and carry follow the angle', () => {
    const C = (headingDeg?: number): EquipmentPlacement => ({ id: 'c', kind: 'curved-conveyor', originMm: vec(0, 0, 0), yawDeg: 0, params: { radiusMm: 600, widthMm: 300, speedMmS: 400 }, ...(headingDeg ? { headingDeg } : {}) });
    const flat = C(), turned = C(30);
    const a0 = arcOf(flat), a1 = arcOf(turned);
    expect(Math.hypot(a1.cx, a1.cy)).toBeCloseTo(Math.hypot(a0.cx, a0.cy), 6);                 // the arc swings about the item origin
    expect(Math.atan2(a1.cy, a1.cx) - Math.atan2(a0.cy, a0.cx)).toBeCloseTo(30 * Math.PI / 180, 6);
    expect(arcExit(turned).headingDeg).toBe(arcExit(flat).headingDeg + 30);
    const entry = (a: typeof flat) => { const arc = arcOf(a); const t = (a.yawDeg + (a.headingDeg ?? 0)) * Math.PI / 180; return { x: arc.cx + 600 * Math.sin(t), y: arc.cy - 600 * Math.cos(t), z: 0 }; };
    expect(arcContains(turned, entry(turned))).toBe(true);
    expect(arcContains(flat, entry(turned))).toBe(false);                                      // the turned entry is off the unturned belt
    const r = run([turned], [{ x: entry(turned).x, y: entry(turned).y, carrier: 'c' }], 30);
    const v = r.world.bodies[0].vel;
    expect(Math.hypot(v.x, v.y)).toBeGreaterThan(300);                                         // carried along the turned arc
    expect(r.world.bodies[0].supportedBy).toBe('c');
  });
  it('roller conveyors turn freely too, and a heading on any other device is refused by the plant', () => {
    const r = run([B('r', 0, 0, 30, {}, 0, 'roller-conveyor')], [{ x: 0, y: 0, carrier: 'r' }], 20);
    expect(r.world.bodies[0].vel.y).toBeGreaterThan(40);
    const bad: EquipmentPlacement = { id: 's', kind: 'stopper', originMm: vec(0, 0, 0), yawDeg: 0, params: {}, headingDeg: 30 };
    expect(() => freshRuntime(freshWorld(), [bad], PLANT_EQUIPMENT)).toThrow(/free heading/);
    const range: EquipmentPlacement = { ...B('b', 0, 0), headingDeg: 400 };
    expect(() => freshRuntime(freshWorld(), [range], PLANT_EQUIPMENT)).toThrow(/free heading/);
    const nan: EquipmentPlacement = { ...B('b', 0, 0), headingDeg: NaN };
    expect(() => stepScene(freshRuntime(freshWorld(), [B('b', 0, 0)], PLANT_EQUIPMENT), [nan], PLANT_EQUIPMENT, {})).toThrow(/free heading|Invalid/);
  });
  it('lane occupancy counts only parts inside the turned rectangle', () => {
    const items = [B('b', 0, 0, 45, { zoneSensorMode: 1 })];
    const r = run(items, [{ x: 100, y: 100, carrier: 'b' }, { x: 150, y: -150, carrier: 'b' }], 1);
    expect(r.signals.b.zoneCount).toBe(1);                                                 // (150,-150) is 212 mm across a 300 mm belt: outside it
  });
  it('the drawing follows the true angle', () => {
    const drawing = PLANT_EQUIPMENT['belt-conveyor'].describe(PLANT_EQUIPMENT['belt-conveyor'].fresh({}), { id: 'b', originMm: vec(0, 0, 0), yawDeg: 90, headingDeg: 30, params: {} });
    expect(drawing[0].yawDeg).toBe(120);
    const plain = PLANT_EQUIPMENT['belt-conveyor'].describe(PLANT_EQUIPMENT['belt-conveyor'].fresh({}), { id: 'b', originMm: vec(0, 0, 0), yawDeg: 90, params: {} });
    expect(plain[0].yawDeg).toBe(90);
  });
});

describe('R21/R22 editing a freely headed belt', () => {
  const comp = (id: string, kind: string, x: number, y: number, extra: Partial<PlacedComponent> = {}) => ({ id, kind, x, y, pressed: false, ...extra } as PlacedComponent);
  const project = (components: PlacedComponent[]): ProjectFile => ({
    formatVersion: 1, program: { id: 'p', version: '1', rungs: [{ id: 'r', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' }] } as never, components, wires: [] });
  it('belts, rollers, stations, transfer units and curved belts may turn freely; tanks and turntables still may not', () => {
    expect(isFreeRotation('belt-conveyor')).toBe(true); expect(isFreeRotation('roller-conveyor')).toBe(true);
    for (const k of ['process-tank', 'turntable']) expect(isFreeRotation(k)).toBe(false);
    for (const k of ['process-station', 'transfer-unit', 'curved-conveyor']) expect(isFreeRotation(k)).toBe(true);
  });
  it('rotateFree turns a belt, the project keeps it, and the plant placement carries the heading', () => {
    let p = project([comp('b', 'belt-conveyor', 300, 100)]);
    p = editWorkspace(p, { kind: 'rotateFree', ids: ['b'], deltaDeg: 45 });
    expect(p.components[0].freeYawDeg).toBe(45);
    expect(() => validateProject(p)).not.toThrow();
    expect(plantPlacements(p)[0].headingDeg).toBe(45);
    expect(plantPlacements(project([comp('b', 'belt-conveyor', 300, 100)]))[0].headingDeg).toBeUndefined();
    const w = tick(createWorld(), [{ k: 'loadProject', project: p }, { k: 'editWorkspace', edit: { kind: 'rotateFree', ids: ['b'], deltaDeg: 15 } }]).world;
    expect(w.lastError).toBeNull(); expect(w.project.components[0].freeYawDeg).toBe(60);
  });
  it('a selection with a belt and a lamp turns together, but one holding a turntable is refused naming it', () => {
    const ok = editWorkspace(project([comp('b', 'belt-conveyor', 300, 100), comp('l', 'lamp', 500, 100)]), { kind: 'rotateFree', ids: ['b', 'l'], deltaDeg: 30 });
    expect(ok.components.every(c => c.freeYawDeg === 30)).toBe(true);
    expect(() => editWorkspace(project([comp('b', 'belt-conveyor', 300, 100), comp('s', 'turntable', 500, 100)]), { kind: 'rotateFree', ids: ['b', 's'], deltaDeg: 30 })).toThrow(/turntable/);
  });
  it('the plant placement carries the heading for every kind that takes one, and for no other', () => {
    for (const kind of ['belt-conveyor', 'roller-conveyor', 'process-station', 'transfer-unit', 'curved-conveyor'])
      expect(plantPlacements(project([comp('x', kind, 300, 100, { freeYawDeg: 25 })]))[0].headingDeg, kind).toBe(25);
    expect(plantPlacements(project([comp('x', 'lamp', 300, 100, { freeYawDeg: 25 })])).length).toBe(0);            // not plant equipment at all
  });
  it('the plan footprint is the bounding box of the turned rectangle', () => {
    const flat = footprintOf(comp('b', 'belt-conveyor', 300, 100), { b: { lengthMm: 1200, widthMm: 300 } });
    const turned = footprintOf(comp('b', 'belt-conveyor', 300, 100, { freeYawDeg: 45 }), { b: { lengthMm: 1200, widthMm: 300 } });
    expect(flat.width).toBe(120); expect(flat.depth).toBe(30);
    expect(turned.width).toBeCloseTo((120 + 30) * c45, 5); expect(turned.depth).toBeCloseTo((120 + 30) * c45, 5);
    const quarter = footprintOf(comp('b', 'belt-conveyor', 300, 100, { yawDeg: 90 }), { b: { lengthMm: 1200, widthMm: 300 } });
    expect(quarter.width).toBe(30); expect(quarter.depth).toBe(120);
  });
});
