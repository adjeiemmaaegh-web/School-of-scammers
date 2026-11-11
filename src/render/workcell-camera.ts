/**
 * Camera navigation for the 3D teaching workcell.
 * Camera motion changes only the view; the PLC worker never reads these poses.
 * Bounds/part footprints provide simple inspection navigation, not a rigid-body
 * person simulator or a certified machine collision model.
 */
import type { ProjectFile } from '../sim/signals';
import { footprintOf } from '../workspace/floor-plan';
import { PLANT_EQUIPMENT } from '../plant/equipment';

export type WorkcellCameraMode = 'orbit' | 'fly' | 'first-person';
export type CameraPose = { x:number; y:number; z:number; yaw:number; pitch:number;
 /** Local view-only jump state, never sent to the PLC worker. */
 verticalVelocityMps?:number; jumpConsumed?:boolean };
export type CameraKeys = { forward:boolean; back:boolean; left:boolean; right:boolean;
  rise:boolean; descend:boolean; jump?:boolean };
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
   height:isPlant?Math.max(.15,(PLANT_EQUIPMENT[c.kind]?.footprint.z??400)/1000):1.5,
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
 const firstPerson=mode==='first-person';
 const grounded=pose.y<=FIRST_PERSON_HEIGHT_M+1e-6;
 const jumpStarts=firstPerson&&grounded&&!!keys.jump&&!pose.jumpConsumed;
 // Fixed-step classroom jump with gravity, independent of the worker clock.
 // Space is edge-triggered: holding it may not repeatedly launch an avatar.
 const v0=jumpStarts?3.65:pose.verticalVelocityMps??0;
 const vertical=firstPerson?Math.max(FIRST_PERSON_HEIGHT_M,
   pose.y+v0*dt-9.81*dt*dt/2):pose.y;
 const nextY=firstPerson?vertical:
   Math.max(.4,Math.min(11,pose.y+(Number(keys.rise)-Number(keys.descend))*3*dt));
 const v1=nextY<=FIRST_PERSON_HEIGHT_M?0:v0-9.81*dt;
 // Obstacles are floor-mounted: a jumping viewpoint may clear low conveyors,
 // but not a full-height rack. This remains view-only, not avatar/PLC input.
 const collisionHeight=firstPerson?Math.max(.2,nextY-FIRST_PERSON_HEIGHT_M):nextY;
 const previousCollisionHeight=firstPerson?
   Math.max(.2,pose.y-FIRST_PERSON_HEIGHT_M):pose.y;
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
 return firstPerson?{...pose,x,y:nextY,z,
  verticalVelocityMps:v1,jumpConsumed:!!keys.jump}:
  {...pose,x,y:nextY,z};
}


/** Frame saved 3D equipment without zooming to a fake viewport extent.
 * All positions are metres. Reading project coordinates has no effect on
 * PLC states or simulation time; requested framing never mutates the model.
 */
export function frameEntireWorkcell(
 project:Pick<ProjectFile,'components'|'params'>,
):{target:[number,number,number];position:[number,number,number]}{
 if(!project.components.length)
  return {target:[0,0,0],position:[7,8.5,10]};
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const component of project.components){
  const bounds=footprintOf(component,project.params);
  const x=(bounds.x-540)/100,z=(bounds.y-290)/100;
  const halfX=bounds.width/200,halfZ=bounds.depth/200;
  minX=Math.min(minX,x-halfX);maxX=Math.max(maxX,x+halfX);
  minZ=Math.min(minZ,z-halfZ);maxZ=Math.max(maxZ,z+halfZ);
 }
 const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
 // Include the vertical viewing angle and a comfortable border for labels.
 const sceneSpan=Math.max(maxX-minX,(maxZ-minZ)*1.8,2.5);
 const distance=Math.min(14,Math.max(4,sceneSpan*1.05));
 return {target:[cx,0,cz],position:[cx+distance*.65,
  1+distance*.95,cz+distance]};
}
