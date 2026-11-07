/**
 * Several PLCs in one project (Packet-Tracer-style: any number of controllers on the bench).
 *
 * The FIRST PLC component keeps its program in the legacy top-level `ProjectFile` fields and its scan
 * state in the legacy `WorldState` fields, so every single-PLC project, test and saved file behaves
 * exactly as before. Every further PLC has its program in `ProjectFile.plcPrograms[id]` and its scan
 * state in `WorldState.plcs[id]`. Each PLC samples its OWN terminals and drives its OWN outputs; PLCs
 * only affect each other through the 24 V netlist (a wire from one PLC's output to another's input).
 * Pure and deterministic, like everything under src/sim.
 */
import { executeLadder, type LadderDocument } from '../engineering/ladder';
import { executeStructuredText, type STValue } from '../engineering/structured-text';
import { compileSandboxST, DEFAULT_ST_SOURCE } from '../program/p2-contract';
import type { PlacedComponent, PlcInputs, PlcProgram, PlcRuntime, PlcView, ProjectFile } from './signals';

export const MAX_PLCS = 6;

export const blankProgram = (): LadderDocument => ({
  id: 'sandbox-program', version: '1.0', rungs: [
    { id: 'rung-1', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' },
  ],
});

/** Output coil tag and the physical terminal it drives, in Q0.0..Q0.5 order. */
export const PLC_OUTPUTS = [
  ['Run', 'Q0.0'], ['Sort', 'Q0.1'], ['Fill', 'Q0.2'], ['Drain', 'Q0.3'], ['Forward', 'Q0.4'], ['Reverse', 'Q0.5'],
] as const;
export const COIL_NAMES = PLC_OUTPUTS.map(([coil]) => coil);

type HasComponents = { components: readonly PlacedComponent[] };
export const plcComponents = (project: HasComponents): PlacedComponent[] =>
  project.components.filter(c => c.kind === 'plc');
export const primaryPlcId = (project: HasComponents): string | undefined =>
  plcComponents(project)[0]?.id;
export const extraPlcs = (project: HasComponents): PlacedComponent[] =>
  plcComponents(project).slice(1);

export type ResolvedProgram = { program: LadderDocument; language: 'ladder' | 'st'; stSource: string };

/** The program of any PLC, with defaults filled in. Unknown ids resolve to a blank Ladder program. */
export function programOf(project: ProjectFile, plcId: string | undefined): ResolvedProgram {
  if (plcId === undefined || plcId === primaryPlcId(project) || project.components.every(c => c.kind !== 'plc'))
    return { program: project.program, language: project.language ?? 'ladder', stSource: project.stSource ?? DEFAULT_ST_SOURCE };
  const own = project.plcPrograms?.[plcId];
  return { program: own?.program ?? blankProgram(), language: own?.language ?? 'ladder', stSource: own?.stSource ?? DEFAULT_ST_SOURCE };
}

/** Project with one PLC's program changed. The first PLC writes the legacy fields. */
export function withProgramOf(project: ProjectFile, plcId: string | undefined, patch: Partial<PlcProgram>): ProjectFile {
  if (plcId === undefined || plcId === primaryPlcId(project)) return {
    ...project,
    ...(patch.program !== undefined ? { program: patch.program } : {}),
    ...(patch.language !== undefined ? { language: patch.language } : {}),
    ...(patch.stSource !== undefined ? { stSource: patch.stSource } : {}),
  };
  const current = programOf(project, plcId);
  return { ...project, plcPrograms: { ...project.plcPrograms, [plcId]: {
    program: patch.program ?? current.program,
    language: patch.language ?? current.language,
    stSource: patch.stSource ?? current.stSource,
  } } };
}

const idleTags = (inputs: PlcInputs): Record<string, STValue> => ({
  ...inputs, Run: false, Sort: false, Fill: false, Drain: false, Forward: false, Reverse: false, Unused: false,
});

export function freshPlcRuntime(cfg: ResolvedProgram): PlcRuntime {
  const inputs: PlcInputs = { Start: false, StopOK: false, Photoeye: false, TankHigh: false, ReverseRequest: false };
  return {
    powered: false, inputs, coils: {}, tagValues: idleTags(inputs), ladderMemory: {}, ladderNumeric: {}, ladderSteps: [],
    stCompiled: cfg.language === 'st' ? compileSandboxST(cfg.stSource) : null, stMemory: {},
  };
}

/** One scan of an additional PLC. Throws on a runtime fault; the caller fails the whole plant closed. */
export function scanExtraPlc(
  cfg: ResolvedProgram, prior: PlcRuntime, inputs: PlcInputs, powered: boolean, dtMs: number,
): PlcRuntime {
  if (!powered) return { ...prior, powered, inputs, coils: {}, tagValues: idleTags(inputs), ladderMemory: {}, ladderNumeric: {}, ladderSteps: [], stMemory: prior.stMemory };
  if (cfg.language === 'st') {
    const compiled = prior.stCompiled ?? compileSandboxST(cfg.stSource);
    const result = executeStructuredText(compiled, inputs, prior.stMemory);
    const out = (name: string) => Object.entries(result.outputs).find(([key]) => key.toLowerCase() === name)?.[1];
    if (typeof out('run') !== 'boolean') throw new TypeError('ST Run output must be BOOL');
    for (const name of ['sort', 'fill', 'drain', 'forward', 'reverse']) {
      const value = out(name);
      if (value !== undefined && typeof value !== 'boolean') throw new TypeError('PLC Sort/Fill/Drain/Forward/Reverse outputs must be BOOL');
    }
    // Structured Text is case-insensitive; the physical bindings are the canonical coil names.
    const coils = {
      ...Object.fromEntries(Object.entries(result.outputs).filter(([, v]) => typeof v === 'boolean')),
      ...Object.fromEntries(COIL_NAMES.map(c => [c, out(c.toLowerCase()) === true])),
    } as Record<string, boolean>;
    return { ...prior, powered, inputs, coils, stCompiled: compiled, stMemory: result.memory, ladderMemory: {}, ladderNumeric: {}, ladderSteps: [],
      tagValues: { ...inputs, ...result.signals, ...coils, ...Object.fromEntries(COIL_NAMES.map(c => [c, coils[c] === true])), Unused: false } };
  }
  const result = executeLadder(cfg.program, inputs, prior.coils, prior.ladderMemory, dtMs, prior.ladderNumeric);
  const coils = result.outputs;
  return { ...prior, powered, inputs, coils, stMemory: {}, ladderMemory: result.memory, ladderNumeric: result.numericValues, ladderSteps: [...result.steps],
    tagValues: { ...inputs, ...result.numericValues, ...coils, ...Object.fromEntries(COIL_NAMES.map(c => [c, coils[c] === true])), Unused: false } };
}

/** Publishable summary of one PLC from its inputs/coils/power. */
export function plcView(
  language: 'ladder' | 'st', powered: boolean, inputs: PlcInputs, coils: Record<string, boolean>,
): PlcView {
  const on = (c: string) => coils[c] === true;
  return {
    powered, language, inputs: { ...inputs }, coils: Object.fromEntries(COIL_NAMES.map(c => [c, on(c)])),
    outputs: { 'Q0.0': on('Run'), 'Q0.1': on('Sort'), 'Q0.2': on('Fill'), 'Q0.3': on('Drain'), 'Q0.4': on('Forward'), 'Q0.5': on('Reverse') },
  };
}
