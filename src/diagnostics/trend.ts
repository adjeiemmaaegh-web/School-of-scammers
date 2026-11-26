/**
 * R5.5 / R8.1 process trend: a bounded recording of real snapshot values over model time. Every value is read from the
 * worker's published snapshot (PLC I/O, analog channels, numeric PLC tags, plant equipment signals); nothing is computed or
 * smoothed. Booleans are recorded as 0/1. The recording lives only in the page while the panel is open.
 */
import type { RenderSnapshot } from '../sim/signals';

export type TrendSource = { id: string; label: string; unit: string; kind: 'bool' | 'number' };
export type TrendSample = { tick: number; timeMs: number; values: Record<string, number | null> };
export const MAX_TREND_SAMPLES = 600;
export const MAX_TREND_SERIES = 4;

const num = (v: unknown): number | null =>
  typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' && Number.isFinite(v) ? v : null;

/** Every recordable signal in this snapshot, in a stable order. */
export function trendSources(snapshot: RenderSnapshot): TrendSource[] {
  const out: TrendSource[] = [];
  for (const [pid, view] of Object.entries(snapshot.plcs).sort(([a], [b]) => a.localeCompare(b))) {
    for (const p of view.io.inputs) out.push({ id: `plc:${pid}:in:${p.terminal}`, label: `${pid} ${p.terminal} ${p.tag}`, unit: '', kind: 'bool' });
    for (const p of view.io.outputs) out.push({ id: `plc:${pid}:out:${p.terminal}`, label: `${pid} ${p.terminal} ${p.tag}`, unit: '', kind: 'bool' });
    for (const a of view.io.analogInputs ?? []) out.push({ id: `plc:${pid}:ai:${a.terminal}`, label: `${pid} ${a.terminal} ${a.tag}`, unit: a.unit, kind: 'number' });
    for (const [tag, v] of Object.entries(view.tagValues ?? {}).sort(([a], [b]) => a.localeCompare(b)))
      if (typeof v === 'number') out.push({ id: `plc:${pid}:tag:${tag}`, label: `${pid} tag ${tag}`, unit: '', kind: 'number' });
  }
  for (const [dev, signals] of Object.entries(snapshot.plantWorld.signals).sort(([a], [b]) => a.localeCompare(b)))
    for (const [name, v] of Object.entries(signals).sort(([a], [b]) => a.localeCompare(b)))
      if (typeof v === 'boolean' || typeof v === 'number') out.push({ id: `plant:${dev}:${name}`, label: `${dev} ${name}`, unit: '', kind: typeof v === 'boolean' ? 'bool' : 'number' });
  return out;
}
/** The current value of one source, or null when it is not in this snapshot (removed device, unpowered channel). */
export function readSource(snapshot: RenderSnapshot, id: string): number | null {
  const parts = id.split(':');
  if (parts[0] === 'plant') return num(snapshot.plantWorld.signals[parts[1]]?.[parts.slice(2).join(':')]);
  if (parts[0] !== 'plc') return null;
  const view = snapshot.plcs[parts[1]];
  if (!view) return null;
  const key = parts.slice(3).join(':');
  if (parts[2] === 'in') return num(view.io.inputs.find(p => p.terminal === key)?.on);
  if (parts[2] === 'out') return num(view.io.outputs.find(p => p.terminal === key)?.on);
  if (parts[2] === 'ai') { const a = view.io.analogInputs?.find(p => p.terminal === key); return a && a.sampled !== false ? num(a.value) : null; }
  if (parts[2] === 'tag') return num(view.tagValues?.[key]);
  return null;
}
/** Append one sample per new scan (a repeated or older tick is ignored), keeping the newest MAX_TREND_SAMPLES. */
export function appendSample(buffer: readonly TrendSample[], snapshot: RenderSnapshot, scanMs: number, ids: readonly string[]): TrendSample[] {
  const last = buffer[buffer.length - 1];
  if (last && snapshot.tick <= last.tick) return snapshot.tick < last.tick ? [] : buffer as TrendSample[];   // a reset world starts a new recording
  const values: Record<string, number | null> = {};
  for (const id of ids) values[id] = readSource(snapshot, id);
  const next = [...buffer, { tick: snapshot.tick, timeMs: snapshot.tick * scanMs, values }];
  return next.length > MAX_TREND_SAMPLES ? next.slice(next.length - MAX_TREND_SAMPLES) : next;
}
/** Min and max of one series (null when it has no values); a flat series gets a unit band so it can be drawn. */
export function seriesRange(buffer: readonly TrendSample[], id: string): { min: number; max: number } | null {
  const vs = buffer.map(s => s.values[id]).filter((v): v is number => typeof v === 'number');
  if (!vs.length) return null;
  const min = Math.min(...vs), max = Math.max(...vs);
  return min === max ? { min: min - 0.5, max: max + 0.5 } : { min, max };
}
/** SVG polyline points for one series in a width x height box; gaps (null values) split the line into segments. */
export function seriesSegments(buffer: readonly TrendSample[], id: string, width: number, height: number): string[] {
  const range = seriesRange(buffer, id);
  if (!range || buffer.length < 2) return [];
  const t0 = buffer[0].timeMs, span = Math.max(1, buffer[buffer.length - 1].timeMs - t0);
  const segments: string[] = []; let current: string[] = [];
  for (const s of buffer) {
    const v = s.values[id];
    if (typeof v !== 'number') { if (current.length > 1) segments.push(current.join(' ')); current = []; continue; }
    const x = ((s.timeMs - t0) / span) * width, y = height - ((v - range.min) / (range.max - range.min)) * height;
    current.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  if (current.length > 1) segments.push(current.join(' '));
  return segments;
}
const csvCell = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
/** CSV with one row per scan: model time, scan number, then one column per series (empty when the value was unavailable). */
export function trendCsv(buffer: readonly TrendSample[], sources: readonly TrendSource[]): string {
  const head = ['time_ms', 'scan', ...sources.map(s => s.label + (s.unit ? ` (${s.unit})` : ''))].map(csvCell).join(',');
  const rows = buffer.map(s => [String(s.timeMs), String(s.tick), ...sources.map(src => { const v = s.values[src.id]; return v === null || v === undefined ? '' : String(v); })].join(','));
  return [head, ...rows].join('\n') + '\n';
}
