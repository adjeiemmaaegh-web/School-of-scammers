/**
 * R07 Sequential Function Chart (SFC), as an authoring layer over the real Structured Text engine.
 *
 * A chart is a document of steps and transitions. `compileSfcToSt` turns it into ordinary ST that the existing scan engine runs, so an
 * SFC program uses the same timers, forces, watch table, breakpoints and I/O mapping as any other program. The document itself travels
 * in a header comment of the generated source, so it round-trips (`extractSfc`) and survives save/load without a project-format change.
 *
 * Semantics per scan (deterministic):
 *  1. Step timers advance (`T_<step>` is true once the step has been active for `minMs`).
 *  2. Every transition is evaluated against the step flags as they stood at the start of the scan. A transition is enabled when ALL its
 *     source steps are active and its condition is true. If two enabled transitions share a source step, the one EARLIER in the
 *     document fires and the other does not (a fixed priority, not a race).
 *  3. A fired transition deactivates all its sources and activates all its targets together, so parallel splits and joins work.
 *  4. Actions are evaluated on the new step flags: `N` holds an output while the step is active; `S` sets it when the step is ENTERED and it stays set until an `R`;
 *     `R` resets it on entry (a reset in the same scan wins over a set); `P` gives a one-scan pulse on step entry.
 * Step flags are `SFC_<step>` and are visible in conditions and the watch table.
 *
 * Teaching subset: no macro steps, no step-level jumps beyond transitions, no `L`/`D` timed qualifiers (use a step timer), actions are
 * BOOL outputs only. Not a model of any vendor's SFC runtime.
 */
import type { IoNames } from '../sim/plc-io';

export type SfcQualifier = 'N' | 'S' | 'R' | 'P';
export type SfcAction = { q: SfcQualifier; tag: string };
export type SfcStep = { id: string; initial?: boolean; minMs?: number; actions?: SfcAction[] };
export type SfcTransition = { from: string[]; to: string[]; when: string };
export type SfcDocument = { steps: SfcStep[]; transitions: SfcTransition[] };

export const SFC_MAX_STEPS = 32, SFC_MAX_TRANSITIONS = 48, SFC_MAX_ACTIONS = 8, SFC_MAX_CONDITION = 200, SFC_MAX_STEP_MS = 3_600_000;
const STEP_ID = /^[A-Za-z][A-Za-z0-9]{0,15}$/;
const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;
const HEADER = /^\(\*SFC:(.*)\*\)/;

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Everything wrong with a chart, in plain words; empty when it can be compiled. */
export function validateSfc(doc: unknown, names: IoNames): string[] {
  const errors: string[] = [];
  if (!doc || typeof doc !== 'object') return ['Chart must have steps and transitions'];
  const { steps, transitions } = doc as Partial<SfcDocument>;
  if (!Array.isArray(steps) || !Array.isArray(transitions)) return ['Chart needs steps and transitions lists'];
  if (steps.length < 1 || steps.length > SFC_MAX_STEPS) errors.push(`1-${SFC_MAX_STEPS} steps required`);
  if (transitions.length > SFC_MAX_TRANSITIONS) errors.push(`At most ${SFC_MAX_TRANSITIONS} transitions`);
  if (errors.length) return errors;
  const seen = new Set<string>();
  for (const s of steps) {
    if (!s || typeof s.id !== 'string' || !STEP_ID.test(s.id)) { errors.push(`Step "${String((s as SfcStep)?.id)}": use 1-16 letters/digits, starting with a letter`); continue; }
    if (seen.has(s.id.toLowerCase())) errors.push(`Step ${s.id} twice`); else seen.add(s.id.toLowerCase());
    if (s.minMs !== undefined && (!Number.isInteger(s.minMs) || s.minMs < 1 || s.minMs > SFC_MAX_STEP_MS)) errors.push(`Step ${s.id}: minimum time must be 1-${SFC_MAX_STEP_MS} ms`);
    if ((s.actions?.length ?? 0) > SFC_MAX_ACTIONS) errors.push(`Step ${s.id}: over ${SFC_MAX_ACTIONS} actions`);
    for (const a of s.actions ?? []) {
      if (!a || !['N', 'S', 'R', 'P'].includes(a.q)) errors.push(`Step ${s.id}: qualifier must be N, S, R or P`);
      else if (!names.outputs.some(o => same(o, String(a.tag)))) errors.push(`Step ${s.id}: ${String(a.tag)} is not a BOOL output`);
    }
  }
  if (!steps.some(s => s?.initial === true)) errors.push('Mark an initial step');
  transitions.forEach((t, i) => {
    const label = `Transition ${i + 1}`;
    if (!t || !Array.isArray(t.from) || !Array.isArray(t.to) || t.from.length < 1 || t.to.length < 1) { errors.push(`${label}: needs sources and targets`); return; }
    for (const id of [...t.from, ...t.to]) if (!seen.has(String(id).toLowerCase())) errors.push(`${label}: unknown step ${String(id)}`);
    if (new Set(t.from.map(x => String(x).toLowerCase())).size !== t.from.length || new Set(t.to.map(x => String(x).toLowerCase())).size !== t.to.length) errors.push(`${label}: duplicate step`);
    if (typeof t.when !== 'string' || !t.when.trim() || t.when.length > SFC_MAX_CONDITION || t.when.includes('(*') || t.when.includes('*)') || t.when.includes(';'))
      errors.push(`${label}: condition must be one expression up to ${SFC_MAX_CONDITION} characters, no ; or comments`);
  });
  return errors;
}

/** Generated Structured Text for a valid chart. Throws on an invalid one. */
export function compileSfcToSt(doc: SfcDocument, names: IoNames): string {
  const errors = validateSfc(doc, names);
  if (errors.length) throw new Error(errors.join('; '));
  const flag = (id: string) => `SFC_${id}`;
  const idOf = (raw: string) => doc.steps.find(s => same(s.id, raw))!.id;
  const trs = doc.transitions.map(t => ({ from: t.from.map(idOf), to: t.to.map(idOf), when: t.when.trim() }));
  // Which declared tags the conditions read.
  const inputs = new Set<string>(), numeric = new Set<string>();
  for (const t of trs) for (const word of t.when.match(IDENT) ?? []) {
    const d = names.inputs.find(n => same(n, word)); if (d) inputs.add(d);
    const n = names.numericInputs.find(x => same(x, word)); if (n) numeric.add(n);
  }
  const outs = new Map<string, { n: string[]; s: string[]; r: string[]; p: string[] }>();
  for (const s of doc.steps) for (const a of s.actions ?? []) {
    const tag = names.outputs.find(o => same(o, a.tag))!;
    const e = outs.get(tag) ?? { n: [], s: [], r: [], p: [] };
    e[a.q.toLowerCase() as 'n' | 's' | 'r' | 'p'].push(s.id); outs.set(tag, e);
  }
  const timed = doc.steps.filter(s => s.minMs !== undefined);
  const header = `(*SFC:${JSON.stringify(doc).replaceAll('*)', '*\\u0029')}*)`;
  const L: string[] = [header];
  if (inputs.size || numeric.size) L.push('VAR_INPUT', ...[...inputs].map(n => `  ${n} : BOOL;`), ...[...numeric].map(n => `  ${n} : REAL;`), 'END_VAR');
  L.push('VAR_OUTPUT', ...[...outs.keys()].map(n => `  ${n} : BOOL;`), 'END_VAR');
  const vars = ['init : BOOL;', 'boot : BOOL;', ...doc.steps.flatMap(s => [`${flag(s.id)} : BOOL;`, `nx_${s.id} : BOOL;`, `ent_${s.id} : BOOL;`]),
    ...trs.map((_, i) => `fired_${i} : BOOL;`), ...timed.flatMap(s => [`tm_${s.id} : TON;`, `T_${s.id} : BOOL;`]),
    ...[...outs].filter(([, e]) => e.s.length || e.r.length).map(([tag]) => `lt_${tag} : BOOL;`)];
  L.push('VAR', ...vars.map(v => `  ${v}`), 'END_VAR');
  const initials = doc.steps.filter(s => s.initial);
  L.push('boot := NOT init;', 'IF NOT init THEN', ...initials.map(s => `  ${flag(s.id)} := TRUE;`), '  init := TRUE;', 'END_IF;');
  for (const s of timed) L.push(`tm_${s.id}(IN := ${flag(s.id)}, PT := T#${s.minMs}ms);`, `T_${s.id} := tm_${s.id}.Q;`);
  // Transitions are all evaluated on the flags as they stood at the start of the scan.
  trs.forEach((t, i) => {
    L.push(`fired_${i} := ${t.from.map(flag).join(' AND ')} AND (${t.when});`);
    for (let j = 0; j < i; j++) if (t.from.some(f => trs[j].from.includes(f))) L.push(`fired_${i} := fired_${i} AND NOT fired_${j};`);
  });
  for (const s of doc.steps) {
    const leaves = trs.map((t, i) => (t.from.includes(s.id) ? `fired_${i}` : '')).filter(Boolean);
    const enters = trs.map((t, i) => (t.to.includes(s.id) ? `fired_${i}` : '')).filter(Boolean);
    const kept = leaves.length ? `${flag(s.id)} AND NOT (${leaves.join(' OR ')})` : flag(s.id);
    L.push(`nx_${s.id} := ${enters.length ? `(${kept}) OR ${enters.join(' OR ')}` : kept};`);
    L.push(`ent_${s.id} := nx_${s.id} AND NOT ${flag(s.id)}${s.initial ? ' OR boot' : ''};`);
  }
  for (const s of doc.steps) L.push(`${flag(s.id)} := nx_${s.id};`);
  for (const [tag, e] of outs) {
    for (const id of e.s) L.push(`IF ent_${id} THEN lt_${tag} := TRUE; END_IF;`);
    for (const id of e.r) L.push(`IF ent_${id} THEN lt_${tag} := FALSE; END_IF;`);
    const parts = [...e.n.map(flag), ...e.p.map(id => `ent_${id}`), ...(e.s.length || e.r.length ? [`lt_${tag}`] : [])];
    L.push(`${tag} := ${parts.length ? parts.join(' OR ') : 'FALSE'};`);
  }
  return L.join('\n') + '\n';
}

/** The chart embedded in generated source, or null when the source was not generated from a valid chart. */
export function extractSfc(source: string, names: IoNames): SfcDocument | null {
  const m = HEADER.exec(source.split('\n', 1)[0] ?? '');
  if (!m) return null;
  try {
    const doc = JSON.parse(m[1]) as unknown;
    return validateSfc(doc, names).length ? null : (doc as SfcDocument);
  } catch { return null; }
}
