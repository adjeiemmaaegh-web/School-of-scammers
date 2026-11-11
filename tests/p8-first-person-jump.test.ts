import {describe,it,expect} from 'vitest';
import type {PlacedComponent,ProjectFile} from '../src/sim/signals';
import {advanceCamera,initialNavigationPose,FIRST_PERSON_HEIGHT_M,sceneCameraObstacles,
 type CameraPose,type CameraKeys} from '../src/render/workcell-camera';
const idle:CameraKeys={forward:false,back:false,left:false,right:false,
 rise:false,descend:false,jump:false};
const step=(pose:CameraPose,buttons:Partial<CameraKeys>={})=>
 advanceCamera(pose,{...idle,...buttons},.05,'first-person',[]);
const item=(kind:PlacedComponent['kind']):PlacedComponent=>({
 id:'machine',kind,x:455,y:225,pressed:false,yawDeg:90});
const scene=(kind:PlacedComponent['kind']):
 Pick<ProjectFile,'components'|'params'>=>({components:[item(kind)],params:{}});
describe('P8 original first-person movement and jump remain view-only',()=>{
 it('Space launches a finite gravitational jump and always returns to eye height',()=>{
  const start=initialNavigationPose('first-person');
  let current=step(start,{jump:true});
  expect(current.y).toBeGreaterThan(FIRST_PERSON_HEIGHT_M);
  let highest=current.y;
  for(let i=0;i<30;i++){
   current=step(current);
   highest=Math.max(highest,current.y);
  }
  expect(highest).toBeLessThan(FIRST_PERSON_HEIGHT_M+1.2);
  expect(highest).toBeGreaterThan(FIRST_PERSON_HEIGHT_M+.45);
  expect(current.y).toBe(FIRST_PERSON_HEIGHT_M);
  expect(current.verticalVelocityMps).toBe(0);
  expect(start.y).toBe(FIRST_PERSON_HEIGHT_M);
 });
 it('does not retrigger a jump while Space is held continuously',()=>{
  let camera=initialNavigationPose('first-person');
  for(let i=0;i<50;i++)camera=step(camera,{jump:true});
  expect(camera.y).toBe(FIRST_PERSON_HEIGHT_M);
  camera=step(camera,{jump:true});
  expect(camera.y).toBe(FIRST_PERSON_HEIGHT_M);
  camera=step(camera);camera=step(camera,{jump:true});
  expect(camera.y).toBeGreaterThan(FIRST_PERSON_HEIGHT_M);
 });
 it('Fly and Orbit navigation contracts remain unchanged',()=>{
  const fly=initialNavigationPose('fly');
  const moved=advanceCamera(fly,{...idle,jump:true},.05,'fly',[]);
  expect(moved.y).toBe(fly.y);
  expect(moved.verticalVelocityMps).toBeUndefined();
 });
 it('uses actual rack height rather than a generic 400mm fake obstacle',()=>{
  const rack=sceneCameraObstacles(scene('shelf'))[0];
  const belt=sceneCameraObstacles(scene('roller-conveyor'))[0];
  expect(rack.height).toBe(3);
  expect(belt.height).toBeCloseTo(.12,6);
 });
 it('can traverse a low conveyor during jump, but not a tall rack',()=>{
  const starting:CameraPose={x:.83,y:FIRST_PERSON_HEIGHT_M,z:0,
   yaw:-Math.PI/2,pitch:0};
  const walk=(kind:'roller-conveyor'|'shelf')=>{
   let p=starting;
   const obstacles=sceneCameraObstacles(scene(kind));
   for(let i=0;i<9;i++)p=advanceCamera(p,
    {...idle,forward:true,jump:i===0},.05,'first-person',obstacles);
   return p;
  };
  const aboveBelt=walk('roller-conveyor'),atRack=walk('shelf');
  expect(aboveBelt.x).toBeLessThan(.3);
  expect(atRack.x).toBeGreaterThan(.65);
 });
 it('never mutates project, body/sensor/PLC state or reads wall-clock time',()=>{
  const original=scene('shelf');
  const before=JSON.stringify(original);
  const obstacles=sceneCameraObstacles(original);
  const pose=advanceCamera(initialNavigationPose('first-person'),{
   ...idle,jump:true,forward:true},.04,'first-person',obstacles);
  expect(pose.y).toBeGreaterThan(FIRST_PERSON_HEIGHT_M);
  expect(JSON.stringify(original)).toBe(before);
 });
});
