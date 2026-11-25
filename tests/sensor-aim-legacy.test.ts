import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { beamDirection, opticalZoneOf } from '../src/plant/equipment/sensor-zone';
import type { EquipmentPlacement } from '../src/plant/world/types';

const eye = (params: Record<string, number>, yawDeg: 0 | 90 | 180 | 270 = 0, kind = 'geometry-photoeye'): EquipmentPlacement => ({ id: 'eye', kind, originMm: vec(0, 0, 120), yawDeg, params: { responseMs: 0, beamMode: 1, rangeMm: 600, beamWidthMm: 100, ...params } });
/** Is a body at (x, y) detected after a short run? */
function sees(item: EquipmentPlacement, x: number, y: number, tags: Record<string, string | number | boolean> = {}, size: [number, number, number] = [60, 60, 60], fault: string | null = null): boolean {
  let w = freshWorld();
  w = spawnBody(w, 't', { size: vec(...size), massKg: 1, pos: vec(x, y, 120), supportedBy: null, tags });
  let r = freshRuntime(w, [item], PLANT_EQUIPMENT);
  for (let i = 0; i < 3; i++) r = stepScene(r, [item], PLANT_EQUIPMENT, {}, fault ? { eye: fault } : {});
  return r.signals.eye.present === true;
}

describe('R21 continuous aim for the older optical sensors', () => {
  it('aim 0 is exactly the old behaviour: the beam runs along the placement heading', () => {
    expect(sees(eye({}), 300, 0)).toBe(true);
    expect(sees(eye({}), 212, 212)).toBe(false);                 // the diagonal is outside a 100 mm wide axial beam
    expect(sees(eye({}), -300, 0)).toBe(false);                  // behind the head
    expect(opticalZoneOf('geometry-photoeye', { id: 'e', originMm: vec(0, 0, 0), yawDeg: 90, params: { beamMode: 1 } }).yawDeg).toBe(90);
  });
  it('a 45 degree aim finds a diagonal target and no longer finds the axial one', () => {
    const aimed = eye({ aimDeg: 45 });
    expect(sees(aimed, 212, 212)).toBe(true);
    expect(sees(aimed, 300, 0)).toBe(false);
    expect(sees(aimed, 0, 300)).toBe(false);
    expect(sees(aimed, -212, -212)).toBe(false);                 // behind the head, along the same line
    expect(sees(aimed, 650, 650)).toBe(false);                   // beyond the 600 mm range (919 mm away)
  });
  it('aim adds to the placement yaw: yaw 90 with aim -90 points along +x, yaw 90 with aim +45 points between +y and -x', () => {
    expect(sees(eye({ aimDeg: -90 }, 90), 300, 0)).toBe(true);
    expect(sees(eye({ aimDeg: -90 }, 90), 0, 300)).toBe(false);
    expect(sees(eye({ aimDeg: 45 }, 90), -212, 212)).toBe(true);
    expect(sees(eye({ aimDeg: 45 }, 90), 212, 212)).toBe(false);
  });
  it('the beam has its width across the aim direction: an off-axis target is in only when within half the width', () => {
    const aimed = eye({ aimDeg: 30, beamWidthMm: 100 });
    const dir = beamDirection(30);
    const at = (long: number, lat: number) => [long * dir.x - lat * dir.y, long * dir.y + lat * dir.x] as const;
    expect(sees(aimed, ...at(300, 40))).toBe(true);
    expect(sees(aimed, ...at(300, 70))).toBe(false);
    expect(sees(aimed, ...at(300, -40))).toBe(true);
    expect(sees(aimed, ...at(300, -70))).toBe(false);
  });
  it('body-volume targeting uses the rotated beam too: a large box whose edge reaches the beam is seen, a distant one is not', () => {
    const aimed = eye({ aimDeg: 45, targetMode: 1, beamWidthMm: 60 });
    expect(sees(aimed, 212, 212, {}, [200, 200, 60])).toBe(true);
    expect(sees(aimed, 300, 0, {}, [60, 60, 60])).toBe(false);
    expect(sees(aimed, 300, 0, {}, [60, 60, 60])).toBe(false);
  });
  it('body-volume targeting counts the rotated extent of the box at the end of the range', () => {
    const aimed = eye({ aimDeg: 45, targetMode: 1, beamWidthMm: 60, rangeMm: 600 });
    // centre 660 mm out on the 45 degree line: only the box's projected half-length (0.707 x (20+200)/2 = 78 mm) reaches back into the beam
    expect(sees(aimed, 467, 467, {}, [20, 200, 60])).toBe(true);
    expect(sees(aimed, 467, 467, {}, [20, 20, 60])).toBe(false);          // a small box that far out is beyond the range
    // and sideways: a 200 x 20 box centred 100 mm off the beam line reaches it only because of its rotated lateral extent
    expect(sees(aimed, 141, 283, {}, [200, 20, 60])).toBe(true);
    expect(sees(aimed, 141, 283, {}, [20, 20, 60])).toBe(false);
  });
  it('the inductive and capacitive sensors take the aim as well, and keep their material rule', () => {
    expect(sees(eye({ aimDeg: 45 }, 0, 'inductive-prox'), 212, 212, { material: 'metal' })).toBe(true);
    expect(sees(eye({ aimDeg: 45 }, 0, 'inductive-prox'), 212, 212, { material: 'plastic' })).toBe(false);
    expect(sees(eye({ aimDeg: 45 }, 0, 'capacitive-prox'), 212, 212)).toBe(true);
    expect(sees(eye({ aimDeg: 45 }, 0, 'capacitive-prox'), 300, 0)).toBe(false);
  });
  it('area mode ignores the aim, and a misalignment fault turns the aimed head a further quarter turn', () => {
    expect(sees(eye({ beamMode: 0, aimDeg: 45, rangeMm: 600 }), 100, 100)).toBe(true);
    expect(sees(eye({ beamMode: 0, aimDeg: 45, rangeMm: 600 }), -100, 100)).toBe(true);
    expect(sees(eye({ aimDeg: 0 }), 300, 0, {}, [60, 60, 60], 'sensor-misaligned')).toBe(false);
    expect(sees(eye({ aimDeg: 0 }), 0, 300, {}, [60, 60, 60], 'sensor-misaligned')).toBe(true);
    expect(sees(eye({ aimDeg: 45 }), -212, 212, {}, [60, 60, 60], 'sensor-misaligned')).toBe(true);   // 45 + 90 = 135 degrees
  });
  it('beamDirection keeps exact quarter-turn vectors and handles negative and large angles', () => {
    expect(beamDirection(0)).toEqual({ x: 1, y: 0, z: 0 }); expect(beamDirection(90)).toEqual({ x: 0, y: 1, z: 0 });
    expect(beamDirection(-90)).toEqual({ x: 0, y: -1, z: 0 }); expect(beamDirection(360)).toEqual({ x: 1, y: 0, z: 0 });
    expect(beamDirection(45).x).toBeCloseTo(Math.SQRT1_2, 12); expect(beamDirection(-135).y).toBeCloseTo(-Math.SQRT1_2, 12);
  });
});
