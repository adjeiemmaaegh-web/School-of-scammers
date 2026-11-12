import { describe, expect, it } from 'vitest';
import type { PlacedComponent } from '../src/sim/signals';
import { plantPlacements } from '../src/sim/p3-plant-bridge';
import {
  footprintOf, planToPlacement, possibleCarrierOverlaps, workerToPlan,
} from '../src/workspace/floor-plan';

const part = (kind: PlacedComponent['kind'], id: string, x: number, y: number,
  yawDeg: PlacedComponent['yawDeg'] = 0): PlacedComponent => ({
  id, kind, x, y, yawDeg, pressed: false,
});

describe('P6 visual floor plan uses worker project geometry, never an independent plant', () => {
  it('round-trips the exact P3 millimetre origin for a saved component', () => {
    const components = [part('roller-conveyor', 'roller-1', 220, 160)];
    const placement = plantPlacements({ components, params: {} })[0];
    const location = workerToPlan(placement.originMm.x, placement.originMm.y);
    expect(location).toEqual({ x: 305, y: 225 });
    expect(location).toEqual({
      x: components[0].x + 85,
      y: components[0].y + 65,
    });
  });
  it('uses the P3 transport dimensions rather than an invented 170x130 machine', () => {
    expect(footprintOf(part('roller-conveyor', 'roller-1', 200, 200))).toMatchObject({
      x: 285, y: 265, width: 60, depth: 30,
    });
  });
  it('uses validated saved dimension parameters when present', () => {
    expect(footprintOf(part('belt-conveyor', 'belt-1', 200, 100),
      { 'belt-1': { lengthMm: 1200, widthMm: 400 } })).toMatchObject({
      width: 120, depth: 40,
    });
  });
  it('turns the physical footprint with the same quarter-turn yaw as the worker', () => {
    expect(footprintOf(part('roller-conveyor', 'roller-1', 200, 100, 90)))
      .toMatchObject({ width: 30, depth: 60, yawDeg: 90 });
    expect(footprintOf(part('roller-conveyor', 'roller-1', 200, 100, 270)))
      .toMatchObject({ width: 30, depth: 60, yawDeg: 270 });
  });
  it('positions a mouse drop by centred device coordinates on the selected grid', () => {
    expect(planToPlacement(200, 150, 5)).toEqual({ x: 115, y: 85 });
    expect(planToPlacement(203, 151, 10)).toEqual({ x: 120, y: 90 });
  });
  it('keeps dropped equipment inside the actual saved-project floor bounds', () => {
    expect(planToPlacement(-10000, -10000, 5)).toEqual({ x: 0, y: 0 });
    expect(planToPlacement(10000, 10000, 5)).toEqual({ x: 910, y: 450 });
  });
  it('reports an advisory overlap only for two material-handling carriers', () => {
    const items = [
      footprintOf(part('roller-conveyor', 'roller-a', 100, 100)),
      footprintOf(part('belt-conveyor', 'belt-b', 125, 100)),
    ];
    expect(possibleCarrierOverlaps(items)).toEqual([
      { first: 'roller-a', second: 'belt-b' },
    ]);
  });
  it('does not warn for conveyors that just touch at an intentional transfer edge', () => {
    const items = [
      footprintOf(part('roller-conveyor', 'roller-a', 100, 100)),
      footprintOf(part('roller-conveyor', 'roller-b', 160, 100)),
    ];
    expect(possibleCarrierOverlaps(items)).toEqual([]);
  });
  it('does not classify a mounted photoeye as a blocking collision', () => {
    const items = [
      footprintOf(part('roller-conveyor', 'roller-a', 100, 100)),
      footprintOf(part('geometry-photoeye', 'eye-a', 100, 100)),
    ];
    expect(possibleCarrierOverlaps(items)).toEqual([]);
  });
  it('never edits plant data while constructing footprints or overlap diagnostics', () => {
    const c = part('turntable', 'turn', 240, 190, 90);
    const params = { turn: { turnMs: 3500 } };
    const before = JSON.stringify({ c, params });
    const result = footprintOf(c, params);
    possibleCarrierOverlaps([result]);
    expect(JSON.stringify({ c, params })).toBe(before);
    expect(result).toMatchObject({ width: 40, depth: 40, isCarrier: true });
  });
});
