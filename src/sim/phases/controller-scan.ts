/**
 * Tick phase (R3.3/R3.4): sample the wired input image and run every controller.
 * The first classic PLC and each additional/PLC16 controller execute through the SAME
 * `scanPlc` interpreter. The first classic PLC retains historical fixed-name
 * WorldState mirrors and trace outputs for existing v1 projects. Independent PLCs
 * sample their own terminals, program and state. All faults stop the virtual model.
 */
import type { LadderResult } from '../../engineering/ladder';
import type { FbdResult } from '../../engineering/fbd';
import type { STResult, STValue } from '../../engineering/structured-text';
import { solveNetAware } from '../../engineering/electrical';
import { faultsOf } from '../faults';
import { ioOf, LEGACY_IO } from '../plc-io';
import { classicInputs, freshPlcRuntime, namesFor, programOf, runtimePlcs, scanPlc } from '../plcs';
import { sampleAnalogInputs } from '../analog';
import { samplePlcDigitalInputs } from '../plc-input-image';
import { haltedSimulationWorld } from './fail-closed';
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
  /** Optional precomputed per-controller image from the same settled netlist. */
  powerById?: Readonly<Record<string, boolean>>,
): ControllerScan | ControllerHalt {
  // 3. Sample actual wired 24V input image, including powered mark photoeye.
  // The photoeye's optical state was determined by the PRIOR plant scan.
  const eyePowered = !shorted && w.project.components.some(c => c.kind === 'photoeye' && circuit.reads24(terminal(c.id, 'L+'), terminal(c.id, 'M')));
  const probePowered = !shorted && w.project.components.some(c => c.kind === 'levelprobe' && circuit.reads24(terminal(c.id, 'L+'), terminal(c.id, 'M')));
  const sensors = { photoeye: eyePowered, levelprobe: probePowered };
  // The global five-tag legacy mirror is always bound to physical I0.0-I0.4,
  // even if a configurable PLC16 is placed first. Its independent runtime
  // reads the user's configured I/O tags later in this same scan.
  const inputs = classicInputs(plc
    ? samplePlcDigitalInputs(plc.id, LEGACY_IO, powered, circuit, sensors)
    : {});
  // 4. The first classic PLC executes through the SAME canonical scanPlc
  // interpreter path as every additional controller. Its historical WorldState
  // fields remain the storage/trace compatibility mirror (no project migration).
  const executed: { ladderResult: LadderResult | null; stResult: STResult | null; fbdResult: FbdResult | null } = {
    ladderResult: null, stResult: null, fbdResult: null,
  };
  let legacyScan: PlcRuntime | null = null;
  try {
    if (powered && plc?.kind === 'plc') {
      const prior: PlcRuntime = {
        powered: w.powered, inputs: w.inputs, tagInputs: w.inputs, analogInputs: [],
        coils: w.coils, tagValues: w.tagValues,
        ladderMemory: w.ladderMemory, ladderNumeric: w.ladderNumeric, ladderSteps: w.ladderSteps,
        stCompiled: w.stCompiled, stMemory: w.stMemory,
        fbdMemory: w.fbdMemory, fbdSteps: w.fbdSteps,
      };
      legacyScan = scanPlc(programOf(w.project, plc.id), LEGACY_IO, prior, inputs,
        powered, dtMs, [], w.debugForces[plc.id] ?? {}, execution => {
          if (execution.language === 'ladder') executed.ladderResult = execution.result;
          else if (execution.language === 'st') executed.stResult = execution.result;
          else executed.fbdResult = execution.result;
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PLC runtime failed';
    // Historically a non-BOOL secondary ST output used a distinct top-level
    // error string without appending the generic PLC scan diagnostic.
    const outputTypeError = message === 'PLC Sort/Fill/Drain/Forward/Reverse outputs must be BOOL';
    const paused = haltedSimulationWorld(w, outputTypeError ? message : `PLC runtime error: ${message}`,
      outputTypeError ? undefined : 'PLC scan interrupted; simulated outputs deenergized');
    return { halt: { world: paused, events: [{ tick: w.tick, kind: 'error', detail: message }] } };
  }
  const { ladderResult, stResult, fbdResult } = executed;
  // These fixed-name mirrors are still required by existing dashboard traces,
  // breakpoints and v1 projects. Execution itself is now shared with PLC16.
  const coils: Record<string, boolean> = legacyScan?.coils ?? {};
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
    const extraPowered = powerById?.[extra.id] ??
      (!shorted && circuit.reads24(terminal(extra.id, 'L+'), terminal(extra.id, 'M')));
    const io = ioOf(w.project, extra);
    // A sensor-named input only reads high if some powered sensor of that kind exists (guards a wire straight to P24).
    const digitalInputs = samplePlcDigitalInputs(extra.id, io, extraPowered, circuit, sensors);
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
      const paused = haltedSimulationWorld(w, `PLC ${extra.id} runtime error: ${message}`,
        'PLC scan interrupted; simulated outputs deenergized');
      return { halt: { world: paused, events: [{ tick: w.tick, kind: 'error', detail: `PLC ${extra.id}: ${message}` }] } };
    }
    if (!extraPowered && extra.id !== plc?.id) unpoweredExtras.push(extra.id);
  }
  return { eyePowered, probePowered, inputs, ladderResult, stResult, fbdResult, coils, tagValues, nextPlcs, unpoweredExtras };
}
