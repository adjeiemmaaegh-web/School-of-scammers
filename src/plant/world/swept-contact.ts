/**
 * Deterministic P8 3D continuous contact broad phase for quarter-turn teaching
 * solids. Body.pos.z is its BOTTOM (as in the P3 body renderer). Contact is
 * segment-versus-expanded rotated outer box with conservative cylinder bounds.
 * No mesh impulses, friction, arbitrary-angle solver or industrial rating.
 */
import type {Body,EquipmentPlacement,Vec3} from './types';

type Box={center:Vec3;half:Vec3};
const TOL=1e-8;
export const bodyEnvelope=(b:Body):Box=>{
 const quarter=b.yawDeg===90||b.yawDeg===270;
 return {center:{x:b.pos.x,y:b.pos.y,z:b.pos.z+b.size.z/2},
  half:{x:(quarter?b.size.y:b.size.x)/2,
   y:(quarter?b.size.x:b.size.y)/2,z:b.size.z/2}};
};
export const placementEnvelope=(p:EquipmentPlacement,size:Vec3):Box=>{
 const quarter=p.yawDeg===90||p.yawDeg===270;
 return {center:{x:p.originMm.x,y:p.originMm.y,z:p.originMm.z+size.z/2},
  half:{x:(quarter?size.y:size.x)/2,
   y:(quarter?size.x:size.y)/2,z:size.z/2}};
};

/** Earliest path fraction within [0,1] for 3D full-volume contact.
 * A body already overlapping the target is ignored, preserving intentionally
 * overlapping legacy/material-transfer arrangements. Touching and moving
 * *away* is not a collision. Pure, fixed order, no floating randomness.
 */
export function sweptBoxEntry(moving:Box,target:Box,delta:Vec3):number|null{
 const extent={x:moving.half.x+target.half.x,
  y:moving.half.y+target.half.y,z:moving.half.z+target.half.z};
 const diff={x:moving.center.x-target.center.x,
  y:moving.center.y-target.center.y,z:moving.center.z-target.center.z};
 const axes=['x','y','z'] as const;
 if(axes.every(k=>Math.abs(diff[k])<extent[k]-TOL))return null;
 let enters=0,exits=1;
 for(const axis of axes){
  const speed=delta[axis];
  if(Math.abs(speed)<TOL){
   if(Math.abs(diff[axis])>=extent[axis]-TOL)return null;
   continue;
  }
  let near=(-extent[axis]-diff[axis])/speed;
  let far=(extent[axis]-diff[axis])/speed;
  if(near>far)[near,far]=[far,near];
  enters=Math.max(enters,near);exits=Math.min(exits,far);
  if(exits<enters-TOL)return null;
 }
 // A single instantaneous exit from an initial touch is not a contact.
 return exits>TOL&&enters<=1+TOL?Math.max(0,Math.min(1,enters)):null;
}

/** True 3D volume overlap under the cardinal-yaw educational model. */
export function bodyVolumeOverlap(a:Body,b:Body):boolean{
 const x=bodyEnvelope(a),y=bodyEnvelope(b);
 return Math.abs(x.center.x-y.center.x)<x.half.x+y.half.x-TOL&&
  Math.abs(x.center.y-y.center.y)<x.half.y+y.half.y-TOL&&
  Math.abs(x.center.z-y.center.z)<x.half.z+y.half.z-TOL;
}
export function sweptBodyContact(a:Body,b:Body,delta:Vec3):number|null{
 if(a.id===b.id)return null;
 return sweptBoxEntry(bodyEnvelope(a),bodyEnvelope(b),delta);
}
export function sweptPlacementContact(body:Body,place:EquipmentPlacement,
 size:Vec3,delta:Vec3):number|null{
 return sweptBoxEntry(bodyEnvelope(body),placementEnvelope(place,size),delta);
}
