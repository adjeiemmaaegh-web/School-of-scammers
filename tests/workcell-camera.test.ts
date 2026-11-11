import { describe,expect,it } from 'vitest';
import type { ProjectFile, PlacedComponent } from '../src/sim/signals';
import {
  FIRST_PERSON_HEIGHT_M, FLOOR_LIMIT_X, FLOOR_LIMIT_Z,
  advanceCamera, initialNavigationPose, sceneCameraObstacles,
  type CameraKeys, type CameraPose,
} from '../src/render/workcell-camera';

const idle:CameraKeys={forward:false,back:false,left:false,right:false,rise:false,descend:false};
const key=(name:keyof CameraKeys):CameraKeys=>({...idle,[name]:true});
const part=(kind:PlacedComponent['kind'],id:string,x:number,y:number,yawDeg:PlacedComponent['yawDeg']=0):PlacedComponent=>
 ({kind,id,x,y,yawDeg,pressed:false});
const project=(components:PlacedComponent[],params:ProjectFile['params']={}):
  Pick<ProjectFile,'components'|'params'>=>({components,params});

describe('P6 Factory I/O-style 3D camera navigation (read-only inspection)',()=>{
 it('has a real default eye-height position and never creates PLC signals',()=>{
  const p=initialNavigationPose('first-person');
  expect(p.y).toBe(FIRST_PERSON_HEIGHT_M);
  expect(p.x).toBeLessThan(FLOOR_LIMIT_X);
  expect(p.z).toBeLessThan(FLOOR_LIMIT_Z);
  expect(initialNavigationPose('fly').z).toBeLessThan(FLOOR_LIMIT_Z);
 });
 it('walks with W across the simulated floor in a stable yaw-relative direction',()=>{
  const start=initialNavigationPose('first-person');
  const next=advanceCamera(start,key('forward'),.04,'first-person',[]);
  expect(next.x).toBeLessThan(start.x);
  expect(next.z).toBeLessThan(start.z);
  expect(next.y).toBe(FIRST_PERSON_HEIGHT_M);
  expect(next.yaw).toBe(start.yaw);
 });
 it('strafe changes the horizontal axis but never eye height in first person',()=>{
  const p:CameraPose={x:0,y:FIRST_PERSON_HEIGHT_M,z:0,yaw:0,pitch:0};
  const right=advanceCamera(p,key('right'),.05,'first-person',[]);
  expect(right.x).toBeGreaterThan(0);
  expect(right.z).toBe(0);
  expect(advanceCamera(p,key('rise'),.05,'first-person',[]).y).toBe(FIRST_PERSON_HEIGHT_M);
 });
 it('Fly mode moves vertically with Q/E and keeps positive height',()=>{
  const start=initialNavigationPose('fly');
  expect(advanceCamera(start,key('rise'),.05,'fly',[]).y).toBeGreaterThan(start.y);
  expect(advanceCamera(start,key('descend'),.05,'fly',[]).y).toBeLessThan(start.y);
  let pose:CameraPose={...start,y:.4};
  pose=advanceCamera(pose,key('descend'),.05,'fly',[]);
  expect(pose.y).toBe(.4);
 });
 it('normalizes diagonal navigation to avoid diagonal speed cheating',()=>{
  const p:CameraPose={x:0,y:FIRST_PERSON_HEIGHT_M,z:0,yaw:0,pitch:0};
  const straight=advanceCamera(p,key('forward'),.05,'first-person',[]);
  const diagonal=advanceCamera(p,{...key('forward'),right:true},.05,'first-person',[]);
  expect(Math.hypot(straight.x,straight.z)).toBeCloseTo(
    Math.hypot(diagonal.x,diagonal.z),6);
 });
 it('honors fixed scene bounds even after many forward steps',()=>{
  let p:CameraPose={x:0,y:FIRST_PERSON_HEIGHT_M,z:2.8,yaw:Math.PI,pitch:0};
  for(let i=0;i<300;i++)p=advanceCamera(p,key('forward'),.05,'first-person',[]);
  expect(p.z).toBeLessThanOrEqual(FLOOR_LIMIT_Z);
  expect(p.x).toBeLessThanOrEqual(FLOOR_LIMIT_X);
 });
 it('uses P3 registered equipment dimensions and orientation for collision envelopes',()=>{
  const before=sceneCameraObstacles(project([part('roller-conveyor','r',455,225)]))[0];
  expect(before).toMatchObject({x:0,z:0});
  expect(before.halfX).toBeCloseTo(.3,6);
  expect(before.halfZ).toBeCloseTo(.15,6);
  const after=sceneCameraObstacles(project([part('roller-conveyor','r',455,225,90)]))[0];
  expect(after.halfX).toBeCloseTo(.15,6);
  expect(after.halfZ).toBeCloseTo(.3,6);
 });
 it('blocks a first-person body from entering a powered conveyor footprint',()=>{
  const obstacles=sceneCameraObstacles(project([part('roller-conveyor','r',455,225)]));
  let p:CameraPose={x:.7,z:0,y:FIRST_PERSON_HEIGHT_M,yaw:-Math.PI/2,pitch:0};
  for(let i=0;i<20;i++)p=advanceCamera(p,key('forward'),.05,'first-person',obstacles);
  expect(p.x).toBeGreaterThanOrEqual(.43-1e-5);
  expect(p.y).toBe(FIRST_PERSON_HEIGHT_M);
 });
 it('does not silently move through a 3D machine while using low Fly inspection',()=>{
  const obstacles=sceneCameraObstacles(project([part('roller-conveyor','r',455,225)]));
  const pose:CameraPose={x:.7,z:0,y:.2,yaw:-Math.PI/2,pitch:0};
  let current=pose;
  for(let i=0;i<20;i++)current=advanceCamera(current,key('forward'),.05,'fly',obstacles);
  expect(current.x).toBeGreaterThanOrEqual(.43-1e-5);
 });
 it('preserves the original project object: camera movement is never a PLC input',()=>{
  const scene=project([part('geometry-photoeye','eye',300,220),
    part('roller-conveyor','roller',455,225,90)],{'roller':{lengthMm:1200}});
  const before=JSON.stringify(scene);
  const obstacles=sceneCameraObstacles(scene);
  advanceCamera(initialNavigationPose('first-person'),key('forward'),.05,'first-person',obstacles);
  expect(JSON.stringify(scene)).toBe(before);
 });
 it('ignores nonfinite or negative frame intervals and caps long stalls',()=>{
  const pose=initialNavigationPose('fly');
  expect(advanceCamera(pose,key('forward'),Number.NaN,'fly',[])).toBe(pose);
  expect(advanceCamera(pose,key('forward'),-.01,'fly',[])).toBe(pose);
  expect(Math.abs(advanceCamera(pose,key('forward'),10,'fly',[]).x-pose.x)).toBeLessThan(.3);
 });
});
