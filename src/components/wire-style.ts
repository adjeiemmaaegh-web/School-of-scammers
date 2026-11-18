/**
 * Wire colour and net label (roadmap R5.1). A presentation record stored sparsely in `ProjectFile.wireStyles`, keyed by
 * wire id. It never reaches the electrical solver, so styling a wire cannot change what a circuit does. Pure helpers.
 */
import type { ProjectFile, Wire } from '../sim/signals';

export type WireColor = 'red' | 'blue' | 'black' | 'green' | 'yellow' | 'orange' | 'white' | 'brown';
export const WIRE_COLORS: Readonly<Record<WireColor, { label: string; css: string }>> = {
  red: { label: 'Red (24 V +)', css: '#e5534b' }, blue: { label: 'Blue (0 V)', css: '#4c8dff' }, black: { label: 'Black', css: '#2b3138' },
  green: { label: 'Green', css: '#3fb950' }, yellow: { label: 'Yellow', css: '#e3b341' }, orange: { label: 'Orange (signal)', css: '#f0883e' },
  white: { label: 'White', css: '#e6edf3' }, brown: { label: 'Brown', css: '#a0724a' },
};
export type WireStyle = { color?: WireColor; label?: string };
export const MAX_WIRE_LABEL = 24;
const isColor = (v: unknown): v is WireColor => typeof v === 'string' && Object.hasOwn(WIRE_COLORS, v);
const cleanLabel = (v: unknown): string | null =>
  typeof v === 'string' && v.length <= MAX_WIRE_LABEL && !/[\u0000-\u001f\u007f]/.test(v) ? v.trim() : null;

/** Validates stored styles against the project's wires. Throws a readable Error; omitted when empty. */
export function validateWireStyles(raw: unknown, wires: readonly Wire[]): Record<string, WireStyle> | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid wire styles');
  const ids = new Set(wires.map(w => w.id));
  const out: Record<string, WireStyle> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ids.has(id)) throw new Error(`Wire style for unknown wire ${id.slice(0, 40)}`);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid style for wire ${id}`);
    const v = value as Record<string, unknown>;
    for (const key of Object.keys(v)) if (key !== 'color' && key !== 'label') throw new Error(`Unknown wire style field ${key.slice(0, 20)}`);
    const style: WireStyle = {};
    if (v.color !== undefined) { if (!isColor(v.color)) throw new Error(`Unknown wire colour for ${id}`); style.color = v.color; }
    if (v.label !== undefined) { const l = cleanLabel(v.label); if (l === null) throw new Error(`Wire label for ${id} must be plain text of at most ${MAX_WIRE_LABEL} characters`); if (l) style.label = l; }
    if (style.color || style.label) out[id] = style;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Sets or clears (null) a colour and/or label for one wire. */
export function withWireStyle(project: ProjectFile, id: string, patch: { color?: WireColor | null; label?: string | null }): ProjectFile {
  if (!project.wires.some(w => w.id === id)) throw new Error('Unknown wire');
  const current = { ...(project.wireStyles?.[id] ?? {}) } as WireStyle;
  if (patch.color !== undefined) { if (patch.color === null) delete current.color; else if (isColor(patch.color)) current.color = patch.color; else throw new Error('Unknown wire colour'); }
  if (patch.label !== undefined) {
    if (patch.label === null || patch.label.trim() === '') delete current.label;
    else { const l = cleanLabel(patch.label); if (!l) throw new Error(`Wire label must be plain text of at most ${MAX_WIRE_LABEL} characters`); current.label = l; }
  }
  const styles = { ...(project.wireStyles ?? {}) };
  if (current.color || current.label) styles[id] = current; else delete styles[id];
  const { wireStyles: _old, ...rest } = project;
  return Object.keys(styles).length ? { ...rest, wireStyles: styles } : rest;
}

/** Drops styles whose wire no longer exists (after unwire, device removal, paste/clear). */
export function pruneWireStyles(project: ProjectFile): ProjectFile {
  if (!project.wireStyles) return project;
  const ids = new Set(project.wires.map(w => w.id));
  const kept = Object.fromEntries(Object.entries(project.wireStyles).filter(([id]) => ids.has(id)));
  if (Object.keys(kept).length === Object.keys(project.wireStyles).length) return project;
  const { wireStyles: _old, ...rest } = project;
  return Object.keys(kept).length ? { ...rest, wireStyles: kept } : rest;
}
