/** Fail-closed helpers shared by the tick phases and the orchestrator's pause paths. */
import type { SortingPlant } from '../../plant/sorting-conveyor';
import type { PlcRuntime } from '../signals';

export const quietLanes = (lanes: Record<string, SortingPlant>): Record<string, SortingPlant> =>
  Object.fromEntries(Object.entries(lanes).map(([id, lane]) => [id, { ...lane, photoeyeActive: false }]));
/** Every additional PLC with its outputs off (fail-closed after a runtime fault). */
export const deenergisedPlcs = (plcs: Record<string, PlcRuntime>): Record<string, PlcRuntime> =>
  Object.fromEntries(Object.entries(plcs).map(([id, rt]) => [id, { ...rt, coils: {} }]));
