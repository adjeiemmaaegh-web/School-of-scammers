/** Deterministic, DOM-free educational PLC scan kernel. Not an IEC 61131-3 certified runtime. */
export type Signal = boolean | number;
export type Inputs = Readonly<Record<string, Signal>>;
export type Outputs = Readonly<Record<string, Signal>>;
export type Memory = Record<string, Signal>;
export type Instruction =
  | { kind: 'contact'; input: string; target: string; normallyClosed?: boolean }
  | { kind: 'coil'; condition: string; output: string }
  | { kind: 'ton'; enable: string; timer: string; presetMs: number; done: string }
  | { kind: 'ctu'; countInput: string; resetInput: string; counter: string; preset: number; done: string };
export interface Program { id: string; version: string; instructions: readonly Instruction[] }
export interface Timer { elapsedMs: number; done: boolean }
export interface Counter { value: number; lastInput: boolean; done: boolean }
export interface Snapshot { scan: number; elapsedMs: number; memory: Memory; outputs: Record<string, Signal>; timers: Record<string, Timer>; counters: Record<string, Counter> }
export interface Trace { scan: number; elapsedMs: number; inputs: Inputs; outputs: Outputs }
export interface ScanResult { snapshot: Snapshot; trace: Trace }
const isValidTag = (tag: string): boolean => /^[A-Za-z][A-Za-z0-9_.]{0,79}$/.test(tag);
const bool = (v: Signal | undefined): boolean => v === true || (typeof v === 'number' && v !== 0);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function validateProgram(program: Program): string[] {
  const errors: string[] = [];
  if (!program.id || !program.version) errors.push('Program id and version are required');
  for (const [index, op] of program.instructions.entries()) {
    const tags = op.kind === 'contact' ? [op.input, op.target] : op.kind === 'coil' ? [op.condition, op.output] : op.kind === 'ton' ? [op.enable, op.timer, op.done] : [op.countInput, op.resetInput, op.counter, op.done];
    if (tags.some(tag => !isValidTag(tag))) errors.push(`Instruction ${index}: invalid tag`);
    if (op.kind === 'ton' && (!Number.isSafeInteger(op.presetMs) || op.presetMs < 0)) errors.push(`Instruction ${index}: invalid timer preset`);
    if (op.kind === 'ctu' && (!Number.isSafeInteger(op.preset) || op.preset < 0)) errors.push(`Instruction ${index}: invalid counter preset`);
  }
  return errors;
}
export function emptySnapshot(): Snapshot { return { scan: 0, elapsedMs: 0, memory: {}, outputs: {}, timers: {}, counters: {} }; }
export function scan(program: Program, previous: Snapshot, inputs: Inputs, deltaMs: number): ScanResult {
  const errors = validateProgram(program);
  if (errors.length) throw new Error(errors.join('; '));
  if (!Number.isSafeInteger(deltaMs) || deltaMs <= 0 || deltaMs > 1000) throw new RangeError('Scan interval must be 1..1000 milliseconds');
  const state = copy(previous);
  if (!Number.isSafeInteger(state.scan) || state.scan < 0 || state.scan === Number.MAX_SAFE_INTEGER || !Number.isSafeInteger(state.elapsedMs + deltaMs)) throw new RangeError('Scan clock overflow');
  state.scan++; state.elapsedMs += deltaMs;
  // Inputs are sampled once; instructions execute in source order; outputs commit at scan end.
  const sampled: Inputs = { ...inputs };
  for (const op of program.instructions) {
    switch (op.kind) {
      case 'contact': {
        const value = Object.hasOwn(sampled, op.input) ? sampled[op.input] : state.memory[op.input];
        state.memory[op.target] = op.normallyClosed ? !bool(value) : bool(value);
        break;
      }
      case 'coil': state.outputs[op.output] = bool(state.memory[op.condition]); break;
      case 'ton': {
        const enabled = bool(state.memory[op.enable]);
        const prev = state.timers[op.timer] ?? { elapsedMs: 0, done: false };
        const elapsedMs = enabled ? Math.min(op.presetMs, prev.elapsedMs + deltaMs) : 0;
        const done = enabled && elapsedMs >= op.presetMs;
        state.timers[op.timer] = { elapsedMs, done }; state.memory[op.done] = done;
        break;
      }
      case 'ctu': {
        const high = bool(state.memory[op.countInput]);
        const reset = bool(state.memory[op.resetInput]);
        const prev = state.counters[op.counter] ?? { value: 0, lastInput: false, done: false };
        const value = reset ? 0 : high && !prev.lastInput ? Math.min(op.preset, prev.value + 1) : prev.value;
        const done = value >= op.preset;
        state.counters[op.counter] = { value, lastInput: reset ? false : high, done }; state.memory[op.done] = done;
        break;
      }
    }
  }
  return { snapshot: state, trace: { scan: state.scan, elapsedMs: state.elapsedMs, inputs: sampled, outputs: { ...state.outputs } } };
}
export const motorStartProgram: Program = {
  id: 'motor-start-reference', version: '1.0.0', instructions: [
    { kind: 'contact', input: 'Start', target: 'start' },
    { kind: 'contact', input: 'EStopOK', target: 'safety' },
    { kind: 'contact', input: 'SensorOK', target: 'sensor' },
    // The reference program demonstrates a fixed sequence; ladder editing comes in Stage 2.
    { kind: 'contact', input: 'Permit', target: 'permit' },
    { kind: 'coil', condition: 'permit', output: 'MotorRequest' }
  ]
};
