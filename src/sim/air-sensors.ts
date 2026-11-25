/**
 * R06 air pressure readings for the pressure sensors of a project: the working pressure at each sensor's AIR port from the same
 * air solution the cylinders use (receivers through regulators, air lines as wires). Pure and deterministic. A sensor that is
 * not plumbed to a supplied net reads 0, and a project without a compressor has no air model at all (every reading is 0).
 */
import { paramSpecsOf, paramValue } from '../components/params';
import { solveAir, type Receiver } from '../plant/air';
import type { ProjectFile } from './signals';

export function airSensorReadings(project: Pick<ProjectFile, 'components' | 'wires' | 'params' | 'faults'>, receivers: Readonly<Record<string, Receiver>>): Record<string, number> {
  const sensors = project.components.filter(c => c.kind === 'pressure-sensor');
  if (!sensors.length) return {};
  if (!project.components.some(c => c.kind === 'compressor')) return Object.fromEntries(sensors.map(c => [c.id, 0]));
  const setpoints = Object.fromEntries(project.components.filter(c => c.kind === 'air-regulator')
    .map(r => [r.id, paramValue(project.params, r.id, paramSpecsOf('air-regulator')[0])]));
  const open = new Set((project.faults ?? []).filter(f => f.kind === 'wire-open').map(f => f.target));
  const solution = solveAir(project.components, project.wires.filter(w => !open.has(w.id)), receivers, setpoints);
  return Object.fromEntries(sensors.map(c => [c.id, solution.pressureAt(`${c.id}.AIR`)]));
}
