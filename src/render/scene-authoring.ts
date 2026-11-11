/**
 * P7 pure 3D authoring proposals. All coordinates are the existing persisted
 * workcell slot units (100 units = 1 metre); the underlying worker model is
 * unchanged. A placement preview is NEVER a physics or PLC sensor decision.
 */
import type { ComponentKind } from '../components/registry';
import type { PlacedComponent, ProjectFile, XY } from '../sim/signals';
import { clampPlacement, MAX_POSITION, snap } from '../workspace/geometry';
import { footprintOf } from '../workspace/floor-plan';
import type { GridStep } from '../workspace/types';

export const SENSOR_KINDS: ReadonlySet<string> = new Set([
 'geometry-photoeye', 'inductive-prox', 'capacitive-prox',
]);
export const RAIL_KINDS: ReadonlySet<string> = new Set([
 'belt-conveyor', 'roller-conveyor',
]);
export type MountProposal = { carrierId: string; at: XY; distance: number };
export type AuthoringProposal = {
 at: XY; valid: boolean; reason: string | null;
 advisory: string | null; mount: MountProposal | null;
};

/**
 * A real sensor's origin must remain near the conveyor so the existing
 * worker's radial proximity rule can detect a parcel. This is an optional
 * rail-side mounting proposal, not a new or faked optical raycast.
 * Any yaw orientation is supported through the model's physical footprint.
 */
export function proposeSensorMount(
 kind:ComponentKind, raw:XY, project:Pick<ProjectFile,'components'|'params'>,
 grid:GridStep,
):MountProposal|null {
 if(!SENSOR_KINDS.has(kind))return null;
 let best:MountProposal|null=null;
 for(const carrier of project.components) {
  if(!RAIL_KINDS.has(carrier.kind))continue;
  const f=footprintOf(carrier,project.params);
  const sideways=f.yawDeg===90||f.yawDeg===270;
  const wide=(sideways?f.depth:f.width)/2;
  const narrow=(sideways?f.width:f.depth)/2;
  // Centre in the persisted UI floor, not the component's top-left.
  const cx=raw.x+85,cy=raw.y+65;
  const long=Math.max(-wide+4,Math.min(wide-4,cx-f.x));
  const longY=Math.max(-wide+4,Math.min(wide-4,cy-f.y));
  // Keep sensor centre within the worker's nominal 200 mm range of the
  // conveyor centreline: a 300mm wide belt => 175mm side mounting.
  const rail=Math.max(5,narrow+2);
  let mx:number,my:number;
  if(sideways){
   mx=f.x+(cx>=f.x?rail:-rail);
   my=f.y+longY;
  }else{
   mx=f.x+long;
   my=f.y+(cy>=f.y?rail:-rail);
  }
  const d=Math.hypot(cx-mx,cy-my);
  if(d>22||Math.abs(sideways?cy-f.y:cx-f.x)>wide+14)continue;
  const at=clampPlacement({x:mx-85,y:my-65},grid);
  if(!best||d<best.distance)best={carrierId:carrier.id,at,distance:d};
 }
 return best;
}

export function propose3DPlacement(
 kind:ComponentKind, raw:XY,
 project:Pick<ProjectFile,'components'|'params'>,grid:GridStep,
):AuthoringProposal {
 const bounds=Number.isFinite(raw.x)&&Number.isFinite(raw.y)&&
  raw.x>=0&&raw.x<=MAX_POSITION.x&&raw.y>=0&&raw.y<=MAX_POSITION.y;
 const mount=bounds?proposeSensorMount(kind,raw,project,grid):null;
 const at=mount?.at??clampPlacement(raw,grid);
 const ghost:PlacedComponent={kind,id:'authoring-preview',x:at.x,y:at.y,pressed:false};
 const footprint=footprintOf(ghost,project.params);
 let advisory:string|null=null;
 for(const item of project.components){
  const other=footprintOf(item,project.params);
  const overlapX=(footprint.width+other.width)/2-Math.abs(footprint.x-other.x);
  const overlapY=(footprint.depth+other.depth)/2-Math.abs(footprint.y-other.y);
  if(overlapX>5&&overlapY>5){
   // Sensor-on-conveyor overlap is a supported mounting relationship.
   if(mount?.carrierId===item.id)continue;
   if(SENSOR_KINDS.has(kind)&&RAIL_KINDS.has(item.kind))continue;
   if(other.isCarrier&&footprint.isCarrier){
    advisory='Transport footprints overlap: verify the intended parcel transfer.';
   }else if(!SENSOR_KINDS.has(kind)&&!SENSOR_KINDS.has(item.kind)){
    advisory='Machine footprints overlap: inspect in 3D before commissioning.';
   }
   if(advisory)break;
  }
 }
 return {
  at,valid:bounds,reason:bounds?null:'Outside the editable workcell floor',
  advisory,mount,
 };
}

/** Native 3D hit on the plane is in metres, and saved slots are top-left. */
export const placementFrom3DFloor=(x:number,z:number):XY=>({
 x:x*100+540-85,y:z*100+290-65,
});
/** The 3D editor's accessible numeric fields use the same bounded grid. */
export const precise3DPlacement=(x:number,y:number,grid:GridStep):XY=>
 clampPlacement({x:snap(x,grid),y:snap(y,grid)},grid);
