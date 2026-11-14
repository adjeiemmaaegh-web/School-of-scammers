import {describe,expect,it} from 'vitest';
import {freshWorld} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';
import type {Body,EquipmentPlacement,World} from '../src/plant/world/types';
import type {SceneOccluder} from '../src/plant/world/equipment';
import {sightlineHitsSolid,hasUnobstructedSightline} from '../src/plant/equipment/line-of-sight';
import {freshRuntime,stepScene,validatePlacements} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';

const fixtureBody=(x=750,y=0,z=120):Body=>({
 id:'b1',shape:'box',size:vec(80,80,80),massKg:1,
 pos:vec(x,y,z),yawDeg:0,vel:vec(),supportedBy:null,tags:{material:'cardboard'},
});
const item=(id:string,kind:string,x:number,y:number,yawDeg:EquipmentPlacement['yawDeg']=0,
 params:Record<string,number>={}):EquipmentPlacement=>({
 id,kind,originMm:vec(x,y,0),yawDeg,params,
});
const sensor=(params:Record<string,number>={})=>item('eye','geometry-photoeye',0,0,0,{
 rangeMm:800,responseMs:0,beamMode:1,beamWidthMm:100,occlusionMode:1,...params,
});
const rack=(yawDeg:EquipmentPlacement['yawDeg']=90)=>
 item('rack','shelf',400,400,yawDeg);
const scene=(placements:EquipmentPlacement[],body:Body=fixtureBody()):boolean=>{
 const world:World={...freshWorld(42),bodies:[body]};
 const runtime=freshRuntime(world,placements,PLANT_EQUIPMENT);
 return stepScene(runtime,placements,PLANT_EQUIPMENT).signals.eye.present as boolean;
};
const solid=(yawDeg:SceneOccluder['yawDeg']=90):SceneOccluder=>({
 id:'rack',originMm:vec(400,400,0),yawDeg,sizeMm:vec(1100,600,3000),
});

describe('P8 opt-in structural line-of-sight occlusion',()=>{
 it('detects an unobstructed target through the real worker scan',()=>{
  expect(scene([sensor()])).toBe(true);
 });
 it('blocks a target hidden behind the yaw-rotated rack, not just a rendered effect',()=>{
  expect(scene([sensor(),rack()])).toBe(false);
 });
 it('uses physical 3D rack yaw, not an unrotated 2D bounding shortcut',()=>{
  expect(scene([sensor(),rack(0)])).toBe(true);
  expect(scene([sensor(),rack(90)])).toBe(false);
 });
 it('keeps the old area and forward modes exactly unchanged unless opted in',()=>{
  expect(scene([sensor({occlusionMode:0}),rack()])).toBe(true);
  expect(scene([sensor({beamMode:0}),rack()],fixtureBody(190,0))).toBe(true);
 });
 it('does not allow conveyors or sensor mounts to become invented blockers',()=>{
  const conveyor=item('belt','belt-conveyor',400,0,90);
  const other=item('prox','inductive-prox',300,0,0);
  expect(scene([sensor(),conveyor,other])).toBe(true);
 });
 it('uses 3D height and ray intersection, not ground-plane proximity alone',()=>{
  const start=vec(0,0,3200),target=vec(750,0,3200);
  expect(sightlineHitsSolid(start,target,solid())).toBe(false);
  expect(sightlineHitsSolid(vec(0,0,120),vec(750,0,120),solid())).toBe(true);
  expect(sightlineHitsSolid(vec(0,0,120),vec(750,0,120),solid(0))).toBe(false);
 });
 it('keeps occlusion deterministic and immutable with any solids ordering',()=>{
  const open=solid(0),blocked=solid(90),start=vec(0,0,120),target=vec(750,0,120);
  const solids=[open,blocked] as const;
  const snapshot=JSON.stringify(solids);
  expect(hasUnobstructedSightline(start,target,solids,'eye')).toBe(false);
  expect(hasUnobstructedSightline(start,target,[...solids].reverse(),'eye')).toBe(false);
  expect(hasUnobstructedSightline(start,target,[{...blocked,id:'eye'}],'eye')).toBe(true);
  expect(JSON.stringify(solids)).toBe(snapshot);
 });
 it('rejects unsupported parameter values through the saved scene validator',()=>{
  expect(()=>validatePlacements([sensor({occlusionMode:4})],PLANT_EQUIPMENT))
   .toThrow(/Invalid plant parameter/);
  expect(()=>validatePlacements([sensor({occlusionMode:1})],PLANT_EQUIPMENT))
   .not.toThrow();
 });
});
