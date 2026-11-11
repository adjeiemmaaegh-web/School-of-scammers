import {describe,it,expect} from 'vitest';
import {photoeye,inductiveProx} from '../src/plant/equipment/sensors';
import {opticalZoneIntersectsBody,opticalZoneOf} from '../src/plant/equipment/sensor-zone';
import {freshWorld} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';
import type {Body,World} from '../src/plant/world/types';
import type {EquipmentContext} from '../src/plant/world/equipment';
import {validatePlacements} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';

const target=(x:number,y:number,material='cardboard'):Body=>({
 id:'b1',shape:'box',size:vec(180,120,80),massKg:2,
 pos:vec(x,y,120),yawDeg:0,vel:vec(),supportedBy:null,
 tags:{material},
});
const sensor=(extra:Record<string,number>={},yawDeg:EquipmentContext['yawDeg']=0):EquipmentContext=>({
 id:'eye',originMm:vec(0,0,0),yawDeg,
 params:{beamMode:1,beamWidthMm:80,rangeMm:800,responseMs:0,...extra},
});
const detect=(body:Body,ctx:EquipmentContext,fault:string|null=null,
 timeMs=0,metalOnly=false):boolean=>{
 const def=metalOnly?inductiveProx:photoeye;
 const world:World={...freshWorld(11),bodies:[body],timeMs};
 return def.step(def.fresh({}),world,{},10,fault,ctx).state.engaged;
};
describe('P8 worker-owned beam-volume sensing and reproducible faults',()=>{
 it('detects a large target edge while preserving historical centre-only behavior',()=>{
  const body=target(390,85);
  expect(detect(body,sensor())).toBe(false);
  expect(detect(body,sensor({targetMode:1}))).toBe(true);
  expect(opticalZoneIntersectsBody(body,sensor({targetMode:1}),
    opticalZoneOf('geometry-photoeye',sensor({targetMode:1})))).toBe(true);
 });
 it('rotates the target envelope and sensor beam without 2D aliasing',()=>{
  const body={...target(390,110),yawDeg:90 as const};
  expect(detect(body,sensor({targetMode:1}))).toBe(true);
  expect(detect(target(0,390),sensor({targetMode:1},90))).toBe(true);
  expect(detect(target(0,390),sensor({targetMode:1},0))).toBe(false);
 });
 it('requires physical 3D vertical overlap, not only floor-plane projection',()=>{
  expect(detect({...target(350,0),pos:vec(350,0,760)},
   sensor({targetMode:1}))).toBe(false);
  expect(detect({...target(350,0),pos:vec(350,0,570)},
   sensor({targetMode:1}))).toBe(true);
 });
 it('does not let target volume bypass inductive material classification',()=>{
  expect(detect(target(390,85),sensor({targetMode:1}),null,0,true)).toBe(false);
  expect(detect(target(390,85,'metal'),sensor({targetMode:1}),null,0,true)).toBe(true);
 });
 it('misaligned sensor points 90 degrees away and 3D display shares the same fault geometry',()=>{
  const ctx=sensor({targetMode:1});
  const normal=opticalZoneOf('geometry-photoeye',ctx);
  const shifted=opticalZoneOf('geometry-photoeye',ctx,'sensor-misaligned');
  expect(normal.yawDeg).toBe(0);
  expect(shifted.yawDeg).toBe(90);
  expect(detect(target(350,0),ctx,'sensor-misaligned')).toBe(false);
  expect(detect(target(0,350),ctx,'sensor-misaligned')).toBe(true);
 });
 it('intermittent fault repeats only against worker simulation time, never browser wall time',()=>{
  const ctx=sensor();
  const b=target(300,0);
  expect(detect(b,ctx,'sensor-intermittent',0)).toBe(true);
  expect(detect(b,ctx,'sensor-intermittent',160)).toBe(false);
  expect(detect(b,ctx,'sensor-intermittent',310)).toBe(true);
  expect(detect(b,ctx,'sensor-stuck-off',0)).toBe(false);
  expect(detect(target(900,0),ctx,'sensor-stuck-on',0)).toBe(true);
 });
 it('worker rejects unsupported target geometry modes',()=>{
  const place=(value:number)=>[{
   id:'eye',kind:'geometry-photoeye',originMm:vec(0,0,0),
   yawDeg:0 as const,params:{targetMode:value},
  }];
  expect(()=>validatePlacements(place(1),PLANT_EQUIPMENT)).not.toThrow();
  expect(()=>validatePlacements(place(2),PLANT_EQUIPMENT)).toThrow(/parameter/);
 });
});
