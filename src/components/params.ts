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
  if (Math.round(value / spec.step) * spec.step !== value) return `${spec.label} must be a multiple of ${spec.step} ${spec.unit}`;
  return null;
}
