/**
 * Separate, deterministic educational numeric signal bus.
 * Never feed these links to the idealized 24V electrical solver.
 * The first source is the existing tank's simulated liquid volume in ml.
 * This is an engineering-unit signal, not a modeled 4-20mA/0-10V transducer.
 */
import { COMPONENTS } from '../components/registry';
import type { PlacedComponent, ProjectFile, Wire } from './signals';
import type { PlcIoMap } from './plc-io';

export type AnalogPoint = { terminal: string; tag: string; value: number; unit: string; connected: boolean; source: string | null };
type AnalogRole = 'analog-input' | 'analog-output';

const terminalRole = (name: string, components: readonly PlacedComponent[]): AnalogRole | null => {
  const dot = name.indexOf('.');
  if (dot < 1) return null;
  const owner = components.find(c => c.id === name.slice(0, dot));
  const role = owner && COMPONENTS[owner.kind].terminals.find(t => t.name === name.slice(dot + 1))?.role;
  return role === 'analog-input' || role === 'analog-output' ? role : null;
};

/** Numeric wires may connect only ONE source to ONE PLC numeric input, in either click order. */
export function analogWireError(
  from: string, to: string, components: readonly PlacedComponent[], existing: readonly Wire[],
): string | null {
  const a = terminalRole(from, components), b = terminalRole(to, components);
  if (!a && !b) return null;
  if (!((a === 'analog-output' && b === 'analog-input') ||
        (a === 'analog-input' && b === 'analog-output')))
    return 'Numeric signals must connect an analog output directly to an analog input; 24V and numeric wires cannot mix';
  const input = a === 'analog-input' ? from : to;
  if (existing.some(w => w.from === input || w.to === input))
    return 'An analog PLC input supports exactly one signal source; only one numeric source may be connected';
  return null;
}

/** Keep numeric links out of the electrical graph: numeric signals are not 24V conductors. */
export const isAnalogWire = (wire: Pick<Wire, 'from' | 'to'>, components: readonly PlacedComponent[]): boolean =>
  terminalRole(wire.from, components) !== null || terminalRole(wire.to, components) !== null;

/** Sample the PREVIOUS settled process state once per PLC scan; never poll renderer state. */
export function sampleAnalogInputs(
  project: Pick<ProjectFile, 'components' | 'wires'>,
  vessels: Readonly<Record<string, { levelMl: number }>>,
  plcId: string, io: PlcIoMap, powered: boolean, openWireIds: ReadonlySet<string> = new Set(),
): { values: Record<string, number>; points: AnalogPoint[] } {
  const values: Record<string, number> = {};
  const points: AnalogPoint[] = [];
  for (const [pin, tag] of Object.entries(io.analogInputs ?? {})) {
    const target = plcId + '.' + pin;
    const link = project.wires.find(w => !openWireIds.has(w.id) &&
      (w.from === target || w.to === target) && isAnalogWire(w, project.components));
    const source = link ? (link.from === target ? link.to : link.from) : null;
    const dot = source?.indexOf('.') ?? -1;
    const id = dot > 0 ? source!.slice(0, dot) : '';
    const part = project.components.find(c => c.id === id);
    const signal = dot > 0 ? source!.slice(dot + 1) : '';
    const connected = !!source && part?.kind === 'tank' && signal === 'LEVEL';
    let value = 0;
    if (powered && connected) {
      const reading = vessels[id]?.levelMl ?? 0;
      if (!Number.isFinite(reading) || reading < 0 || reading > 1000)
        throw new RangeError('Invalid tank numeric signal');
      value = reading;
    }
    values[tag] = value;
    points.push({ terminal: pin, tag, value, unit: connected ? 'ml' : '', connected, source: connected ? source : null });
  }
  return { values, points };
}
