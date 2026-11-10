/** An original browsable equipment taxonomy. No hard-coded duplicate component definitions. */
import { COMPONENTS, componentKinds, type ComponentKind } from '../components/registry';
import type { WorkspaceCategory } from './types';

export const CATEGORIES: readonly WorkspaceCategory[] = [
  'Controllers & I/O', 'Power & protection', 'Control gear', 'Sensors',
  'Motors & actuators', 'Conveyance', 'Process', 'Indicators',
];
export const CATEGORY_BY_KIND: Record<ComponentKind, WorkspaceCategory> = {
  plc: 'Controllers & I/O', plc16: 'Controllers & I/O',
  supply: 'Power & protection', breaker: 'Power & protection',
  overload: 'Power & protection', estop: 'Power & protection',
  start: 'Control gear', stop: 'Control gear', reversebutton: 'Control gear',
  contactor: 'Control gear', forwardcontactor: 'Control gear',
  reversecontactor: 'Control gear', relay: 'Control gear', timerelay: 'Control gear',
  photoeye: 'Sensors', levelprobe: 'Sensors',
  motor: 'Motors & actuators', revmotor: 'Motors & actuators',
  cylinder: 'Motors & actuators', diverter: 'Motors & actuators',
  conveyor: 'Conveyance',
  tank: 'Process', pump: 'Process', drainvalve: 'Process',
  lamp: 'Indicators', stacklight: 'Indicators',
  'three-phase-supply': 'Power & protection',
  'star-delta-drive': 'Motors & actuators',
  'belt-conveyor': 'Conveyance', 'roller-conveyor': 'Conveyance',
  turntable: 'Conveyance', stopper: 'Conveyance', pusher: 'Motors & actuators',
  'diverter-gate': 'Conveyance', 'box-feeder': 'Conveyance',
  'geometry-photoeye': 'Sensors', 'inductive-prox': 'Sensors',
  'capacitive-prox': 'Sensors', 'light-curtain': 'Sensors',
  'weigh-cell': 'Sensors',
  lift: 'Motors & actuators', 'scissor-lift': 'Motors & actuators',
  'rotary-actuator': 'Motors & actuators', 'pick-and-place': 'Motors & actuators',
  palletizer: 'Motors & actuators', shelf: 'Conveyance', 'asrs-crane': 'Conveyance',
  'robot-arm': 'Motors & actuators', 'process-tank': 'Process',
  mixer: 'Process', heater: 'Process', 'proportional-valve': 'Process',
  filler: 'Process', capper: 'Process',
};
export function searchEquipment(query: string, category: WorkspaceCategory | 'All' = 'All'): ComponentKind[] {
  const tokens = query.trim().toLocaleLowerCase('en').split(/\s+/u).filter(Boolean);
  return componentKinds.filter(kind => {
    const bucket = CATEGORY_BY_KIND[kind];
    if (category !== 'All' && bucket !== category) return false;
    const def = COMPONENTS[kind];
    const haystack = [kind, def.label, def.help, bucket].join(' ').toLocaleLowerCase('en');
    return tokens.every(token => haystack.includes(token));
  });
}
export function catalogueCounts(): Record<WorkspaceCategory, number> {
  const counts = Object.fromEntries(CATEGORIES.map(category => [category, 0])) as Record<WorkspaceCategory, number>;
  for (const kind of componentKinds) counts[CATEGORY_BY_KIND[kind]]++;
  return counts;
}
