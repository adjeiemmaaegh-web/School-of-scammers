import { describe, expect, it } from 'vitest';
import { frameIndustrialPlant, presetCameraPosition } from '../src/render/workcell-camera';
import { createWorld, tick } from '../src/sim/orchestrator';

const project = tick(createWorld(), [{ k: 'place', id: 'c', kind: 'belt-conveyor', at: { x: 400, y: 250 } }]).world.project;
describe('R6.2 camera presets', () => {
  const framing = frameIndustrialPlant(project);
  const dist = (p: number[]) => Math.hypot(p[0] - framing.target[0], p[1] - framing.target[1], p[2] - framing.target[2]);
  it('keep the default distance and look along the right axis', () => {
    const d = dist(framing.position);
    const top = presetCameraPosition(framing, 'top'), front = presetCameraPosition(framing, 'front'), side = presetCameraPosition(framing, 'side');
    for (const p of [top, front, side]) expect(Math.abs(dist(p) - d)).toBeLessThan(d * 0.05);
    expect(top[0]).toBe(framing.target[0]); expect(top[1]).toBeGreaterThan(framing.target[1] + d * 0.99); // straight above
    expect(front[0]).toBe(framing.target[0]); expect(front[2]).toBeGreaterThan(framing.target[2] + d * 0.9);
    expect(side[2]).toBe(framing.target[2]); expect(side[0]).toBeGreaterThan(framing.target[0] + d * 0.9);
  });
  it('are pure and deterministic', () => {
    expect(presetCameraPosition(framing, 'top')).toEqual(presetCameraPosition(framing, 'top'));
  });
});
