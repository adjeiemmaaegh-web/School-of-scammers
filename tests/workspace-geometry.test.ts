import { describe, expect, it } from 'vitest';
import { boundedGroupDelta, clampPlacement, rotateFloorOffset, turn } from '../src/workspace/geometry';

describe('P1 workspace coordinates and discrete orientation', () => {
  it('snaps grid positions and never places a device outside the floor', () => {
    expect(clampPlacement({ x: 37, y: 48 }, 25)).toEqual({ x: 25, y: 50 });
    expect(clampPlacement({ x: 9999, y: -50 }, 5)).toEqual({ x: 910, y: 0 });
    expect(() => clampPlacement({ x: Number.NaN, y: 1 }, 5)).toThrow(/Non-finite/);
  });
  it('clamps a GROUP as a uniform translation, retaining internal spacing', () => {
    const parts = [{ id: 'a', kind: 'lamp' as const, x: 10, y: 10, pressed: false },
      { id: 'b', kind: 'motor' as const, x: 190, y: 35, pressed: false }];
    expect(boundedGroupDelta(parts, { x: 11, y: 22 }, 25)).toEqual({ x: 0, y: 25 });
    expect(boundedGroupDelta(parts, { x: -300, y: -50 }, 25)).toEqual({ x: -10, y: -10 });
    expect(boundedGroupDelta(parts, { x: 10000, y: 10000 }, 25)).toEqual({ x: 720, y: 415 });
  });
  it('uses reversible quarter-turns and matching floor terminal offsets', () => {
    expect(turn(0, -1)).toBe(270);
    expect(turn(270, 1)).toBe(0);
    expect(turn(90, 1)).toBe(180);
    expect(() => turn(45, 1)).toThrow(/quarter-turn/);
    expect(rotateFloorOffset({ x: 2, z: 3 }, 90)).toEqual({ x: -3, z: 2 });
    expect(rotateFloorOffset({ x: 2, z: 3 }, 270)).toEqual({ x: 3, z: -2 });
  });
});
