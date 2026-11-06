/** P0/P1 authoritative deterministic sandbox. Pure simulation: no DOM, timers or wall clock. */
import { COMPONENTS, terminalExists, type ComponentKind } from '../components/registry';
import { solveDiscrete24V, type Device } from '../engineering/electrical';
import { executeLadder, type LadderDocument, type LadderResult } from '../engineering/ladder';
import { executeStructuredText, type STResult, type STValue } from '../engineering/structured-text';
import { compileSandboxST, DEFAULT_ST_SOURCE, validateSandboxProgram } from '../program/p2-contract';
import { appendScanTrace, buildScanTrace, tagEdge, validateTagBreakpoint } from '../program/scan-trace';
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
export const newProject = (): ProjectFile => ({
  formatVersion: 1, components: [], wires: [], program: blankProgram(),
  language: 'ladder', stSource: DEFAULT_ST_SOURCE,
});
export function createWorld(project: ProjectFile = newProject()): WorldState {
  return {
    project, running: false, tick: 0, coils: {}, ladderMemory: {}, ladderNumeric: {},
    stCompiled: project.language === 'st' ? compileSandboxST(project.stSource ?? '') : null,
    stMemory: {},
    tagValues: { Start: false, StopOK: false, Run: false }, ladderSteps: [],
    breakpointScan: null, breakpointHit: null, breakpointTag: null, scanTrace: [],
    contactorOn: false, motorOn: false, motorAngleRad: 0,
    powered: false, inputs: { Start: false, StopOK: false },
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
function applyCommands(initial: WorldState, commands: readonly Command[]): { world: WorldState; forceStep: boolean } {
  let world = initial;
  let forceStep = false;
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
    else if (cmd.k === 'operate') {
      if (!world.project.components.some(c => c.id === cmd.id && (c.kind === 'start' || c.kind === 'stop'))) world = setError(world, 'Only pushbuttons can be operated');
      else world = { ...world, project: { ...world.project, components: world.project.components.map(c => c.id === cmd.id ? { ...c, pressed: cmd.pressed } : c) } };
    } else if (!canEdit(world)) world = setError(world, 'Pause simulation before modifying the project');
    else if (cmd.k === 'place') {
      if (!validId(cmd.id) || !Object.hasOwn(COMPONENTS, cmd.kind) || !validPos(cmd.at) ||
          world.project.components.some(c => c.id === cmd.id) || world.project.components.length >= 40) world = setError(world, 'Invalid component placement');
      else if ((cmd.kind === 'plc' || cmd.kind === 'supply') && world.project.components.some(c => c.kind === cmd.kind)) world = setError(world, 'P1 supports one PLC and one supply');
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
  return { world, forceStep };
}
function buildCircuit(world: WorldState): Device[] {
  const devices: Device[] = [];
  for (const c of world.project.components) {
    if (c.kind === 'supply') devices.push({ id: c.id, kind: 'supply', positive: terminal(c.id, 'P24'), negative: terminal(c.id, 'M0'), volts: 24 });
    if (c.kind === 'start' || c.kind === 'stop') devices.push({
      id: c.id, kind: 'switch', a: terminal(c.id, 'A'), b: terminal(c.id, 'B'),
      closed: c.kind === 'start' ? c.pressed : !c.pressed,
    });
    if (c.kind === 'plc') devices.push({ id: `${c.id}-Q`, kind: 'switch',
      a: terminal(c.id, 'L+'), b: terminal(c.id, 'Q0.0'), closed: world.coils.Run === true });
    if (c.kind === 'contactor') {
      devices.push({ id: c.id, kind: 'load', positive: terminal(c.id, 'A1'), negative: terminal(c.id, 'A2'), nominalVolts: 24 });
      devices.push({ id: `${c.id}-NO`, kind: 'switch', a: terminal(c.id, '13'), b: terminal(c.id, '14'), closed: world.contactorOn });
    }
    if (c.kind === 'motor') devices.push({ id: c.id, kind: 'load', positive: terminal(c.id, 'L+'), negative: terminal(c.id, 'M-'), nominalVolts: 24 });
  }
  return devices;
}
export function renderSnapshot(world: WorldState): RenderSnapshot {
  return { tick: world.tick, running: world.running, components: world.project.components.map(c => ({ ...c })),
    wires: world.project.wires.map(w => ({ ...w })),
    io: { Start: world.inputs.Start, StopOK: world.inputs.StopOK, Run: world.coils.Run === true,
      'Q0.0': world.coils.Run === true, PlcPowered: world.powered },
    voltages: { ...world.voltages }, contactorOn: world.contactorOn, motorOn: world.motorOn, motorAngleRad: world.motorAngleRad,
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
  const events: SimEvent[] = [];
  if (!w.running && !change.forceStep) return { world: w, snapshot: renderSnapshot(w), events };
  // 2. Solve the 24V netlist using last scan's actuator/output state.
  const circuit = solveDiscrete24V({ devices: buildCircuit(w), wires: w.project.wires.map(wire => [wire.from, wire.to] as const) });
  const shorted = circuit.diagnostics.some(d => d.startsWith('Supply short'));
  const plc = w.project.components.find(c => c.kind === 'plc');
  const powered = !!plc && !shorted && circuit.voltage[terminal(plc.id, 'L+')] === 24 &&
    circuit.voltage[terminal(plc.id, 'M')] === 0;
  // 3. Snapshot the PLC inputs from actually wired terminals (not buttons directly).
  const inputs = {
    Start: powered && circuit.voltage[terminal(plc!.id, 'I0.0')] === 24,
    StopOK: powered && circuit.voltage[terminal(plc!.id, 'I0.1')] === 24,
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
      ...w, running: false, coils: { ...w.coils, Run: false },
      tagValues: { ...w.tagValues, Run: false },
      contactorOn: false, motorOn: false, voltages: {},
      diagnostics: [...w.diagnostics, 'PLC scan interrupted; simulated outputs deenergized'],
      lastError: `PLC runtime error: ${message}`,
    };
    return { world: paused, snapshot: renderSnapshot(paused),
      events: [{ tick: w.tick, kind: 'error', detail: message }] };
  }
  const stRun = stResult
    ? Object.entries(stResult.outputs).find(([name]) => name.toLowerCase() === 'run')?.[1]
    : undefined;
  // Structured Text is case-insensitive; the physical Q0.0 binding is always canonical "Run".
  const coils: Record<string, boolean> = stResult
    ? { ...Object.fromEntries(Object.entries(stResult.outputs).filter(([, value]) => typeof value === 'boolean')),
        Run: stRun === true }
    : ladderResult?.outputs ?? {};
  const tagValues: Record<string, STValue> = {
    ...inputs, ...(stResult?.signals ?? {}), ...(ladderResult?.numericValues ?? {}), ...coils,
    Run: coils.Run === true, Unused: false,
  };
  // 5. Publish output image (Q0.0 follows coil Run, only when PLC is powered).
  // 6. Apply outputs to actuators via circuit on the NEXT tick; contactor coil is sampled here.
  const contactor = w.project.components.find(c => c.kind === 'contactor');
  const motor = w.project.components.find(c => c.kind === 'motor');
  const contactorOn = !!contactor && circuit.energizedLoads.includes(contactor.id);
  // 7. Advance P1 plant: ideal DC motor load, no fake animation or invented motion physics.
  const motorOn = !!motor && circuit.energizedLoads.includes(motor.id);
  // Idealized shaft indicator rotation comes from the authoritative simulation clock,
  // not requestAnimationFrame or visual-only animation. Speed is illustrative, not calibrated.
  const motorAngleRad = motorOn ? (w.motorAngleRad + dtMs * 0.02) % (2 * Math.PI) : w.motorAngleRad;
  // 8. P1 has manually operated pushbuttons; their states are sampled in phase 2 next tick.
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
    voltages: circuit.voltage,
    diagnostics: [...circuit.diagnostics, ...(!powered && plc ? ['PLC is not powered (wire L+ and M to the 24V supply)'] : [])],
    breakpointHit,
    running: change.forceStep || !!breakpointHit ? false : w.running,
  };
  // 10. Immutable render data: visuals never drive the simulation.
  return { world: w, snapshot: renderSnapshot(w), events };
}
