/** P5-UX: discoverable families for actually registered/working devices only.
 * This file categorizes registry kinds; it never creates simulated equipment.
 * Future P3/P4 kinds appear only after their source is genuinely integrated.
 */
export const DEVICE_FAMILIES = [
  {id:'all', label:'All devices'},
  {id:'plc', label:'PLC & I/O'},
  {id:'electrical', label:'Electrical & control'},
  {id:'sensors', label:'Sensors & instruments'},
  {id:'drives', label:'Motors & drives'},
  {id:'handling', label:'Material handling'},
  {id:'motion', label:'Pneumatics & motion'},
  {id:'process', label:'Process'},
  {id:'indicators', label:'HMI & indicators'},
] as const;
export type DeviceFamily = (typeof DEVICE_FAMILIES)[number]['id'];
const families: Record<Exclude<DeviceFamily,'all'>,readonly string[]> = {
  plc:['plc','plc16'],
  electrical:['supply','breaker','overload','contactor','forwardcontactor',
    'reversecontactor','relay','timerelay','estop','start','stop','reversebutton',
    'three-phase-supply','star-delta-drive'],
  sensors:['photoeye','levelprobe','geometry-photoeye','inductive-prox',
    'capacitive-prox','light-curtain','weigh-cell'],
  drives:['motor','revmotor'],
  handling:['conveyor','diverter','belt-conveyor','roller-conveyor','turntable',
    'stopper','pusher','diverter-gate','box-feeder','palletizer','shelf','asrs-crane'],
  motion:['cylinder','lift','scissor-lift','rotary-actuator','pick-and-place','robot-arm'],
  process:['tank','pump','drainvalve','process-tank','mixer','heater',
    'proportional-valve','filler','capper'],
  indicators:['lamp','stacklight'],
};
export function familyForKind(kind:string):Exclude<DeviceFamily,'all'> {
  for (const [family,kinds] of Object.entries(families)) {
    if(kinds.includes(kind)) return family as Exclude<DeviceFamily,'all'>;
  }
  // Unknown registry entries stay discoverable, not silently hidden.
  return 'electrical';
}
export const matchesFamily=(kind:string,family:DeviceFamily)=>
  family==='all'||familyForKind(kind)===family;
export const supportedFamilies=(kinds:readonly string[]):DeviceFamily[] =>
  DEVICE_FAMILIES.filter(f=>f.id==='all'||kinds.some(k=>matchesFamily(k,f.id)))
    .map(f=>f.id);
