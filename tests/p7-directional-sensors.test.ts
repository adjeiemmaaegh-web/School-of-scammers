import {describe,it,expect} from 'vitest';
import type {Body,World} from '../src/plant/world/types';
import type {EquipmentContext} from '../src/plant/world/equipment';
import {freshWorld} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';
import {validatePlacements} from '../src/plant/world/runner';
import {photoeye,inductiveProx,capacitiveProx,lightCurtain} from '../src/plant/equipment/sensors';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {opticalZoneContains,opticalZoneOf} from '../src/plant/equipment/sensor-zone';

const ctx=(yawDeg:EquipmentContext['yawDeg']=0,params:Record<string,number>={}):EquipmentContext=>({
 id:'eye',originMm:vec(0,0,0),yawDeg,params:{rangeMm:400,responseMs:0,...params},
});
const body=(x:number,y:number,z=120,metal=false):Body=>({
 id:'b1',shape:'box',size:vec(80,80,80),massKg:1,
 pos:vec(x,y,z),yawDeg:0,vel:vec(),supportedBy:null,
 tags:{material:metal?'metal':'cardboard'},
});
const world=(...bodies:Body[]):World=>({...freshWorld(123),bodies});
const detect=(equipment:typeof photoeye,w:World,context:EquipmentContext,fault:string|null=null)=>
 equipment.step(equipment.fresh({}),w,{},10,fault,context).state.engaged;

describe('P7 exact worker-to-3D directional photoeye geometry',()=>{
 it('keeps historic area sensing for every project that has no new sensor settings',()=>{
  const c=ctx();
  const zone=opticalZoneOf('geometry-photoeye',c);
  expect(zone).toMatchObject({shape:'area',rangeMm:400,beamWidthMm:400,yawDeg:0});
  expect(detect(photoeye,world(body(-180,180)),c)).toBe(true);
  expect(detect(photoeye,world(body(-210,0)),c)).toBe(false);
  expect(detect(photoeye,world(body(0,0,601)),c)).toBe(false);
 });
 it('enables actual forward detection only when beamMode is explicitly set',()=>{
  const c=ctx(0,{beamMode:1,beamWidthMm:100});
  expect(opticalZoneOf('geometry-photoeye',c)).toMatchObject({
   shape:'forward',rangeMm:400,beamWidthMm:100,yawDeg:0,
  });
  expect(detect(photoeye,world(body(250,40)),c)).toBe(true);
  expect(detect(photoeye,world(body(-20,0)),c)).toBe(false);
  expect(detect(photoeye,world(body(210,60)),c)).toBe(false);
  expect(detect(photoeye,world(body(401,0)),c)).toBe(false);
  expect(detect(photoeye,world(body(200,0,700)),c)).toBe(false);
 });
 it('rotates the detection strip with worker-preserved 0/90/180/270 yaw',()=>{
  for(const [yaw,x,y] of [[0,220,0],[90,0,220],[180,-220,0],[270,0,-220]] as const){
   const c=ctx(yaw,{beamMode:1,beamWidthMm:60});
   const zone=opticalZoneOf('geometry-photoeye',c);
   expect(opticalZoneContains(vec(x,y,130),c,zone)).toBe(true);
   expect(detect(photoeye,world(body(x,y)),c)).toBe(true);
   expect(detect(photoeye,world(body(-x,-y)),c)).toBe(false);
  }
 });
 it('applies worker dirty-lens range reduction to both sampling and visual descriptor',()=>{
  const c=ctx(0,{beamMode:1,beamWidthMm:100});
  const clear=opticalZoneOf('geometry-photoeye',c);
  const dirty=opticalZoneOf('geometry-photoeye',c,'dirty-lens');
  expect(clear.rangeMm).toBe(400);
  expect(dirty.rangeMm).toBe(100);
  expect(detect(photoeye,world(body(150,0)),c,null)).toBe(true);
  expect(detect(photoeye,world(body(150,0)),c,'dirty-lens')).toBe(false);
  expect(detect(photoeye,world(body(90,0)),c,'dirty-lens')).toBe(true);
 });
 it('keeps material classification and direct optical geometry in the worker',()=>{
  const c=ctx(90,{beamMode:1,beamWidthMm:100});
  expect(detect(inductiveProx,world(body(0,200,120,false)),c)).toBe(false);
  expect(detect(inductiveProx,world(body(0,200,120,true)),c)).toBe(true);
  expect(detect(capacitiveProx,world(body(0,200,120,false)),c)).toBe(true);
 });
 it('preserves legacy height-curtain square and does not invent directional sensing',()=>{
  const c=ctx(90,{beamMode:1,beamWidthMm:30});
  const zone=opticalZoneOf('light-curtain',c);
  expect(zone).toMatchObject({shape:'area',rangeMm:500,yawDeg:90});
  expect(detect(lightCurtain,world(body(-240,-240)),c)).toBe(true);
 });
 it('does not infer orientation or change any saved world data',()=>{
  const c=ctx(180,{beamMode:1,beamWidthMm:100});
  const w=world(body(-300,10),body(400,0));
  const original=JSON.stringify({c,w});
  const zone=opticalZoneOf('geometry-photoeye',c);
  detect(photoeye,w,c);
  expect(opticalZoneContains(w.bodies[0].pos,c,zone)).toBe(true);
  expect(JSON.stringify({c,w})).toBe(original);
 });
 it('rejects invalid beam modes and widths through the existing P3 parameter gate',()=>{
  const placement=(params:Record<string,number>)=>[{
   id:'photoeye-1',kind:'geometry-photoeye',originMm:vec(),yawDeg:0 as const,params,
  }];
  expect(()=>validatePlacements(placement({beamMode:2}),PLANT_EQUIPMENT)).toThrow(/parameter/);
  expect(()=>validatePlacements(placement({beamWidthMm:15}),PLANT_EQUIPMENT)).toThrow(/parameter/);
  expect(()=>validatePlacements(placement({beamMode:1,beamWidthMm:100}),PLANT_EQUIPMENT)).not.toThrow();
 });
});
