import { describe, expect, it } from 'vitest';
import { newProject } from '../src/sim/orchestrator';
import { projectPlacement, terminalPoint, worldPosition } from '../src/render/scene-coordinates';
import type { PlacedComponent } from '../src/sim/signals';

const c = (id: string, kind: PlacedComponent['kind'], x: number, y: number): PlacedComponent =>
  ({ id, kind, x, y, pressed: false });

describe('P1 real 3D project coordinate contract', () => {
  it('preserves saved project placement over 3D camera changes', () => {
    for (const xy of [{ x: 25, y: 25 }, { x: 350, y: 25 }, { x: 460, y: 245 }, { x: 870, y: 430 }]) {
      const [x, height, z] = worldPosition(xy);
      expect(height).toBe(0);
      expect(projectPlacement({ x, z })).toEqual(xy);
    }
  });
  it('bounds out-of-workspace placement from 3D ray hits', () => {
    expect(projectPlacement({ x: -500, z: -500 })).toEqual({ x: 5, y: 5 });
    expect(projectPlacement({ x: 500, z: 500 })).toEqual({ x: 905, y: 435 });
  });
  it('projects numbered PLC I/O and source terminal endpoints without confusing dot-separated pins', () => {
    const project = newProject();
    project.components = [c('plc-2', 'plc', 350, 25), c('supply-1', 'supply', 25, 25)];
    const left = terminalPoint(project, 'plc-2.I0.0');
    const right = terminalPoint(project, 'plc-2.Q0.0');
    const source = terminalPoint(project, 'supply-1.P24');
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(source).not.toBeNull();
    expect(left!.x).toBeLessThan(right!.x);
    expect(left!.y).toBe(0.35);
    expect(terminalPoint(project, 'plc-2.I0.99')).toBeNull();
    expect(terminalPoint(project, 'bogus.terminal')).toBeNull();
  });
});
