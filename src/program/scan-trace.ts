/**
 * P2 bounded, deterministic, read-only PLC debugging data.
 * The worker owns these records. Never sample UI time, DOM, or animation frames.
 */
import type { LadderStep } from '../engineering/ladder';
import type { FbdStep } from '../engineering/fbd';
import type { STValue } from '../engineering/structured-text';

export type EdgeDirection = 'rising' | 'falling' | 'either';
export type TagBreakpoint = { tag: string; edge: EdgeDirection };
export type ScanTrace = {
  scan: number;
  simulatedMs: number;
  language: 'ladder' | 'st' | 'fbd';
  start: boolean;
  stopOK: boolean;
  run: boolean;
  plcPowered: boolean;
  contactorOn: boolean;
  motorOn: boolean;
  networks: { rung: string; instruction: string; result: boolean; elapsedMs?: number; count?: number; numericResult?: number }[];
  breakpoint: string | null;
};
export const MAX_SCAN_TRACE = 300;

export function tagEdge(before: STValue | undefined, after: STValue | undefined,
  direction: EdgeDirection): boolean {
  if (!['rising', 'falling', 'either'].includes(direction)) return false;
  if (typeof before !== 'boolean' || typeof after !== 'boolean' || before === after) return false;
  return direction === 'either' || (direction === 'rising' ? after : !after);
}
export function validateTagBreakpoint(value: unknown, names: ReadonlySet<string>): value is TagBreakpoint {
  if (!value || typeof value !== 'object') return false;
  const bp = value as Partial<TagBreakpoint>;
  return typeof bp.tag === 'string' && names.has(bp.tag) &&
    (bp.edge === 'rising' || bp.edge === 'falling' || bp.edge === 'either');
}
export function buildScanTrace(input: {
  scan: number; simulatedMs: number; language: 'ladder' | 'st' | 'fbd';
  start: boolean; stopOK: boolean; run: boolean; plcPowered: boolean;
  contactorOn: boolean; motorOn: boolean; ladderSteps: readonly LadderStep[]; fbdSteps?: readonly FbdStep[];
  breakpoint: string | null;
}): ScanTrace {
  return {
    scan: input.scan, simulatedMs: input.simulatedMs, language: input.language,
    start: input.start, stopOK: input.stopOK, run: input.run, plcPowered: input.plcPowered,
    contactorOn: input.contactorOn, motorOn: input.motorOn,
    networks: [...input.ladderSteps.map(step => ({
      rung: step.rungId, instruction: step.operation, result: step.result,
      ...(step.elapsedMs === undefined ? {} : { elapsedMs: step.elapsedMs }),
      ...(step.count === undefined ? {} : { count: step.count }),
      ...(step.numericResult === undefined ? {} : { numericResult: step.numericResult }),
    })), ...(input.fbdSteps ?? []).map(step => ({
      rung: step.nodeId, instruction: 'FBD-' + step.kind, result: step.on,
      ...(step.elapsedMs === undefined ? {} : { elapsedMs: step.elapsedMs }),
      ...(step.count === undefined ? {} : { count: step.count }),
    }))],
    breakpoint: input.breakpoint,
  };
}
export function appendScanTrace(prior: readonly ScanTrace[], entry: ScanTrace): ScanTrace[] {
  return [...prior.slice(-(MAX_SCAN_TRACE - 1)), entry];
}
export function scanTraceCsv(trace: readonly ScanTrace[]): string {
  const safe = (value: unknown) => {
    const contents = String(value ?? '').replaceAll('"', '""');
    return `"${/^[\s]*[=+@-]/.test(contents) ? "'" + contents : contents}"`;
  };
  return [
    ['scan', 'simulated_ms', 'language', 'start', 'stop_ok', 'run', 'plc_powered', 'contactor', 'motor', 'network_results', 'breakpoint'],
    ...trace.map(row => [
      row.scan, row.simulatedMs, row.language, Number(row.start), Number(row.stopOK),
      Number(row.run), Number(row.plcPowered), Number(row.contactorOn), Number(row.motorOn),
      row.networks.map(n => `${n.rung}:${n.instruction}=${Number(n.result)}${n.elapsedMs === undefined ? '' : `:${n.elapsedMs}ms`}${n.count === undefined ? '' : `:CV${n.count}`}`).join(';'),
      row.breakpoint ?? '',
    ]),
  ].map(row => row.map(safe).join(',')).join('\r\n') + '\r\n';
}
