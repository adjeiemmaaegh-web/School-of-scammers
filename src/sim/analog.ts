/**
 * Separate, deterministic educational numeric signal bus.
 * Never feed these links to the idealized 24V electrical solver.
 * The first source is the existing tank's simulated liquid volume in ml.
 * This is an engineering-unit signal, not a modeled 4-20mA/0-10V transducer.
 */
import { COMPONENTS } from '../components/registry';
import { PLANT_EQUIPMENT } from '../plant/equipment';
import type { SceneRuntime } from '../plant/world/runner';
import type { PlacedComponent, ProjectFile, Wire } from './signals';
import { pinLocation, type PlcIoMap } from './plc-io';

export type AnalogPoint = { terminal: string; tag: string; value: number; unit: string; connected: boolean; source: string | null; sampled?: boolean };
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
    return 'An analog PLC input supports exactly one signal source';
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
  plant?: SceneRuntime, isPlantSourcePowered: (id: string) => boolean = () => false,
  airBar: Readonly<Record<string, number>> = {},
): { values: Record<string, number>; points: AnalogPoint[] } {
  const values: Record<string, number> = {};
  const points: AnalogPoint[] = [];
  for (const [pin, tag] of Object.entries(io.analogInputs ?? {})) {
    // R13: a pin of an expansion AI module is wired on the MODULE and reads only while the module itself is powered.
    const at = pinLocation(plcId, pin);
    const target = at.owner + '.' + at.pin;
    const channelPowered = powered && (!at.module || isPlantSourcePowered(at.owner));
    const link = project.wires.find(w => !openWireIds.has(w.id) &&
      (w.from === target || w.to === target) && isAnalogWire(w, project.components));
    const source = link ? (link.from === target ? link.to : link.from) : null;
    const dot = source?.indexOf('.') ?? -1;
    const id = dot > 0 ? source!.slice(0, dot) : '';
    const part = project.components.find(c => c.id === id);
    const signal = dot > 0 ? source!.slice(dot + 1) : '';
    const legacyTank = !!source && part?.kind === 'tank' && signal === 'LEVEL';
    const model = part && PLANT_EQUIPMENT[part.kind];
    const channel = model?.signals.find(ch => ch.kind === 'number' && signal === 'AN_' + ch.name);
    const processSensor = !!source && !!channel && !!plant && isPlantSourcePowered(id);
    // R06: an air pressure sensor's analog output is the working pressure at its AIR port.
    const airSensor = !!source && part?.kind === 'pressure-sensor' && signal === 'AN_pressureBar' && isPlantSourcePowered(id);
    const connected = legacyTank || processSensor || airSensor;
    let value = 0;
    if (channelPowered && legacyTank) {
      const reading = vessels[id]?.levelMl ?? 0;
      if (!Number.isFinite(reading) || reading < 0 || reading > 1000)
        throw new RangeError('Invalid tank numeric signal');
      value = reading;
    } else if (channelPowered && airSensor) {
      value = airBar[id] ?? 0;
    } else if (channelPowered && processSensor) {
      const reading = plant!.signals[id]?.[channel!.name];
      if (typeof reading !== 'number' || !Number.isFinite(reading) || Math.abs(reading) > 1_000_000_000)
        throw new RangeError('Invalid physical equipment numeric signal');
      value = reading;
    }
    values[tag] = value;
    points.push({ terminal: pin, tag, value, unit: connected ? legacyTank ? 'ml' : airSensor ? 'bar' : channel?.unit ?? '' : '',
      connected, source: connected ? source : null, ...(at.module ? { sampled: channelPowered } : {}) });
  }
  return { values, points };
}
