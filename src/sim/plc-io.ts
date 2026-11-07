/**
 * Which tag each PLC terminal is bound to. A tag is the name a program uses; a terminal is a physical pin.
 *
 *  - The classic `plc` (5 inputs, 6 outputs) has a FIXED map: `Start`, `StopOK`, `Photoeye`, `TankHigh` and
 *    `ReverseRequest` on I0.0-I0.4 and `Run`, `Sort`, `Fill`, `Drain`, `Forward`, `Reverse` on Q0.0-Q0.5. Parts of
 *    the simulator (alarms, the scan trace, sensor guards, saved projects) rely on those names, so they cannot change.
 *  - The `plc16` (16 inputs, 16 outputs) starts with neutral names (`In0`..`In15`, `Out0`..`Out15`) and every one
 *    can be renamed per PLC, stored in `ProjectFile.plcIo`.
 *
 * Pure and deterministic like everything under src/sim.
 */
import { PLC16_INPUT_TERMINALS, PLC16_OUTPUT_TERMINALS } from '../components/registry';
import type { PlacedComponent, ProjectFile } from './signals';

/** terminal -> tag, for inputs and for outputs. */
export type PlcIoMap = { inputs: Record<string, string>; outputs: Record<string, string> };

export const LEGACY_IO: PlcIoMap = {
  inputs: { 'I0.0': 'Start', 'I0.1': 'StopOK', 'I0.2': 'Photoeye', 'I0.3': 'TankHigh', 'I0.4': 'ReverseRequest' },
  outputs: { 'Q0.0': 'Run', 'Q0.1': 'Sort', 'Q0.2': 'Fill', 'Q0.3': 'Drain', 'Q0.4': 'Forward', 'Q0.5': 'Reverse' },
};
export const defaultIo = (kind: string): PlcIoMap => kind === 'plc16' ? {
  inputs: Object.fromEntries(PLC16_INPUT_TERMINALS.map((t, i) => [t, `In${i}`])),
  outputs: Object.fromEntries(PLC16_OUTPUT_TERMINALS.map((t, i) => [t, `Out${i}`])),
} : LEGACY_IO;

/** The classic controller's map is fixed; only the 16/16 controller can be renamed. */
export const isConfigurableIo = (kind: string): boolean => kind === 'plc16';

/** The resolved map of one PLC: its saved names laid over the defaults for its kind. */
export function ioOf(project: Pick<ProjectFile, 'plcIo'>, plc: Pick<PlacedComponent, 'id' | 'kind'>): PlcIoMap {
  const base = defaultIo(plc.kind);
  const saved = isConfigurableIo(plc.kind) ? project.plcIo?.[plc.id] : undefined;
  return saved ? { inputs: { ...base.inputs, ...saved.inputs }, outputs: { ...base.outputs, ...saved.outputs } } : base;
}

/** Words a program tag may not be: they would collide with Structured Text and Ladder syntax or the engine. */
const RESERVED = new Set(['TRUE', 'FALSE', 'NOT', 'AND', 'OR', 'XOR', 'MOD', 'IF', 'THEN', 'ELSE', 'ELSIF', 'END_IF', 'VAR', 'VAR_INPUT',
  'VAR_OUTPUT', 'END_VAR', 'BOOL', 'INT', 'DINT', 'REAL', 'LREAL', 'UNUSED', '__PROTO__', 'CONSTRUCTOR', 'PROTOTYPE']);
const TAG = /^[A-Za-z][A-Za-z0-9_]{0,23}$/;

/** Problems with a proposed map for a PLC of `kind`; empty when valid. */
export function validateIoMap(kind: string, map: unknown): string[] {
  const errors: string[] = [];
  if (!isConfigurableIo(kind)) return ['This controller has a fixed I/O map'];
  if (!map || typeof map !== 'object') return ['I/O map must be an object'];
  const { inputs, outputs } = map as Partial<PlcIoMap>;
  const base = defaultIo(kind);
  const seen = new Map<string, string>();
  const check = (side: 'inputs' | 'outputs', table: unknown) => {
    if (!table || typeof table !== 'object' || Array.isArray(table)) { errors.push(`I/O ${side} must be an object`); return; }
    const allowed = Object.keys(base[side]);
    for (const [terminal, tag] of Object.entries(table as Record<string, unknown>)) {
      if (!allowed.includes(terminal)) { errors.push(`${terminal} is not an ${side === 'inputs' ? 'input' : 'output'} terminal of this controller`); continue; }
      if (typeof tag !== 'string' || !TAG.test(tag) || RESERVED.has(tag.toUpperCase())) {
        errors.push(`${terminal}: "${String(tag)}" is not a valid tag name (letters, digits and _ , starting with a letter, up to 24, not a reserved word)`); continue;
      }
    }
  };
  check('inputs', inputs); check('outputs', outputs);
  if (errors.length) return errors;
  // Names are case-insensitive in Structured Text, so uniqueness is checked that way across inputs AND outputs.
  const full = { inputs: { ...base.inputs, ...(inputs as Record<string, string>) }, outputs: { ...base.outputs, ...(outputs as Record<string, string>) } };
  for (const side of ['inputs', 'outputs'] as const) for (const [terminal, tag] of Object.entries(full[side])) {
    const key = tag.toUpperCase();
    if (seen.has(key)) errors.push(`Tag ${tag} is used by both ${seen.get(key)} and ${terminal}`); else seen.set(key, terminal);
  }
  return errors;
}

/** The program-visible names for a PLC: what validators and editors accept as inputs and outputs. */
export type IoNames = { inputs: string[]; outputs: string[]; requireRun: boolean };
export const namesOf = (io: PlcIoMap): IoNames => ({
  inputs: Object.values(io.inputs), outputs: Object.values(io.outputs), requireRun: Object.values(io.outputs).includes('Run'),
});
/** What the classic controller always accepted. */
export const LEGACY_NAMES: IoNames = namesOf(LEGACY_IO);
