import { pickSeededFault } from '../sim/faults';
import { blankProgram } from '../sim/orchestrator';
import type { ProjectFile, WorldState } from '../sim/signals';
import {
  MOTOR_LINKS, MOTOR_PLACES, SORTING_LINKS, SORTING_PLACES, TANK_LINKS, TANK_PLACES,
  motorWorking, projectFrom,
} from './layouts';
import { feed, loadBench, press, release, run, scan, until } from './probe';
import { layoutSignature, repairedTargets } from './grade';
import { usedMultimeter } from './evidence';
import { getScenarioMeta, type ScenarioMeta } from './meta';
import type { CheckOutcome, GradeContext, ScenarioCheck, ScenarioDefinition } from './types';

const meta = (id: string): ScenarioMeta => {
  const m = getScenarioMeta(id);
  if (!m) throw new Error(`Scenario ${id} has no metadata entry`);
  return m;
};

const ok = (pass: boolean, yes: string, no: string): CheckOutcome => ({ pass, reason: pass ? yes : no });

/* ------------------------------------------------------------------------------------------- *
 * Shared behavioural probes. Each one loads the learner's project into a fresh headless bench,
 * so checks never contaminate each other and always see the project as it was submitted.
 * ------------------------------------------------------------------------------------------- */

/** Running bench for a start/stop motor circuit, or a reason it could not run. */
function running(project: ProjectFile): { w: WorldState } | { error: string } {
  const bench = loadBench(project);
  if (bench.loadError) return { error: bench.loadError };
  const w = run(bench.world);
  if (w.lastError) return { error: w.lastError };
  return { w: scan(w, 4) };
}
const motorChecks = (project: ProjectFile) => ({
  starts(): CheckOutcome {
    const r = running(project);
    if ('error' in r) return { pass: false, reason: r.error };
    const w = press(r.w, 'start');
    return ok(w.motorOn, 'Pressing START made the motor run.', 'Pressing START did not make the motor run.');
  },
  seals(): CheckOutcome {
    const r = running(project);
    if ('error' in r) return { pass: false, reason: r.error };
    const w = release(press(r.w, 'start'), 'start', 30);
    return ok(w.motorOn, 'The motor kept running after START was released.', 'The motor dropped out as soon as START was released.');
  },
  /** STOP must beat START: with the motor running and START still held, pressing STOP drops it. */
  stops(): CheckOutcome {
    const r = running(project);
    if ('error' in r) return { pass: false, reason: r.error };
    const w = press(r.w, 'start');
    if (!w.motorOn) return { pass: false, reason: 'The motor never ran, so STOP could not be tested.' };
    const stopped = press(w, 'stop', 20);
    return ok(!stopped.motorOn, 'Pressing STOP stopped the motor.', 'The motor kept running after STOP was pressed.');
  },
  staysOff(): CheckOutcome {
    const r = running(project);
    if ('error' in r) return { pass: false, reason: r.error };
    const w = press(press(r.w, 'start'), 'stop', 20);
    if (w.motorOn) return { pass: false, reason: 'The motor could not be stopped.' };
    const after = release(release(w, 'start', 10), 'stop', 30);
    return ok(!after.motorOn, 'The motor stayed off after both buttons were released.', 'The motor restarted by itself after the buttons were released.');
  },
  idle(): CheckOutcome {
    const r = running(project);
    if ('error' in r) return { pass: false, reason: r.error };
    const w = scan(r.w, 30);
    return ok(!w.motorOn, 'Nothing runs until START is pressed.', 'The motor ran without anyone pressing START.');
  },
});

/* ------------------------------------------------------------------------------------------- *
 * 1 · Build a start/stop motor starter  (rank 2)
 * ------------------------------------------------------------------------------------------- */
const startStop: ScenarioDefinition = {
  ...meta('plc-sbx-startstop'),
  hints: [
    'Start with the supply: P24 and M0 both go to the PLC. Then connect each device in turn and use the multimeter to confirm 24 V where you expect it.',
    'The STOP button is normally closed in real panels: the PLC input is ON while STOP is released. The StopOK tag follows that.',
    'A seal-in (latch) uses the output as one of its own conditions: (Start OR Run) AND StopOK → Run.',
  ],
  starter: () => projectFrom(MOTOR_PLACES, [], blankProgram()),
  passMark: 0.8,
  checks: [
    { id: 'powered', label: 'The PLC is powered and its program runs', max: 2, run: ({ project }) => {
      const bench = loadBench(project);
      if (bench.loadError) return { pass: false, reason: bench.loadError };
      const w = run(bench.world);
      if (w.lastError) return { pass: false, reason: w.lastError };
      return ok(scan(w, 4).inputs.StopOK, 'The PLC is powered and sees STOP healthy.', 'The PLC is not powered or does not see the STOP circuit.');
    } },
    { id: 'starts', label: 'START starts the motor', max: 2, required: true, run: ({ project }) => motorChecks(project).starts() },
    { id: 'seals', label: 'The motor keeps running after START is released', max: 2, required: true, run: ({ project }) => motorChecks(project).seals() },
    { id: 'stops', label: 'STOP stops the motor', max: 2, required: true, run: ({ project }) => motorChecks(project).stops() },
    { id: 'stays-off', label: 'The motor stays off after STOP is released', max: 1, run: ({ project }) => motorChecks(project).staysOff() },
    { id: 'idle', label: 'The motor does not run until commanded', max: 1, run: ({ project }) => motorChecks(project).idle() },
  ],
};

/* ------------------------------------------------------------------------------------------- *
 * 2 · Find the fault  (rank 4, troubleshooting)
 * ------------------------------------------------------------------------------------------- */
function faultedStarter(seed: number): ProjectFile {
  const base = motorWorking();
  const pick = pickSeededFault(base, seed);
  if (!pick) return base;
  return {
    ...base,
    faults: [{ id: 'f1', kind: pick.kind, target: pick.target, hidden: true,
      ...(pick.stuckPressed !== undefined ? { stuckPressed: pick.stuckPressed } : {}),
      ...(pick.stuckActive !== undefined ? { stuckActive: pick.stuckActive } : {}) }],
  };
}
const faultTargets = (ctx: GradeContext) => (ctx.starter.faults ?? []).map(f => f.target);
const findFault: ScenarioDefinition = {
  ...meta('plc-sbx-find-fault'),
  hints: [
    'Reproduce the symptom first: press START, then STOP, and watch the alarm list and the Q0.0 lamp.',
    'A meter reading of 24 V across a coil that is not pulling in points at the coil; 24 V present up to a terminal but nothing beyond it points at the conductor or part after it.',
    'Parts can only be replaced with the simulation paused.',
  ],
  starter: faultedStarter,
  passMark: 0.8,
  troubleshooting: true,
  checks: [
    { id: 'starts', label: 'The starter starts and seals in again', max: 3, required: true, run: ({ project }) => {
      const a = motorChecks(project).starts(); if (!a.pass) return a;
      return motorChecks(project).seals();
    } },
    { id: 'stops', label: 'STOP stops it and it stays off', max: 2, required: true, run: ({ project }) => {
      const a = motorChecks(project).stops(); if (!a.pass) return a;
      return motorChecks(project).staysOff();
    } },
    { id: 'fault-gone', label: 'The fault has been removed', max: 1, required: true, run: ({ project }) =>
      ok((project.faults ?? []).length === 0, 'No fault remains in the circuit.', 'The fault is still present.') },
    { id: 'intact', label: 'The circuit and program were not rebuilt or bypassed', max: 2, run: (ctx) => {
      const same = layoutSignature(ctx.project) === layoutSignature(ctx.starter) &&
        JSON.stringify(ctx.project.program) === JSON.stringify(ctx.starter.program) &&
        ctx.project.language !== 'st';
      return ok(same, 'Devices, wiring and program are as issued.', 'The circuit or program was changed instead of repaired.');
    } },
    { id: 'diagnosed', label: 'Measured with the multimeter before replacing anything', max: 3, run: (ctx) => {
      const firstRepair = ctx.evidence.find(e => e.action === 'repair' && e.accepted)?.index;
      return ok(usedMultimeter(ctx.evidence, firstRepair ?? Infinity),
        'Both meter probes were placed on terminals before any part was replaced.',
        'No multimeter measurement was recorded before a part was replaced.');
    } },
    { id: 'precise', label: 'Replaced only the faulty part', max: 3, run: (ctx) => {
      const targets = faultTargets(ctx);
      const replaced = repairedTargets(ctx.evidence);
      const wrong = replaced.filter(t => !targets.includes(t));
      if (wrong.length) return { pass: false, reason: `Replaced healthy parts: ${[...new Set(wrong)].join(', ')}.` };
      return ok(replaced.length > 0 || (ctx.project.faults ?? []).length === 0,
        'Only the faulty part was replaced.', 'Nothing was repaired.');
    } },
  ],
};

/* ------------------------------------------------------------------------------------------- *
 * 3 · Program the sorting line  (rank 5)
 * ------------------------------------------------------------------------------------------- */
const sortingStarter = () => projectFrom(SORTING_PLACES, SORTING_LINKS, blankProgram());
/** Belt running with every operator control released; null if the project does not run. */
function sortingBench(project: ProjectFile): WorldState | { error: string } {
  const bench = loadBench(project);
  if (bench.loadError) return { error: bench.loadError };
  const w = run(bench.world);
  if (w.lastError) return { error: w.lastError };
  return release(press(scan(w, 4), 'start', 10), 'start', 10);
}
/** Feed one parcel and let it leave the belt. */
function sortOne(w: WorldState, kind: 'plain' | 'marked'): WorldState {
  const r = until(feed(w, kind), s => s.plant.parcel === null, 200);
  return r.world;
}
const sortCheck = (kinds: ('plain' | 'marked')[], wantAccepted: number, wantRejected: number, yes: string, no: string): ScenarioCheck['run'] =>
  ({ project }) => {
    const b = sortingBench(project);
    if ('error' in b) return { pass: false, reason: b.error };
    let w = b;
    for (const k of kinds) w = sortOne(w, k);
    return ok(w.plant.accepted === wantAccepted && w.plant.rejected === wantRejected && w.plant.parcel === null, yes,
      `${no} (accepted ${w.plant.accepted}, rejected ${w.plant.rejected}).`);
  };
const sorting: ScenarioDefinition = {
  ...meta('plc-sbx-sorting'),
  hints: [
    'The diverter output has its own tag (Sort). It should be driven only while the belt runs and the photoeye sees a mark.',
    'The belt needs a latch just like a motor starter: START latches, STOP drops.',
    'Feed one parcel at a time and watch the photoeye lamp and the diverter state as it travels.',
  ],
  starter: sortingStarter,
  passMark: 0.8,
  checks: [
    { id: 'belt-runs', label: 'START runs the belt and it keeps running', max: 2, run: ({ project }) => {
      const b = sortingBench(project);
      if ('error' in b) return { pass: false, reason: b.error };
      return ok(b.conveyorOn, 'The belt runs after START is released.', 'The belt is not running.');
    } },
    { id: 'plain-passes', label: 'A plain parcel passes the diverter', max: 2, required: true,
      run: sortCheck(['plain'], 1, 0, 'The plain parcel was accepted.', 'The plain parcel was not accepted') },
    { id: 'marked-rejected', label: 'A marked parcel is rejected', max: 3, required: true,
      run: sortCheck(['marked'], 0, 1, 'The marked parcel was rejected.', 'The marked parcel was not rejected') },
    { id: 'mixed-batch', label: 'A mixed batch (plain, marked, plain) is sorted correctly', max: 2,
      run: sortCheck(['plain', 'marked', 'plain'], 2, 1, 'The whole batch was sorted correctly.', 'The batch was not sorted correctly') },
    { id: 'belt-stops', label: 'STOP stops the belt', max: 1, run: ({ project }) => {
      const b = sortingBench(project);
      if ('error' in b) return { pass: false, reason: b.error };
      return ok(!press(b, 'stop', 20).conveyorOn, 'STOP stopped the belt.', 'The belt kept moving after STOP.');
    } },
  ],
};

/* ------------------------------------------------------------------------------------------- *
 * 4 · Program the tank process  (rank 6)
 * ------------------------------------------------------------------------------------------- */
const tankStarter = () => projectFrom(TANK_PLACES, TANK_LINKS, blankProgram());
function tankRun(project: ProjectFile, scans: number): { trace: WorldState[]; start: WorldState } | { error: string } {
  const bench = loadBench(project);
  if (bench.loadError) return { error: bench.loadError };
  const w = run(bench.world);
  if (w.lastError) return { error: w.lastError };
  const r = until(w, () => false, scans);
  return { trace: r.trace, start: w };
}
const tank: ScenarioDefinition = {
  ...meta('plc-sbx-tank'),
  hints: [
    'The level switch has hysteresis: once HIGH it stays HIGH until the level falls below 600 ml. You can use that instead of a second sensor.',
    'Two outputs, two rungs. Each is a condition on StopOK and on TankHigh (normal or negated).',
    'Watch the tank level and the lamps for a whole cycle before you decide it works.',
  ],
  starter: tankStarter,
  passMark: 0.8,
  checks: [
    { id: 'fills', label: 'The pump fills the tank until the level switch trips', max: 2, required: true, run: ({ project }) => {
      const r = tankRun(project, 200);
      if ('error' in r) return { pass: false, reason: r.error };
      const filled = r.trace.some(w => w.pumpOn) && r.trace.some(w => w.inputs.TankHigh);
      return ok(filled, 'The pump ran and the level switch reached HIGH.', 'The tank never filled to the HIGH switch.');
    } },
    { id: 'no-overflow', label: 'The tank never overflows and the pump never runs while HIGH', max: 3, required: true, run: ({ project }) => {
      const r = tankRun(project, 400);
      if ('error' in r) return { pass: false, reason: r.error };
      const spilled = r.trace.some(w => w.tank.spills > 0 || w.tank.levelMl >= 1000);
      // One or two scans of I/O lag after the switch trips is normal; a pump that ignores it is not.
      let streak = 0, worst = 0;
      for (const w of r.trace) { streak = w.inputs.TankHigh && w.pumpOn ? streak + 1 : 0; worst = Math.max(worst, streak); }
      const pumpedHigh = worst > 3;
      return ok(!spilled && !pumpedHigh, 'No overflow, and the pump stopped at HIGH.',
        spilled ? 'The tank overflowed.' : 'The pump kept running while the tank was HIGH.');
    } },
    { id: 'drains', label: 'The drain opens at HIGH and empties until the switch clears', max: 2, run: ({ project }) => {
      const r = tankRun(project, 400);
      if ('error' in r) return { pass: false, reason: r.error };
      const hi = r.trace.findIndex(w => w.inputs.TankHigh);
      if (hi < 0) return { pass: false, reason: 'The tank never reached HIGH.' };
      const cleared = r.trace.slice(hi).some(w => !w.inputs.TankHigh);
      return ok(cleared && r.trace.slice(hi).some(w => w.drainOn), 'The drain opened and the level switch cleared.',
        'The tank was not drained until the level switch cleared.');
    } },
    { id: 'repeats', label: 'The cycle repeats on its own', max: 1, run: ({ project }) => {
      const r = tankRun(project, 600);
      if ('error' in r) return { pass: false, reason: r.error };
      let highs = 0, prev = false;
      for (const w of r.trace) { if (w.inputs.TankHigh && !prev) highs++; prev = w.inputs.TankHigh; }
      return ok(highs >= 2, `The tank reached HIGH ${highs} times.`, 'The cycle did not repeat.');
    } },
    { id: 'stop-halts', label: 'STOP halts the pump and the drain valve', max: 2, run: ({ project }) => {
      const r = tankRun(project, 30);
      if ('error' in r) return { pass: false, reason: r.error };
      const w = press(r.trace[r.trace.length - 1], 'stop', 6);
      return ok(!w.pumpOn && !w.drainOn, 'STOP halted the pump and the drain valve.', 'The pump or drain kept running after STOP.');
    } },
  ],
};

export const SCENARIOS: ScenarioDefinition[] = [startStop, findFault, sorting, tank];
export const getScenario = (id: string): ScenarioDefinition | undefined => SCENARIOS.find(s => s.id === id);
