/** Supported P2 teaching subset for the open sandbox, not full IEC 61131-3. */
import { validateLadder, type LadderDocument } from '../engineering/ladder';
import { compileStructuredText, type STProgram } from '../engineering/structured-text';

export const MAX_SANDBOX_RUNGS = 8;
export const MAX_SANDBOX_SYMBOLS = 16;
export const SANDBOX_INPUTS = ['Start', 'StopOK'] as const;
export const DEFAULT_ST_SOURCE = [
  'VAR_INPUT',
  '  Start : BOOL;',
  '  StopOK : BOOL;',
  'END_VAR',
  'VAR_OUTPUT',
  '  Run : BOOL;',
  'END_VAR',
  'Run := StopOK AND (Start OR Run);',
].join('\n');

const builtIns = new Set(['Start', 'StopOK', 'Run', 'Unused']);
const safeTag = (tag: string) => /^[A-Za-z][A-Za-z0-9_.]{0,39}$/.test(tag) &&
  !['__proto__', 'constructor', 'prototype'].includes(tag.toLowerCase());

export function validateSandboxProgram(program: LadderDocument): string[] {
  const errors = validateLadder(program);
  if (errors.length) return errors;
  if (program.rungs.length > MAX_SANDBOX_RUNGS) errors.push(`Sandbox supports at most ${MAX_SANDBOX_RUNGS} Ladder rungs`);
  const symbols = Object.keys(program.symbols ?? {});
  if (symbols.length > MAX_SANDBOX_SYMBOLS) errors.push(`Sandbox supports at most ${MAX_SANDBOX_SYMBOLS} local tags`);
  for (const tag of symbols) if (builtIns.has(tag) || !safeTag(tag)) errors.push(`Invalid or reserved local tag: ${tag}`);
  const coils = new Set(program.rungs.map(rung => rung.coil));
  const known = new Set([...builtIns, ...symbols, ...coils]);
  for (const [index, rung] of program.rungs.entries()) {
    if (rung.elements.length > 8 || rung.elements.length < 1) errors.push(`Rung ${index + 1} needs 1–8 series elements`);
    if (!safeTag(rung.coil) || (rung.coil !== 'Run' && rung.coil !== 'Unused' && !symbols.includes(rung.coil)))
      errors.push(`Rung ${index + 1}: declare local output tag ${rung.coil} before use`);
    for (const element of rung.elements) {
      if (element.type === 'contact' && !known.has(element.tag)) errors.push(`Rung ${index + 1}: unknown contact ${element.tag}`);
      if (element.type === 'branch' &&
        (element.alternatives.length !== 2 ||
          element.alternatives.some(path => path.length !== 1 || !known.has(path[0].tag))))
        errors.push(`Rung ${index + 1}: sandbox editor supports two one-contact parallel paths`);
    }
  }
  return errors;
}

export function compileSandboxST(source: string): STProgram {
  const compiled = compileStructuredText(source);
  if (!compiled.assignedOutputs.some(name => name.toLowerCase() === 'run'))
    throw new SyntaxError('The sandbox 24V motor circuit requires a Run output (BOOL)');
  if (compiled.declarations.length) {
    const inputs = compiled.declarations.filter(d => d.scope === 'input');
    for (const decl of inputs) {
      if (!SANDBOX_INPUTS.some(tag => tag.toLowerCase() === decl.name.toLowerCase()) || decl.type !== 'BOOL')
        throw new SyntaxError(`Unsupported VAR_INPUT ${decl.name}; use BOOL Start and StopOK`);
    }
    const run = compiled.declarations.find(d => d.name.toLowerCase() === 'run');
    if (!run || run.scope !== 'output' || run.type !== 'BOOL')
      throw new SyntaxError('Declare Run : BOOL inside VAR_OUTPUT to control the motor');
  }
  return compiled;
}
