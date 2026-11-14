/**
 * P8 bounded stationary-solid model shared by equipment specifications and
 * worker material-flow collision. Millimetres, yaw in quarter turns.
 * Deliberately NOT a general mesh / rigid-body collision solver.
 */
import type {Body,EquipmentPlacement,Vec3} from './types';
import {vec} from './math';
import {sweptPlacementContact} from './swept-contact';

export const SHELF_SOLID_SIZE=vec(1100,600,3000);
export const PROCESS_TANK_SOLID_SIZE=vec(700,700,1350);

/** Registered outer enclosures for stationary machinery. These simple
 * envelopes do NOT describe robot-arm moving links or open bays: a user
 * must explicitly opt in to solid material-flow blocking. Keep these
 * dimensions matched to the P3 equipment registry (regression enforced).
 */
const STATIONARY_SOLIDS:Readonly<Record<string,Vec3>>={
 shelf:SHELF_SOLID_SIZE,'process-tank':PROCESS_TANK_SOLID_SIZE,
 'asrs-crane':vec(1300,750,3100),'robot-arm':vec(900,900,1800),
 palletizer:vec(1300,1000,1750),mixer:vec(450,450,650),
 heater:vec(320,320,350),'proportional-valve':vec(240,260,350),
 filler:vec(250,250,500),capper:vec(240,240,500),
};
export const STATIC_SOLID_KINDS=Object.freeze(Object.keys(STATIONARY_SOLIDS));
export function staticSolidSize(kind:string):Vec3|null{
 return STATIONARY_SOLIDS[kind]??null;
}
export function intersectsStaticSolid(body:Body,item:EquipmentPlacement):boolean{
 const solid=staticSolidSize(item.kind);
 if(!solid)return false;
 const quarter=item.yawDeg===90||item.yawDeg===270;
 const dx=quarter?solid.y:solid.x,dy=quarter?solid.x:solid.y;
 const overlapX=Math.abs(body.pos.x-item.originMm.x)<(body.size.x+dx)/2;
 const overlapY=Math.abs(body.pos.y-item.originMm.y)<(body.size.y+dy)/2;
 const vertical=body.pos.z+body.size.z/2>item.originMm.z&&
   body.pos.z-body.size.z/2<item.originMm.z+solid.z;
 return overlapX&&overlapY&&vertical;
}
/** Historical projects retain free motion; only explicit user-configured solids block. */
export function newlyContactsStaticSolid(
 body:Body,moved:Body,items:readonly EquipmentPlacement[],
):boolean{
 return items.some(item=>{
  if(item.params.blockMaterialFlow!==1)return false;
  const size=staticSolidSize(item.kind);
  if(!size)return false;
  // Check the complete continuous 3D path, not only the position sampled
  // after a 10ms substep (which could tunnel across a thin enclosure).
  return sweptPlacementContact(body,item,size,{
   x:moved.pos.x-body.pos.x,y:moved.pos.y-body.pos.y,
   z:moved.pos.z-body.pos.z})!==null;
 });
}
