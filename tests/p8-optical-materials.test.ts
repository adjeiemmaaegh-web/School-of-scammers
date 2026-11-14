import {describe,it,expect} from 'vitest';
import {vec} from '../src/plant/world/math';
import {freshWorld} from '../src/plant/world/bodies';
import {photoeye,capacitiveProx} from '../src/plant/equipment/sensors';
import {opticallyOpaque,sightlineClearOfBodies} from '../src/plant/equipment/line-of-sight';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {validatePlacements} from '../src/plant/world/runner';
import type {Body,World} from '../src/plant/world/types';
import type {EquipmentContext} from '../src/plant/world/equipment';
const body=(id:string,x:number,material:string):Body=>({
 id,shape:'box',size:vec(90,90,90),pos:vec(x,0,120),massKg:3,
 yawDeg:0,vel:vec(),supportedBy:null,tags:{material},
});
const near=body('near',240,'glass'),far=body('far',480,'metal');
const ctx=(occlusionMode:number,materialMode=0):EquipmentContext=>({
 id:'eye',originMm:vec(0,0,120),yawDeg:0,
 params:{rangeMm:800,responseMs:0,beamWidthMm:100,beamMode:1,
 occlusionMode,materialMode},
});
const seen=(pieces:Body[],config:EquipmentContext,def=photoeye):boolean=>{
 const w:World={...freshWorld(12),bodies:pieces};
 return def.step(def.fresh({}),w,{},10,null,config).state.engaged;
};
describe('P8 transparent material optical teaching model',()=>{
 it('classifies explicitly transparent bodies without any shader or camera inference',()=>{
  expect(opticallyOpaque(near)).toBe(false);
  expect(opticallyOpaque({...near,tags:{...near.tags,transparent:true}})).toBe(false);
  expect(opticallyOpaque(far)).toBe(true);
 });
 it('legacy mode treats glass as an opaque beam blocker, but opt-in material mode allows passage',()=>{
  expect(sightlineClearOfBodies(ctx(2).originMm,far,[near,far])).toBe(false);
  expect(sightlineClearOfBodies(ctx(3).originMm,far,[near,far],true)).toBe(true);
  expect(seen([near,far],ctx(2),capacitiveProx)).toBe(true);
  // Inductive is a separate material-qualified sensor in a different test.
 });
 it('optical photoeye ignores transparent target only after materialMode=1',()=>{
  expect(seen([near],ctx(0,0))).toBe(true);
  expect(seen([near],ctx(0,1))).toBe(false);
  expect(seen([far],ctx(0,1))).toBe(true);
 });
 it('the material-aware mode can see a qualified opaque target behind transparent glass',()=>{
  expect(seen([near,far],ctx(3,1))).toBe(true);
  expect(seen([near,far],ctx(2,1))).toBe(false);
 });
 it('worker validation only accepts explicit bounded optical modes',()=>{
  const device=(occlusionMode:number,materialMode:number)=>[{
   id:'eye',kind:'geometry-photoeye',originMm:vec(0,0,0),
   yawDeg:0 as const,params:{occlusionMode,materialMode},
  }];
  expect(()=>validatePlacements(device(3,1),PLANT_EQUIPMENT)).not.toThrow();
  expect(()=>validatePlacements(device(4,1),PLANT_EQUIPMENT)).toThrow(/parameter/);
  expect(()=>validatePlacements(device(3,2),PLANT_EQUIPMENT)).toThrow(/parameter/);
 });
});
