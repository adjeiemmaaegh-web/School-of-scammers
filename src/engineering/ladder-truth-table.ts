/** Exhaustive single-scan logic exploration for small ladder programs. Simulation only. */
import { executeLadder, validateLadder, type LadderDocument } from './ladder';
export type TruthRow = { inputs: Record<string, boolean>; outputs: Record<string, boolean>; energizedRungs: string[] };
export type TruthTable = { inputTags: string[]; outputTags: string[]; rows: TruthRow[]; warnings: string[] };
const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;
export function buildTruthTable(doc: LadderDocument, maxInputs = 10): TruthTable {
  const errors = validateLadder(doc);
  if (errors.length) throw new Error(errors.join('; '));
  if (!Number.isSafeInteger(maxInputs) || maxInputs < 1 || maxInputs > 12) throw new RangeError('Input limit must be 1..12');
  const outputTags = doc.rungs.map(r => r.coil);
  const outputs = new Set(outputTags);
  const inputTags = [...new Set(doc.rungs.flatMap(r => r.elements.flatMap(e => e.type === 'contact' ? [e.tag] : e.alternatives.flatMap(path => path.map(c => c.tag))).concat(r.operation && 'resetTag' in r.operation && r.operation.resetTag ? [r.operation.resetTag] : [])))].filter(t => !outputs.has(t)).sort();
  if (inputTags.length > maxInputs) throw new RangeError(`Too many external inputs (${inputTags.length}); maximum ${maxInputs}`);
  const warnings: string[] = [];
  if (doc.rungs.some(r => r.operation && r.operation.kind !== 'coil')) warnings.push('Stateful instructions are evaluated from fresh memory for each row; this is not a multi-scan behavior proof.');
  if (doc.rungs.some(r => r.elements.some(e => (e.type === 'contact' ? [e] : e.alternatives.flat()).some(c => outputs.has(c.tag))))) warnings.push('Internal coil references use document scan order and initial FALSE state.');
  const rows: TruthRow[] = [];
  for (let mask = 0; mask < 2 ** inputTags.length; mask++) {
    const inputs = Object.fromEntries(inputTags.map((tag, i) => [tag, Boolean(mask & (2 ** i))]));
    const result = executeLadder(doc, inputs);
    rows.push({ inputs, outputs: result.outputs, energizedRungs: result.steps.filter(s => s.energized).map(s => s.rungId) });
  }
  return { inputTags, outputTags, rows, warnings };
}
export function truthTableCsv(table: TruthTable): string {
  const columns = [...table.inputTags.map(x => `IN ${x}`), ...table.outputTags.map(x => `OUT ${x}`), 'Energized rungs'];
  return [columns.map(csvCell).join(','), ...table.rows.map(row => [...table.inputTags.map(t => row.inputs[t] ? '1' : '0'), ...table.outputTags.map(t => row.outputs[t] ? '1' : '0'), csvCell(row.energizedRungs.join('; '))].join(','))].join('\r\n');
}
