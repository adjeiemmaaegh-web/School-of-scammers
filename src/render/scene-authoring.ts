/**
 * P7 3D scene authoring policy. Pure, bounded and advisory: never commits a
 * project, moves a simulated parcel, samples a sensor or edits PLC I/O.
 *
 * Every candidate uses persisted legacy coordinates and the SAME plant
 * dimensions/quarter-turns that P3 and the 3D renderer use. Alignment is
 * optional and only for local optical/proximity sensing equipment. An aligned
 * sensor shares a carrier's sensing region origin; there is no fake beam.
 */
import { PLANT_EQUIPMENT } from '../plant/equipment';
import type { ComponentKind } from '../components/registry';
import type { PlacedComponent, ProjectFile, XY } from '../sim/signals';
import { clampPlacement } from '../workspace/geometry';
import { footprintOf, possibleCarrierOverlaps, type PlanFootprint } from '../workspace/floor-plan';
import type { GridStep } from '../workspace/types';

export const P7_SENSOR_KINDS: ReadonlySet<string> = new Set([
  'geometry-photoeye','inductive-prox','capacitive-prox','light-curtain',
]);
export type PlacementAssessment = {
  at: XY;
  source: 'pointer' | 'sensor-alignment';
  overlappingCarriers: string[];
  mountedTo: string | null;
  footprint: PlanFootprint;
};
/** Finds the closest carrier whose P3 footprint contains the pointer. The
 * sensor snaps to its centre only on request. No vertical offset is written.
 */
export function nearestSensorCarrier(
 project: Pick<ProjectFile,'components'|'params'>,
 at:XY,
 kind:ComponentKind,
): PlacedComponent | null {
 if(!P7_SENSOR_KINDS.has(kind))return null;
 const x=at.x+85,y=at.y+65;
 const carriers=project.components.filter(c=>footprintOf(c,project.params).isCarrier);
 let nearest:PlacedComponent|null=null,best=Infinity;
 for(const c of carriers){
  const f=footprintOf(c,project.params);
  if(Math.abs(f.x-x)>f.width/2+10||Math.abs(f.y-y)>f.depth/2+10)continue;
  const distance=Math.hypot(f.x-x,f.y-y);
  if(distance<best){nearest=c;best=distance;}
 }
 return nearest;
}
export function assess3DPlacement(
 project:Pick<ProjectFile,'components'|'params'>,
 kind:ComponentKind,point:XY,grid:GridStep,
 alignSensor=true,
):PlacementAssessment {
 if(!Object.hasOwn(PLANT_EQUIPMENT,kind)&&!P7_SENSOR_KINDS.has(kind)){
  // Non-P3 electrical devices use the same documented 170x130 project slots.
 }
 const snapped=clampPlacement(point,grid);
 const nearest=alignSensor?nearestSensorCarrier(project,snapped,kind):null;
 const at=nearest?clampPlacement({x:nearest.x,y:nearest.y},grid):snapped;
 const candidate:PlacedComponent={id:'p7-preview',kind,x:at.x,y:at.y,pressed:false};
 const footprint=footprintOf(candidate,project.params);
 const overlaps=possibleCarrierOverlaps([
  ...project.components.map(c=>footprintOf(c,project.params)),footprint,
 ]).filter(w=>w.first===candidate.id||w.second===candidate.id)
  .map(w=>w.first===candidate.id?w.second:w.first);
 return {at,source:nearest?'sensor-alignment':'pointer',
  mountedTo:nearest?.id??null,overlappingCarriers:overlaps,footprint};
}
/** Display-only scene dimensions in metres from the true P3 footprint. The
 * footprint already incorporates saved yaw; never apply that yaw a second time.
 */
export function previewDimensions(footprint:PlanFootprint):[number,number]{
 return [footprint.width/100,footprint.depth/100];
}
/** We can reject only unsatisfiable workspace coordinates, not collisions:
 * P3 legitimately overlaps feeders, sensors and transfer stations. */
export function placementMessage(assessment:PlacementAssessment):string{
 if(assessment.mountedTo)return 'Aligned to carrier '+assessment.mountedTo+' (shared sensing origin)';
 if(assessment.overlappingCarriers.length)
  return 'Carrier footprint overlap (advisory): '+assessment.overlappingCarriers.join(', ');
 return 'Snapped to factory grid; placement awaits worker validation';
}
