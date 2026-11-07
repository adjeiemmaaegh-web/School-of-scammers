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
import { executeLadder, type LadderDocument, type LadderMemory, type LadderStep } from '../engineering/ladder';
import { executeStructuredText, type STValue } from '../engineering/structured-text';
import { compileSandboxST, DEFAULT_ST_SOURCE } from '../program/p2-contract';
import { isPlcKind } from '../components/registry';
import { defaultIo, ioOf, namesOf, type IoNames, type PlcIoMap } from './plc-io';
import type { PlacedComponent, PlcInputs, PlcIoPoint, PlcProgram, PlcRuntime, PlcView, ProjectFile } from './signals';

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
  project.components.filter(c => isPlcKind(c.kind));
export const primaryPlcId = (project: HasComponents): string | undefined =>
  plcComponents(project)[0]?.id;
export const extraPlcs = (project: HasComponents): PlacedComponent[] =>
  plcComponents(project).slice(1);
/**
 * The first PLC keeps its program in the legacy fields; if it is the classic `plc` it ALSO keeps its scan state in
 * the legacy `WorldState` fields and its original fixed-name code path. Any other PLC (every PLC after the first,
 * and a first PLC that is a configurable `plc16`) is scanned by the generic path and lives in `WorldState.plcs`.
 */
export const legacyPrimaryId = (project: HasComponents): string | undefined => {
  const first = plcComponents(project)[0];
  return first?.kind === 'plc' ? first.id : undefined;
};
export const runtimePlcs = (project: HasComponents): PlacedComponent[] =>
  plcComponents(project).filter(c => c.id !== legacyPrimaryId(project));

/** The idle placeholder program for a controller type: a legacy PLC's references tags a 16/16 PLC does not have. */
export function defaultProgramFor(kind: string | undefined, io?: PlcIoMap): ResolvedProgram {
  if (kind === 'plc16') {
    // The placeholder passes the first input to the first output, in whatever those are currently called.
    const names = namesOf(io ?? defaultIo('plc16'));
    const [input, output] = [names.inputs[0], names.outputs[0]];
    return {
      program: { id: 'sandbox-program', version: '1.0', rungs: [{ id: 'rung-1', elements: [{ type: 'contact', tag: input }], coil: output }] },
      language: 'ladder', stSource: ['VAR_INPUT', `  ${input} : BOOL;`, 'END_VAR', 'VAR_OUTPUT', `  ${output} : BOOL;`, 'END_VAR', `${output} := ${input};`].join('\n'),
    };
  }
  return { program: blankProgram(), language: 'ladder', stSource: DEFAULT_ST_SOURCE };
}

export type ResolvedProgram = { program: LadderDocument; language: 'ladder' | 'st'; stSource: string };

/** The program of any PLC, with defaults filled in. Unknown ids resolve to a blank Ladder program. */
export function programOf(project: ProjectFile, plcId: string | undefined): ResolvedProgram {
  if (plcId === undefined || plcId === primaryPlcId(project) || plcComponents(project).length === 0)
    return { program: project.program, language: project.language ?? 'ladder', stSource: project.stSource ?? DEFAULT_ST_SOURCE };
  const own = project.plcPrograms?.[plcId];
  const comp = project.components.find(c => c.id === plcId);
  const fallback = defaultProgramFor(comp?.kind, comp ? ioOf(project, comp) : undefined);
  return { program: own?.program ?? fallback.program, language: own?.language ?? 'ladder', stSource: own?.stSource ?? fallback.stSource };
}

/** The tag names a PLC's program is validated against (its I/O map). Unknown ids get the classic names. */
export function namesFor(project: ProjectFile, plcId: string | undefined): IoNames {
  const plc = plcComponents(project).find(c => c.id === (plcId ?? primaryPlcId(project)));
  return plc ? namesOf(ioOf(project, plc)) : namesOf(ioOf(project, { id: '', kind: 'plc' }));
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

export function freshPlcRuntime(cfg: ResolvedProgram, names?: IoNames): PlcRuntime {
  const inputs: PlcInputs = { Start: false, StopOK: false, Photoeye: false, TankHigh: false, ReverseRequest: false };
  return {
    powered: false, inputs, tagInputs: {}, coils: {}, tagValues: idleTags(inputs), ladderMemory: {}, ladderNumeric: {}, ladderSteps: [],
    stCompiled: cfg.language === 'st' ? compileSandboxST(cfg.stSource, names) : null, stMemory: {},
  };
}

/** The classic five-tag input image, read from any tag-keyed image. */
export const classicInputs = (tags: Record<string, boolean>): PlcInputs => ({
  Start: tags.Start === true, StopOK: tags.StopOK === true, Photoeye: tags.Photoeye === true,
  TankHigh: tags.TankHigh === true, ReverseRequest: tags.ReverseRequest === true,
});

/**
 * One scan of a PLC through its I/O map. `tagInputs` is the sampled input image keyed by tag; outputs come back
 * keyed by tag too. Throws on a runtime fault; the caller fails the whole plant closed.
 */
export function scanPlc(
  cfg: ResolvedProgram, io: PlcIoMap, prior: PlcRuntime, tagInputs: Record<string, boolean>, powered: boolean, dtMs: number,
): PlcRuntime {
  const names = namesOf(io);
  const inputs = classicInputs(tagInputs);
  const mappedOutputs = (coils: Record<string, boolean>) => Object.fromEntries(names.outputs.map(n => [n, coils[n] === true]));
  if (!powered) return { ...prior, powered, inputs, tagInputs, coils: {},
    tagValues: { ...tagInputs, ...mappedOutputs({}), Unused: false }, ladderMemory: {}, ladderNumeric: {}, ladderSteps: [], stMemory: prior.stMemory };
  if (cfg.language === 'st') {
    const compiled = prior.stCompiled ?? compileSandboxST(cfg.stSource, names);
    const result = executeStructuredText(compiled, tagInputs, prior.stMemory);
    const out = (name: string) => Object.entries(result.outputs).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
    if (names.requireRun && typeof out('Run') !== 'boolean') throw new TypeError('ST Run output must be BOOL');
    for (const name of names.outputs) {
      const value = out(name);
      if (value !== undefined && typeof value !== 'boolean')
        throw new TypeError(names.requireRun ? 'PLC Sort/Fill/Drain/Forward/Reverse outputs must be BOOL' : `PLC output ${name} must be BOOL`);
    }
    // Structured Text is case-insensitive; the physical bindings use the canonical mapped names.
    const coils = {
      ...Object.fromEntries(Object.entries(result.outputs).filter(([, v]) => typeof v === 'boolean')),
      ...Object.fromEntries(names.outputs.map(n => [n, out(n) === true])),
    } as Record<string, boolean>;
    return { ...prior, powered, inputs, tagInputs, coils, stCompiled: compiled, stMemory: result.memory, ladderMemory: {}, ladderNumeric: {}, ladderSteps: [],
      tagValues: { ...tagInputs, ...result.signals, ...coils, ...mappedOutputs(coils), Unused: false } };
  }
  const result = executeLadder(cfg.program, tagInputs, prior.coils, prior.ladderMemory, dtMs, prior.ladderNumeric);
  const coils = result.outputs;
  return { ...prior, powered, inputs, tagInputs, coils, stMemory: {}, ladderMemory: result.memory, ladderNumeric: result.numericValues, ladderSteps: [...result.steps],
    tagValues: { ...tagInputs, ...result.numericValues, ...coils, ...mappedOutputs(coils), Unused: false } };
}

/** Publishable summary of one PLC: its I/O points with tags and live state, whatever its I/O map. */
export function plcView(
  kind: string, language: 'ladder' | 'st', powered: boolean, io: PlcIoMap, tagInputs: Record<string, boolean>, coils: Record<string, boolean>,
  live: { tagValues: Record<string, STValue>; ladderSteps: LadderStep[]; ladderMemory: LadderMemory },
): PlcView {
  const names = namesOf(io);
  const point = (table: Record<string, string>, on: (tag: string) => boolean): PlcIoPoint[] =>
    Object.entries(table).map(([terminal, tag]) => ({ terminal, tag, on: on(tag) }));
  const outputs = point(io.outputs, t => coils[t] === true);
  return {
    powered, language, kind, io: { inputs: point(io.inputs, t => tagInputs[t] === true), outputs },
    inputs: classicInputs(tagInputs), coils: Object.fromEntries(names.outputs.map(c => [c, coils[c] === true])),
    outputs: Object.fromEntries(outputs.map(o => [o.terminal, o.on])),
    tagValues: { ...live.tagValues }, ladderSteps: [...live.ladderSteps], ladderMemory: { ...live.ladderMemory },
  };
}
