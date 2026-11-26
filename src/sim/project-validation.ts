/**
 * Project-file validation (R2/R3): the one schema check every loader uses — the worker on loadProject, the page on reading
 * browser storage, the project library, import and recovery. It lives apart from the simulation engine so the page can
 * validate a project without bundling `tick()`, the scan phases or the plant physics; the orchestrator re-exports it.
 */
import { validateGroups } from '../workspace/groups';
import { COMPONENTS, isIoModuleKind, terminalExists, type ComponentKind } from '../components/registry';
import { compileFbd } from '../engineering/fbd';
import { compileSandboxST, DEFAULT_ST_SOURCE, validateSandboxProgram } from '../program/p2-contract';
import { MAX_PLCS, blankProgram, defaultProgramFor, extraPlcs, namesFor, plcComponents, programOf } from './plcs';
import { MAX_IO_MODULES_PER_PLC, ioOf, isConfigurableIo, validateIoMap } from './plc-io';
import { threePhaseWireError } from '../electrical/three-phase-netlist';
import { MAX_COMPONENTS, MAX_SUPPLIES, MAX_WIRES } from './panels';
import { paramError, paramSpecsOf } from '../components/params';
import { validateWireStyles } from '../components/wire-style';
import { DEFAULT_SCAN_MS, isValidScanMs } from './scan-config';
import { airWireError } from '../plant/air';
import { analogWireError } from './analog';
import { shapeErrors, type CustomShapeDef } from '../plant/world/custom-shapes';
import { MATERIALS, MAX_CUSTOM_SHAPES } from '../plant/world/materials';
import { isFreeRotation } from '../workspace/editor';
import { PLANT_EQUIPMENT, isPlantEquipmentKind } from '../plant/equipment';
import { validateFaults } from './faults';
import type { PlacedComponent, PlcProgram, ProjectFile } from './signals';

export const newProject = (): ProjectFile => ({
  formatVersion: 1, components: [], wires: [], program: blankProgram(),
  language: 'ladder', stSource: DEFAULT_ST_SOURCE,
});
export const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,45}$/.test(value);
export const validPos = (value: unknown): value is { x: number; y: number } =>
  !!value && typeof value === 'object' && 'x' in value && 'y' in value &&
  typeof value.x === 'number' && Number.isFinite(value.x) && value.x >= 0 && value.x <= 3000 &&
  typeof value.y === 'number' && Number.isFinite(value.y) && value.y >= 0 && value.y <= 3000;

/** Plant equipment faults: at most 8, each naming a fault its equipment kind defines. */
export function validatePlantFaults(raw:unknown,
 project:Pick<ProjectFile,'components'>):Record<string,string>|undefined{
 if(raw===undefined)return undefined;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid plant fault dictionary');
 const entries=Object.entries(raw);
 if(entries.length>8)throw new Error('At most 8 active plant equipment faults');
 const faults:Record<string,string>={};
 for(const [id,code] of entries){
  const comp=project.components.find(c=>c.id===id);
  if(!comp||!isPlantEquipmentKind(comp.kind)||typeof code!=='string'||
     !PLANT_EQUIPMENT[comp.kind].faults.includes(code))
   throw new Error('Invalid plant equipment fault '+id);
  faults[id]=code;
 }
 return Object.keys(faults).length?faults:undefined;
}
export function validateProject(raw: unknown): ProjectFile {
  if (!raw || typeof raw !== 'object') throw new Error('Project must be an object');
  const p = raw as Partial<ProjectFile>;
  if (p.formatVersion !== 1 || !Array.isArray(p.components) || !Array.isArray(p.wires) || !p.program ||
      p.components.length > MAX_COMPONENTS || p.wires.length > MAX_WIRES) throw new Error('Unsupported project format or size');
  const components: PlacedComponent[] = [];
  const ids = new Set<string>();
  for (const entry of p.components) {
    if (!entry || !validId(entry.id) || ids.has(entry.id) || !Object.hasOwn(COMPONENTS, entry.kind) || !validPos(entry)) {
      throw new Error('Invalid component in project');
    }
    if (entry.yawDeg !== undefined && !([0, 90, 180, 270] as unknown[]).includes(entry.yawDeg))
      throw new Error('Device orientation must be a quarter turn');
    if (entry.freeYawDeg !== undefined && (!isFreeRotation(entry.kind) || !Number.isInteger(entry.freeYawDeg) ||
        entry.freeYawDeg < 5 || entry.freeYawDeg > 355 || entry.freeYawDeg % 5 !== 0))
      throw new Error('Invalid free rotation (5 to 355 degrees in 5 degree steps, on devices that may turn freely)');
    if (entry.elevationMm !== undefined &&
        (!Object.hasOwn(PLANT_EQUIPMENT, entry.kind) ||
         !Number.isSafeInteger(entry.elevationMm) ||
         entry.elevationMm < 0 || entry.elevationMm > 2500))
      throw new Error('Invalid supported plant elevation');
    ids.add(entry.id);
    components.push({ id: entry.id, kind: entry.kind as ComponentKind, x: entry.x, y: entry.y,
      pressed: entry.pressed === true, ...(entry.yawDeg === undefined ? {} : { yawDeg: entry.yawDeg }),
      ...(entry.freeYawDeg === undefined ? {} : { freeYawDeg: entry.freeYawDeg }),
      ...(entry.elevationMm === undefined ? {} : { elevationMm: entry.elevationMm }) });
  }
  // One of each protective branch device per educational circuit: state is
  // explicitly maintained per role, not silently shared among duplicates.
  if (plcComponents({ components }).length > MAX_PLCS) throw new Error(`At most ${MAX_PLCS} PLCs are supported`);
  if (components.filter(c => c.kind === 'supply').length > MAX_SUPPLIES) throw new Error(`At most ${MAX_SUPPLIES} 24V supplies are supported`);
  for (const kind of ['reversebutton', 'forwardcontactor', 'reversecontactor', 'revmotor'] as const)
    if (components.filter(c => c.kind === kind).length > 1)
      throw new Error(`Only one ${kind} protection device is supported`);
  const wireIds = new Set<string>();
  const wiresChecked: { id: string; from: string; to: string }[] = [];
  const phaseOwners = Object.fromEntries(components.map(c => [c.id, c.kind]));
  for (const wire of p.wires) {
    if (!wire || !validId(wire.id) || wireIds.has(wire.id) || typeof wire.from !== 'string' ||
        typeof wire.to !== 'string' || wire.from === wire.to ||
        !terminalExists(wire.from, components) || !terminalExists(wire.to, components)) throw new Error('Invalid wire in project');
    const phaseError = threePhaseWireError(wire.from, wire.to, phaseOwners);
    if (phaseError) throw new Error(phaseError);
    const domainError = airWireError(wire.from, wire.to, components) ?? analogWireError(wire.from, wire.to, components, wiresChecked);
    if (domainError) throw new Error(domainError);
    wiresChecked.push({ id: wire.id, from: wire.from, to: wire.to });
    wireIds.add(wire.id);
  }
  const plcIo = validatePlcIo(p.plcIo, components);
  const ioModules = validateIoModules(p.ioModules, components);
  for (const plcC of components.filter(c => c.kind === 'plc16')) {
    const seen = new Set<string>();
    const io = ioOf({ components, plcIo, ioModules } as ProjectFile, plcC);
    for (const tag of [...Object.values(io.inputs), ...Object.values(io.outputs), ...Object.values(io.analogInputs ?? {}), ...Object.values(io.analogOutputs ?? {})]) {
      if (seen.has(tag.toUpperCase())) throw new Error(`PLC ${plcC.id}: tag ${tag} is used twice (check expansion module channel names)`);
      seen.add(tag.toUpperCase());
    }
  }
  const names = namesFor({ components, plcIo, ioModules } as ProjectFile, undefined);
  const programErrors = validateSandboxProgram(p.program, names);
  if (programErrors.length) throw new Error(programErrors.join('; '));
  if (p.language !== undefined && p.language !== 'ladder' && p.language !== 'st' && p.language !== 'fbd')
    throw new Error('Unknown PLC programming language');
  if (p.stSource !== undefined && typeof p.stSource !== 'string')
    throw new Error('Invalid Structured Text source');
  if (p.language === 'st' || p.stSource !== undefined) {
    if (p.language === 'st' && !p.stSource) throw new Error('ST mode requires a compiled source');
    if (p.stSource) compileSandboxST(p.stSource, names);
  }
  if(p.fbd!==undefined||p.language==='fbd'){
    const candidate={...p,components,plcIo,ioModules} as ProjectFile;
    const config=programOf(candidate,undefined);
    compileFbd(p.fbd??config.fbd,names);
  }
  const wires = p.wires.map(w => ({ id: w.id, from: w.from, to: w.to }));
  const faults = validateFaults(p.faults, components, wires);
  const plcPrograms = validatePlcPrograms(p.plcPrograms, components, plcIo, ioModules);
  const params = validateParams(p.params, components);
  const plantFaults = validatePlantFaults(p.plantFaults, { components });
  const wireStyles = validateWireStyles(p.wireStyles, wires);
  const groups = validateGroups(p.groups, new Set(components.map(c => c.id)), components);
  const customShapes = validateCustomShapes(p.customShapes, components, params);
  const mechanicalLinks = validateMechanicalLinks(p.mechanicalLinks, components);
  if (p.scanMs !== undefined && !isValidScanMs(p.scanMs)) throw new Error('Invalid scan period (10-500 ms in steps of 10)');
  return {
    formatVersion: 1, components, wires, program: p.program,
    ...(p.language !== undefined ? { language: p.language } : {}),
    ...(p.stSource !== undefined ? { stSource: p.stSource } : {}),
    ...(p.fbd !== undefined ? { fbd: p.fbd } : {}),
    // Omitted when empty so legacy and fault-free projects keep their exact v1 shape.
    ...(faults.length ? { faults } : {}),
    ...(plcPrograms ? { plcPrograms } : {}),
    ...(plcIo ? { plcIo } : {}),
    ...(ioModules ? { ioModules } : {}),
    ...(params ? { params } : {}),
    ...(plantFaults ? { plantFaults } : {}),
    ...(wireStyles ? { wireStyles } : {}),
    ...(groups ? { groups } : {}),
    ...(customShapes ? { customShapes } : {}),
    ...(mechanicalLinks ? { mechanicalLinks } : {}),
    // The default period is never stored, so existing projects keep their exact shape.
    ...(p.scanMs !== undefined && p.scanMs !== DEFAULT_SCAN_MS ? { scanMs: p.scanMs } : {}),
  };
}
/** Device settings: each key must be a setting its device kind defines, with an allowed value that differs from the default. */
function validateParams(raw: unknown, components: readonly PlacedComponent[]): ProjectFile['params'] | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid device settings');
  const out: NonNullable<ProjectFile['params']> = {};
  for (const [id, values] of Object.entries(raw as Record<string, unknown>)) {
    const part = components.find(c => c.id === id);
    if (!part || !paramSpecsOf(part.kind).length) throw new Error(`Settings for ${id}: not a configurable device in this project`);
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error(`Invalid settings for ${id}`);
    const kept: Record<string, number> = {};
    for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
      const spec = paramSpecsOf(part.kind).find(s => s.key === key);
      if (!spec) throw new Error(`Settings for ${id}: unknown setting ${key}`);
      const error = paramError(spec, value);
      if (error) throw new Error(`${id}: ${error}`);
      if (value !== spec.default) kept[key] = value as number;
    }
    if (Object.keys(kept).length) out[id] = kept;
  }
  return Object.keys(out).length ? out : undefined;
}
/** Programs of the additional PLCs. Keys must name a PLC after the first; omitted when there are none. */
/** Tag names of the configurable controllers. Keys must be 16/16 PLCs; omitted when there are none. */
function validatePlcIo(raw: unknown, components: readonly PlacedComponent[]): ProjectFile['plcIo'] | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid PLC I/O configuration');
  const out: NonNullable<ProjectFile['plcIo']> = {};
  for (const [id, map] of Object.entries(raw as Record<string, unknown>)) {
    const plc = components.find(c => c.id === id);
    if (!plc || !isConfigurableIo(plc.kind)) throw new Error(`I/O configuration for ${id}: not a configurable PLC in this project`);
    const errors = validateIoMap(plc.kind, map);
    if (errors.length) throw new Error(`PLC ${id} I/O: ${errors.join('; ')}`);
    const m = map as { inputs: Record<string, string>; outputs: Record<string, string> };
    out[id] = { inputs: { ...m.inputs }, outputs: { ...m.outputs } };
  }
  return Object.keys(out).length ? out : undefined;
}
/** R14/R28 mechanical links: each is a real `drive` turning a belt-type conveyor, a belt has at most one drive, and the ratio is bounded. */
const LINKABLE = new Set(['belt-conveyor', 'roller-conveyor', 'curved-conveyor']);
export function validateMechanicalLinks(raw: unknown, components: readonly PlacedComponent[]): ProjectFile['mechanicalLinks'] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > 16) throw new Error('Invalid mechanical links (at most 16)');
  const targets = new Set<string>(), out: NonNullable<ProjectFile['mechanicalLinks']> = [];
  for (const l of raw as { drive?: unknown; target?: unknown; mmPerRev?: unknown }[]) {
    const drive = components.find(c => c.id === l?.drive), target = components.find(c => c.id === l?.target);
    if (!drive || drive.kind !== 'drive') throw new Error(`Mechanical link: ${String(l?.drive)} is not a drive in this project`);
    if (!target || !LINKABLE.has(target.kind)) throw new Error(`Mechanical link: ${String(l?.target)} is not a belt, roller or curved conveyor`);
    if (!Number.isFinite(l.mmPerRev) || (l.mmPerRev as number) < 10 || (l.mmPerRev as number) > 2000) throw new Error('Mechanical link: travel per revolution must be 10 to 2000 mm');
    if (targets.has(target.id)) throw new Error(`Mechanical link: ${target.id} already has a drive`);
    targets.add(target.id);
    out.push({ drive: drive.id, target: target.id, mmPerRev: l.mmPerRev as number });
  }
  return out.length ? out : undefined;
}
/** R02: at most MAX_CUSTOM_SHAPES valid, uniquely named shapes; a device setting may only name a custom shape that exists. */
export function validateCustomShapes(raw: unknown, components: readonly PlacedComponent[], params: ProjectFile['params']): ProjectFile['customShapes'] | undefined {
  const list = raw === undefined ? [] : raw;
  if (!Array.isArray(list) || list.length > MAX_CUSTOM_SHAPES) throw new Error(`Invalid custom shapes (at most ${MAX_CUSTOM_SHAPES})`);
  const ids = new Set<string>();
  for (const shape of list as CustomShapeDef[]) {
    const errors = shapeErrors(shape);
    if (errors.length) throw new Error(`Custom shape ${String((shape as { id?: unknown })?.id)}: ${errors.join('; ')}`);
    if (ids.has(shape.id)) throw new Error(`Custom shape ${shape.id} is defined twice`);
    ids.add(shape.id);
  }
  for (const c of components) {
    const key = c.kind === 'box-feeder' ? 'materialId' : c.kind === 'collector' ? 'acceptMaterial' : null;
    const index = key ? params?.[c.id]?.[key] : undefined;
    if (index !== undefined && index > MATERIALS.length && index - MATERIALS.length > list.length)
      throw new Error(`${c.id}: material ${index} is a custom shape that is not defined in this project`);
  }
  return list.length ? (list as CustomShapeDef[]).map(s => JSON.parse(JSON.stringify(s)) as CustomShapeDef) : undefined;
}
/** R13: each module is attached to one existing PLC16 with a free slot 1..MAX; nothing else may appear. */
function validateIoModules(raw: unknown, components: readonly PlacedComponent[]): ProjectFile['ioModules'] | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid expansion module configuration');
  const out: NonNullable<ProjectFile['ioModules']> = {};
  const used = new Set<string>();
  for (const [id, link] of Object.entries(raw as Record<string, unknown>)) {
    const mod = components.find(c => c.id === id);
    if (!mod || !isIoModuleKind(mod.kind)) throw new Error(`Expansion module ${id}: not an expansion module in this project`);
    const l = link as { plc?: unknown; slot?: unknown } | null;
    const host = components.find(c => c.id === l?.plc);
    if (!host || host.kind !== 'plc16') throw new Error(`Expansion module ${id}: host must be a 16/16 PLC in this project`);
    if (!Number.isInteger(l?.slot) || (l?.slot as number) < 1 || (l?.slot as number) > MAX_IO_MODULES_PER_PLC) throw new Error(`Expansion module ${id}: slot must be 1 to ${MAX_IO_MODULES_PER_PLC}`);
    const key = `${host.id}#${l?.slot}`;
    if (used.has(key)) throw new Error(`Expansion module ${id}: slot ${l?.slot} of ${host.id} is already used`);
    used.add(key);
    const names = (l as { names?: unknown })?.names;
    if (names !== undefined && (!names || typeof names !== 'object' || Array.isArray(names) || Object.values(names).some(n => typeof n !== 'string')))
      throw new Error(`Expansion module ${id}: invalid channel names`);
    out[id] = { plc: host.id, slot: l?.slot as number, ...(names && Object.keys(names).length ? { names: { ...(names as Record<string, string>) } } : {}) };
  }
  return Object.keys(out).length ? out : undefined;
}
function validatePlcPrograms(raw: unknown, components: readonly PlacedComponent[], plcIo: ProjectFile['plcIo'], ioModules?: ProjectFile['ioModules']): Record<string, PlcProgram> | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid PLC programs');
  const extras = new Set(extraPlcs({ components }).map(c => c.id));
  const out: Record<string, PlcProgram> = {};
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!extras.has(id)) throw new Error(`PLC program for ${id}: not an additional PLC in this project`);
    const e = entry as Partial<PlcProgram> | null;
    if (!e || typeof e !== 'object' || !e.program) throw new Error(`Invalid program for PLC ${id}`);
    const names = namesFor({ components, plcIo, ioModules } as ProjectFile, id);
    const issues = validateSandboxProgram(e.program, names);
    if (issues.length) throw new Error(`PLC ${id}: ${issues.join('; ')}`);
    if (e.language !== undefined && e.language !== 'ladder' && e.language !== 'st' && e.language !== 'fbd') throw new Error(`PLC ${id}: unknown language`);
    if (e.stSource !== undefined && typeof e.stSource !== 'string') throw new Error(`PLC ${id}: invalid Structured Text source`);
    if (e.language === 'st' && !e.stSource) throw new Error(`PLC ${id}: ST mode requires a source`);
    if (e.stSource) compileSandboxST(e.stSource, names);
    if (e.fbd!==undefined||e.language==='fbd'){
      const component=components.find(c=>c.id===id)!;
      const cfg=defaultProgramFor(component.kind,ioOf({components,plcIo,ioModules} as ProjectFile,component));
      compileFbd(e.fbd??cfg.fbd,names);
    }
    out[id] = { program: e.program,
      ...(e.language !== undefined ? { language: e.language } : {}),
      ...(e.stSource !== undefined ? { stSource: e.stSource } : {}),
      ...(e.fbd !== undefined ? { fbd: e.fbd } : {}) };
  }
  return Object.keys(out).length ? out : undefined;
}
