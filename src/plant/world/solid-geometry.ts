/**
 * P8 bounded stationary-solid model shared by equipment specifications and
 * worker material-flow collision. Millimetres, yaw in quarter turns.
 * Deliberately NOT a general mesh / rigid-body collision solver.
 */
import type {Body,EquipmentPlacement,Vec3} from './types';
import {vec} from './math';

export const SHELF_SOLID_SIZE=vec(1100,600,3000);
export const PROCESS_TANK_SOLID_SIZE=vec(700,700,1350);

export function staticSolidSize(kind:string):Vec3|null{
 return kind==='shelf'?SHELF_SOLID_SIZE:
  kind==='process-tank'?PROCESS_TANK_SOLID_SIZE:null;
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
 return items.some(item=>item.params.blockMaterialFlow===1&&staticSolidSize(item.kind)!==null&&
  !intersectsStaticSolid(body,item)&&intersectsStaticSolid(moved,item));
}
