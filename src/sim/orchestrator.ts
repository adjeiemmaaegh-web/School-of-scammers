/** P0/P1 authoritative deterministic sandbox. Pure simulation: no DOM, timers or wall clock. */
import { COMPONENTS, isPlcKind, terminalExists, type ComponentKind } from '../components/registry';
import { solveNetAware, type Device } from '../engineering/electrical';
import { executeLadder, type LadderDocument, type LadderResult } from '../engineering/ladder';
import { compileFbd, executeFbd, type FbdResult } from '../engineering/fbd';
import { executeStructuredText, type STResult, type STValue } from '../engineering/structured-text';
import { compileSandboxST, DEFAULT_ST_SOURCE, validateSandboxProgram } from '../program/p2-contract';
import { appendScanTrace, buildScanTrace, tagEdge, validateTagBreakpoint } from '../program/scan-trace';
import { fbdReadings, instructionBreakpointHit, ladderReadings, validateInstructionBreakpoint } from '../program/instruction-breakpoint';
import { applyLocalForce } from '../program/local-force';
import { feedPlant, freshPlant, stepPlant } from '../plant/sorting-conveyor';
import { freshTank, stepTank } from '../plant/tank-process';
import {
  MAX_PLCS, blankProgram, defaultProgramFor, extraPlcs, freshPlcRuntime, legacyPrimaryId, namesFor, plcComponents, plcView,
  primaryPlcId, programOf, runtimePlcs, scanPlc, withProgramOf,
} from './plcs';
import { LEGACY_IO, defaultIo, ioOf, isConfigurableIo, validateIoMap } from './plc-io';
export { blankProgram };
import { emptyMeter, measureDC24 } from '../electrical/panel-meter';
import { threePhaseWireError, threePhaseConnections } from '../electrical/three-phase-netlist';
import { freshStarterPanel } from '../electrical/three-phase-types';
import { stepWiredStarter } from '../electrical/wired-star-delta';
import { readPhaseMeter } from '../electrical/phase-instruments';
import { MAX_COMPONENTS, MAX_SUPPLIES, MAX_WIRES, planStarterPanel, removeComponent, withStarterPanel } from './panels';
import { laneOf, lanesOf, vesselOf, vesselsOf } from './stations';
import { electricalDevices } from '../components/electrical-defs';
import { paramError, paramSpecsOf, paramValue } from '../components/params';
import { clearedAlarm, engineFault, freshCylinder, stepCylinder } from '../plant/cylinder';
import { freshProjectPlant, stepProjectPlant, sensorImage,validatePlantFaults } from './p3-plant-bridge';
import { makePlantSceneProject } from './p3-scene-import';
import { plantNumericWireError, sampleNumericInputs } from './p3-numeric';
import { editWorkspace as applyWorkspaceEdit } from '../workspace/editor';
import { analogWireError, sampleAnalogInputs } from './analog';
export { MAX_COMPONENTS, MAX_WIRES };
import { freshAlarmWatch, updateAlarms } from '../diagnostics/alarms';
import {
  describeFault, effectivePressed, effectiveSensor, faultsOf, hasFault, nextFaultId, pickSeededFault,
  repairDetail, solverWires, validateFaults, type FaultCandidate,
} from './faults';
export { validateSandboxProgram } from '../program/p2-contract';
import type { Command, FaultSpec, PlacedComponent, PlcInputs, PlcProgram, PlcRuntime, ProjectFile, RenderSnapshot, SimEvent, WorldState } from './signals';
import type { SortingPlant } from '../plant/sorting-conveyor';
import type { CylinderState } from '../plant/cylinder';
import type { TankProcess } from '../plant/tank-process';

export const SCAN_MS = 50;
export const latchProgram = (): LadderDocument => ({
  id: 'sandbox-program', version: '1.0', rungs: [
    { id: 'rung-1', elements: [
      { type: 'contact', tag: 'StopOK' },
      { type: 'branch', alternatives: [
        [{ type: 'contact', tag: 'Start' }],
        [{ type: 'contact', tag: 'Run' }],
      ] },
    ], coil: 'Run' },
  ],
});
/** P3 teachable sorting example: Run controls Q0.0, mark detector gates Q0.1. */
export const sortingProgram = (): LadderDocument => ({
  id: 'conveyor-sorting', version: '1.0', rungs: [
    { id: 'belt-enable', elements: [
      { type: 'contact', tag: 'StopOK' },
      { type: 'branch', alternatives: [[{ type: 'contact', tag: 'Start' }],
        [{ type: 'contact', tag: 'Run' }]] },
    ], coil: 'Run' },
    { id: 'sort-at-eye', elements: [
      { type: 'contact', tag: 'Run' }, { type: 'contact', tag: 'Photoeye' },
    ], coil: 'Sort' },
  ],
});
/** P3 fluid handling: a motor-independent pump fills until the HIGH level switch trips,
 * then a wired drain valve lowers the tank; all logic remains user-editable.
 */
export const tankProgram = (): LadderDocument => ({
  id: 'tank-control', version: '1.0', rungs: [
    { id: 'inlet-pump', elements: [
      { type:'contact', tag:'StopOK' },
      { type:'contact', tag:'TankHigh', normallyClosed:true },
    ], coil:'Fill' },
    { id:'outlet-valve', elements: [
      { type:'contact', tag:'StopOK' },
      { type:'contact', tag:'TankHigh' },
    ], coil:'Drain' },
    { id:'inactive-motor', elements: [{ type:'contact',tag:'Unused' }], coil:'Run' },
  ],
});
/** P4 bounded forward/reverse exercise. Cross-interlocked PLC rungs supplement
 * real NC auxiliary contacts on the two physical virtual contactors.
 * Both buttons pressed together inhibit both requests.
 */
export const reversingProgram = (): LadderDocument => ({
  id: 'reversible-motor', version: '1.0',
  symbols: {
    ForwardStart: { description: 'Forward request allowed only without reverse request', type: 'BOOL' },
    ReverseStart: { description: 'Reverse request allowed only without forward request', type: 'BOOL' },
  },
  rungs: [
    { id: 'forward-request', elements: [
      { type: 'contact', tag: 'Start' },
      { type: 'contact', tag: 'ReverseRequest', normallyClosed: true },
    ], coil: 'ForwardStart' },
    { id: 'reverse-request', elements: [
      { type: 'contact', tag: 'ReverseRequest' },
      { type: 'contact', tag: 'Start', normallyClosed: true },
    ], coil: 'ReverseStart' },
    { id: 'forward-enable', elements: [
      { type: 'contact', tag: 'StopOK' },
      { type: 'contact', tag: 'Reverse', normallyClosed: true },
      { type: 'branch', alternatives: [
        [{ type: 'contact', tag: 'ForwardStart' }],
        [{ type: 'contact', tag: 'Forward' }],
      ] },
    ], coil: 'Forward' },
    { id: 'reverse-enable', elements: [
      { type: 'contact', tag: 'StopOK' },
      { type: 'contact', tag: 'Forward', normallyClosed: true },
      { type: 'branch', alternatives: [
        [{ type: 'contact', tag: 'ReverseStart' }],
        [{ type: 'contact', tag: 'Reverse' }],
      ] },
    ], coil: 'Reverse' },
    { id: 'inactive-dol', elements: [{ type: 'contact', tag: 'Unused' }], coil: 'Run' },
  ],
});
export const newProject = (): ProjectFile => ({
  formatVersion: 1, components: [], wires: [], program: blankProgram(),
  language: 'ladder', stSource: DEFAULT_ST_SOURCE,
});
export function createWorld(project: ProjectFile = newProject()): WorldState {
  return {
    project, running: false, tick: 0, coils: {}, ladderMemory: {}, ladderNumeric: {},
    // Only a classic first PLC (or no PLC at all) uses the legacy compiled-program field; every other PLC compiles in its runtime.
    stCompiled: project.language === 'st' && (legacyPrimaryId(project) !== undefined || plcComponents(project).length === 0)
      ? compileSandboxST(project.stSource ?? '', namesFor(project, undefined)) : null,
    stMemory: {}, fbdMemory: {}, fbdSteps: [], debugForces: {},
    tagValues: { Start: false, StopOK: false, Photoeye: false, TankHigh: false, ReverseRequest: false,
      Run: false, Sort: false, Fill: false, Drain: false, Forward: false, Reverse: false }, ladderSteps: [],
    breakpointScan: null, breakpointHit: null, breakpointTag: null, breakpointInstruction: null, scanTrace: [],
    contactorOn: false, motorOn: false, motorAngleRad: 0,
    plcs: Object.fromEntries(runtimePlcs(project).map(c => [c.id, freshPlcRuntime(programOf(project, c.id), namesFor(project, c.id))])),
    lanes: {}, vessels: {}, tripped: {}, cylinders: {}, timers: {},
    threePhase: {}, threePhasePower: {},
    plantWorld:freshProjectPlant(project),
    deviceOn: {}, motorAngles: {},
    forwardContactorOn: false, reverseContactorOn: false, motorDirection: 'stopped',
    reverseMotorAngleRad: 0, interlockConflict: false,
    plant: freshPlant(), conveyorOn: false, diverterOn: false,
    tank: freshTank(), pumpOn: false, drainOn: false,
    breakerTripped: false, overloadTripped: false, lampOn: false,
    meter: emptyMeter(),
    powered: false, inputs: { Start: false, StopOK: false, Photoeye: false, TankHigh: false, ReverseRequest: false },
    voltages: {}, diagnostics: [], lastError: null,
    alarms: [], alarmWatch: freshAlarmWatch(),
  };
}
const terminal = (id: string, pin: string) => `${id}.${pin}`;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,45}$/.test(value);
const validPos = (value: unknown): value is { x: number; y: number } =>
  !!value && typeof value === 'object' && 'x' in value && 'y' in value &&
  typeof value.x === 'number' && Number.isFinite(value.x) && value.x >= 0 && value.x <= 3000 &&
  typeof value.y === 'number' && Number.isFinite(value.y) && value.y >= 0 && value.y <= 3000;

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
    ids.add(entry.id);
    components.push({ id: entry.id, kind: entry.kind as ComponentKind, x: entry.x, y: entry.y,
      pressed: entry.pressed === true,
      ...(entry.yawDeg === undefined ? {} : { yawDeg: entry.yawDeg }) });
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
  const numericChecked: {from:string;to:string}[]=[];
  const threePhaseOwners = Object.fromEntries(components.map(c=>[c.id,c.kind]));
  for (const wire of p.wires) {
    if (!wire || !validId(wire.id) || wireIds.has(wire.id) || typeof wire.from !== 'string' ||
        typeof wire.to !== 'string' || wire.from === wire.to ||
        !terminalExists(wire.from, components) || !terminalExists(wire.to, components)) throw new Error('Invalid wire in project');
    const domainError=threePhaseWireError(wire.from,wire.to,threePhaseOwners);
    if(domainError)throw new Error(domainError);
    const domainError=plantNumericWireError(wire.from,wire.to,components,numericChecked);
    if(domainError)throw new Error(domainError);
    numericChecked.push({from:wire.from,to:wire.to});
    const domainError = analogWireError(wire.from, wire.to, components, wiresChecked);
    if (domainError) throw new Error(domainError);
    wiresChecked.push({ id: wire.id, from: wire.from, to: wire.to });
    wireIds.add(wire.id);
  }
  const plcIo = validatePlcIo(p.plcIo, components);
  const names = namesFor({ components, plcIo } as ProjectFile, undefined);
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
  if (p.fbd !== undefined || p.language === 'fbd') {
    const candidate = { ...p, components, plcIo } as ProjectFile;
    const config = programOf(candidate, undefined);
    compileFbd(p.fbd ?? config.fbd, names);
  }
  const wires = p.wires.map(w => ({ id: w.id, from: w.from, to: w.to }));
  const faults = validateFaults(p.faults, components, wires);
  const plcPrograms = validatePlcPrograms(p.plcPrograms, components, plcIo);
  const params = validateParams(p.params, components);
  const plantFaults=validatePlantFaults(p.plantFaults,{components});
  return {
    formatVersion: 1, components, wires, program: p.program,
    ...(p.language !== undefined ? { language: p.language } : {}),
    ...(p.stSource !== undefined ? { stSource: p.stSource } : {}),
    ...(p.fbd !== undefined ? { fbd: p.fbd } : {}),
    // Omitted when empty so legacy and fault-free projects keep their exact v1 shape.
    ...(faults.length ? { faults } : {}),
    ...(plcPrograms ? { plcPrograms } : {}),
    ...(plcIo ? { plcIo } : {}),
    ...(params ? { params } : {}),
    ...(plantFaults ? {plantFaults} : {}),
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
function validatePlcPrograms(raw: unknown, components: readonly PlacedComponent[], plcIo: ProjectFile['plcIo']): Record<string, PlcProgram> | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid PLC programs');
  const extras = new Set(extraPlcs({ components }).map(c => c.id));
  const out: Record<string, PlcProgram> = {};
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!extras.has(id)) throw new Error(`PLC program for ${id}: not an additional PLC in this project`);
    const e = entry as Partial<PlcProgram> | null;
    if (!e || typeof e !== 'object' || !e.program) throw new Error(`Invalid program for PLC ${id}`);
    const names = namesFor({ components, plcIo } as ProjectFile, id);
    const issues = validateSandboxProgram(e.program, names);
    if (issues.length) throw new Error(`PLC ${id}: ${issues.join('; ')}`);
    if (e.language !== undefined && e.language !== 'ladder' && e.language !== 'st' && e.language !== 'fbd') throw new Error(`PLC ${id}: unknown language`);
    if (e.stSource !== undefined && typeof e.stSource !== 'string') throw new Error(`PLC ${id}: invalid Structured Text source`);
    if (e.language === 'st' && !e.stSource) throw new Error(`PLC ${id}: ST mode requires a source`);
    if (e.stSource) compileSandboxST(e.stSource, names);
    if (e.fbd !== undefined || e.language === 'fbd') {
      const cfg = defaultProgramFor(components.find(c => c.id === id)?.kind, ioOf({ components, plcIo } as ProjectFile,
        components.find(c => c.id === id)!));
      compileFbd(e.fbd ?? cfg.fbd, names);
    }
    out[id] = { program: e.program,
      ...(e.language !== undefined ? { language: e.language } : {}),
      ...(e.stSource !== undefined ? { stSource: e.stSource } : {}),
      ...(e.fbd !== undefined ? { fbd: e.fbd } : {}) };
  }
  return Object.keys(out).length ? out : undefined;
}
const setError = (world: WorldState, message: string): WorldState => ({ ...world, lastError: message });
/**
 * Recompute the legacy single-device fields (plant, tank, breaker/overload flags) from the per-instance
 * state. Every conveyor lane, tank and protection device has its own state keyed by component id; the legacy
 * fields mirror the FIRST of each kind so single-device projects behave exactly as before. This is the only
 * place the mirror is maintained.
 */
function syncLegacy(w: WorldState): WorldState {
  const comps = w.project.components;
  const conveyor = comps.find(c => c.kind === 'conveyor'), tank = comps.find(c => c.kind === 'tank');
  const breaker = comps.find(c => c.kind === 'breaker'), overload = comps.find(c => c.kind === 'overload');
  return { ...w,
    plant: conveyor ? w.lanes[conveyor.id] ?? freshPlant() : w.plant,
    tank: tank ? w.vessels[tank.id] ?? freshTank() : w.tank,
    breakerTripped: !!breaker && w.tripped[breaker.id] === true,
    overloadTripped: !!overload && w.tripped[overload.id] === true };
}
/** A cylinder latches its alarm until it is reset; repairing it (or clearing its fault) resets it. */
const resetCylinderAlarm = (w: WorldState, id: string): WorldState =>
  w.cylinders[id] ? { ...w, cylinders: { ...w.cylinders, [id]: clearedAlarm(w.cylinders[id]) } } : w;
const quietLanes = (lanes: Record<string, SortingPlant>): Record<string, SortingPlant> =>
  Object.fromEntries(Object.entries(lanes).map(([id, lane]) => [id, { ...lane, photoeyeActive: false }]));
/** Truth a photoeye reports: the lane (conveyor) it is positioned along. No lane, no detection. */
const eyeActive = (w: WorldState, eye: PlacedComponent): boolean => {
  const lane = laneOf(w.project.components, eye);
  return !!lane && w.lanes[lane.id]?.photoeyeActive === true;
};
/** Truth a level switch reports: the tank it is mounted beside. Not mounted, no output. */
const probeHigh = (w: WorldState, probe: PlacedComponent): boolean => {
  const vessel = vesselOf(w.project.components, probe);
  return !!vessel && w.vessels[vessel.id]?.highLevel === true;
};
/** Every additional PLC with its outputs off (fail-closed after a runtime fault). */
const deenergisedPlcs = (plcs: Record<string, PlcRuntime>): Record<string, PlcRuntime> =>
  Object.fromEntries(Object.entries(plcs).map(([id, rt]) => [id, { ...rt, coils: {} }]));
const canEdit = (world: WorldState) => !world.running;
/** Replace the fault list, omitting the key when empty so fault-free projects keep their v1 shape. */
function withFaults(world: WorldState, faults: readonly FaultSpec[]): WorldState {
  const { faults: _previous, ...rest } = world.project;
  return { ...world, project: faults.length ? { ...rest, faults: [...faults] } : rest };
}
function applyCommands(initial: WorldState, commands: readonly Command[]): {
  world: WorldState; forceStep: boolean; events: SimEvent[];
} {
  let world = initial;
  let forceStep = false;
  const commandEvents: SimEvent[] = [];
  for (const cmd of commands) {
    world = { ...world, lastError: null };
    if (cmd.k === 'run') {
      try {
        const ids: (string | undefined)[] = plcComponents(world.project).length ? plcComponents(world.project).map(c => c.id) : [undefined];
        for (const id of ids) {
          const cfg = programOf(world.project, id);
          const label = id !== undefined && id !== primaryPlcId(world.project) ? `PLC ${id}: ` : '';
          try {
            const names = namesFor(world.project, id);
            if (cfg.language === 'st') compileSandboxST(cfg.stSource, names);
            else if (cfg.language === 'fbd') compileFbd(cfg.fbd, names);
            else {
              const issues = validateSandboxProgram(cfg.program, names);
              if (issues.length) throw new Error(issues.join('; '));
            }
          } catch (error) { throw new Error(`${label}${error instanceof Error ? error.message : 'Program validation failed'}`); }
        }
        world = { ...world, running: true, breakpointHit: null };
      } catch (error) { world = setError(world, error instanceof Error ? error.message : 'Program validation failed'); }
    } else if (cmd.k === 'pause') world = { ...world, running: false };
    else if (cmd.k === 'step') { world = { ...world, running: false }; forceStep = true; }
    else if (cmd.k === 'reset') world = { ...createWorld(world.project), breakpointScan: world.breakpointScan, breakpointTag: world.breakpointTag,
      breakpointInstruction: world.breakpointInstruction };
    else if (cmd.k === 'clear') world = createWorld();
    else if (cmd.k === 'loadPlantScene') {
      if(world.running)world=setError(world,'Pause before loading a plant scene');
      else try {
        const project=validateProject(makePlantSceneProject(cmd.id));
        world=createWorld(project);
        commandEvents.push({tick:world.tick,kind:'scene',
          detail:'Opened unsolved editable plant scene '+cmd.id});
      }catch(error){world=setError(world,error instanceof Error?error.message:'Unable to load plant scene');}
    }
    else if (cmd.k === 'setPlantFault') {
      if(world.running)world=setError(world,'Pause before changing a plant equipment fault');
      else {
        try {
          const faults={...(world.project.plantFaults??{})};
          if(cmd.fault===null)delete faults[cmd.id];
          else faults[cmd.id]=cmd.fault;
          const checked=validatePlantFaults(faults,world.project);
          const {plantFaults:ignored,...rest}=world.project;
          world={...world,project:checked?{...rest,plantFaults:checked}:rest};
          commandEvents.push({tick:world.tick,kind:'fault',
            detail:'Plant fault for '+cmd.id+(cmd.fault?' set: '+cmd.fault:' cleared')});
        }catch(error){world=setError(world,error instanceof Error?error.message:'Invalid plant fault');}
      }
    }
    else if (cmd.k === 'feedParcel') {
      const lane = cmd.conveyor !== undefined
        ? world.project.components.find(c => c.id === cmd.conveyor && c.kind === 'conveyor')
        : world.project.components.find(c => c.kind === 'conveyor');
      if (!lane) world = setError(world, cmd.conveyor !== undefined ? 'Unknown conveyor' : 'Place a conveyor before feeding a parcel');
      else if (cmd.kind !== 'plain' && cmd.kind !== 'marked')
        world = setError(world, 'Unknown parcel type');
      else {
        const prior = world.lanes[lane.id] ?? freshPlant();
        const fed = feedPlant(prior, cmd.kind);
        const succeeded = fed.plant !== prior;
        world = syncLegacy({ ...world, lanes: { ...world.lanes, [lane.id]: fed.plant } });
        if (!succeeded) world = setError(world, fed.events[0] ?? 'Unable to feed parcel');
        else for (const detail of fed.events) commandEvents.push({ tick: world.tick, kind: 'plant', detail });
      }
    } else if (cmd.k === 'operateProtection') {
      const component = world.project.components.find(c => c.id === cmd.id);
      if (!component || !['breaker', 'overload'].includes(component.kind) ||
          (cmd.action !== 'trip' && cmd.action !== 'reset'))
        world = setError(world, 'Invalid breaker/overload control');
      else {
        // Do not permit resetting the idealized breaker into a still-present
        // direct supply short. It must be removed from the user's netlist first.
        const resettingBreaker = component.kind === 'breaker' && cmd.action === 'reset';
        const candidate = resettingBreaker ? { ...world, tripped: { ...world.tripped, [component.id]: false } } : world;
        const circuit = resettingBreaker ? solveNetAware({
          devices: buildCircuit(candidate),
          wires: solverWires(candidate.project),
        }) : null;
        if (circuit?.diagnostics.some(d => d.startsWith('Supply short'))) {
          world = setError(world, 'Remove the short circuit before resetting the branch breaker');
          commandEvents.push({ tick: world.tick, kind: 'protection',
            detail: 'Breaker reset refused: direct short remains' });
        } else {
          world = syncLegacy({ ...world, tripped: { ...world.tripped, [component.id]: cmd.action === 'trip' } });
          // The overload contact is hardwired to the contactor, not to PLC
          // memory: do not silently rewrite the learner's Run latch.
          // A deliberately unsafe program may restart when 95-96 is reset.
          commandEvents.push({ tick: world.tick, kind: 'protection',
            detail: `${component.kind} ${cmd.action === 'trip' ? 'opened (manual training trip)' : 'reset by learner'}` });
        }
      }
    } else if (cmd.k === 'setThreePhasePower') {
      const source=world.project.components.find(c=>c.id===cmd.id&&c.kind==='three-phase-supply');
      if(world.running)world=setError(world,'Pause the simulator before isolating three-phase source');
      else if(!source||typeof cmd.enabled!=='boolean')world=setError(world,'Invalid virtual three-phase source control');
      else {
        world={...world,threePhasePower:{...world.threePhasePower,[cmd.id]:cmd.enabled}};
        commandEvents.push({tick:world.tick,kind:'mains',
          detail:'Virtual three-phase source '+cmd.id+(cmd.enabled?' energised':' isolated')});
      }
    } else if (cmd.k === 'setMeterProbe') {
      if ((cmd.lead !== 'positive' && cmd.lead !== 'negative') ||
          (cmd.terminal !== null && (typeof cmd.terminal !== 'string' ||
            !terminalExists(cmd.terminal, world.project.components))))
        world = setError(world, 'Meter probe must attach to an existing terminal or be disconnected');
      else world = { ...world, meter: {
        ...world.meter, [cmd.lead]: cmd.terminal, volts: null, status: 'select',
      } };
    } else if (cmd.k === 'operate' || cmd.k === 'operateToggle') {
      const target = world.project.components.find(c => c.id === cmd.id &&
        (c.kind === 'start' || c.kind === 'stop' || c.kind === 'estop' || c.kind === 'reversebutton'));
      if (!target) world = setError(world, 'Only pushbuttons and training E-stop can be operated');
      else {
        // A toggle is resolved here, against authoritative state, in command order. Resolving it in
        // the UI from a snapshot loses presses when clicks land between scans.
        const pressed = cmd.k === 'operate' ? cmd.pressed : !target.pressed;
        world = { ...world, project: { ...world.project, components: world.project.components.map(c => c.id === cmd.id ? { ...c, pressed } : c) } };
      }
    } else if (cmd.k === 'injectFault' || cmd.k === 'injectSeededFault') {
      // Faults can occur while running, so injection is not gated on pause. The fault only changes
      // what the circuit solver is given; no symptom is set here (see sim/faults.ts).
      const existing = faultsOf(world.project);
      let picked: FaultCandidate | null;
      if (cmd.k === 'injectSeededFault') {
        picked = Number.isSafeInteger(cmd.seed) ? pickSeededFault(world.project, cmd.seed) : null;
        if (!Number.isSafeInteger(cmd.seed)) world = setError(world, 'Fault seed must be a whole number');
        else if (!picked) world = setError(world, 'No applicable fault for this project');
      } else {
        picked = { kind: cmd.kind, target: cmd.target,
          ...(cmd.stuckPressed !== undefined ? { stuckPressed: cmd.stuckPressed } : {}),
          ...(cmd.stuckActive !== undefined ? { stuckActive: cmd.stuckActive } : {}) };
      }
      if (picked) {
        try {
          const faults = validateFaults([...existing, { id: nextFaultId(existing), ...picked, hidden: cmd.hidden }],
            world.project.components, world.project.wires);
          world = withFaults(world, faults);
          commandEvents.push({ tick: world.tick, kind: 'fault', detail: cmd.hidden
            ? 'A fault was injected (hidden)'
            : `Fault injected: ${describeFault(faults[faults.length - 1])}` });
        } catch (error) { world = setError(world, error instanceof Error ? error.message : 'Invalid fault'); }
      }
    } else if (cmd.k === 'clearFault' || cmd.k === 'revealFault') {
      const fault = faultsOf(world.project).find(f => f.id === cmd.id);
      if (!fault) world = setError(world, 'Unknown fault');
      else if (cmd.k === 'clearFault') {
        world = withFaults(world, faultsOf(world.project).filter(f => f.id !== cmd.id));
        world = resetCylinderAlarm(world, fault.target);
        commandEvents.push({ tick: world.tick, kind: 'fault', detail: fault.hidden
          ? 'A hidden fault was cleared' : `Fault cleared: ${describeFault(fault)}` });
      } else if (fault.hidden) {
        world = withFaults(world, faultsOf(world.project).map(f => f.id === cmd.id ? { ...f, hidden: false } : f));
        commandEvents.push({ tick: world.tick, kind: 'fault', detail: `Fault revealed: ${describeFault(fault)}` });
      }
    } else if (!canEdit(world)) world = setError(world, 'Pause simulation before modifying the project');
    else if (cmd.k === 'repair') {
      // Replacing a part is only possible with the plant isolated (paused). The event is neutral on
      // purpose: it never says whether anything was wrong, so guess-and-replace is not rewarded.
      if (!world.project.components.some(c => c.id === cmd.target) && !world.project.wires.some(w => w.id === cmd.target))
        world = setError(world, 'Nothing to repair: unknown component or wire');
      else {
        world = withFaults(world, faultsOf(world.project).filter(f => f.target !== cmd.target));
        world = resetCylinderAlarm(world, cmd.target);
        commandEvents.push({ tick: world.tick, kind: 'repair', detail: repairDetail(cmd.target) });
      }
    }
    else if (cmd.k === 'setParam') {
      const part = world.project.components.find(c => c.id === cmd.id);
      const spec = part ? paramSpecsOf(part.kind).find(s => s.key === cmd.key) : undefined;
      const error = !part ? 'Unknown component' : !spec ? 'This device has no such setting' : paramError(spec, cmd.value);
      if (error || !part || !spec) world = setError(world, error ?? 'Invalid setting');
      else {
        const { params: previous, ...rest } = world.project;
        const nextParams = { ...(previous ?? {}) };
        const mine = { ...(nextParams[part.id] ?? {}) };
        if (cmd.value === spec.default) delete mine[spec.key]; else mine[spec.key] = cmd.value;
        if (Object.keys(mine).length) nextParams[part.id] = mine; else delete nextParams[part.id];
        world = { ...world, project: Object.keys(nextParams).length ? { ...rest, params: nextParams } : rest, lastError: null };
      }
    }
    else if (cmd.k === 'remove') {
      const without = removeComponent(world.project, cmd.id);
      if (!without) world = setError(world, 'Unknown component');
      else {
        // Rebuild the runtime: per-device and per-PLC state for the removed part must not linger.
        const probe = (t: string | null) => (t && terminalExists(t, without.components) ? t : null);
        const kept = { ...world.meter, positive: probe(world.meter.positive), negative: probe(world.meter.negative),
          volts: null, status: 'select' as const };
        world = { ...createWorld(without), meter: kept, breakpointScan: world.breakpointScan, breakpointTag: world.breakpointTag };
        commandEvents.push({ tick: world.tick, kind: 'edit', detail: `Removed ${cmd.id} and everything wired to it` });
      }
    } else if (cmd.k === 'addPanel') {
      if (cmd.template !== 'motor-starter' || (cmd.at !== undefined && !validPos(cmd.at))) world = setError(world, 'Unknown panel template or position');
      else {
        const plan = planStarterPanel(world.project, cmd.at);
        if (!plan.ok) world = setError(world, plan.error);
        else {
          world = { ...world, project: withStarterPanel(world.project, plan, latchProgram()) };
          commandEvents.push({ tick: world.tick, kind: 'edit', detail: `Added a pre-wired starter panel (${plan.plcId})` });
        }
      }
    }
    else if (cmd.k === 'configureIo') {
      const plc = plcComponents(world.project).find(c => c.id === cmd.plc);
      const errors = plc ? validateIoMap(plc.kind, cmd.io) : ['Unknown PLC'];
      if (!plc || errors.length) world = setError(world, errors.join('; '));
      else {
        const merged = { inputs: { ...defaultIo(plc.kind).inputs, ...cmd.io.inputs }, outputs: { ...defaultIo(plc.kind).outputs, ...cmd.io.outputs } };
        // PLC16 has fixed analog channels; a digital tag rename should not persist
        // a fake non-default map solely because defaultIo also describes analog ports.
        const original = defaultIo(plc.kind);
        const isDefault = JSON.stringify(merged.inputs) === JSON.stringify(original.inputs) &&
          JSON.stringify(merged.outputs) === JSON.stringify(original.outputs);
        const { plcIo: previous, ...rest } = world.project;
        const nextIo = { ...(previous ?? {}) };
        if (isDefault) delete nextIo[plc.id]; else nextIo[plc.id] = merged;
        const candidate: ProjectFile = Object.keys(nextIo).length ? { ...rest, plcIo: nextIo } : rest;
        // A program the user never changed (the generated placeholder) follows the rename; a program they wrote is protected.
        const before = programOf(world.project, plc.id);
        const oldPlaceholder = defaultProgramFor(plc.kind, ioOf(world.project, plc));
        const newPlaceholder = defaultProgramFor(plc.kind, ioOf(candidate, plc));
        const pristineLadder = JSON.stringify(before.program) === JSON.stringify(oldPlaceholder.program);
        const pristineSt = before.stSource === oldPlaceholder.stSource;
        let renamed = candidate;
        if (pristineLadder) renamed = withProgramOf(renamed, plc.id, { program: newPlaceholder.program });
        if (pristineSt) renamed = withProgramOf(renamed, plc.id, { stSource: newPlaceholder.stSource });
        const finalCandidate = renamed;
        // Renaming must not silently break the program that is active on this PLC.
        const cfg = programOf(finalCandidate, plc.id);
        const names = namesFor(finalCandidate, plc.id);
        let problem: string | null = null;
        try {
          if (cfg.language === 'st') compileSandboxST(cfg.stSource, names);
          else if (cfg.language === 'fbd') compileFbd(cfg.fbd, names);
          else { const issues = validateSandboxProgram(cfg.program, names); if (issues.length) problem = issues.join('; '); }
        } catch (error) { problem = error instanceof Error ? error.message : 'Program no longer compiles'; }
        if (problem) world = setError(world, `Renaming would break the program on ${plc.id}: ${problem}`);
        else {
          world = createWorld(finalCandidate);
          commandEvents.push({ tick: world.tick, kind: 'edit', detail: `Changed the I/O tags of ${plc.id}` });
        }
      }
    }
    else if (cmd.k === 'editWorkspace') {
      if (world.running) world = setError(world, 'Pause the PLC before editing the workspace');
      else {
        try {
          const candidate = validateProject(applyWorkspaceEdit(world.project, cmd.edit));
          if (JSON.stringify(candidate) !== JSON.stringify(world.project)) {
            world = { ...createWorld(candidate), breakpointScan: world.breakpointScan, breakpointTag: world.breakpointTag };
            commandEvents.push({ tick: world.tick, kind: 'edit', detail: 'Workspace ' + cmd.edit.kind + ' committed' });
          }
        } catch (e) {
          world = setError(world, e instanceof Error ? e.message : 'Invalid workspace edit');
        }
      }
    }
    else if (cmd.k === 'place') {
      if (!validId(cmd.id) || !Object.hasOwn(COMPONENTS, cmd.kind) || !validPos(cmd.at) ||
          world.project.components.some(c => c.id === cmd.id) || world.project.components.length >= MAX_COMPONENTS) world = setError(world, 'Invalid component placement');
      else if (isPlcKind(cmd.kind) && plcComponents(world.project).length >= MAX_PLCS)
        world = setError(world, `At most ${MAX_PLCS} PLCs fit on this workbench`);
      else if (cmd.kind === 'supply' && world.project.components.filter(c => c.kind === 'supply').length >= MAX_SUPPLIES)
        world = setError(world, `At most ${MAX_SUPPLIES} 24V supplies fit on this workbench`);
      else if (['reversebutton', 'forwardcontactor', 'reversecontactor', 'revmotor'].includes(cmd.kind) &&
        world.project.components.some(c => c.kind === cmd.kind))
        world = setError(world, 'This educational workbench supports one of each station component');
      else {
        const firstPlc = isPlcKind(cmd.kind) && plcComponents(world.project).length === 0;
        let project: ProjectFile = { ...world.project, components: [...world.project.components, { id: cmd.id, kind: cmd.kind, x: cmd.at.x, y: cmd.at.y, pressed: false }] };
        // The top-level program belongs to the first PLC. A pristine classic placeholder would not compile for a
        // 16/16 controller (it names Start and Run), so the first controller of that type gets its own placeholder.
        if (firstPlc && cmd.kind === 'plc16' && JSON.stringify(project.program) === JSON.stringify(blankProgram())) {
          const fresh = defaultProgramFor('plc16');
          project = { ...project, program: fresh.program, stSource: fresh.stSource };
        }
        world = { ...world, project };
      }
    } else if (cmd.k === 'move') {
      if (!validPos(cmd.to) || !world.project.components.some(c => c.id === cmd.id)) world = setError(world, 'Invalid movement');
      else world = { ...world, project: { ...world.project, components: world.project.components.map(c => c.id === cmd.id ? { ...c, ...cmd.to } : c) } };
    } else if (cmd.k === 'wire') {
      const domainError = analogWireError(cmd.from, cmd.to, world.project.components, world.project.wires);
      if (domainError) world = setError(world, domainError);
      else if (!validId(cmd.id) || world.project.wires.some(w => w.id === cmd.id || (w.from === cmd.from && w.to === cmd.to) || (w.from === cmd.to && w.to === cmd.from)) ||
          cmd.from === cmd.to || !terminalExists(cmd.from, world.project.components) ||
          !terminalExists(cmd.to, world.project.components) || world.project.wires.length >= MAX_WIRES)
        world = setError(world, 'Invalid or duplicate terminal connection');
      else world = { ...world, project: { ...world.project, wires: [...world.project.wires, { id: cmd.id, from: cmd.from, to: cmd.to }] } };
    } else if (cmd.k === 'unwire') {
      world = { ...world, project: { ...world.project, wires: world.project.wires.filter(w => w.id !== cmd.id) } };
      // Removing a broken conductor is a legitimate repair, and a dangling fault would make the
      // exported project fail validation.
      world = withFaults(world, faultsOf(world.project).filter(f => !(f.kind === 'wire-open' && f.target === cmd.id)));
    } else if (cmd.k === 'loadProgram' || cmd.k === 'loadST' || cmd.k === 'loadFBD' || cmd.k === 'activateLanguage') {
      // `plc` selects the target controller; omitted means the first PLC, exactly as with one PLC.
      if (cmd.plc !== undefined && !plcComponents(world.project).some(c => c.id === cmd.plc)) {
        world = setError(world, 'Unknown PLC');
      } else if (cmd.k === 'loadProgram') {
        const errors = validateSandboxProgram(cmd.program, namesFor(world.project, cmd.plc));
        if (errors.length) world = setError(world, errors.join('; '));
        else world = createWorld(withProgramOf(world.project, cmd.plc, { program: cmd.program, language: 'ladder' }));
      } else if (cmd.k === 'loadFBD') {
        try {
          compileFbd(cmd.document, namesFor(world.project, cmd.plc));
          world = createWorld(withProgramOf(world.project, cmd.plc, { language: 'fbd', fbd: cmd.document }));
        } catch (error) { world = setError(world, error instanceof Error ? error.message : 'Invalid FBD graph'); }
      } else if (cmd.k === 'loadST') {
        try {
          compileSandboxST(cmd.source, namesFor(world.project, cmd.plc));
          world = createWorld(withProgramOf(world.project, cmd.plc, { language: 'st', stSource: cmd.source }));
        } catch (error) { world = setError(world, error instanceof Error ? error.message : 'Invalid Structured Text'); }
      } else {
        try {
          const cfg = programOf(world.project, cmd.plc);
          const names = namesFor(world.project, cmd.plc);
          if (cmd.language === 'st') compileSandboxST(cfg.stSource, names);
          if (cmd.language === 'fbd') compileFbd(cfg.fbd, names);
          if (cmd.language === 'ladder') {
            const errors = validateSandboxProgram(cfg.program, names);
            if (errors.length) throw new Error(errors.join('; '));
          }
          world = createWorld(withProgramOf(world.project, cmd.plc, { language: cmd.language }));
        } catch (error) { world = setError(world, error instanceof Error ? error.message : 'Cannot activate language'); }
      }
    } else if (cmd.k === 'breakAtScan') {
      if (cmd.scan !== null && (!Number.isSafeInteger(cmd.scan) || cmd.scan < 1 || cmd.scan > 1000000 || cmd.scan <= world.tick))
        world = setError(world, 'Choose a future scan from 1 to 1000000');
      else world = { ...world, breakpointScan: cmd.scan, breakpointHit: null };
    } else if (cmd.k === 'breakOnTag') {
      const tags = new Set([
        'Start', 'StopOK', 'Run', ...Object.keys(world.project.program.symbols ?? {}),
        ...world.project.program.rungs.map(rung => rung.coil),
        ...Object.entries(world.tagValues).filter(([, value]) => typeof value === 'boolean').map(([tag]) => tag),
      ]);
      if (cmd.breakpoint !== null && !validateTagBreakpoint(cmd.breakpoint, tags))
        world = setError(world, 'Tag breakpoint requires a known Boolean PLC tag and valid edge');
      else world = { ...world, breakpointTag: cmd.breakpoint, breakpointHit: null };
    } else if (cmd.k === 'breakOnInstruction') {
      const cfg = programOf(world.project, undefined);
      const ids = cfg.language === 'fbd' ? cfg.fbd.nodes.map(node => node.id) :
        cfg.language === 'ladder' ? cfg.program.rungs.map(rung => rung.id) : [];
      if (cmd.breakpoint !== null && !validateInstructionBreakpoint(cmd.breakpoint, ids))
        world = setError(world, 'Instruction breakpoint requires an existing FBD block or Ladder rung, and a bounded edge/threshold');
      else world = { ...world, breakpointInstruction: cmd.breakpoint, breakpointHit: null };
    } else if (cmd.k === 'forceLocal') {
      const selectedPlc = cmd.plc ?? primaryPlcId(world.project);
      const plc = selectedPlc ? plcComponents(world.project).find(c=>c.id===selectedPlc) : undefined;
      if(world.running) world = setError(world,'Pause simulation before setting a local debug force');
      else if(!plc) world = setError(world,'Select a real PLC before forcing local memory');
      else if(programOf(world.project,plc.id).language!=='ladder')
        world = setError(world,'Local debug forcing is supported only for Ladder memory tags');
      else {
        try {
          const prior = world.debugForces[plc.id] ?? {};
          const updated = applyLocalForce(prior,programOf(world.project,plc.id).program,cmd.tag,cmd.value);
          const all = {...world.debugForces};
          if(Object.keys(updated).length)all[plc.id]=updated;else delete all[plc.id];
          world = {...world,debugForces:all};
          commandEvents.push({tick:world.tick,kind:'debug',
            detail:'Local memory force '+plc.id+'.'+cmd.tag+(cmd.value===null?' removed':' active')});
        } catch (error) {world=setError(world,error instanceof Error?error.message:'Invalid local force');}
      }
    } else if (cmd.k === 'loadProject') {
      try { world = createWorld(validateProject(cmd.project)); } catch (e) { world = setError(world, e instanceof Error ? e.message : 'Invalid project'); }
    }
  }
  return { world, forceStep, events: commandEvents };
}
function buildCircuit(world: WorldState): Device[] {
  const devices: Device[] = [];
  const primary = legacyPrimaryId(world.project);
  for (const c of world.project.components) {
    // Equipment described as data (relay, cylinder): the definition says which loads and switches it contributes.
    const described = electricalDevices(c, { on: world.deviceOn[c.id] === true, hasFault: kind => hasFault(world.project, kind, c.id),
      cylinder: world.cylinders[c.id],plantSignals:sensorImage(world.plantWorld,c.id) });
    if (described) { devices.push(...described); continue; }
    if (c.kind === 'supply') devices.push({ id: c.id, kind: 'supply', positive: terminal(c.id, 'P24'), negative: terminal(c.id, 'M0'), volts: 24 });
    if (c.kind === 'breaker') devices.push({
      id: c.id, kind: 'switch', a: terminal(c.id,'IN'), b: terminal(c.id,'OUT'),
      closed: world.tripped[c.id] !== true,
    });
    if (c.kind === 'overload') devices.push({
      id: c.id, kind: 'switch', a: terminal(c.id,'95'), b: terminal(c.id,'96'),
      closed: world.tripped[c.id] !== true,
    });
    if (c.kind === 'start' || c.kind === 'stop' || c.kind === 'estop' || c.kind === 'reversebutton') {
      // A stuck-button fault overrides what the operator did; the circuit sees the stuck contact.
      const pressed = effectivePressed(world.project, c);
      devices.push({
        id: c.id, kind: 'switch', a: terminal(c.id, 'A'), b: terminal(c.id, 'B'),
        closed: c.kind === 'start' || c.kind === 'reversebutton' ? pressed : !pressed,
      });
    }
    if (isPlcKind(c.kind)) {
      // Each PLC drives only its own output terminals, through its I/O map, from its own scan state.
      const coils = c.id === primary ? world.coils : world.plcs[c.id]?.coils ?? {};
      Object.entries(ioOf(world.project, c).outputs).forEach(([pin, tag], i) => devices.push({
        id: c.kind === 'plc' ? (i === 0 ? `${c.id}-Q` : `${c.id}-Q${i}`) : `${c.id}-${pin}`, kind: 'switch',
        a: terminal(c.id, 'L+'), b: terminal(c.id, pin), closed: coils[tag] === true }));
    }
    // A stuck-output sensor lies to the PLC: only its electrical output changes. The plant truth
    // (world.plant.photoeyeActive / world.tank.highLevel) keeps computing from real geometry and level.
    if (c.kind === 'photoeye') devices.push({ id: `${c.id}-OUT`, kind: 'switch',
      a: terminal(c.id, 'L+'), b: terminal(c.id, 'OUT'),
      closed: effectiveSensor(world.project, c, eyeActive(world, c)) });
    if (c.kind === 'levelprobe') devices.push({ id: `${c.id}-OUT`, kind: 'switch',
      a: terminal(c.id, 'L+'), b: terminal(c.id, 'OUT'),
      closed: effectiveSensor(world.project, c, probeHigh(world, c)) });
    if (c.kind === 'contactor') {
      // Open coil: not part of the circuit, so it never pulls in (A1-A2 still measures 24 V).
      if (!hasFault(world.project, 'contactor-coil-open', c.id))
        devices.push({ id: c.id, kind: 'load', positive: terminal(c.id, 'A1'), negative: terminal(c.id, 'A2'), nominalVolts: 24 });
      // Welded contacts stay closed whatever the coil does.
      devices.push({ id: `${c.id}-NO`, kind: 'switch', a: terminal(c.id, '13'), b: terminal(c.id, '14'),
        closed: world.deviceOn[c.id] === true || hasFault(world.project, 'contactor-welded', c.id) });
    }
    if (c.kind === 'forwardcontactor' || c.kind === 'reversecontactor') {
      // The NC auxiliary is mechanically linked to the NO contacts, so a weld opens it too.
      const on = (c.kind === 'forwardcontactor' ? world.forwardContactorOn : world.reverseContactorOn) ||
        hasFault(world.project, 'contactor-welded', c.id);
      if (!hasFault(world.project, 'contactor-coil-open', c.id))
        devices.push({ id: c.id, kind: 'load', positive: terminal(c.id, 'A1'),
          negative: terminal(c.id, 'A2'), nominalVolts: 24 });
      devices.push({ id: `${c.id}-NO`, kind: 'switch', a: terminal(c.id, '13'),
        b: terminal(c.id, '14'), closed: on });
      devices.push({ id: `${c.id}-NC`, kind: 'switch', a: terminal(c.id, '21'),
        b: terminal(c.id, '22'), closed: !on });
    }
    if (c.kind === 'revmotor' && !hasFault(world.project, 'motor-open-winding', c.id)) {
      devices.push({ id: `${c.id}-F`, kind: 'load', positive: terminal(c.id, 'F+'),
        negative: terminal(c.id, 'M-'), nominalVolts: 24 });
      devices.push({ id: `${c.id}-R`, kind: 'load', positive: terminal(c.id, 'R+'),
        negative: terminal(c.id, 'M-'), nominalVolts: 24 });
    }
    // Open winding: the load is not part of the circuit. Terminals still measure 24 V; nothing moves.
    if ((c.kind === 'motor' || c.kind === 'conveyor' || c.kind === 'pump' || c.kind === 'lamp') &&
        !hasFault(world.project, 'motor-open-winding', c.id)) devices.push({ id: c.id, kind: 'load',
      positive: terminal(c.id, 'L+'), negative: terminal(c.id, 'M-'), nominalVolts: 24 });
    if (c.kind === 'diverter' || c.kind === 'drainvalve') devices.push({ id: c.id, kind: 'load',
      positive: terminal(c.id, 'A1'), negative: terminal(c.id, 'A2'), nominalVolts: 24 });
  }
  return devices;
}
export function renderSnapshot(world: WorldState): RenderSnapshot {
  return { tick: world.tick, running: world.running, components: world.project.components.map(c => ({ ...c })),
    wires: world.project.wires.map(w => ({ ...w })),
    io: { Start: world.inputs.Start, StopOK: world.inputs.StopOK,
      Photoeye: world.inputs.Photoeye, TankHigh: world.inputs.TankHigh, ReverseRequest: world.inputs.ReverseRequest,
      Run: world.coils.Run === true, Sort: world.coils.Sort === true,
      Fill: world.coils.Fill === true, Drain: world.coils.Drain === true,
      Forward: world.coils.Forward === true, Reverse: world.coils.Reverse === true,
      'Q0.0': world.coils.Run === true, 'Q0.1': world.coils.Sort === true,
      'Q0.2': world.coils.Fill === true, 'Q0.3': world.coils.Drain === true,
      'Q0.4': world.coils.Forward === true, 'Q0.5': world.coils.Reverse === true,
      PlcPowered: world.powered },
    voltages: { ...world.voltages }, contactorOn: world.contactorOn, motorOn: world.motorOn, motorAngleRad: world.motorAngleRad,
    plcs: Object.fromEntries(plcComponents(world.project).map(c => {
      const lang = programOf(world.project, c.id).language;
      const idle: Record<string, boolean> = {};
      const rt = world.plcs[c.id];
      const io = ioOf(world.project, c);
      // Show the physical numeric connection on the paused bench before the first scan.
      // While running, the live PLC view shows the previous scan's actual sampled value.
      const analogPoints = io.analogInputs && !world.running
        ? sampleAnalogInputs(world.project, world.vessels, c.id, io, rt?.powered ?? false,
          new Set(faultsOf(world.project).filter(f => f.kind === 'wire-open').map(f => f.target))).points
        : rt?.analogInputs ?? [];
      return [c.id, c.id === legacyPrimaryId(world.project)
        ? plcView(c.kind, lang, world.powered, LEGACY_IO, world.inputs, world.coils,
          { tagValues: world.tagValues, ladderSteps: world.ladderSteps, ladderMemory: world.ladderMemory })
        : plcView(c.kind, lang, rt?.powered ?? false, io, rt?.tagInputs ?? idle, rt?.coils ?? {},
          { tagValues: rt?.tagValues ?? {}, ladderSteps: rt?.ladderSteps ?? [], ladderMemory: rt?.ladderMemory ?? {} }, analogPoints)];
    })),
    deviceOn: { ...world.deviceOn }, motorAngles: { ...world.motorAngles },
    lanes: Object.fromEntries(Object.entries(world.lanes).map(([id, l]) => [id, { ...l, parcel: l.parcel ? { ...l.parcel } : null }])),
    vessels: Object.fromEntries(Object.entries(world.vessels).map(([id, v]) => [id, { ...v }])),
    tripped: { ...world.tripped },
    threePhase: Object.fromEntries(Object.entries(world.threePhase).map(([id,state])=>
      [id,{...state,motor:{...state.motor,diagnostics:[...state.motor.diagnostics]},
        events:[...state.events]}])),
    threePhaseSources: Object.fromEntries(world.project.components.filter(c=>c.kind==='three-phase-supply')
      .map(c=>[c.id,world.threePhasePower[c.id]!==false])),
    phaseMeters: Object.fromEntries(Object.entries(threePhaseConnections(world.project.components,
      world.project.wires.filter(w=>!faultsOf(world.project).some(f=>f.kind==='wire-open'&&f.target===w.id))))
      .map(([id,connection])=>[id,readPhaseMeter(connection,
        world.threePhasePower[connection.supplyId]!==false)])),
    timers: Object.fromEntries(world.project.components.filter(c => c.kind === 'timerelay').map(c => {
      const delayMs = paramValue(world.project.params, c.id, paramSpecsOf('timerelay')[0]);
      const elapsedMs = world.timers[c.id] ?? 0;
      return [c.id, { elapsedMs, delayMs, done: elapsedMs >= delayMs }];
    })),
    cylinders: Object.fromEntries(Object.entries(world.cylinders).map(([id, c]) => [id, {
      position: c.position, extendLimit: c.extendLimit, retractLimit: c.retractLimit, command: c.command, alarm: c.alarm, conflict: c.conflict }])),
    forwardContactorOn: world.forwardContactorOn, reverseContactorOn: world.reverseContactorOn,
    motorDirection: world.motorDirection, reverseMotorAngleRad: world.reverseMotorAngleRad,
    interlockConflict: world.interlockConflict,
    conveyorOn: world.conveyorOn, diverterOn: world.diverterOn,
    plant: { ...world.plant, parcel: world.plant.parcel ? { ...world.plant.parcel } : null },
    tank: { ...world.tank }, pumpOn: world.pumpOn, drainOn: world.drainOn,
    breakerTripped: world.breakerTripped, overloadTripped: world.overloadTripped,
    lampOn: world.lampOn, meter: { ...world.meter },
    diagnostics: [...world.diagnostics], lastError: world.lastError,
    alarms: world.alarms.map(a => ({ ...a })),
    language: world.project.language ?? 'ladder',
    tagValues: { ...world.tagValues }, ladderSteps: [...world.ladderSteps],
    ladderMemory: { ...world.ladderMemory }, fbdSteps: world.fbdSteps.map(step => ({ ...step })),
    debugForces: { ...(world.debugForces[primaryPlcId(world.project) ?? ''] ?? {}) },
    breakpointScan: world.breakpointScan, breakpointHit: world.breakpointHit,
    breakpointTag: world.breakpointTag, breakpointInstruction: world.breakpointInstruction,
    scanTrace: world.scanTrace.map(entry => ({
      ...entry, networks: entry.networks.map(network => ({ ...network })),
    })) };
}
/** Only this function owns the ten phases. Sensor state is sampled for the NEXT tick. */
export function tick(initial: WorldState, commands: readonly Command[] = [], dtMs = SCAN_MS):
  { world: WorldState; snapshot: RenderSnapshot; events: SimEvent[] } {
  if (!Number.isSafeInteger(dtMs) || dtMs < 1 || dtMs > 1000) throw new RangeError('Invalid simulation timestep');
  // 1. Apply commands. Run/Pause/Step are commands, not renderer state.
  const change = applyCommands(initial, commands);
  let w = change.world;
  const events: SimEvent[] = [...change.events];
  if (!w.running && !change.forceStep) {
    // Measurements update while paused without advancing PLC/plant state.
    // This is a read of the current idealized netlist, not a hidden PLC tick.
    if (w.meter.positive || w.meter.negative) {
      const pausedCircuit = solveNetAware({
        devices: buildCircuit(w),
        wires: solverWires(w.project),
      });
      w = { ...w, voltages: pausedCircuit.voltage,
        meter: measureDC24(pausedCircuit.voltage, pausedCircuit.diagnostics,
          w.meter.positive, w.meter.negative, pausedCircuit.sameSupply) };
    }
    return { world: w, snapshot: renderSnapshot(w), events };
  }
  // 2. Solve the 24V netlist using last scan's actuator/output state.
  const wires = solverWires(w.project);
  let circuit = solveNetAware({ devices: buildCircuit(w), wires });
  // An ideal direct short downstream of the CLOSED breaker trips its latched
  // protective contact. An unfused upstream short does NOT get false protection.
  const shortedAtStart = circuit.diagnostics.some(d => d.startsWith('Supply short'));
  if (shortedAtStart) {
    // The first closed breaker whose opening isolates the short trips. An upstream short that no breaker
    // can isolate is NOT given false protection.
    for (const breaker of w.project.components.filter(c => c.kind === 'breaker' && w.tripped[c.id] !== true)) {
      const opened = buildCircuit(w).map(d =>
        d.id === breaker.id && d.kind === 'switch' ? { ...d, closed: false } : d);
      const isolated = solveNetAware({ devices: opened, wires });
      if (!isolated.diagnostics.some(d => d.startsWith('Supply short'))) {
        w = syncLegacy({ ...w, tripped: { ...w.tripped, [breaker.id]: true } });
        circuit = isolated;
        events.push({ tick: w.tick + 1, kind: 'protection',
          detail: 'Branch breaker tripped: downstream direct short isolated' });
        break;
      }
    }
  }
  const shorted = circuit.diagnostics.some(d => d.startsWith('Supply short'));
  const plc = plcComponents(w.project)[0];
  // "24 V" always means 24 V relative to the device's OWN reference, so isolated supplies cannot leak.
  const powered = !!plc && !shorted && circuit.reads24(terminal(plc.id, 'L+'), terminal(plc.id, 'M'));
  // 3. Sample actual wired 24V input image, including powered mark photoeye.
  // The photoeye's optical state was determined by the PRIOR plant scan.
  const eyePowered = !shorted && w.project.components.some(c => c.kind === 'photoeye' && circuit.reads24(terminal(c.id, 'L+'), terminal(c.id, 'M')));
  const probePowered = !shorted && w.project.components.some(c => c.kind === 'levelprobe' && circuit.reads24(terminal(c.id, 'L+'), terminal(c.id, 'M')));
  const inputs = {
    Start: powered && circuit.reads24(terminal(plc!.id, 'I0.0'), terminal(plc!.id, 'M')),
    StopOK: powered && circuit.reads24(terminal(plc!.id, 'I0.1'), terminal(plc!.id, 'M')),
    Photoeye: powered && eyePowered && circuit.reads24(terminal(plc!.id, 'I0.2'), terminal(plc!.id, 'M')),
    TankHigh: powered && probePowered && circuit.reads24(terminal(plc!.id, 'I0.3'), terminal(plc!.id, 'M')),
    ReverseRequest: powered && circuit.reads24(terminal(plc!.id, 'I0.4'), terminal(plc!.id, 'M')),
  };
  // 4. Execute the learner's exact document in the salvaged bounded LD or ST engine.
  let ladderResult: LadderResult | null = null;
  let stResult: STResult | null = null;
  let fbdResult: FbdResult | null = null;
  try {
    // Only a classic first PLC runs through this original fixed-name path; every other PLC takes the generic path below.
    if (powered && plc?.kind === 'plc') {
      if (w.project.language === 'fbd') {
        fbdResult = executeFbd(compileFbd(programOf(w.project, plc.id).fbd, namesFor(w.project, plc.id)),
          inputs, w.coils, w.fbdMemory, dtMs);
      } else if (w.project.language === 'st') {
        const compiled = w.stCompiled ?? compileSandboxST(w.project.stSource ?? '');
        stResult = executeStructuredText(compiled, inputs, w.stMemory);
        const run = Object.entries(stResult.outputs).find(([key]) => key.toLowerCase() === 'run')?.[1];
        if (typeof run !== 'boolean') throw new TypeError('ST Run output must be BOOL');
      } else ladderResult = executeLadder(w.project.program, inputs, w.coils, w.ladderMemory, dtMs,
        w.ladderNumeric,w.debugForces[plc.id] ?? {});
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PLC runtime failed';
    // Fail closed in the *simulated* plant. Do not publish stale energized outputs
    // after an arithmetic fault (overflow, division by zero, invalid typed write).
    const paused: WorldState = {
      ...w, running: false, coils: { ...w.coils, Run: false, Sort: false, Fill: false, Drain: false, Forward: false, Reverse: false },
      tagValues: { ...w.tagValues, Run: false, Sort: false, Fill: false, Drain: false, Forward: false, Reverse: false },
      contactorOn: false, motorOn: false, conveyorOn: false, diverterOn: false,
      pumpOn: false, drainOn: false, lampOn: false,
      plcs: deenergisedPlcs(w.plcs), deviceOn: {}, timers: {},
      forwardContactorOn: false, reverseContactorOn: false, motorDirection: 'stopped',
      interlockConflict: false,
      plant: { ...w.plant, photoeyeActive: false }, lanes: quietLanes(w.lanes), voltages: {},
      diagnostics: [...w.diagnostics, 'PLC scan interrupted; simulated outputs deenergized'],
      lastError: `PLC runtime error: ${message}`,
    };
    return { world: paused, snapshot: renderSnapshot(paused),
      events: [{ tick: w.tick, kind: 'error', detail: message }] };
  }
  const stRun = stResult
    ? Object.entries(stResult.outputs).find(([name]) => name.toLowerCase() === 'run')?.[1]
    : undefined;
  const stSort = stResult
    ? Object.entries(stResult.outputs).find(([name]) => name.toLowerCase() === 'sort')?.[1]
    : undefined;
  const stFill = stResult
    ? Object.entries(stResult.outputs).find(([name]) => name.toLowerCase() === 'fill')?.[1]
    : undefined;
  const stDrain = stResult
    ? Object.entries(stResult.outputs).find(([name]) => name.toLowerCase() === 'drain')?.[1]
    : undefined;
  const stForward = stResult
    ? Object.entries(stResult.outputs).find(([name]) => name.toLowerCase() === 'forward')?.[1]
    : undefined;
  const stReverse = stResult
    ? Object.entries(stResult.outputs).find(([name]) => name.toLowerCase() === 'reverse')?.[1]
    : undefined;
  if ((stSort !== undefined && typeof stSort !== 'boolean') ||
      (stFill !== undefined && typeof stFill !== 'boolean') ||
      (stDrain !== undefined && typeof stDrain !== 'boolean') ||
      (stForward !== undefined && typeof stForward !== 'boolean') ||
      (stReverse !== undefined && typeof stReverse !== 'boolean')) {
    const paused: WorldState = {
      ...w, running: false, coils: { ...w.coils, Run: false, Sort: false },
      tagValues: { ...w.tagValues, Run: false, Sort: false },
      motorOn: false, conveyorOn: false, diverterOn: false, contactorOn: false,
      pumpOn: false, drainOn: false, lampOn: false,
      plcs: deenergisedPlcs(w.plcs), deviceOn: {}, timers: {},
      forwardContactorOn: false, reverseContactorOn: false, motorDirection: 'stopped',
      interlockConflict: false,
      lastError: 'PLC Sort/Fill/Drain/Forward/Reverse outputs must be BOOL',
    };
    return { world: paused, snapshot: renderSnapshot(paused),
      events: [{ tick: w.tick, kind: 'error', detail: 'PLC Sort/Fill/Drain/Forward/Reverse outputs must be BOOL' }] };
  }
  // Structured Text is case-insensitive; the physical Q0.0 binding is always canonical "Run".
  const coils: Record<string, boolean> = stResult
    ? { ...Object.fromEntries(Object.entries(stResult.outputs).filter(([, value]) => typeof value === 'boolean')),
        Run: stRun === true, Sort: stSort === true, Fill: stFill === true, Drain: stDrain === true,
        Forward: stForward === true, Reverse: stReverse === true }
    : fbdResult?.outputs ?? ladderResult?.outputs ?? {};
  const tagValues: Record<string, STValue> = {
    ...inputs, ...(stResult?.signals ?? {}), ...(w.debugForces[plc?.id ?? ''] ?? {}),
    ...(ladderResult?.numericValues ?? {}), ...coils,
    Run: coils.Run === true, Sort: coils.Sort === true,
    Fill: coils.Fill === true, Drain: coils.Drain === true,
    Forward: coils.Forward === true, Reverse: coils.Reverse === true, Unused: false,
  };
  // 4b. Every additional PLC samples ITS OWN wired terminals and scans ITS OWN program. They interact
  // only through the 24V netlist (e.g. one PLC's output wired to another's input).
  const nextPlcs: Record<string, PlcRuntime> = {};
  const unpoweredExtras: string[] = [];
  for (const extra of runtimePlcs(w.project)) {
    const extraPowered = !shorted && circuit.reads24(terminal(extra.id, 'L+'), terminal(extra.id, 'M'));
    const io = ioOf(w.project, extra);
    // A sensor-named input only reads high if some powered sensor of that kind exists (guards a wire straight to P24).
    const digitalInputs = Object.fromEntries(Object.entries(io.inputs).map(([pin, tag]) => [tag, extraPowered &&
      (tag === 'Photoeye' ? eyePowered : tag === 'TankHigh' ? probePowered : true) &&
      circuit.reads24(terminal(extra.id, pin), terminal(extra.id, 'M'))]));
    const cfg = programOf(w.project, extra.id);
    try {
      const openAnalogWires = new Set(faultsOf(w.project).filter(f => f.kind === 'wire-open').map(f => f.target));
      const numeric = sampleAnalogInputs(w.project, w.vessels, extra.id, io, extraPowered, openAnalogWires);
      // Physical numeric process inputs come from the preceding settled scan state.
      const tagInputs = { ...digitalInputs, ...numeric.values };
      nextPlcs[extra.id] = scanPlc(cfg, io, w.plcs[extra.id] ?? freshPlcRuntime(cfg, namesFor(w.project, extra.id)),
        tagInputs, extraPowered, dtMs, numeric.points);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PLC runtime failed';
      const quiet = { Run: false, Sort: false, Fill: false, Drain: false, Forward: false, Reverse: false };
      const paused: WorldState = {
        ...w, running: false, coils: { ...w.coils, ...quiet }, tagValues: { ...w.tagValues, ...quiet },
        plcs: deenergisedPlcs(w.plcs), deviceOn: {}, timers: {},
        contactorOn: false, motorOn: false, conveyorOn: false, diverterOn: false,
        pumpOn: false, drainOn: false, lampOn: false,
        forwardContactorOn: false, reverseContactorOn: false, motorDirection: 'stopped', interlockConflict: false,
        plant: { ...w.plant, photoeyeActive: false }, lanes: quietLanes(w.lanes), voltages: {},
        diagnostics: [...w.diagnostics, 'PLC scan interrupted; simulated outputs deenergized'],
        lastError: `PLC ${extra.id} runtime error: ${message}`,
      };
      return { world: paused, snapshot: renderSnapshot(paused), events: [{ tick: w.tick, kind: 'error', detail: `PLC ${extra.id}: ${message}` }] };
    }
    if (!extraPowered && extra.id !== plc?.id) unpoweredExtras.push(extra.id);
  }
  // 5. Publish output image (Q0.0 follows coil Run, only when PLC is powered).
  // 6. Apply outputs to actuators via circuit on the NEXT tick; contactor coil is sampled here.
  const contactor = w.project.components.find(c => c.kind === 'contactor');
  const motor = w.project.components.find(c => c.kind === 'motor');
  const conveyor = w.project.components.find(c => c.kind === 'conveyor');
  const diverter = w.project.components.find(c => c.kind === 'diverter');
  const pump = w.project.components.find(c => c.kind === 'pump');
  const drain = w.project.components.find(c => c.kind === 'drainvalve');
  const lamp = w.project.components.find(c => c.kind === 'lamp');
  const forwardContactor = w.project.components.find(c => c.kind === 'forwardcontactor');
  const reverseContactor = w.project.components.find(c => c.kind === 'reversecontactor');
  const reversibleMotor = w.project.components.find(c => c.kind === 'revmotor');
  // Coil currents come only from the resolved electrical graph, including
  // the opposite contactor's physically wired NC auxiliary. The simplified
  // mechanical interlock also inhibits both when simultaneous energized coils
  // are detected (e.g. user bypasses both NC auxiliaries).
  const forwardCoilOn = !!forwardContactor && circuit.energizedLoads.includes(forwardContactor.id);
  const reverseCoilOn = !!reverseContactor && circuit.energizedLoads.includes(reverseContactor.id);
  const interlockConflict = forwardCoilOn && reverseCoilOn;
  const forwardContactorOn = forwardCoilOn && !interlockConflict;
  const reverseContactorOn = reverseCoilOn && !interlockConflict;
  const forwardMotorPowered = !!reversibleMotor &&
    circuit.energizedLoads.includes(`${reversibleMotor.id}-F`);
  const reverseMotorPowered = !!reversibleMotor &&
    circuit.energizedLoads.includes(`${reversibleMotor.id}-R`);
  const opposingDrives = forwardMotorPowered && reverseMotorPowered;
  const motorDirection: 'stopped' | 'forward' | 'reverse' =
    interlockConflict || opposingDrives ? 'stopped' :
      forwardMotorPowered ? 'forward' : reverseMotorPowered ? 'reverse' : 'stopped';
  // The simple modeled shaft follows only worker-owned scan time and observed
  // 24V motor terminal energization. Reverse rotates in the negative direction.
  const reverseMotorAngleRad = motorDirection === 'stopped' ? w.reverseMotorAngleRad :
    (w.reverseMotorAngleRad + (motorDirection === 'forward' ? 1 : -1) * dtMs * 0.02 +
      2 * Math.PI * 100) % (2 * Math.PI);
  const contactorOn = !!contactor && circuit.energizedLoads.includes(contactor.id);
  // 7. Advance P1 plant: ideal DC motor load, no fake animation or invented motion physics.
  const motorOn = !!motor && circuit.energizedLoads.includes(motor.id);
  // Idealized shaft indicator rotation comes from the authoritative simulation clock,
  // not requestAnimationFrame or visual-only animation. Speed is illustrative, not calibrated.
  const motorAngleRad = motorOn ? (w.motorAngleRad + dtMs * 0.02) % (2 * Math.PI) : w.motorAngleRad;
  // P3 plant movement derives from the actual powered conveyor, never Run/3D animation.
  const conveyorOn = !!conveyor && circuit.energizedLoads.includes(conveyor.id);
  const diverterOn = !!diverter && circuit.energizedLoads.includes(diverter.id);
  // Every conveyor is its own lane: the photoeye and diverter positioned along it, and its own parcel.
  const nextLanes: Record<string, SortingPlant> = {};
  for (const lane of lanesOf(w.project.components)) {
    const belt = circuit.energizedLoads.includes(lane.conveyor.id);
    const gate = lane.diverters.some(d => circuit.energizedLoads.includes(d.id));
    const parts = [lane.conveyor, ...lane.eyes.slice(0, 1), ...lane.diverters.slice(0, 1)];
    const change = stepPlant(w.lanes[lane.conveyor.id] ?? freshPlant(), parts, belt, gate, dtMs);
    nextLanes[lane.conveyor.id] = change.plant;
    for (const detail of change.events) events.push({ tick: w.tick + 1, kind: 'plant', detail });
  }
  const pumpOn = !!pump && circuit.energizedLoads.includes(pump.id);
  const drainOn = !!drain && circuit.energizedLoads.includes(drain.id);
  const lampOn = !!lamp && circuit.energizedLoads.includes(lamp.id);
  // Every contactor, motor and lamp has its own energised state (the legacy booleans mirror the first).
  const deviceOn: Record<string, boolean> = {};
  const motorAngles: Record<string, number> = {};
  for (const c of w.project.components) {
    if (!['contactor', 'motor', 'lamp', 'conveyor', 'diverter', 'pump', 'drainvalve', 'relay', 'stacklight'].includes(c.kind)) continue;
    const on = circuit.energizedLoads.includes(c.id);
    deviceOn[c.id] = on;
    // A stack light has three lamps, each its own load: record every lamp by `<id>-R`, `-Y` and `-G`.
    if (c.kind === 'stacklight') for (const lamp of ['R', 'Y', 'G']) deviceOn[`${c.id}-${lamp}`] = circuit.energizedLoads.includes(`${c.id}-${lamp}`);
    if (c.kind === 'motor') {
      const prev = w.motorAngles[c.id] ?? (c.id === motor?.id ? w.motorAngleRad : 0);
      motorAngles[c.id] = on ? (prev + dtMs * 0.02) % (2 * Math.PI) : prev;
      if (c.id !== motor?.id && on !== (w.deviceOn[c.id] === true))
        events.push({ tick: w.tick + 1, kind: 'motor', detail: `Motor ${c.id} ${on ? 'running' : 'stopped'}` });
    } else if (c.kind === 'contactor' && c.id !== contactor?.id && on !== (w.deviceOn[c.id] === true)) {
      events.push({ tick: w.tick + 1, kind: 'contactor', detail: `Contactor ${c.id} ${on ? 'energised' : 'released'}` });
    }
  }
  // Every on-delay relay times its own coil: elapsed grows while the coil is energised and resets the moment it drops.
  // `deviceOn` for these means "contacts transferred", which the circuit reads on the next scan (the usual one-scan delay).
  const nextTimers: Record<string, number> = {};
  for (const c of w.project.components.filter(x => x.kind === 'timerelay')) {
    const delayMs = paramValue(w.project.params, c.id, paramSpecsOf('timerelay')[0]);
    const coil = circuit.energizedLoads.includes(c.id);
    const elapsed = coil ? Math.min((w.timers[c.id] ?? 0) + dtMs, delayMs) : 0;
    nextTimers[c.id] = elapsed;
    const done = elapsed >= delayMs;
    deviceOn[c.id] = done;
    if (done !== (w.deviceOn[c.id] === true))
      events.push({ tick: w.tick + 1, kind: 'relay', detail: `${c.id}: ${done ? 'delay elapsed, contacts transferred' : 'released'}` });
  }
  // Every tank is its own vessel: the pumps, drain valves and level switches mounted beside it.
  // Every pneumatic cylinder moves from its two solenoid coils, as solved from the wiring.
  const nextCylinders: Record<string, CylinderState> = {};
  for (const c of w.project.components.filter(x => x.kind === 'cylinder')) {
    const fault = engineFault(faultsOf(w.project).find(f => f.target === c.id && f.kind.startsWith('cylinder-'))?.kind);
    const step = stepCylinder(w.cylinders[c.id] ?? freshCylinder(), circuit.energizedLoads.includes(`${c.id}-E`), circuit.energizedLoads.includes(`${c.id}-R`), dtMs, fault);
    nextCylinders[c.id] = step.state;
    for (const detail of step.events) events.push({ tick: w.tick + 1, kind: 'cylinder', detail: `${c.id}: ${detail}` });
  }
  const nextVessels: Record<string, TankProcess> = {};
  for (const vessel of vesselsOf(w.project.components)) {
    const live = (parts: PlacedComponent[]) => parts.some(p => circuit.energizedLoads.includes(p.id));
    const parts = [vessel.tank, ...vessel.pumps.slice(0, 1), ...vessel.valves.slice(0, 1), ...vessel.probes.slice(0, 1)];
    const change = stepTank(w.vessels[vessel.tank.id] ?? freshTank(), parts, live(vessel.pumps), live(vessel.valves), dtMs);
    nextVessels[vessel.tank.id] = change.tank;
    for (const detail of change.events) events.push({ tick: w.tick + 1, kind: 'tank', detail });
  }
  // P4 three-phase process after the worker's actual 24V coil demand scan.
  // Three-phase conductors are not supplied by the 24V electrical solver.
  const connectedThreePhase=threePhaseConnections(w.project.components,w.project.wires.filter(wire=>
    !faultsOf(w.project).some(f=>f.kind==='wire-open'&&f.target===wire.id)));
  const nextThreePhase:WorldState['threePhase']={};
  for(const part of w.project.components.filter(c=>c.kind==='star-delta-drive')){
    const wired=connectedThreePhase[part.id]??null;
    const live=wired&&w.threePhasePower[wired.supplyId]!==false?wired:null;
    const coils={
      main:circuit.energizedLoads.includes(part.id+'-MAIN'),
      star:circuit.energizedLoads.includes(part.id+'-STAR'),
      delta:circuit.energizedLoads.includes(part.id+'-DELTA'),
      reset:circuit.energizedLoads.includes(part.id+'-RESET'),
    };
    const previous=w.threePhase[part.id]??freshStarterPanel();
    const next=stepWiredStarter(previous,live,coils,dtMs);
    nextThreePhase[part.id]=next;
    deviceOn[part.id]=next.mainClosed&&(next.starClosed||next.deltaClosed);
    if(next.motor.mode!==previous.motor.mode||next.motor.tripped!==previous.motor.tripped)
      events.push({tick:w.tick+1,kind:'three-phase',detail:part.id+': '+next.motor.mode+
        (next.motor.tripped?' (thermal trip)':'')});
    if(next.conflict&&!previous.conflict)events.push({tick:w.tick+1,kind:'interlock',
      detail:part.id+': STAR/DELTA control conflict; motor inhibited'});
  }
  // P3: the independent equipment world is stepped using the electrical
  // solver's already-committed actuator image. Its new geometric sensor values
  // may only affect PLC inputs at the following 50ms scan.
  const p3=stepProjectPlant(w.plantWorld,w.project,circuit.energizedLoads,dtMs);
  for(const event of p3.events)events.push({tick:w.tick+1,kind:'plant',
    detail:event.source+': '+event.detail});
  // 8. Photoeye state from geometry is sampled by the circuit on NEXT scan.
  // 9. Collect ordered events for observation/replay.
  if (contactorOn !== w.contactorOn) events.push({ tick: w.tick + 1, kind: 'contactor', detail: contactorOn ? 'Contactor energised' : 'Contactor released' });
  if (motorOn !== w.motorOn) events.push({ tick: w.tick + 1, kind: 'motor', detail: motorOn ? 'Motor running' : 'Motor stopped' });
  if (motorDirection !== w.motorDirection) events.push({ tick: w.tick + 1,
    kind: 'direction', detail: `Reversible motor ${motorDirection}` });
  if (interlockConflict && !w.interlockConflict) events.push({ tick: w.tick + 1,
    kind: 'interlock', detail: 'Simultaneous contactor-coil demand: modeled mechanical interlock prevents both from closing' });
  if (opposingDrives) events.push({ tick: w.tick + 1,
    kind: 'wiring', detail: 'Both forward and reverse motor feeds energized; reversible motor inhibited' });
  const nextTick = w.tick + 1;
  const scanHit = w.breakpointScan === nextTick ? `Paused at scan ${nextTick}` : null;
  const edgeHit = w.breakpointTag && tagEdge(w.tagValues[w.breakpointTag.tag],
    tagValues[w.breakpointTag.tag], w.breakpointTag.edge)
    ? `Paused at scan ${nextTick}: ${w.breakpointTag.tag} ${w.breakpointTag.edge} edge` : null;
  const instructionHit = instructionBreakpointHit(w.breakpointInstruction,
    w.project.language === 'fbd' ? fbdReadings(w.fbdSteps) : ladderReadings(w.ladderSteps),
    w.project.language === 'fbd' ? fbdReadings(fbdResult?.steps ?? []) : ladderReadings(ladderResult?.steps ?? []),
    nextTick);
  const breakpointHit = scanHit ?? edgeHit ?? instructionHit;
  if (breakpointHit) events.push({ tick: nextTick, kind: 'breakpoint', detail: breakpointHit });
  // Supervisory alarms report commanded-vs-observed symptoms only; they never name a cause.
  const alarmUpdate = updateAlarms({
    scan: nextTick, monitored: powered && !!motor, runCommanded: coils.Run === true,
    motorEnergized: motorOn, alarms: w.alarms, watch: w.alarmWatch,
  });
  for (const a of alarmUpdate.raised) events.push({ tick: nextTick, kind: 'alarm',
    detail: `Alarm (${a.severity}): ${a.message}` });
  for (const a of alarmUpdate.cleared) events.push({ tick: nextTick, kind: 'alarm',
    detail: `Alarm cleared: ${a.code}` });
  const trace = buildScanTrace({
    scan: nextTick, simulatedMs: nextTick * dtMs, language: w.project.language ?? 'ladder',
    start: inputs.Start, stopOK: inputs.StopOK, run: coils.Run === true,
    plcPowered: powered, contactorOn, motorOn, ladderSteps: ladderResult?.steps ?? [],
    fbdSteps: fbdResult?.steps ?? [],
    breakpoint: breakpointHit,
  });
  w = {
    ...w, tick: nextTick, coils, scanTrace: appendScanTrace(w.scanTrace, trace),
    ladderMemory: ladderResult?.memory ?? {},
    ladderNumeric: ladderResult?.numericValues ?? {},
    ladderSteps: [...(ladderResult?.steps ?? [])],
    fbdMemory: fbdResult?.memory ?? {}, fbdSteps: [...(fbdResult?.steps ?? [])],
    stMemory: stResult?.memory ?? {},
    tagValues, powered, inputs, contactorOn, motorOn, motorAngleRad,
    plcs: nextPlcs, deviceOn, motorAngles, threePhase: nextThreePhase,
    alarms: alarmUpdate.alarms, alarmWatch: alarmUpdate.watch,
    forwardContactorOn, reverseContactorOn, motorDirection,
    reverseMotorAngleRad, interlockConflict,
    conveyorOn, diverterOn, lanes: nextLanes, vessels: nextVessels, cylinders: nextCylinders, timers: nextTimers,
    plantWorld:p3.runtime,
    pumpOn, drainOn, lampOn,
    voltages: circuit.voltage,
    meter: measureDC24(circuit.voltage,circuit.diagnostics,w.meter.positive,w.meter.negative,circuit.sameSupply),
    diagnostics: [...circuit.diagnostics,
      ...(w.project.components.some(c => c.kind === 'breaker' && w.tripped[c.id] === true) ? ['Branch breaker open: reset only after removing downstream short'] : []),
      ...(w.project.components.some(c => c.kind === 'overload' && w.tripped[c.id] === true) ? ['Motor overload auxiliary 95-96 open (manual test trip)'] : []),
      ...(interlockConflict ? ['Reversing contactors demand simultaneous engagement: mechanical interlock active'] : []),
      ...(opposingDrives ? ['Both direction terminals energized: reversible motor inhibited'] : []),
      ...Object.entries(nextThreePhase).flatMap(([id,state])=>state.motor.diagnostics.map(msg=>id+': '+msg)),
      ...(!powered && plc ? ['PLC is not powered (wire L+ and M to the 24V supply)'] : []),
      ...unpoweredExtras.map(id => `PLC ${id} is not powered (wire L+ and M to a 24V supply)`)],
    breakpointHit,
    running: change.forceStep || !!breakpointHit ? false : w.running,
  };
  // 10. Immutable render data: visuals never drive the simulation.
  w = syncLegacy(w);
  return { world: w, snapshot: renderSnapshot(w), events };
}
