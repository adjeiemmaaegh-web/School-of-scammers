/** P0/P1 authoritative deterministic sandbox. Pure simulation: no DOM, timers or wall clock. */
import { COMPONENTS, terminalExists, type ComponentKind } from '../components/registry';
import { solveDiscrete24V, type Device } from '../engineering/electrical';
import { executeLadder, type LadderDocument, type LadderResult } from '../engineering/ladder';
import { executeStructuredText, type STResult, type STValue } from '../engineering/structured-text';
import { compileSandboxST, DEFAULT_ST_SOURCE, validateSandboxProgram } from '../program/p2-contract';
import { appendScanTrace, buildScanTrace, tagEdge, validateTagBreakpoint } from '../program/scan-trace';
import { feedPlant, freshPlant, stepPlant } from '../plant/sorting-conveyor';
import { freshTank, stepTank } from '../plant/tank-process';
import { emptyMeter, measureDC24 } from '../electrical/panel-meter';
export { validateSandboxProgram } from '../program/p2-contract';
import type { Command, PlacedComponent, ProjectFile, RenderSnapshot, SimEvent, WorldState } from './signals';

export const SCAN_MS = 50;
export const blankProgram = (): LadderDocument => ({
  id: 'sandbox-program', version: '1.0', rungs: [
    { id: 'rung-1', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' },
  ],
});
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
export const newProject = (): ProjectFile => ({
  formatVersion: 1, components: [], wires: [], program: blankProgram(),
  language: 'ladder', stSource: DEFAULT_ST_SOURCE,
});
export function createWorld(project: ProjectFile = newProject()): WorldState {
  return {
    project, running: false, tick: 0, coils: {}, ladderMemory: {}, ladderNumeric: {},
    stCompiled: project.language === 'st' ? compileSandboxST(project.stSource ?? '') : null,
    stMemory: {},
    tagValues: { Start: false, StopOK: false, Photoeye: false, TankHigh: false, Run: false, Sort: false, Fill: false, Drain: false }, ladderSteps: [],
    breakpointScan: null, breakpointHit: null, breakpointTag: null, scanTrace: [],
    contactorOn: false, motorOn: false, motorAngleRad: 0,
    plant: freshPlant(), conveyorOn: false, diverterOn: false,
    tank: freshTank(), pumpOn: false, drainOn: false,
    breakerTripped: false, overloadTripped: false, lampOn: false,
    meter: emptyMeter(),
    powered: false, inputs: { Start: false, StopOK: false, Photoeye: false, TankHigh: false },
    voltages: {}, diagnostics: [], lastError: null,
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
      p.components.length > 40 || p.wires.length > 150) throw new Error('Unsupported project format or size');
  const components: PlacedComponent[] = [];
  const ids = new Set<string>();
  for (const entry of p.components) {
    if (!entry || !validId(entry.id) || ids.has(entry.id) || !Object.hasOwn(COMPONENTS, entry.kind) || !validPos(entry)) {
      throw new Error('Invalid component in project');
    }
    ids.add(entry.id);
    components.push({ id: entry.id, kind: entry.kind as ComponentKind, x: entry.x, y: entry.y, pressed: entry.pressed === true });
  }
  // One of each protective branch device per educational circuit: state is
  // explicitly maintained per role, not silently shared among duplicates.
  for (const kind of ['breaker', 'overload'] as const)
    if (components.filter(c => c.kind === kind).length > 1)
      throw new Error(`Only one ${kind} protection device is supported`);
  const wireIds = new Set<string>();
  for (const wire of p.wires) {
    if (!wire || !validId(wire.id) || wireIds.has(wire.id) || typeof wire.from !== 'string' ||
        typeof wire.to !== 'string' || wire.from === wire.to ||
        !terminalExists(wire.from, components) || !terminalExists(wire.to, components)) throw new Error('Invalid wire in project');
    wireIds.add(wire.id);
  }
  const programErrors = validateSandboxProgram(p.program);
  if (programErrors.length) throw new Error(programErrors.join('; '));
  if (p.language !== undefined && p.language !== 'ladder' && p.language !== 'st')
    throw new Error('Unknown PLC programming language');
  if (p.stSource !== undefined && typeof p.stSource !== 'string')
    throw new Error('Invalid Structured Text source');
  if (p.language === 'st' || p.stSource !== undefined) {
    if (p.language === 'st' && !p.stSource) throw new Error('ST mode requires a compiled source');
    if (p.stSource) compileSandboxST(p.stSource);
  }
  return {
    formatVersion: 1, components,
    wires: p.wires.map(w => ({ id: w.id, from: w.from, to: w.to })), program: p.program,
    ...(p.language !== undefined ? { language: p.language } : {}),
    ...(p.stSource !== undefined ? { stSource: p.stSource } : {}),
  };
}
const setError = (world: WorldState, message: string): WorldState => ({ ...world, lastError: message });
const canEdit = (world: WorldState) => !world.running;
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
        if (world.project.language === 'st') compileSandboxST(world.project.stSource ?? '');
        else {
          const issues = validateSandboxProgram(world.project.program);
          if (issues.length) throw new Error(issues.join('; '));
        }
        world = { ...world, running: true, breakpointHit: null };
      } catch (error) { world = setError(world, error instanceof Error ? error.message : 'Program validation failed'); }
    } else if (cmd.k === 'pause') world = { ...world, running: false };
    else if (cmd.k === 'step') { world = { ...world, running: false }; forceStep = true; }
    else if (cmd.k === 'reset') world = { ...createWorld(world.project), breakpointScan: world.breakpointScan, breakpointTag: world.breakpointTag };
    else if (cmd.k === 'clear') world = createWorld();
    else if (cmd.k === 'feedParcel') {
      if (!world.project.components.some(c => c.kind === 'conveyor'))
        world = setError(world, 'Place a conveyor before feeding a parcel');
      else if (cmd.kind !== 'plain' && cmd.kind !== 'marked')
        world = setError(world, 'Unknown parcel type');
      else {
        const fed = feedPlant(world.plant, cmd.kind);
        const succeeded = fed.plant !== world.plant;
        world = { ...world, plant: fed.plant };
        if (!succeeded) world = setError(world, fed.events[0] ?? 'Unable to feed parcel');
        else for (const detail of fed.events) commandEvents.push({ tick: world.tick, kind: 'plant', detail });
      }
    } else if (cmd.k === 'operateProtection') {
      const component = world.project.components.find(c => c.id === cmd.id);
      if (!component || !['breaker', 'overload'].includes(component.kind) ||
          (cmd.action !== 'trip' && cmd.action !== 'reset'))
        world = setError(world, 'Invalid breaker/overload control');
      else {
        world = component.kind === 'breaker'
          ? { ...world, breakerTripped: cmd.action === 'trip' }
          : { ...world, overloadTripped: cmd.action === 'trip' };
        commandEvents.push({ tick: world.tick, kind: 'protection',
          detail: `${component.kind} ${cmd.action === 'trip' ? 'opened (manual training trip)' : 'reset by learner'}` });
      }
    } else if (cmd.k === 'setMeterProbe') {
      if ((cmd.lead !== 'positive' && cmd.lead !== 'negative') ||
          (cmd.terminal !== null && (!terminalExists(cmd.terminal, world.project.components) ||
            typeof cmd.terminal !== 'string')))
        world = setError(world, 'Meter probe must attach to an existing terminal or be disconnected');
      else world = { ...world, meter: {
        ...world.meter, [cmd.lead]: cmd.terminal, volts: null, status: 'select',
      } };
    } else if (cmd.k === 'operate') {
      if (!world.project.components.some(c => c.id === cmd.id && (c.kind === 'start' || c.kind === 'stop'))) world = setError(world, 'Only pushbuttons can be operated');
      else world = { ...world, project: { ...world.project, components: world.project.components.map(c => c.id === cmd.id ? { ...c, pressed: cmd.pressed } : c) } };
    } else if (!canEdit(world)) world = setError(world, 'Pause simulation before modifying the project');
    else if (cmd.k === 'place') {
      if (!validId(cmd.id) || !Object.hasOwn(COMPONENTS, cmd.kind) || !validPos(cmd.at) ||
          world.project.components.some(c => c.id === cmd.id) || world.project.components.length >= 40) world = setError(world, 'Invalid component placement');
      else if (['plc', 'supply', 'conveyor', 'photoeye', 'diverter', 'tank', 'pump', 'levelprobe', 'drainvalve', 'breaker', 'overload'].includes(cmd.kind) &&
        world.project.components.some(c => c.kind === cmd.kind))
        world = setError(world, 'This educational workbench supports one of each station component');
      else world = { ...world, project: { ...world.project, components: [...world.project.components, { id: cmd.id, kind: cmd.kind, x: cmd.at.x, y: cmd.at.y, pressed: false }] } };
    } else if (cmd.k === 'move') {
      if (!validPos(cmd.to) || !world.project.components.some(c => c.id === cmd.id)) world = setError(world, 'Invalid movement');
      else world = { ...world, project: { ...world.project, components: world.project.components.map(c => c.id === cmd.id ? { ...c, ...cmd.to } : c) } };
    } else if (cmd.k === 'wire') {
      if (!validId(cmd.id) || world.project.wires.some(w => w.id === cmd.id || (w.from === cmd.from && w.to === cmd.to) || (w.from === cmd.to && w.to === cmd.from)) ||
          cmd.from === cmd.to || !terminalExists(cmd.from, world.project.components) ||
          !terminalExists(cmd.to, world.project.components) || world.project.wires.length >= 150)
        world = setError(world, 'Invalid or duplicate terminal connection');
      else world = { ...world, project: { ...world.project, wires: [...world.project.wires, { id: cmd.id, from: cmd.from, to: cmd.to }] } };
    } else if (cmd.k === 'unwire') {
      world = { ...world, project: { ...world.project, wires: world.project.wires.filter(w => w.id !== cmd.id) } };
    } else if (cmd.k === 'loadProgram') {
      const errors = validateSandboxProgram(cmd.program);
      if (errors.length) world = setError(world, errors.join('; '));
      else world = { ...createWorld({ ...world.project, program: cmd.program, language: 'ladder' }) };
    } else if (cmd.k === 'loadST') {
      try {
        compileSandboxST(cmd.source);
        world = createWorld({ ...world.project, language: 'st', stSource: cmd.source });
      } catch (error) { world = setError(world, error instanceof Error ? error.message : 'Invalid Structured Text'); }
    } else if (cmd.k === 'activateLanguage') {
      try {
        if (cmd.language === 'st') compileSandboxST(world.project.stSource ?? DEFAULT_ST_SOURCE);
        if (cmd.language === 'ladder') {
          const errors = validateSandboxProgram(world.project.program);
          if (errors.length) throw new Error(errors.join('; '));
        }
        world = createWorld({ ...world.project, language: cmd.language,
          stSource: world.project.stSource ?? DEFAULT_ST_SOURCE });
      } catch (error) { world = setError(world, error instanceof Error ? error.message : 'Cannot activate language'); }
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
    } else if (cmd.k === 'loadProject') {
      try { world = createWorld(validateProject(cmd.project)); } catch (e) { world = setError(world, e instanceof Error ? e.message : 'Invalid project'); }
    }
  }
  return { world, forceStep, events: commandEvents };
}
function buildCircuit(world: WorldState): Device[] {
  const devices: Device[] = [];
  for (const c of world.project.components) {
    if (c.kind === 'supply') devices.push({ id: c.id, kind: 'supply', positive: terminal(c.id, 'P24'), negative: terminal(c.id, 'M0'), volts: 24 });
    if (c.kind === 'breaker') devices.push({
      id: c.id, kind: 'switch', a: terminal(c.id,'IN'), b: terminal(c.id,'OUT'),
      closed: !world.breakerTripped,
    });
    if (c.kind === 'overload') devices.push({
      id: c.id, kind: 'switch', a: terminal(c.id,'95'), b: terminal(c.id,'96'),
      closed: !world.overloadTripped,
    });
    if (c.kind === 'start' || c.kind === 'stop') devices.push({
      id: c.id, kind: 'switch', a: terminal(c.id, 'A'), b: terminal(c.id, 'B'),
      closed: c.kind === 'start' ? c.pressed : !c.pressed,
    });
    if (c.kind === 'plc') {
      devices.push({ id: `${c.id}-Q`, kind: 'switch',
        a: terminal(c.id, 'L+'), b: terminal(c.id, 'Q0.0'), closed: world.coils.Run === true });
      devices.push({ id: `${c.id}-Q1`, kind: 'switch',
        a: terminal(c.id, 'L+'), b: terminal(c.id, 'Q0.1'), closed: world.coils.Sort === true });
      devices.push({ id: `${c.id}-Q2`, kind: 'switch',
        a: terminal(c.id, 'L+'), b: terminal(c.id, 'Q0.2'), closed: world.coils.Fill === true });
      devices.push({ id: `${c.id}-Q3`, kind: 'switch',
        a: terminal(c.id, 'L+'), b: terminal(c.id, 'Q0.3'), closed: world.coils.Drain === true });
    }
    if (c.kind === 'photoeye') devices.push({ id: `${c.id}-OUT`, kind: 'switch',
      a: terminal(c.id, 'L+'), b: terminal(c.id, 'OUT'), closed: world.plant.photoeyeActive });
    if (c.kind === 'levelprobe') devices.push({ id: `${c.id}-OUT`, kind: 'switch',
      a: terminal(c.id, 'L+'), b: terminal(c.id, 'OUT'), closed: world.tank.highLevel });
    if (c.kind === 'contactor') {
      devices.push({ id: c.id, kind: 'load', positive: terminal(c.id, 'A1'), negative: terminal(c.id, 'A2'), nominalVolts: 24 });
      devices.push({ id: `${c.id}-NO`, kind: 'switch', a: terminal(c.id, '13'), b: terminal(c.id, '14'), closed: world.contactorOn });
    }
    if (c.kind === 'motor' || c.kind === 'conveyor' || c.kind === 'pump' || c.kind === 'lamp') devices.push({ id: c.id, kind: 'load',
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
      Photoeye: world.inputs.Photoeye, TankHigh: world.inputs.TankHigh,
      Run: world.coils.Run === true, Sort: world.coils.Sort === true,
      Fill: world.coils.Fill === true, Drain: world.coils.Drain === true,
      'Q0.0': world.coils.Run === true, 'Q0.1': world.coils.Sort === true,
      'Q0.2': world.coils.Fill === true, 'Q0.3': world.coils.Drain === true,
      PlcPowered: world.powered },
    voltages: { ...world.voltages }, contactorOn: world.contactorOn, motorOn: world.motorOn, motorAngleRad: world.motorAngleRad,
    conveyorOn: world.conveyorOn, diverterOn: world.diverterOn,
    plant: { ...world.plant, parcel: world.plant.parcel ? { ...world.plant.parcel } : null },
    tank: { ...world.tank }, pumpOn: world.pumpOn, drainOn: world.drainOn,
    breakerTripped: world.breakerTripped, overloadTripped: world.overloadTripped,
    lampOn: world.lampOn, meter: { ...world.meter },
    diagnostics: [...world.diagnostics], lastError: world.lastError,
    language: world.project.language ?? 'ladder',
    tagValues: { ...world.tagValues }, ladderSteps: [...world.ladderSteps],
    ladderMemory: { ...world.ladderMemory },
    breakpointScan: world.breakpointScan, breakpointHit: world.breakpointHit,
    breakpointTag: world.breakpointTag, scanTrace: world.scanTrace.map(entry => ({
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
      const pausedCircuit = solveDiscrete24V({
        devices: buildCircuit(w),
        wires: w.project.wires.map(wire => [wire.from, wire.to] as const),
      });
      w = { ...w, voltages: pausedCircuit.voltage,
        meter: measureDC24(pausedCircuit.voltage, pausedCircuit.diagnostics,
          w.meter.positive, w.meter.negative) };
    }
    return { world: w, snapshot: renderSnapshot(w), events };
  }
  // 2. Solve the 24V netlist using last scan's actuator/output state.
  const wires = w.project.wires.map(wire => [wire.from, wire.to] as const);
  let circuit = solveDiscrete24V({ devices: buildCircuit(w), wires });
  // An ideal direct short downstream of the CLOSED breaker trips its latched
  // protective contact. An unfused upstream short does NOT get false protection.
  const shortedAtStart = circuit.diagnostics.some(d => d.startsWith('Supply short'));
  const breaker = w.project.components.find(c => c.kind === 'breaker');
  if (shortedAtStart && breaker && !w.breakerTripped) {
    const opened = buildCircuit(w).map(d =>
      d.id === breaker.id && d.kind === 'switch' ? { ...d, closed: false } : d);
    const isolated = solveDiscrete24V({ devices: opened, wires });
    if (!isolated.diagnostics.some(d => d.startsWith('Supply short'))) {
      w = { ...w, breakerTripped: true };
      circuit = isolated;
      events.push({ tick: w.tick + 1, kind: 'protection',
        detail: 'Branch breaker tripped: downstream direct short isolated' });
    }
  }
  const shorted = circuit.diagnostics.some(d => d.startsWith('Supply short'));
  const plc = w.project.components.find(c => c.kind === 'plc');
  const powered = !!plc && !shorted && circuit.voltage[terminal(plc.id, 'L+')] === 24 &&
    circuit.voltage[terminal(plc.id, 'M')] === 0;
  // 3. Sample actual wired 24V input image, including powered mark photoeye.
  // The photoeye's optical state was determined by the PRIOR plant scan.
  const eye = w.project.components.find(c => c.kind === 'photoeye');
  const eyePowered = !!eye && !shorted && circuit.voltage[terminal(eye.id, 'L+')] === 24 &&
    circuit.voltage[terminal(eye.id, 'M')] === 0;
  const probe = w.project.components.find(c => c.kind === 'levelprobe');
  const probePowered = !!probe && !shorted && circuit.voltage[terminal(probe.id, 'L+')] === 24 &&
    circuit.voltage[terminal(probe.id, 'M')] === 0;
  const inputs = {
    Start: powered && circuit.voltage[terminal(plc!.id, 'I0.0')] === 24,
    StopOK: powered && circuit.voltage[terminal(plc!.id, 'I0.1')] === 24,
    Photoeye: powered && eyePowered && circuit.voltage[terminal(plc!.id, 'I0.2')] === 24,
    TankHigh: powered && probePowered && circuit.voltage[terminal(plc!.id, 'I0.3')] === 24,
  };
  // 4. Execute the learner's exact document in the salvaged bounded LD or ST engine.
  let ladderResult: LadderResult | null = null;
  let stResult: STResult | null = null;
  try {
    if (powered) {
      if (w.project.language === 'st') {
        const compiled = w.stCompiled ?? compileSandboxST(w.project.stSource ?? '');
        stResult = executeStructuredText(compiled, inputs, w.stMemory);
        const run = Object.entries(stResult.outputs).find(([key]) => key.toLowerCase() === 'run')?.[1];
        if (typeof run !== 'boolean') throw new TypeError('ST Run output must be BOOL');
      } else ladderResult = executeLadder(w.project.program, inputs, w.coils, w.ladderMemory, dtMs, w.ladderNumeric);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PLC runtime failed';
    // Fail closed in the *simulated* plant. Do not publish stale energized outputs
    // after an arithmetic fault (overflow, division by zero, invalid typed write).
    const paused: WorldState = {
      ...w, running: false, coils: { ...w.coils, Run: false, Sort: false, Fill: false, Drain: false },
      tagValues: { ...w.tagValues, Run: false, Sort: false, Fill: false, Drain: false },
      contactorOn: false, motorOn: false, conveyorOn: false, diverterOn: false,
      pumpOn: false, drainOn: false, lampOn: false,
      plant: { ...w.plant, photoeyeActive: false }, voltages: {},
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
  if ((stSort !== undefined && typeof stSort !== 'boolean') ||
      (stFill !== undefined && typeof stFill !== 'boolean') ||
      (stDrain !== undefined && typeof stDrain !== 'boolean')) {
    const paused: WorldState = {
      ...w, running: false, coils: { ...w.coils, Run: false, Sort: false },
      tagValues: { ...w.tagValues, Run: false, Sort: false },
      motorOn: false, conveyorOn: false, diverterOn: false, contactorOn: false,
      pumpOn: false, drainOn: false, lampOn: false,
      lastError: 'PLC Sort/Fill/Drain outputs must be BOOL',
    };
    return { world: paused, snapshot: renderSnapshot(paused),
      events: [{ tick: w.tick, kind: 'error', detail: 'PLC Sort/Fill/Drain outputs must be BOOL' }] };
  }
  // Structured Text is case-insensitive; the physical Q0.0 binding is always canonical "Run".
  const coils: Record<string, boolean> = stResult
    ? { ...Object.fromEntries(Object.entries(stResult.outputs).filter(([, value]) => typeof value === 'boolean')),
        Run: stRun === true, Sort: stSort === true, Fill: stFill === true, Drain: stDrain === true }
    : ladderResult?.outputs ?? {};
  const tagValues: Record<string, STValue> = {
    ...inputs, ...(stResult?.signals ?? {}), ...(ladderResult?.numericValues ?? {}), ...coils,
    Run: coils.Run === true, Sort: coils.Sort === true,
    Fill: coils.Fill === true, Drain: coils.Drain === true, Unused: false,
  };
  // 5. Publish output image (Q0.0 follows coil Run, only when PLC is powered).
  // 6. Apply outputs to actuators via circuit on the NEXT tick; contactor coil is sampled here.
  const contactor = w.project.components.find(c => c.kind === 'contactor');
  const motor = w.project.components.find(c => c.kind === 'motor');
  const conveyor = w.project.components.find(c => c.kind === 'conveyor');
  const diverter = w.project.components.find(c => c.kind === 'diverter');
  const pump = w.project.components.find(c => c.kind === 'pump');
  const drain = w.project.components.find(c => c.kind === 'drainvalve');
  const lamp = w.project.components.find(c => c.kind === 'lamp');
  const contactorOn = !!contactor && circuit.energizedLoads.includes(contactor.id);
  // 7. Advance P1 plant: ideal DC motor load, no fake animation or invented motion physics.
  const motorOn = !!motor && circuit.energizedLoads.includes(motor.id);
  // Idealized shaft indicator rotation comes from the authoritative simulation clock,
  // not requestAnimationFrame or visual-only animation. Speed is illustrative, not calibrated.
  const motorAngleRad = motorOn ? (w.motorAngleRad + dtMs * 0.02) % (2 * Math.PI) : w.motorAngleRad;
  // P3 plant movement derives from the actual powered conveyor, never Run/3D animation.
  const conveyorOn = !!conveyor && circuit.energizedLoads.includes(conveyor.id);
  const diverterOn = !!diverter && circuit.energizedLoads.includes(diverter.id);
  const nextPlant = stepPlant(w.plant, w.project.components, conveyorOn, diverterOn, dtMs);
  for (const detail of nextPlant.events) events.push({ tick: w.tick + 1, kind: 'plant', detail });
  const pumpOn = !!pump && circuit.energizedLoads.includes(pump.id);
  const drainOn = !!drain && circuit.energizedLoads.includes(drain.id);
  const lampOn = !!lamp && circuit.energizedLoads.includes(lamp.id);
  const nextTank = stepTank(w.tank, w.project.components, pumpOn, drainOn, dtMs);
  for (const detail of nextTank.events) events.push({ tick: w.tick + 1, kind: 'tank', detail });
  // 8. Photoeye state from geometry is sampled by the circuit on NEXT scan.
  // 9. Collect ordered events for observation/replay.
  if (contactorOn !== w.contactorOn) events.push({ tick: w.tick + 1, kind: 'contactor', detail: contactorOn ? 'Contactor energised' : 'Contactor released' });
  if (motorOn !== w.motorOn) events.push({ tick: w.tick + 1, kind: 'motor', detail: motorOn ? 'Motor running' : 'Motor stopped' });
  const nextTick = w.tick + 1;
  const scanHit = w.breakpointScan === nextTick ? `Paused at scan ${nextTick}` : null;
  const edgeHit = w.breakpointTag && tagEdge(w.tagValues[w.breakpointTag.tag],
    tagValues[w.breakpointTag.tag], w.breakpointTag.edge)
    ? `Paused at scan ${nextTick}: ${w.breakpointTag.tag} ${w.breakpointTag.edge} edge` : null;
  const breakpointHit = scanHit ?? edgeHit;
  if (breakpointHit) events.push({ tick: nextTick, kind: 'breakpoint', detail: breakpointHit });
  const trace = buildScanTrace({
    scan: nextTick, simulatedMs: nextTick * dtMs, language: w.project.language ?? 'ladder',
    start: inputs.Start, stopOK: inputs.StopOK, run: coils.Run === true,
    plcPowered: powered, contactorOn, motorOn, ladderSteps: ladderResult?.steps ?? [],
    breakpoint: breakpointHit,
  });
  w = {
    ...w, tick: nextTick, coils, scanTrace: appendScanTrace(w.scanTrace, trace),
    ladderMemory: ladderResult?.memory ?? {},
    ladderNumeric: ladderResult?.numericValues ?? {},
    ladderSteps: [...(ladderResult?.steps ?? [])],
    stMemory: stResult?.memory ?? {},
    tagValues, powered, inputs, contactorOn, motorOn, motorAngleRad,
    conveyorOn, diverterOn, plant: nextPlant.plant,
    pumpOn, drainOn, tank: nextTank.tank, lampOn,
    voltages: circuit.voltage,
    meter: measureDC24(circuit.voltage,circuit.diagnostics,w.meter.positive,w.meter.negative),
    diagnostics: [...circuit.diagnostics,
      ...(w.breakerTripped ? ['Branch breaker open: reset only after removing downstream short'] : []),
      ...(w.overloadTripped ? ['Motor overload auxiliary 95-96 open (manual test trip)'] : []),
      ...(!powered && plc ? ['PLC is not powered (wire L+ and M to the 24V supply)'] : [])],
    breakpointHit,
    running: change.forceStep || !!breakpointHit ? false : w.running,
  };
  // 10. Immutable render data: visuals never drive the simulation.
  return { world: w, snapshot: renderSnapshot(w), events };
}
