/** Stable, pure mapping between saved 2D layout coordinates and 3D floor positions.
 * Layout x/y are historical project coordinates; they are NOT a 2.5D renderer.
 * This keeps old JSON projects readable while the visual workspace is genuine 3D.
 */
import { Vector3 } from 'three';
import { COMPONENTS } from '../components/registry';
import type { PlacedComponent, ProjectFile, XY } from '../sim/signals';

export const WORKSPACE_WIDTH = 1080;
export const WORKSPACE_DEPTH = 580;
export const PX_PER_UNIT = 100;
export const COMPONENT_WIDTH = 170;
export const COMPONENT_DEPTH = 130;
export const clamp = (n: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, n));

export function worldPosition(c: Pick<PlacedComponent, 'x' | 'y'>): [number, number, number] {
  return [(c.x + COMPONENT_WIDTH / 2 - WORKSPACE_WIDTH / 2) / PX_PER_UNIT, 0,
    (c.y + COMPONENT_DEPTH / 2 - WORKSPACE_DEPTH / 2) / PX_PER_UNIT];
}

export function projectPlacement(point: { x: number; z: number }): XY {
  return {
    x: Math.round(clamp(point.x * PX_PER_UNIT + WORKSPACE_WIDTH / 2 - COMPONENT_WIDTH / 2,
      5, WORKSPACE_WIDTH - COMPONENT_WIDTH - 5)),
    y: Math.round(clamp(point.z * PX_PER_UNIT + WORKSPACE_DEPTH / 2 - COMPONENT_DEPTH / 2,
      5, WORKSPACE_DEPTH - COMPONENT_DEPTH - 15)),
  };
}

export function terminalPoint(project: ProjectFile, fullId: string): Vector3 | null {
  // Terminal names may contain dots, e.g. "plc-2.I0.0". Split at the FIRST dot.
  const dot = fullId.indexOf('.');
  if (dot < 1) return null;
  const c = project.components.find(c => c.id === fullId.slice(0, dot));
  const t = c && COMPONENTS[c.kind].terminals.find(t => t.name === fullId.slice(dot + 1));
  if (!c || !t) return null;
  const [x, , z] = worldPosition(c);
  return new Vector3(x + (t.side === 'left' ? -0.64 : 0.64), 0.35, z + (t.y - 65) / 120);
}
