/**
 * P7 commissioning sensor geometry shared by the authoritative P3 worker and
 * its read-only 3D visualization. Units are millimetres, world x/y are the
 * horizontal factory plane, z is vertical. Quarter-turn yaw is worker-owned.
 *
 * Existing saved projects deliberately default to the original square zone.
 * In area mode, rangeMm is the square's full side length (the historical
 * insideFootprint(vec(range,range)) semantics, NOT radius). A user can opt
 * in to a directional, forward-looking zone for three optical
 * sensor families. The render layer never performs detection itself.
 */
import type {EquipmentContext} from '../world/equipment';
import type {Body,Vec3} from '../world/types';
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
  beamWidthMm:directional?(ctx.params.beamWidthMm??100):rangeMm,
  heightMm:1200,
  // Training fault shifts a directional head by a full quarter-turn.
  // The read-only beam display uses this same descriptor as the worker.
  yawDeg:fault==='sensor-misaligned'?(((ctx.yawDeg+90)%360) as 0|90|180|270):ctx.yawDeg,
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
  return Math.abs(dx)<=zone.rangeMm/2&&Math.abs(dy)<=zone.rangeMm/2;
 const direction=face(zone.yawDeg);
 const longitudinal=dx*direction.x+dy*direction.y;
 const transverse=-dx*direction.y+dy*direction.x;
 return longitudinal>=0&&longitudinal<=zone.rangeMm&&
  Math.abs(transverse)<=zone.beamWidthMm/2;
}

/** Optional P8 beam-volume contact: sensor yaw and body yaw are cardinal, so
 * projecting the body's outer bounds onto the beam's local axes is exact for
 * rectangular teaching boxes. Cylinder bodies use their circumscribed bounds.
 * Material classification and visibility are handled separately by the worker.
 * Disabled by default so historical centre-point sensing never changes.
 */
export function opticalZoneIntersectsBody(
 body:Body,ctx:EquipmentContext,zone:OpticalZone,
):boolean{
 if(zone.shape!=='forward')return opticalZoneContains(body.pos,ctx,zone);
 const direction=face(zone.yawDeg);
 const dx=body.pos.x-ctx.originMm.x,dy=body.pos.y-ctx.originMm.y;
 const long=dx*direction.x+dy*direction.y;
 const lateral=-dx*direction.y+dy*direction.x;
 const quarter=body.yawDeg===90||body.yawDeg===270;
 const sx=quarter?body.size.y:body.size.x;
 const sy=quarter?body.size.x:body.size.y;
 const longitudinalHalf=Math.abs(direction.x)*sx/2+Math.abs(direction.y)*sy/2;
 const lateralHalf=Math.abs(direction.y)*sx/2+Math.abs(direction.x)*sy/2;
 const zoneMinZ=ctx.originMm.z-zone.heightMm/2;
 const zoneMaxZ=ctx.originMm.z+zone.heightMm/2;
 return long+longitudinalHalf>=0&&long-longitudinalHalf<=zone.rangeMm&&
  Math.abs(lateral)<=lateralHalf+zone.beamWidthMm/2&&
  body.pos.z+body.size.z>=zoneMinZ&&body.pos.z<=zoneMaxZ;
}
