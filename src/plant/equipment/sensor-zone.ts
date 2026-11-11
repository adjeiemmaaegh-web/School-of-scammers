/**
 * P7 commissioning sensor geometry shared by the authoritative P3 worker and
 * its read-only 3D visualization. Units are millimetres, world x/y are the
 * horizontal factory plane, z is vertical. Quarter-turn yaw is worker-owned.
 *
 * Existing saved projects deliberately default to the original square zone.
 * A user can opt in to a directional, forward-looking zone for three optical
 * sensor families. The render layer never performs detection itself.
 */
import type {EquipmentContext} from '../world/equipment';
import type {Vec3} from '../world/types';
import {face} from '../world/math';

export type OpticalZone={
 shape:'area'|'forward';
 rangeMm:number;
 beamWidthMm:number;
 heightMm:1200;
 yawDeg:0|90|180|270;
};
export const isDirectionalOpticalKind=(kind:string):boolean=>
 kind==='geometry-photoeye'||kind==='inductive-prox'||kind==='capacitive-prox';

/** Return precisely the active footprint. A dirty lens shortens the actual
 * plant sensor range; the read-only display must show that shorter region.
 */
export function opticalZoneOf(kind:string,ctx:EquipmentContext,fault:string|null=null):OpticalZone{
 const directional=isDirectionalOpticalKind(kind)&&ctx.params.beamMode===1;
 const configured=kind==='light-curtain'?500:ctx.params.rangeMm??200;
 const rangeMm=fault==='dirty-lens'?configured*.25:configured;
 return {
  shape:directional?'forward':'area',
  rangeMm,
  beamWidthMm:directional?(ctx.params.beamWidthMm??100):rangeMm*2,
  heightMm:1200,
  yawDeg:ctx.yawDeg,
 };
}
/** Body-centre detection matches the existing bounded P3 teaching physics.
 * Neither dimensions nor rendering add a fictitious occlusion/laser effect.
 */
export function opticalZoneContains(
 position:Vec3,ctx:EquipmentContext,zone:OpticalZone,
):boolean{
 const dx=position.x-ctx.originMm.x;
 const dy=position.y-ctx.originMm.y;
 if(Math.abs(position.z-ctx.originMm.z)>zone.heightMm/2)return false;
 if(zone.shape==='area')
  return Math.abs(dx)<=zone.rangeMm&&Math.abs(dy)<=zone.rangeMm;
 const direction=face(zone.yawDeg);
 const longitudinal=dx*direction.x+dy*direction.y;
 const transverse=-dx*direction.y+dy*direction.x;
 return longitudinal>=0&&longitudinal<=zone.rangeMm&&
  Math.abs(transverse)<=zone.beamWidthMm/2;
}
