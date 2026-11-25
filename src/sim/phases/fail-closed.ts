/** Fail-closed helpers shared by the tick phases and the orchestrator's pause paths. */
import type { SortingPlant } from '../../plant/sorting-conveyor';
import type { PlcRuntime, ProjectFile, WorldState } from '../signals';
import { ioOf } from '../plc-io';

export const quietLanes = (lanes: Record<string, SortingPlant>): Record<string, SortingPlant> =>
  Object.fromEntries(Object.entries(lanes).map(([id, lane]) => [id, { ...lane, photoeyeActive: false }]));
/** Every additional PLC with its outputs off (fail-closed after a runtime fault).
 *
 * A cleared coil image alone is insufficient: monitoring reads tagValues as well.
 * Mask the previous output tags without erasing unrelated input/numeric telemetry,
 * program memory or the device's real supply-powered indication.
 * The next authoritative PLC scan rebuilds the complete image.
 */
export const deenergisedPlcs = (plcs: Record<string, PlcRuntime>, project?: ProjectFile): Record<string, PlcRuntime> =>
  Object.fromEntries(Object.entries(plcs).map(([id, rt]) => {
    const offTags = Object.fromEntries(Object.keys(rt.coils).map(tag => [tag, false]));
    const device = project?.components.find(c => c.id === id);
    const analogTags = device && project ? Object.values(ioOf(project, device).analogOutputs ?? {}) : [];
    const zeroAnalog = Object.fromEntries(analogTags.filter(tag => Object.prototype.hasOwnProperty.call(rt.tagValues, tag)).map(tag => [tag, 0]));
    return [id, {
      ...rt,
      coils: {},
      tagValues: { ...rt.tagValues, ...offTags, ...zeroAnalog },
    }];
  }));

/** Standard virtual-plant failure image shared by the controller phase and
 * the Worker exception boundary. Only the six historical output tags are
 * explicitly shut off: a learner's unrelated inputs, numeric readings,
 * memory and project document are retained for diagnosis.
 *
 * This is an educational model stop, NOT a certified real-world safety stop.
 */
export function haltedSimulationWorld(
  w: WorldState,
  message: string,
  diagnostic?: string,
  maxDiagnostics?: number,
): WorldState {
  const off = { Run: false, Sort: false, Fill: false, Drain: false, Forward: false, Reverse: false };
  const nextDiagnostics = diagnostic ? [...w.diagnostics, diagnostic] : w.diagnostics;
  return {
    ...w,
    running: false,
    coils: { ...w.coils, ...off },
    tagValues: { ...w.tagValues, ...off },
    plcs: deenergisedPlcs(w.plcs, w.project),
    deviceOn: {},
    timers: {},
    threePhase: {},
    contactorOn: false,
    motorOn: false,
    conveyorOn: false,
    diverterOn: false,
    pumpOn: false,
    drainOn: false,
    lampOn: false,
    forwardContactorOn: false,
    reverseContactorOn: false,
    motorDirection: 'stopped',
    interlockConflict: false,
    plant: { ...w.plant, photoeyeActive: false },
    lanes: quietLanes(w.lanes),
    voltages: {},
    diagnostics: maxDiagnostics === undefined ? nextDiagnostics : nextDiagnostics.slice(-maxDiagnostics),
    lastError: message,
  };
}
