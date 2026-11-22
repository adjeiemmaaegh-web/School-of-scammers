/**
 * Per-device settings (a timer relay's delay dial, and later others). A kind lists its settings here; the project stores only
 * values that differ from the default, keyed by component id, so projects without tuned devices keep their exact shape.
 * Pure and deterministic; the worker validates every value, the UI only offers what the spec allows.
 */
import type { ComponentKind } from './registry';
import { EQUIPMENT } from '../plant/equipment';

export type ParamSpec = { key: string; label: string; unit: string; min: number; max: number; step: number; default: number };

export const PARAM_SPECS: Partial<Record<ComponentKind, readonly ParamSpec[]>> = {
  // One scan is 50 ms, so the finest useful delay is 100 ms; a bench timer relay dial tops out around a minute.
  timerelay: [{ key: 'delayMs', label: 'On-delay', unit: 'ms', min: 100, max: 60000, step: 100, default: 2000 }],
  // R06 compressed-air supply: receiver cut-in / cut-out, pump rate and the pressure-switch point; regulator outlet limit.
  compressor: [
    { key: 'cutInBar', label: 'Cut-in pressure', unit: 'bar', min: 2, max: 8, step: 1, default: 6 },
    { key: 'cutOutBar', label: 'Cut-out pressure', unit: 'bar', min: 4, max: 10, step: 1, default: 8 },
    { key: 'fillBarPerS', label: 'Pump rate', unit: 'bar/s', min: 0.1, max: 2, step: 0.1, default: 0.6 },
    { key: 'switchBar', label: 'Pressure-switch point', unit: 'bar', min: 1, max: 8, step: 1, default: 5 },
  ],
  // R06 pneumatic circuit of a cylinder: valve type, restrictors, losses, leakage and load. All defaults = the original
  // fixed-speed cylinder (no circuit), so existing projects behave exactly as before.
  cylinder: [
    { key: 'actuation', label: 'Cylinder type', unit: '0=double-acting, 1=single-acting (spring return)', min: 0, max: 1, step: 1, default: 0 },
    { key: 'valveCentre', label: '5/3 valve centre', unit: '0=closed, 1=exhaust, 2=pressure', min: 0, max: 2, step: 1, default: 0 },
    { key: 'extendFlowPct', label: 'Extend flow control', unit: '%', min: 10, max: 100, step: 10, default: 100 },
    { key: 'retractFlowPct', label: 'Retract flow control', unit: '%', min: 10, max: 100, step: 10, default: 100 },
    { key: 'lineLossBar', label: 'Line pressure loss', unit: 'bar', min: 0, max: 3, step: 0.1, default: 0 },
    { key: 'leakagePct', label: 'Leakage', unit: '% per s', min: 0, max: 100, step: 5, default: 0 },
    { key: 'boreMm', label: 'Piston bore', unit: 'mm', min: 16, max: 100, step: 2, default: 40 },
    { key: 'loadKg', label: 'Load mass', unit: 'kg', min: 0, max: 300, step: 1, default: 0 },
    { key: 'vertical', label: 'Load direction', unit: '0=horizontal, 1=vertical (against gravity)', min: 0, max: 1, step: 1, default: 0 },
  ],
  // R06 pressure sensor: the contact closes at or above this pressure (default = the compressor's pressure-switch default).
  'pressure-sensor': [{ key: 'setpointBar', label: 'Contact closes at', unit: 'bar', min: 0.5, max: 10, step: 0.5, default: 4 }],
  'air-regulator': [{ key: 'setpointBar', label: 'Outlet pressure limit', unit: 'bar', min: 1, max: 8, step: 0.5, default: 4 }],
  ...Object.fromEntries(EQUIPMENT.map(def=>[def.kind,def.params])),
};

export const paramSpecsOf = (kind: ComponentKind): readonly ParamSpec[] => PARAM_SPECS[kind] ?? [];

/** The stored value if any, otherwise the spec default. */
export function paramValue(params: Record<string, Record<string, number>> | undefined, id: string, spec: ParamSpec): number {
  const v = params?.[id]?.[spec.key];
  return typeof v === 'number' ? v : spec.default;
}

/** Why a value is not allowed for this setting, or null. Whole multiples of the step only, within range. */
export function paramError(spec: ParamSpec, value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${spec.label} must be a number`;
  if (value < spec.min || value > spec.max) return `${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit}`;
  // Tolerance for decimal steps: 3 x 0.1 is 0.30000000000000004 in floating point, which is still a valid multiple of 0.1.
  if (Math.abs(Math.round(value / spec.step) * spec.step - value) > 1e-7) return `${spec.label} must be a multiple of ${spec.step} ${spec.unit}`;
  return null;
}
