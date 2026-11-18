/**
 * Tick phase (R3.3): sample the wired input image and run every controller. The first classic PLC takes the original
 * fixed-name Ladder/ST/FBD path; every other PLC samples ITS OWN terminals and scans ITS OWN program through
 * `scanPlc`. Extracted verbatim from `tick()`; a runtime fault returns `halt`, which the caller turns into the same
 * fail-closed paused world as before. Behaviour is pinned by `tests/r3-golden-tick.test.ts` and the scenario suites.
 */
import { executeLadder, type LadderResult } from '../../engineering/ladder';
import { compileFbd, executeFbd, type FbdResult } from '../../engineering/fbd';
import { executeStructuredText, type STResult, type STValue } from '../../engineering/structured-text';
import { compileSandboxST } from '../../program/p2-contract';
import { solveNetAware } from '../../engineering/electrical';
import { faultsOf } from '../faults';
import { ioOf } from '../plc-io';
import { freshPlcRuntime, namesFor, programOf, runtimePlcs, scanPlc } from '../plcs';
import { sampleAnalogInputs } from '../analog';
import { deenergisedPlcs, quietLanes } from './fail-closed';
import type { PlacedComponent, PlcInputs, PlcRuntime, SimEvent, WorldState } from '../signals';

const terminal = (id: string, pin: string) => `${id}.${pin}`;
export type ControllerScan = {
  halt?: undefined; eyePowered: boolean; probePowered: boolean; inputs: PlcInputs;
  ladderResult: LadderResult | null; stResult: STResult | null; fbdResult: FbdResult | null;
  coils: Record<string, boolean>; tagValues: Record<string, STValue>; nextPlcs: Record<string, PlcRuntime>; unpoweredExtras: string[];
};
export type ControllerHalt = { halt: { world: WorldState; events: SimEvent[] } };

export function scanControllers(
  w: WorldState, circuit: ReturnType<typeof solveNetAware>, shorted: boolean,
  plc: PlacedComponent | undefined, powered: boolean, dtMs: number,
): ControllerScan | ControllerHalt {
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
      if(w.project.language==='fbd') {
        fbdResult=executeFbd(compileFbd(programOf(w.project,plc.id).fbd,namesFor(w.project,plc.id)),
          inputs,w.coils,w.fbdMemory,dtMs);
      } else if (w.project.language === 'st') {
        const compiled = w.stCompiled ?? compileSandboxST(w.project.stSource ?? '');
        stResult = executeStructuredText(compiled, inputs, w.stMemory);
        const run = Object.entries(stResult.outputs).find(([key]) => key.toLowerCase() === 'run')?.[1];
        if (typeof run !== 'boolean') throw new TypeError('ST Run output must be BOOL');
      } else ladderResult = executeLadder(w.project.program, inputs, w.coils, w.ladderMemory, dtMs, w.ladderNumeric,
        w.debugForces[plc.id] ?? {});
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
    return { halt: { world: paused, events: [{ tick: w.tick, kind: 'error', detail: message }] } };
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
    return { halt: { world: paused, events: [{ tick: w.tick, kind: 'error', detail: 'PLC Sort/Fill/Drain/Forward/Reverse outputs must be BOOL' }] } };
  }
  // Structured Text is case-insensitive; the physical Q0.0 binding is always canonical "Run".
  const coils: Record<string, boolean> = stResult
    ? { ...Object.fromEntries(Object.entries(stResult.outputs).filter(([, value]) => typeof value === 'boolean')),
        Run: stRun === true, Sort: stSort === true, Fill: stFill === true, Drain: stDrain === true,
        Forward: stForward === true, Reverse: stReverse === true }
    : fbdResult?.outputs ?? ladderResult?.outputs ?? {};
  const tagValues: Record<string, STValue> = {
    ...inputs, ...(stResult?.signals ?? {}), ...(w.debugForces[plc?.id ?? '']??{}),
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
      const numeric = sampleAnalogInputs(w.project, w.vessels, extra.id, io, extraPowered, openAnalogWires,
        w.plantWorld, id => circuit.reads24(terminal(id, 'L+'), terminal(id, 'M')));
      // Physical numeric process inputs come from the preceding settled scan state.
      const tagInputs = { ...digitalInputs, ...numeric.values };
      nextPlcs[extra.id] = scanPlc(cfg, io, w.plcs[extra.id] ?? freshPlcRuntime(cfg, namesFor(w.project, extra.id)),
        tagInputs, extraPowered, dtMs, numeric.points, w.debugForces[extra.id] ?? {});
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
      return { halt: { world: paused, events: [{ tick: w.tick, kind: 'error', detail: `PLC ${extra.id}: ${message}` }] } };
    }
    if (!extraPowered && extra.id !== plc?.id) unpoweredExtras.push(extra.id);
  }
  return { eyePowered, probePowered, inputs, ladderResult, stResult, fbdResult, coils, tagValues, nextPlcs, unpoweredExtras };
}
