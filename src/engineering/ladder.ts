/** Deterministic instructional ladder runtime. Not an IEC 61131-3 certified PLC. */
import type { Inputs, Program, Signal } from '../core/plc';
export type Contact = { type: 'contact'; tag: string; normallyClosed?: boolean };
export type Branch = { type: 'branch'; alternatives: readonly (readonly Contact[])[] };
export type RungElement = Contact | Branch;
export type NumericOperand = { kind: 'literal'; value: number } | { kind: 'tag'; name: string };
export type NumericTagType = 'INT' | 'DINT' | 'REAL';
export type SymbolType = 'BOOL' | NumericTagType;
export type NumericRungOperation =
  | { kind: 'compare'; left: NumericOperand; comparator: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge'; right: NumericOperand }
  | { kind: 'move'; target: string; left: NumericOperand }
  | { kind: 'add' | 'sub' | 'mul' | 'div'; target: string; left: NumericOperand; right: NumericOperand };
export type RungOperation = { kind: 'coil' | 'osr' | 'osf' | 'set' | 'reset' } |
  { kind: 'ton' | 'tof' | 'rto' | 'tp'; presetMs: number; resetTag?: string } |
  { kind: 'ctu'; preset: number; resetTag?: string } | { kind: 'ctd'; preset: number; loadTag: string } |
  NumericRungOperation;
export type Rung = { id: string; elements: readonly RungElement[]; coil: string; operation?: RungOperation };
export type SymbolDefinition = { description: string; address?: string; type?: SymbolType; initial?: boolean | number };
export type LadderDocument = { id: string; version: string; rungs: readonly Rung[]; symbols?: Readonly<Record<string, SymbolDefinition>> };
export type InstructionMemory = { elapsedMs: number; done: boolean; count: number; lastEnable: boolean };
export type LadderMemory = Readonly<Record<string, InstructionMemory>>;
const tagOK = (s: string) => /^[A-Za-z][\w.]{0,79}$/.test(s);
const read = (signals: Readonly<Record<string, Signal>>, tag: string) => signals[tag] === true || (typeof signals[tag] === 'number' && Number.isFinite(signals[tag]) && signals[tag] !== 0);
const NUMERIC_LIMIT = 1_000_000_000;
const numericType = (definition: SymbolDefinition): SymbolType => definition.type ?? 'BOOL';
function checkedNumber(type: NumericTagType, value: number, tag: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > NUMERIC_LIMIT) throw new RangeError(`${tag} outside bounded numeric range`);
  if (type === 'INT' && (!Number.isSafeInteger(value) || value < -32768 || value > 32767))
    throw new RangeError(`${tag} requires INT -32768..32767`);
  if (type === 'DINT' && (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647))
    throw new RangeError(`${tag} requires bounded DINT integer`);
  return value;
}
const validNumericOperand = (value: unknown): value is NumericOperand =>
  !!value && typeof value === 'object' && (
    ('kind' in value && value.kind === 'literal' && 'value' in value && typeof value.value === 'number'
      && Number.isFinite(value.value) && Math.abs(value.value) <= NUMERIC_LIMIT) ||
    ('kind' in value && value.kind === 'tag' && 'name' in value && typeof value.name === 'string' && tagOK(value.name))
  );
export function validateLadder(doc: LadderDocument): string[] {
  const errors: string[] = [];
  if (!doc || typeof doc !== 'object' || typeof doc.id !== 'string' || !doc.id || typeof doc.version !== 'string' || !doc.version || !Array.isArray(doc.rungs)) return ['Invalid ladder document'];
  if (doc.rungs.length === 0) errors.push('Document requires at least one rung');
  if (doc.symbols !== undefined) {
    if (!doc.symbols || typeof doc.symbols !== 'object' || Array.isArray(doc.symbols)) errors.push('Invalid symbol table');
    else for (const [tag, definition] of Object.entries(doc.symbols)) {
      if (!tagOK(tag) || !definition || typeof definition !== 'object' || typeof definition.description !== 'string' || definition.description.length > 120 || (definition.address !== undefined && (typeof definition.address !== 'string' || !/^(?:[IQM]\d+(?:\.\d+)?|[A-Za-z][\w.]{0,79})$/.test(definition.address)))) errors.push(`Invalid symbol definition: ${tag}`);
      else if (!['BOOL', 'INT', 'DINT', 'REAL'].includes(numericType(definition)))
        errors.push(`Invalid symbol type: ${tag}`);
      else if (definition.initial !== undefined) {
        if (numericType(definition) === 'BOOL') {
          if (typeof definition.initial !== 'boolean') errors.push(`Invalid BOOL initial value: ${tag}`);
        } else if (typeof definition.initial !== 'number') errors.push(`Invalid numeric initial value: ${tag}`);
        else try { checkedNumber(numericType(definition) as NumericTagType, definition.initial, tag); }
          catch { errors.push(`Invalid numeric initial value: ${tag}`); }
      }
    }
  }
  const ids = new Set<string>(); const coils = new Map<string, Set<string>>();
  for (const [index, rung] of doc.rungs.entries()) {
    if (!rung || typeof rung !== 'object') { errors.push(`Rung ${index}: invalid rung`); continue; }
    if (typeof rung.id !== 'string' || !rung.id || ids.has(rung.id)) errors.push(`Rung ${index}: duplicate or missing id`);
    ids.add(rung.id);
    if (typeof rung.coil !== 'string' || !tagOK(rung.coil)) errors.push(`Rung ${index}: invalid coil`);
    const previousCoil=coils.get(rung.coil);
    const currentKind=rung.operation?.kind??'coil';
    if(previousCoil && !(previousCoil.size===1 && ['set','reset'].includes(currentKind) &&
        [...previousCoil].every(previous=>['set','reset'].includes(previous)&&previous!==currentKind)))
      errors.push(`Rung ${index}: duplicate output tag ${rung.coil}`);
    if(previousCoil) previousCoil.add(currentKind);
    else coils.set(rung.coil,new Set([currentKind]));
    if (!Array.isArray(rung.elements) || rung.elements.length === 0) { errors.push(`Rung ${index}: empty logic`); continue; }
    for (const element of rung.elements) {
      if (!element || typeof element !== 'object') { errors.push(`Rung ${index}: invalid element`); continue; }
      if (element.type === 'contact') { if (typeof element.tag !== 'string' || !tagOK(element.tag)) errors.push(`Rung ${index}: invalid contact`); }
      else if (element.type === 'branch') {
        if (!Array.isArray(element.alternatives) || element.alternatives.length < 2 || element.alternatives.some((a: readonly Contact[]) => !Array.isArray(a) || !a.length || a.some(c => !c || c.type !== 'contact' || typeof c.tag !== 'string' || !tagOK(c.tag)))) errors.push(`Rung ${index}: invalid branch`);
      } else errors.push(`Rung ${index}: unknown element`);
    }
    const op = rung.operation;
    if (op && (typeof op !== 'object' || !['coil','ton','tof','rto','tp','ctu','ctd','osr','osf','set','reset','compare','move','add','sub','mul','div'].includes(op.kind))) errors.push(`Rung ${index}: invalid operation`);
    if (op?.kind === 'compare' && (!validNumericOperand(op.left) || !validNumericOperand(op.right) ||
      !['eq','ne','lt','le','gt','ge'].includes(op.comparator)))
      errors.push(`Rung ${index}: invalid numeric comparator`);
    if ((op?.kind === 'move' || op?.kind === 'add' || op?.kind === 'sub' ||
      op?.kind === 'mul' || op?.kind === 'div') &&
      (!tagOK(op.target) || !validNumericOperand(op.left) ||
        (op.kind !== 'move' && !validNumericOperand(op.right))))
      errors.push(`Rung ${index}: invalid numeric instruction`);
    if (op?.kind === 'ton' || op?.kind === 'tof' || op?.kind === 'rto' || op?.kind === 'tp') { if (!Number.isSafeInteger(op.presetMs) || op.presetMs < 1 || op.presetMs > 86400000) errors.push(`Rung ${index}: timer preset must be 1..86400000 ms`); }
    if ((op?.kind === 'ctu' || op?.kind === 'ctd') && (!Number.isSafeInteger(op.preset) || op.preset < 1 || op.preset > 100000000)) errors.push(`Rung ${index}: counter preset must be 1..100000000`);
    if (op && 'resetTag' in op && op.resetTag !== undefined && (typeof op.resetTag !== 'string' || !tagOK(op.resetTag))) errors.push(`Rung ${index}: invalid reset tag`);
    if (op && 'resetTag' in op && op.resetTag !== undefined && !['ctu','rto'].includes(op.kind)) errors.push(`Rung ${index}: reset tag unsupported for ${op.kind}`);
    if (op?.kind === 'ctd' && (typeof op.loadTag !== 'string' || !tagOK(op.loadTag) || op.loadTag === rung.coil)) errors.push(`Rung ${index}: CTD requires a valid external load tag`);
    if (op && 'loadTag' in op && op.kind !== 'ctd') errors.push(`Rung ${index}: load tag unsupported for ${op.kind}`);
  }
  return errors;
}
export type ContactTrace = { tag: string; normallyClosed: boolean; sampled: boolean; conducts: boolean };
export type ElementTrace = { type: 'contact' | 'branch'; conducts: boolean; paths: readonly (readonly ContactTrace[])[] };
export type LadderStep = { rungId: string; energized: boolean; coil: string; result: boolean;
  operation: RungOperation['kind']; elapsedMs?: number; count?: number; numericResult?: number;
  elements: readonly ElementTrace[] };
export type LadderResult = { outputs: Record<string, boolean>; steps: readonly LadderStep[]; memory: LadderMemory;
  numericValues: Record<string, number> };
/** Each scan samples inputs once, then evaluates rungs in document order. Timers use simulation time, never wall time. */
export function executeLadder(doc: LadderDocument, inputs: Inputs, previousCoils: Readonly<Record<string, boolean>> = {},
  previousMemory: LadderMemory = {}, deltaMs = 20, previousNumeric: Readonly<Record<string, number>> = {},
  localForces: Readonly<Record<string, Signal>> = {}): LadderResult {
  const errors = validateLadder(doc);
  if (errors.length) throw new Error(errors.join('; '));
  if (!Number.isSafeInteger(deltaMs) || deltaMs < 1 || deltaMs > 1000) throw new RangeError('Scan interval must be 1..1000 ms');
  const definitions = doc.symbols ?? {};
  // Defense in depth: only typed local tags can be overridden; physical inputs
  // and hardware safety wiring are never part of this force map.
  for (const [tag,override] of Object.entries(localForces)) {
    const def=definitions[tag];
    if(!def)throw new Error('Cannot force a physical or undeclared tag: '+tag);
    const type=numericType(def);
    if(type==='BOOL'){
      if(typeof override!=='boolean')throw new TypeError('BOOL force requires boolean: '+tag);
    }else{
      if(typeof override!=='number')throw new TypeError('Numeric force requires a number: '+tag);
      checkedNumber(type,override,tag);
    }
  }
  const numericValues: Record<string, number> = {};
  for (const [name, definition] of Object.entries(definitions)) {
    const type = numericType(definition);
    if (type !== 'BOOL')
      numericValues[name] = checkedNumber(type, typeof localForces[name]==='number' ? localForces[name] as number :
        previousNumeric[name] ?? (typeof definition.initial === 'number' ? definition.initial : 0), name);
  }
  const boolForces=Object.fromEntries(Object.entries(localForces).filter(([,v])=>typeof v==='boolean'));
  const signals: Record<string, Signal> = { ...previousCoils, ...numericValues, ...boolForces, ...inputs };
  const operand = (value: NumericOperand): number => {
    if (value.kind === 'literal') return value.value;
    const number = numericValues[value.name];
    if (number === undefined) throw new TypeError(`Unknown numeric register ${value.name}`);
    return number;
  };
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
    let numericResult: number | undefined;
    if (op.kind === 'set') {
      result = energized || read(signals,rung.coil);
    } else if (op.kind === 'reset') {
      result = !energized && read(signals,rung.coil);
    } else if (op.kind === 'ton') {
      elapsedMs = energized ? Math.min(op.presetMs, old.elapsedMs + deltaMs) : 0;
      result = energized && elapsedMs >= op.presetMs;
    } else if (op.kind === 'tof') {
      elapsedMs = energized ? 0 : old.lastEnable ? deltaMs : Math.min(op.presetMs, old.elapsedMs + deltaMs);
      result = energized || (old.done && elapsedMs < op.presetMs);
    } else if (op.kind === 'tp') {
      // Scan-time monostable: a rising enable edge starts the non-retriggerable pulse.
      const start = energized && !old.lastEnable && !old.done;
      const ongoing = old.done && old.elapsedMs < op.presetMs;
      result = start || ongoing;
      elapsedMs = result ? Math.min(op.presetMs, (start ? 0 : old.elapsedMs) + deltaMs) : 0;
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
    } else if (op.kind === 'ctd') {
      // Explicit LD has priority. Fresh CV starts at 0, so Q is TRUE until loaded.
      const load = read(signals, op.loadTag);
      const prior = Math.max(0, Math.min(op.preset, old.count));
      count = load ? op.preset : energized && !old.lastEnable ? Math.max(0, prior - 1) : prior;
      result = count === 0;
    } else if (op.kind === 'compare') {
      const lhs = operand(op.left), rhs = operand(op.right);
      const matches = op.comparator === 'eq' ? lhs === rhs : op.comparator === 'ne' ? lhs !== rhs :
        op.comparator === 'lt' ? lhs < rhs : op.comparator === 'le' ? lhs <= rhs :
        op.comparator === 'gt' ? lhs > rhs : lhs >= rhs;
      result = energized && matches;
    } else if (op.kind === 'move' || op.kind === 'add' || op.kind === 'sub' ||
      op.kind === 'mul' || op.kind === 'div') {
      if (energized) {
        const type = definitions[op.target] && numericType(definitions[op.target]);
        if (!type || type === 'BOOL') throw new TypeError(`Numeric target ${op.target} must be declared`);
        const lhs = operand(op.left);
        const rhs = op.kind === 'move' ? 0 : operand(op.right);
        if (op.kind === 'div' && rhs === 0) throw new RangeError('Numeric division by zero');
        const next = op.kind === 'move' ? lhs : op.kind === 'add' ? lhs + rhs :
          op.kind === 'sub' ? lhs - rhs : op.kind === 'mul' ? lhs * rhs : lhs / rhs;
        numericResult = checkedNumber(type, next, op.target);
        if(typeof localForces[op.target]==='number') numericResult=checkedNumber(type,localForces[op.target] as number,op.target);
        numericValues[op.target] = numericResult;
        signals[op.target] = numericValues[op.target];
      }
    } else if (op.kind === 'osr') {
      result = energized && !old.lastEnable;
    } else if (op.kind === 'osf') {
      result = !energized && old.lastEnable;
    }
    // A local BOOL force overrides that symbol's published local memory only.
    // The sandbox contract prohibits putting mapped physical outputs in symbols.
    if(typeof localForces[rung.coil]==='boolean')result=localForces[rung.coil] as boolean;
    memory[rung.id] = { elapsedMs, count, done: result, lastEnable: energized };
    outputs[rung.coil] = result; signals[rung.coil] = result;
    steps.push({ rungId: rung.id, energized, coil: rung.coil, result, operation: op.kind, elements: trace,
      ...(op.kind === 'ton' || op.kind === 'tof' || op.kind === 'rto' || op.kind === 'tp' ? {elapsedMs} : {}),
      ...(op.kind === 'ctu' || op.kind === 'ctd' ? {count} : {}),
      ...(numericResult === undefined ? {} : {numericResult}) });
  }
  return { outputs, steps, memory, numericValues };
}
export interface PlcProgramAdapter { readonly format: 'ladder-v1'; readonly document: LadderDocument; readonly target: Program['id'] }
export const conveyorStarter: LadderDocument = { id: 'conveyor-start', version: '1.0.0', rungs: [{ id: 'run-permit', elements: [
  { type: 'contact', tag: 'EStopOK' }, { type: 'contact', tag: 'GuardClosed' },
  { type: 'branch', alternatives: [[{ type: 'contact', tag: 'Start' }], [{ type: 'contact', tag: 'RunLatch' }]] },
  { type: 'contact', tag: 'Stop', normallyClosed: true },
], coil: 'RunLatch' }] };
