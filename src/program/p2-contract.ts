/** Supported P2 teaching subset for the open sandbox, not full IEC 61131-3. */
import { validateLadder, type LadderDocument, type NumericOperand } from '../engineering/ladder';
import { compileStructuredText, type STProgram } from '../engineering/structured-text';
import { LEGACY_NAMES, type IoNames } from '../sim/plc-io';

export const MAX_SANDBOX_RUNGS = 8;
export const MAX_SANDBOX_SYMBOLS = 16;
export const SANDBOX_INPUTS = ['Start', 'StopOK', 'Photoeye', 'TankHigh', 'ReverseRequest'] as const;
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

/** Tag names a program may use without declaring: the controller's own inputs and outputs, plus the idle placeholder. */
const builtInsOf = (names: IoNames) => new Set([...names.inputs, ...names.outputs, 'Unused']);
const safeTag = (tag: string) => /^[A-Za-z][A-Za-z0-9_.]{0,39}$/.test(tag) &&
  !['__proto__', 'constructor', 'prototype'].includes(tag.toLowerCase());

export function validateSandboxProgram(program: LadderDocument, names: IoNames = LEGACY_NAMES): string[] {
  const builtIns = builtInsOf(names);
  const outputNames = new Set([...names.outputs, 'Unused']);
  const errors = validateLadder(program);
  if (errors.length) return errors;
  if (program.rungs.length > MAX_SANDBOX_RUNGS) errors.push(`Sandbox supports at most ${MAX_SANDBOX_RUNGS} Ladder rungs`);
  const symbols = Object.keys(program.symbols ?? {});
  if (symbols.length > MAX_SANDBOX_SYMBOLS) errors.push(`Sandbox supports at most ${MAX_SANDBOX_SYMBOLS} local tags`);
  for (const tag of symbols) if (builtIns.has(tag) || !safeTag(tag)) errors.push(`Invalid or reserved local tag: ${tag}`);
  const numeric = new Set(symbols.filter(tag => ['INT','DINT','REAL'].includes(program.symbols![tag].type ?? 'BOOL')));
  const numericOperand = (operand: NumericOperand, index: number, description: string) => {
    if (operand.kind === 'tag' && !numeric.has(operand.name))
      errors.push(`Rung ${index}: ${description} ${operand.name} must be a declared numeric local tag`);
  };
  const coils = new Set(program.rungs.map(rung => rung.coil));
  const known = new Set([...builtIns, ...symbols, ...coils]);
  for (const [index, rung] of program.rungs.entries()) {
    if (rung.elements.length > 8 || rung.elements.length < 1) errors.push(`Rung ${index + 1} needs 1–8 series elements`);
    if (!safeTag(rung.coil) || (!outputNames.has(rung.coil) && !symbols.includes(rung.coil)))
      errors.push(`Rung ${index + 1}: declare local output tag ${rung.coil} before use`);
    if (numeric.has(rung.coil)) errors.push(`Rung ${index + 1}: numeric tag cannot be a BOOL output coil`);
    const operation = rung.operation;
    if (operation?.kind === 'compare') {
      numericOperand(operation.left, index + 1, 'comparison operand');
      numericOperand(operation.right, index + 1, 'comparison operand');
    }
    if (operation && ['move','add','sub','mul','div'].includes(operation.kind)) {
      const op = operation as Extract<typeof operation, { target: string }>;
      if (!numeric.has(op.target)) errors.push(`Rung ${index + 1}: numeric destination ${op.target} is not declared`);
      numericOperand(op.left, index + 1, 'source');
      if (op.kind !== 'move') numericOperand(op.right, index + 1, 'source');
    }
    if ((operation?.kind === 'rto' || operation?.kind === 'ctu') &&
      operation.resetTag !== undefined && !known.has(operation.resetTag))
      errors.push(`Rung ${index + 1}: reset tag ${operation.resetTag} is not declared`);
    if (operation?.kind === 'ctd' && !known.has(operation.loadTag))
      errors.push(`Rung ${index + 1}: load tag ${operation.loadTag} is not declared`);
    for (const element of rung.elements) {
      if (element.type === 'contact') {
        if (!known.has(element.tag)) errors.push(`Rung ${index + 1}: unknown contact ${element.tag}`);
        if (numeric.has(element.tag)) errors.push(`Rung ${index + 1}: numeric ${element.tag} requires comparison, not a BOOL contact`);
      }
      if (element.type === 'branch') {
        if (element.alternatives.length !== 2 ||
          element.alternatives.some(path => path.length !== 1 || !known.has(path[0].tag)))
          errors.push(`Rung ${index + 1}: sandbox editor supports two one-contact parallel paths`);
        for (const path of element.alternatives)
          for (const contact of path)
            if (numeric.has(contact.tag)) errors.push(`Rung ${index + 1}: numeric ${contact.tag} cannot be a BOOL branch contact`);
      }
    }
  }
  return errors;
}

export function compileSandboxST(source: string, names: IoNames = LEGACY_NAMES): STProgram {
  const compiled = compileStructuredText(source);
  if (names.requireRun && !compiled.assignedOutputs.some(name => name.toLowerCase() === 'run'))
    throw new SyntaxError('The sandbox 24V motor circuit requires a Run output (BOOL)');
  if (compiled.declarations.length) {
    const inputs = compiled.declarations.filter(d => d.scope === 'input');
    for (const decl of inputs) {
      if (!names.inputs.some(tag => tag.toLowerCase() === decl.name.toLowerCase()) || decl.type !== 'BOOL')
        throw new SyntaxError(names === LEGACY_NAMES
          ? `Unsupported VAR_INPUT ${decl.name}; use BOOL Start, StopOK, Photoeye, TankHigh and ReverseRequest`
          : `Unsupported VAR_INPUT ${decl.name}; use BOOL ${names.inputs.join(', ')}`);
    }
    if (names.requireRun) {
      const run = compiled.declarations.find(d => d.name.toLowerCase() === 'run');
      if (!run || run.scope !== 'output' || run.type !== 'BOOL')
        throw new SyntaxError('Declare Run : BOOL inside VAR_OUTPUT to control the motor');
    }
  }
  for (const name of names.outputs.filter(n => n !== 'Run').map(n => n.toLowerCase())) {
    const output = compiled.declarations.find(d => d.name.toLowerCase() === name);
    if (output && (output.scope !== 'output' || output.type !== 'BOOL'))
      throw new SyntaxError(`Declare optional ${name} : BOOL inside VAR_OUTPUT`);
  }
  return compiled;
}
