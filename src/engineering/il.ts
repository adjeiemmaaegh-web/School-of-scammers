/**
 * R07 Instruction List (IL), the textual IEC 61131-3 accumulator language, as an authoring layer over the real Structured Text
 * engine: `compileIlToSt` turns an IL program into ordinary ST (so IL shares the scan engine, timers, forces, watch table and I/O
 * mapping), and the original IL text travels in a header comment so it round-trips (`extractIl`).
 *
 * Subset: BOOL only. One accumulator (the "current result"). Instructions:
 *   LD / LDN x   load x (or NOT x)            ST / STN x   store the accumulator (or its NOT) in x
 *   S x / R x    set / reset x when the accumulator is TRUE
 *   AND / ANDN / OR / ORN / XOR / XORN x       combine the accumulator with x (or NOT x)
 *   NOT          invert the accumulator
 * An operand is a BOOL input of the controller, a BOOL output (readable and writable, it keeps its value between scans), TRUE/FALSE,
 * or any other name, which becomes a private memory bit. Comments are `(* ... *)` on one line or `// ...`. No labels, jumps,
 * parentheses, function-block calls or numeric instructions: use Structured Text or Ladder for those.
 */
import type { IoNames } from '../sim/plc-io';

export const IL_MAX_LINES = 400;
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,23}$/;
const OPS = new Set(['LD', 'LDN', 'ST', 'STN', 'S', 'R', 'AND', 'ANDN', 'OR', 'ORN', 'XOR', 'XORN', 'NOT']);
const HEADER = /^\(\*IL:(.*)\*\)/;
type Instr = { op: string; operand?: string; line: number };
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

function parse(source: string): { instrs: Instr[]; errors: string[] } {
  const errors: string[] = [], instrs: Instr[] = [];
  const lines = source.split('\n');
  if (lines.length > IL_MAX_LINES) return { instrs, errors: [`At most ${IL_MAX_LINES} lines`] };
  lines.forEach((raw, i) => {
    const text = raw.replace(/\(\*.*?\*\)/g, ' ').replace(/\/\/.*$/, '').trim();
    if (!text) return;
    const parts = text.split(/\s+/);
    const op = parts[0].toUpperCase();
    if (/:$/.test(parts[0]) || op === 'JMP' || op === 'JMPC' || op === 'CAL') { errors.push(`Line ${i + 1}: labels, jumps and calls are not supported`); return; }
    if (!OPS.has(op)) { errors.push(`Line ${i + 1}: unknown instruction ${parts[0]}`); return; }
    if (op === 'NOT') { if (parts.length !== 1) errors.push(`Line ${i + 1}: NOT takes no operand`); else instrs.push({ op, line: i + 1 }); return; }
    if (parts.length !== 2) { errors.push(`Line ${i + 1}: ${op} needs exactly one operand`); return; }
    const operand = parts[1];
    if (!/^(TRUE|FALSE)$/i.test(operand) && !NAME.test(operand)) { errors.push(`Line ${i + 1}: ${operand} is not a valid operand`); return; }
    instrs.push({ op, operand, line: i + 1 });
  });
  if (!errors.length && !instrs.length) errors.push('The program is empty');
  if (!errors.length && instrs[0].op !== 'LD' && instrs[0].op !== 'LDN') errors.push(`Line ${instrs[0].line}: a program starts with LD or LDN`);
  return { instrs, errors };
}

/** Everything wrong with an IL program, in plain words; empty when it can be compiled. */
export function validateIl(source: unknown, names: IoNames): string[] {
  if (typeof source !== 'string') return ['The IL program must be text'];
  const { instrs, errors } = parse(source);
  if (errors.length) return errors;
  for (const ins of instrs) {
    if (!ins.operand || /^(TRUE|FALSE)$/i.test(ins.operand)) {
      if (ins.operand && ['ST', 'STN', 'S', 'R'].includes(ins.op)) errors.push(`Line ${ins.line}: ${ins.operand} cannot be written`);
      continue;
    }
    const isInput = names.inputs.some(n => same(n, ins.operand!));
    if (isInput && ['ST', 'STN', 'S', 'R'].includes(ins.op)) errors.push(`Line ${ins.line}: ${ins.operand} is an input and cannot be written`);
    if (names.numericInputs.some(n => same(n, ins.operand!))) errors.push(`Line ${ins.line}: ${ins.operand} is numeric; IL here handles BOOL only`);
  }
  return errors;
}

/** Generated Structured Text for a valid IL program. Throws on an invalid one. */
export function compileIlToSt(source: string, names: IoNames): string {
  const errors = validateIl(source, names);
  if (errors.length) throw new Error(errors.join('; '));
  const { instrs } = parse(source);
  const inputs = new Set<string>(), outputs = new Set<string>(), memory = new Set<string>();
  const operand = (name: string, write: boolean): string => {
    if (/^TRUE$/i.test(name)) return 'TRUE';
    if (/^FALSE$/i.test(name)) return 'FALSE';
    const input = names.inputs.find(n => same(n, name));
    if (input) { inputs.add(input); return input; }
    const output = names.outputs.find(n => same(n, name));
    if (output) { outputs.add(output); return `lt_${output}`; }
    memory.add(name); void write; return `m_${name}`;
  };
  const body: string[] = [];
  for (const ins of instrs) {
    const w = ['ST', 'STN', 'S', 'R'].includes(ins.op);
    const x = ins.operand ? operand(ins.operand, w) : '';
    switch (ins.op) {
      case 'LD': body.push(`cr := ${x};`); break;
      case 'LDN': body.push(`cr := NOT ${x};`); break;
      case 'ST': body.push(`${x} := cr;`); break;
      case 'STN': body.push(`${x} := NOT cr;`); break;
      case 'S': body.push(`IF cr THEN ${x} := TRUE; END_IF;`); break;
      case 'R': body.push(`IF cr THEN ${x} := FALSE; END_IF;`); break;
      case 'AND': body.push(`cr := cr AND ${x};`); break;
      case 'ANDN': body.push(`cr := cr AND NOT ${x};`); break;
      case 'OR': body.push(`cr := cr OR ${x};`); break;
      case 'ORN': body.push(`cr := cr OR NOT ${x};`); break;
      case 'XOR': body.push(`cr := cr XOR ${x};`); break;
      case 'XORN': body.push(`cr := cr XOR NOT ${x};`); break;
      default: body.push('cr := NOT cr;');
    }
  }
  const header = `(*IL:${JSON.stringify(source).replaceAll('*)', '*\\u0029')}*)`;
  const L: string[] = [header];
  if (inputs.size) L.push('VAR_INPUT', ...[...inputs].map(n => `  ${n} : BOOL;`), 'END_VAR');
  if (outputs.size) L.push('VAR_OUTPUT', ...[...outputs].map(n => `  ${n} : BOOL;`), 'END_VAR');
  L.push('VAR', '  cr : BOOL;', ...[...outputs].map(n => `  lt_${n} : BOOL;`), ...[...memory].map(n => `  m_${n} : BOOL;`), 'END_VAR');
  L.push(...body, ...[...outputs].map(n => `${n} := lt_${n};`));
  return L.join('\n') + '\n';
}

/** The IL text embedded in generated source, or null when the source was not generated from a valid IL program. */
export function extractIl(source: string, names: IoNames): string | null {
  const m = HEADER.exec(source.split('\n', 1)[0] ?? '');
  if (!m) return null;
  try { const text = JSON.parse(m[1]) as unknown; return typeof text === 'string' && !validateIl(text, names).length ? text : null; } catch { return null; }
}
