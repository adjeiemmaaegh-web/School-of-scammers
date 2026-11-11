/**
 * Camera navigation for the 3D teaching workcell.
 * Camera motion changes only the view; the PLC worker never reads these poses.
 * Bounds/part footprints provide simple inspection navigation, not a rigid-body
 * person simulator or a certified machine collision model.
 */
import type { ProjectFile } from '../sim/signals';
import { footprintOf } from '../workspace/floor-plan';

export type WorkcellCameraMode = 'orbit' | 'fly' | 'first-person';
export type CameraPose = { x:number; y:number; z:number; yaw:number; pitch:number };
export type CameraKeys = { forward:boolean; back:boolean; left:boolean; right:boolean;
  rise:boolean; descend:boolean };
export type CameraObstacle = { x:number; z:number; halfX:number; halfZ:number; height:number };
export const FIRST_PERSON_HEIGHT_M = 1.8;
export const FLOOR_LIMIT_X = 5.55, FLOOR_LIMIT_Z = 3.05;
export const CAMERA_RADIUS_M = 0.13;
export const initialNavigationPose = (mode:Exclude<WorkcellCameraMode,'orbit'>):CameraPose =>
  mode==='first-person'
    ? {x:4.75,y:FIRST_PERSON_HEIGHT_M,z:2.48,yaw:-0.9,pitch:-0.08}
    : {x:4.5,y:3.5,z:2.55,yaw:-0.85,pitch:-0.32};

/** P3 dimensions and yaw are used, not a separate fixed 2D collider list. */
export function sceneCameraObstacles(project:Pick<ProjectFile,'components'|'params'>):CameraObstacle[] {
 return project.components.map(c=>{
  const f=footprintOf(c,project.params);
  const isPlant=f.isPlant;
  return {
   x:(f.x-540)/100,z:(f.y-290)/100,
   halfX:(isPlant?f.width:150)/200,
   halfZ:(isPlant?f.depth:120)/200,
   height:isPlant?Math.max(.15, (c.kind==='turntable' ? 150 : 400)/1000):1.5,
  };
 });
}
const within=(x:number,z:number):boolean =>
  x>=-FLOOR_LIMIT_X&&x<=FLOOR_LIMIT_X&&z>=-FLOOR_LIMIT_Z&&z<=FLOOR_LIMIT_Z;
const occupied=(x:number,y:number,z:number,obstacles:readonly CameraObstacle[]):boolean=>
 obstacles.some(o=>y < o.height+0.13 &&
  Math.abs(x-o.x)<o.halfX+CAMERA_RADIUS_M &&
  Math.abs(z-o.z)<o.halfZ+CAMERA_RADIUS_M);

/** Advances one bounded frame; sliding is axis-independent. Even a fly view
 * stays within the classroom floor and cannot fly through registered parts.
 * If a scene reload places a camera inside an object, moving OUT is allowed.
 */
export function advanceCamera(
 pose:CameraPose, keys:CameraKeys, seconds:number,
 mode:Exclude<WorkcellCameraMode,'orbit'>,
 obstacles:readonly CameraObstacle[],
):CameraPose {
 if(!Number.isFinite(seconds)||seconds<=0)return pose;
 const dt=Math.min(seconds,.05);
 const fwd=(Number(keys.forward)-Number(keys.back));
 const side=(Number(keys.right)-Number(keys.left));
 const norm=Math.max(1,Math.hypot(fwd,side));
 const speed=mode==='first-person'?2.4:4.5;
 const dx=(Math.sin(pose.yaw)*fwd+Math.cos(pose.yaw)*side)*speed*dt/norm;
 const dz=(-Math.cos(pose.yaw)*fwd+Math.sin(pose.yaw)*side)*speed*dt/norm;
 const nextY=mode==='first-person'?FIRST_PERSON_HEIGHT_M:
   Math.max(.4,Math.min(11,pose.y+(Number(keys.rise)-Number(keys.descend))*3*dt));
 const collisionHeight=mode==='first-person' ? .2 : nextY;
 const previousCollisionHeight=mode==='first-person' ? .2 : pose.y;
 const canMove=(x:number,z:number):boolean=>within(x,z)&&(
  !occupied(x,collisionHeight,z,obstacles) ||
  (occupied(pose.x,previousCollisionHeight,pose.z,obstacles) &&
   // A reloaded camera inside scenery must still be allowed to escape.
   obstacles.every(o=>{
    const prior=Math.hypot((pose.x-o.x)/(o.halfX+CAMERA_RADIUS_M),
      (pose.z-o.z)/(o.halfZ+CAMERA_RADIUS_M));
    const next=Math.hypot((x-o.x)/(o.halfX+CAMERA_RADIUS_M),
      (z-o.z)/(o.halfZ+CAMERA_RADIUS_M));
    return next>=prior-1e-6;
   }))
 );
 let x=pose.x,z=pose.z;
 if(canMove(pose.x+dx,z))x=pose.x+dx;
 if(canMove(x,pose.z+dz))z=pose.z+dz;
 return {...pose,x,y:nextY,z};
}
