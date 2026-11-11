/**
 * P8 bounded optical visibility for the authoritative deterministic P3 worker.
 * This is a line-segment versus yaw-oriented solid-envelope intersection,
 * NOT a ray tracer, calibrated photoelectric model, glass/reflection model,
 * or proof of industrial collision/safety accuracy.
 *
 * Explicitly opaque installed structures (rack / process vessel) are supplied
 * by the worker with footprints from its registered equipment definitions.
 * Ordinary conveyors, bodies and sensor mounts are not generic occluders.
 * Existing scene projects remain unchanged unless a sensor opts in.
 */
import type {SceneOccluder} from '../world/equipment';
import type {Vec3} from '../world/types';
import {face} from '../world/math';

const EPS=1e-7;

/** Segment intersects an oriented 3D solid strictly before the target point. */
export function sightlineHitsSolid(start:Vec3,target:Vec3,solid:SceneOccluder):boolean{
 const heading=face(solid.yawDeg);
 const local=(p:Vec3):[number,number,number]=>{
  const dx=p.x-solid.originMm.x,dy=p.y-solid.originMm.y;
  return [dx*heading.x+dy*heading.y,
   -dx*heading.y+dy*heading.x,
   p.z-solid.originMm.z-solid.sizeMm.z/2];
 };
 const a=local(start),b=local(target);
 const half=[solid.sizeMm.x/2,solid.sizeMm.y/2,solid.sizeMm.z/2];
 let enter=0,exit=1;
 for(let axis=0;axis<3;axis++){
  const delta=b[axis]-a[axis];
  if(Math.abs(delta)<EPS){
   if(a[axis]<-half[axis]||a[axis]>half[axis])return false;
   continue;
  }
  let near=(-half[axis]-a[axis])/delta;
  let far=(half[axis]-a[axis])/delta;
  if(near>far)[near,far]=[far,near];
  enter=Math.max(enter,near);
  exit=Math.min(exit,far);
  if(exit<enter)return false;
 }
 return exit>EPS&&enter<1-EPS;
}

/** No mutation; stable ordering and no browser/renderer state. */
export function hasUnobstructedSightline(
 start:Vec3,target:Vec3,solids:readonly SceneOccluder[],sensorId:string,
):boolean{
 return !solids.some(solid=>solid.id!==sensorId&&sightlineHitsSolid(start,target,solid));
}
