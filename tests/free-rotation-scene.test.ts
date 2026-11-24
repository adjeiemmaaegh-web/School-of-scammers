import { describe, expect, it } from 'vitest';
import { editWorkspace, isFreeRotation } from '../src/workspace/editor';
import { effectiveYaw, rotateFloorOffset } from '../src/workspace/geometry';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';
import type { PlacedComponent, ProjectFile } from '../src/sim/signals';

const comp = (id: string, kind: string, x: number, y: number, extra: Partial<PlacedComponent> = {}) => ({ id, kind, x, y, pressed: false, ...extra } as PlacedComponent);
const project = (components: PlacedComponent[]): ProjectFile => ({
  formatVersion: 1, program: { id: 'p', version: '1', rungs: [{ id: 'r', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' }] } as never,
  components, wires: [],
});
const get = (p: ProjectFile, id: string) => p.components.find(c => c.id === id)!;
const free = (p: ProjectFile, ids: string[], deltaDeg: number) => editWorkspace(p, { kind: 'rotateFree', ids, deltaDeg });

describe('R22 continuous rotation of placed devices', () => {
  it('only orientable devices without orientation-dependent physics may turn freely', () => {
    for (const k of ['lamp', 'plc16', 'start', 'relay', 'motor', 'stacklight']) expect(isFreeRotation(k)).toBe(true);
    for (const k of ['turntable', 'index-table', 'geometry-photoeye', 'process-tank', 'cylinder']) expect(isFreeRotation(k)).toBe(false);
  });
  it('a single device accumulates the angle on top of its quarter-turn yaw, and four-plus steps wrap to nothing', () => {
    let p = project([comp('l', 'lamp', 100, 100, { yawDeg: 90 })]);
    p = free(p, ['l'], 15);
    expect(get(p, 'l').freeYawDeg).toBe(15); expect(get(p, 'l').yawDeg).toBe(90);
    expect(effectiveYaw(get(p, 'l'))).toBe(105);
    p = free(p, ['l'], -30);
    expect(get(p, 'l').freeYawDeg).toBe(345);                              // -15 wraps to 345
    p = free(p, ['l'], 15);                                                 // 345 + 15 = 360: back to exactly the saved shape
    expect(get(p, 'l').freeYawDeg).toBeUndefined();
    expect('freeYawDeg' in get(p, 'l')).toBe(false);
  });
  it('rotating one device does not move it or touch the others', () => {
    const p = free(project([comp('a', 'lamp', 100, 100), comp('b', 'lamp', 200, 100)]), ['a'], 45);
    expect([get(p, 'a').x, get(p, 'a').y]).toEqual([100, 100]);
    expect(get(p, 'b').freeYawDeg).toBeUndefined();
  });
  it('refuses physical equipment and says which', () => {
    const p = project([comp('l', 'lamp', 100, 100), comp('b', 'turntable', 300, 100)]);
    expect(() => free(p, ['l', 'b'], 15)).toThrow(/turntable/);
    expect(() => free(project([comp('t', 'process-tank', 100, 100)]), ['t'], 15)).toThrow(/quarter turns/);
  });
  it('refuses a bad angle: zero, not a multiple of 5, too large, fractional', () => {
    const p = project([comp('l', 'lamp', 100, 100)]);
    for (const d of [0, 7, 185, -190, 2.5, NaN]) expect(() => free(p, ['l'], d)).toThrow(/multiple of 5/);
  });
  it('a group swings about its centre by the true angle, and 90 degrees agrees with the quarter turn', () => {
    const p = project([comp('a', 'lamp', 100, 100), comp('b', 'lamp', 200, 100)]);       // centre (150, 100)
    const q = editWorkspace(p, { kind: 'rotate', ids: ['a', 'b'], quarterTurns: 1 });
    const f = free(free(free(free(free(free(p, ['a', 'b'], 15), ['a', 'b'], 15), ['a', 'b'], 15), ['a', 'b'], 15), ['a', 'b'], 15), ['a', 'b'], 15);
    expect([get(f, 'a').x, get(f, 'a').y]).toEqual([get(q, 'a').x, get(q, 'a').y]);
    expect([get(f, 'b').x, get(f, 'b').y]).toEqual([get(q, 'b').x, get(q, 'b').y]);
    expect(effectiveYaw(get(f, 'a'))).toBe(90);
    const half = free(p, ['a', 'b'], 45);
    expect(get(half, 'a').x).toBe(Math.round(150 - 50 * Math.SQRT1_2)); expect(get(half, 'a').y).toBe(Math.round(100 - 50 * Math.SQRT1_2));
    expect(get(half, 'b').x).toBe(Math.round(150 + 50 * Math.SQRT1_2)); expect(get(half, 'b').y).toBe(Math.round(100 + 50 * Math.SQRT1_2));
  });
  it('a grouped selection turns as a whole when any member is selected', () => {
    let p = project([comp('a', 'lamp', 100, 100), comp('b', 'lamp', 200, 100), comp('c', 'lamp', 500, 300)]);
    p = editWorkspace(p, { kind: 'group', ids: ['a', 'b'], name: 'pair' });
    p = free(p, ['a'], 30);
    expect(get(p, 'a').freeYawDeg).toBe(30); expect(get(p, 'b').freeYawDeg).toBe(30);
    expect(get(p, 'c').freeYawDeg).toBeUndefined();
  });
  it('near an edge the turned group is shifted back onto the floor; one that cannot fit is refused', () => {
    const edge = free(project([comp('a', 'lamp', 5, 5), comp('b', 'lamp', 105, 5)]), ['a', 'b'], 90);
    expect(Math.min(get(edge, 'a').x, get(edge, 'b').x)).toBeGreaterThanOrEqual(0);
    expect(Math.min(get(edge, 'a').y, get(edge, 'b').y)).toBeGreaterThanOrEqual(0);
    expect(() => free(project([comp('a', 'lamp', 0, 100), comp('b', 'lamp', 910, 100)]), ['a', 'b'], 90)).toThrow(/would not fit/);
  });
  it('copy, duplicate and undo-safe: a duplicate keeps the free rotation', () => {
    const p = free(project([comp('l', 'lamp', 100, 100)]), ['l'], 60);
    const dup = editWorkspace(p, { kind: 'duplicate', ids: ['l'], offset: { x: 50, y: 0 }, grid: 1 });
    expect(dup.components).toHaveLength(2);
    expect(dup.components.every(c => c.freeYawDeg === 60)).toBe(true);
  });
  it('the project validator accepts a saved free rotation and rejects an invalid one', () => {
    const ok = free(project([comp('l', 'lamp', 100, 100)]), ['l'], 35);
    expect(() => validateProject(ok)).not.toThrow();
    expect(validateProject(JSON.parse(JSON.stringify(ok))).components[0].freeYawDeg).toBe(35);
    for (const bad of [{ kind: 'turntable', freeYawDeg: 15 }, { kind: 'lamp', freeYawDeg: 17 }, { kind: 'lamp', freeYawDeg: 360 }, { kind: 'lamp', freeYawDeg: 0 }, { kind: 'lamp', freeYawDeg: 2.5 }])
      expect(() => validateProject(project([comp('x', bad.kind, 100, 100, { freeYawDeg: bad.freeYawDeg })]))).toThrow();
  });
  it('the worker command path commits it and keeps the project loadable', () => {
    let w = tick(createWorld(), [{ k: 'loadProject', project: project([comp('l', 'lamp', 100, 100)]) }]).world;
    w = tick(w, [{ k: 'editWorkspace', edit: { kind: 'rotateFree', ids: ['l'], deltaDeg: 75 } }]).world;
    expect(w.lastError).toBeNull();
    expect(w.project.components[0].freeYawDeg).toBe(75);
    w = tick(w, [{ k: 'editWorkspace', edit: { kind: 'rotateFree', ids: ['l'], deltaDeg: 7 } }]).world;
    expect(w.lastError).toMatch(/multiple of 5/);
    expect(w.project.components[0].freeYawDeg).toBe(75);                   // a rejected edit changes nothing
  });
  it('rotateFloorOffset keeps exact quarter-turn vectors and uses the true rotation in between', () => {
    expect(rotateFloorOffset({ x: 1, z: 0 }, 90)).toEqual({ x: -0, z: 1 });
    expect(rotateFloorOffset({ x: 1, z: 0 }, 180)).toEqual({ x: -1, z: -0 });
    const r = rotateFloorOffset({ x: 1, z: 0 }, 45);
    expect(r.x).toBeCloseTo(Math.SQRT1_2, 12); expect(r.z).toBeCloseTo(Math.SQRT1_2, 12);
    const known = rotateFloorOffset({ x: 2, z: 1 }, 45);                    // (2,1) turned 45 degrees: x = 2c - s, z = 2s + c
    expect(known.x).toBeCloseTo(Math.SQRT1_2, 12); expect(known.z).toBeCloseTo(3 * Math.SQRT1_2, 12);
    const wrap = rotateFloorOffset({ x: 2, z: 1 }, 405);
    const base = rotateFloorOffset({ x: 2, z: 1 }, 45);
    expect(wrap.x).toBeCloseTo(base.x, 12); expect(wrap.z).toBeCloseTo(base.z, 12);
  });
});
