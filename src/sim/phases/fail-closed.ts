/** Fail-closed helpers shared by the tick phases and the orchestrator's pause paths. */
import type { SortingPlant } from '../../plant/sorting-conveyor';
import type { PlcRuntime } from '../signals';

export const quietLanes = (lanes: Record<string, SortingPlant>): Record<string, SortingPlant> =>
  Object.fromEntries(Object.entries(lanes).map(([id, lane]) => [id, { ...lane, photoeyeActive: false }]));
/** Every additional PLC with its outputs off (fail-closed after a runtime fault).
 *
 * A cleared coil image alone is insufficient: monitoring reads tagValues as well.
 * Mask the previous output tags without erasing unrelated input/numeric telemetry,
 * program memory or the device's real supply-powered indication.
 * The next authoritative PLC scan rebuilds the complete image.
 */
export const deenergisedPlcs = (plcs: Record<string, PlcRuntime>): Record<string, PlcRuntime> =>
  Object.fromEntries(Object.entries(plcs).map(([id, rt]) => {
    const offTags = Object.fromEntries(Object.keys(rt.coils).map(tag => [tag, false]));
    return [id, {
      ...rt,
      coils: {},
      tagValues: { ...rt.tagValues, ...offTags },
    }];
  }));
