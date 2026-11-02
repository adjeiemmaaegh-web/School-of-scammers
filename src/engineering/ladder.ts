/** Deterministic instructional ladder runtime. Not an IEC 61131-3 certified PLC. */
import type { Inputs, Program, Signal } from '../core/plc';
export type Contact = { type: 'contact'; tag: string; normallyClosed?: boolean };
export type Branch = { type: 'branch'; alternatives: readonly (readonly Contact[])[] };
export type RungElement = Contact | Branch;
export type RungOperation = { kind: 'coil' | 'osr' | 'osf' } | { kind: 'ton' | 'tof' | 'rto'; presetMs: number; resetTag?: string } | { kind: 'ctu'; preset: number; resetTag?: string };
export type Rung = { id: string; elements: readonly RungElement[]; coil: string; operation?: RungOperation };
export type SymbolDefinition = { description: string; address?: string };
export type LadderDocument = { id: string; version: string; rungs: readonly Rung[]; symbols?: Readonly<Record<string, SymbolDefinition>> };
export type InstructionMemory = { elapsedMs: number; done: boolean; count: number; lastEnable: boolean };
export type LadderMemory = Readonly<Record<string, InstructionMemory>>;
const tagOK = (s: string) => /^[A-Za-z][\w.]{0,79}$/.test(s);
const read = (signals: Readonly<Record<string, Signal>>, tag: string) => signals[tag] === true || (typeof signals[tag] === 'number' && Number.isFinite(signals[tag]) && signals[tag] !== 0);
export function validateLadder(doc: LadderDocument): string[] {
  const errors: string[] = [];
  if (!doc || typeof doc !== 'object' || typeof doc.id !== 'string' || !doc.id || typeof doc.version !== 'string' || !doc.version || !Array.isArray(doc.rungs)) return ['Invalid ladder document'];
  if (doc.rungs.length === 0) errors.push('Document requires at least one rung');
  if (doc.symbols !== undefined) {
    if (!doc.symbols || typeof doc.symbols !== 'object' || Array.isArray(doc.symbols)) errors.push('Invalid symbol table');
    else for (const [tag, definition] of Object.entries(doc.symbols)) {
      if (!tagOK(tag) || !definition || typeof definition !== 'object' || typeof definition.description !== 'string' || definition.description.length > 120 || (definition.address !== undefined && (typeof definition.address !== 'string' || !/^(?:[IQM]\d+(?:\.\d+)?|[A-Za-z][\w.]{0,79})$/.test(definition.address)))) errors.push(`Invalid symbol definition: ${tag}`);
    }
  }
  const ids = new Set<string>(); const coils = new Set<string>();
  for (const [index, rung] of doc.rungs.entries()) {
    if (!rung || typeof rung !== 'object') { errors.push(`Rung ${index}: invalid rung`); continue; }
    if (typeof rung.id !== 'string' || !rung.id || ids.has(rung.id)) errors.push(`Rung ${index}: duplicate or missing id`);
    ids.add(rung.id);
    if (typeof rung.coil !== 'string' || !tagOK(rung.coil)) errors.push(`Rung ${index}: invalid coil`);
    if (coils.has(rung.coil)) errors.push(`Rung ${index}: duplicate output tag ${rung.coil}`);
    coils.add(rung.coil);
    if (!Array.isArray(rung.elements) || rung.elements.length === 0) { errors.push(`Rung ${index}: empty logic`); continue; }
    for (const element of rung.elements) {
      if (!element || typeof element !== 'object') { errors.push(`Rung ${index}: invalid element`); continue; }
      if (element.type === 'contact') { if (typeof element.tag !== 'string' || !tagOK(element.tag)) errors.push(`Rung ${index}: invalid contact`); }
      else if (element.type === 'branch') {
        if (!Array.isArray(element.alternatives) || element.alternatives.length < 2 || element.alternatives.some((a: readonly Contact[]) => !Array.isArray(a) || !a.length || a.some(c => !c || c.type !== 'contact' || typeof c.tag !== 'string' || !tagOK(c.tag)))) errors.push(`Rung ${index}: invalid branch`);
      } else errors.push(`Rung ${index}: unknown element`);
    }
    const op = rung.operation;
    if (op && (typeof op !== 'object' || !['coil','ton','tof','rto','ctu','osr','osf'].includes(op.kind))) errors.push(`Rung ${index}: invalid operation`);
    if (op?.kind === 'ton' || op?.kind === 'tof' || op?.kind === 'rto') { if (!Number.isSafeInteger(op.presetMs) || op.presetMs < 1 || op.presetMs > 86400000) errors.push(`Rung ${index}: timer preset must be 1..86400000 ms`); }
    if (op?.kind === 'ctu' && (!Number.isSafeInteger(op.preset) || op.preset < 1 || op.preset > 100000000)) errors.push(`Rung ${index}: counter preset must be 1..100000000`);
    if (op && 'resetTag' in op && op.resetTag !== undefined && (typeof op.resetTag !== 'string' || !tagOK(op.resetTag))) errors.push(`Rung ${index}: invalid reset tag`);
    if (op && 'resetTag' in op && op.resetTag !== undefined && !['ctu','rto'].includes(op.kind)) errors.push(`Rung ${index}: reset tag unsupported for ${op.kind}`);
  }
  return errors;
}
export type ContactTrace = { tag: string; normallyClosed: boolean; sampled: boolean; conducts: boolean };
export type ElementTrace = { type: 'contact' | 'branch'; conducts: boolean; paths: readonly (readonly ContactTrace[])[] };
export type LadderStep = { rungId: string; energized: boolean; coil: string; result: boolean; operation: 'coil'|'ton'|'tof'|'rto'|'ctu'|'osr'|'osf'; elapsedMs?: number; count?: number; elements: readonly ElementTrace[] };
export type LadderResult = { outputs: Record<string, boolean>; steps: readonly LadderStep[]; memory: LadderMemory };
/** Each scan samples inputs once, then evaluates rungs in document order. Timers use simulation time, never wall time. */
export function executeLadder(doc: LadderDocument, inputs: Inputs, previousCoils: Readonly<Record<string, boolean>> = {}, previousMemory: LadderMemory = {}, deltaMs = 20): LadderResult {
  const errors = validateLadder(doc);
  if (errors.length) throw new Error(errors.join('; '));
  if (!Number.isSafeInteger(deltaMs) || deltaMs < 1 || deltaMs > 1000) throw new RangeError('Scan interval must be 1..1000 ms');
  const signals: Record<string, Signal> = { ...previousCoils, ...inputs };
  const outputs: Record<string, boolean> = {}; const memory: Record<string, InstructionMemory> = {};
  const steps: LadderStep[] = [];
  const contact = (c: Contact) => c.normallyClosed ? !read(signals, c.tag) : read(signals, c.tag);
  for (const rung of doc.rungs) {
    let energized = true;
    const trace: ElementTrace[] = [];
    for (const e of rung.elements) {
      const paths = (e.type === 'contact' ? [[e]] : e.alternatives).map(path => path.map(c => ({ tag: c.tag, normallyClosed: c.normallyClosed === true, sampled: read(signals,c.tag), conducts: contact(c) })));
      const conducts = paths.some(path => path.every(c => c.conducts));
      trace.push({ type: e.type, conducts, paths });
      energized = energized && conducts;
    }
    const op = rung.operation ?? { kind: 'coil' as const };
    const old = previousMemory[rung.id] ?? { elapsedMs: 0, done: false, count: 0, lastEnable: false };
    let elapsedMs = 0; let count = old.count; let result = energized;
    if (op.kind === 'ton') {
      elapsedMs = energized ? Math.min(op.presetMs, old.elapsedMs + deltaMs) : 0;
      result = energized && elapsedMs >= op.presetMs;
    } else if (op.kind === 'tof') {
      elapsedMs = energized ? 0 : old.lastEnable ? deltaMs : Math.min(op.presetMs, old.elapsedMs + deltaMs);
      result = energized || (old.done && elapsedMs < op.presetMs);
    } else if (op.kind === 'rto') {
      // RTO retains accumulated time while disabled; reset takes priority even if enabled.
      const reset = op.resetTag !== undefined && read(signals, op.resetTag);
      elapsedMs = reset ? 0 : energized ? Math.min(op.presetMs, Math.max(0, old.elapsedMs) + deltaMs) : Math.max(0, old.elapsedMs);
      result = elapsedMs >= op.presetMs;
    } else if (op.kind === 'ctu') {
      // Non-retentive input edge, retentive count; reset does not create a phantom edge.
      const reset = op.resetTag !== undefined && read(signals, op.resetTag);
      count = reset ? 0 : energized && !old.lastEnable ? Math.min(op.preset, Math.max(0, old.count) + 1) : Math.max(0, old.count);
      result = count >= op.preset;
    } else if (op.kind === 'osr') {
      result = energized && !old.lastEnable;
    } else if (op.kind === 'osf') {
      result = !energized && old.lastEnable;
    }
    memory[rung.id] = { elapsedMs, count, done: result, lastEnable: energized };
    outputs[rung.coil] = result; signals[rung.coil] = result;
    steps.push({ rungId: rung.id, energized, coil: rung.coil, result, operation: op.kind, elements: trace, ...(op.kind === 'ton' || op.kind === 'tof' || op.kind === 'rto' ? {elapsedMs} : {}), ...(op.kind === 'ctu' ? {count} : {}) });
  }
  return { outputs, steps, memory };
}
export interface PlcProgramAdapter { readonly format: 'ladder-v1'; readonly document: LadderDocument; readonly target: Program['id'] }
export const conveyorStarter: LadderDocument = { id: 'conveyor-start', version: '1.0.0', rungs: [{ id: 'run-permit', elements: [
  { type: 'contact', tag: 'EStopOK' }, { type: 'contact', tag: 'GuardClosed' },
  { type: 'branch', alternatives: [[{ type: 'contact', tag: 'Start' }], [{ type: 'contact', tag: 'RunLatch' }]] },
  { type: 'contact', tag: 'Stop', normallyClosed: true },
], coil: 'RunLatch' }] };
