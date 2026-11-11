import {describe,expect,it} from 'vitest';
import type {Body,World} from '../src/plant/world/types';
import type {EquipmentContext} from '../src/plant/world/equipment';
import {freshWorld} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';
import {inductiveProx} from '../src/plant/equipment/sensors';
import {bodySightOccluder,sightlineClearOfBodies,sightlineHitsSolid}
 from '../src/plant/equipment/line-of-sight';
import {validatePlacements} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';

const body=(id:string,x:number,y:number,material='cardboard'):Body=>({
 id,shape:'box',size:vec(90,100,100),pos:vec(x,y,120),massKg:4,
 yawDeg:0,vel:vec(),supportedBy:null,tags:{material},
});
const ctx=(occlusionMode:number):EquipmentContext=>({
 id:'prox',originMm:vec(0,0,120),yawDeg:0,
 params:{rangeMm:800,responseMs:0,beamMode:1,beamWidthMm:120,occlusionMode},
});
const step=(occlusionMode:number,parts:Body[]):boolean=>{
 const c=ctx(occlusionMode),world:World={...freshWorld(3),bodies:parts};
 return inductiveProx.step(inductiveProx.fresh({}),world,{},10,null,c).state.engaged;
};
const far=body('metal',550,0,'metal'),near=body('cardboard',300,0);
describe('P8 authoritative moving-body optical occlusion',()=>{
 it('retains existing mode 0 and fixed-only mode 1 regardless of other moving bodies',()=>{
  expect(step(0,[near,far])).toBe(true);
  expect(step(1,[near,far])).toBe(true);
 });
 it('suppresses a material-qualified sensor only when another body blocks the line',()=>{
  expect(step(2,[near,far])).toBe(false);
  expect(step(2,[far,near])).toBe(false);
  expect(step(2,[far])).toBe(true);
 });
 it('does not occlude for a nearby body outside the actual sightline',()=>{
  expect(step(2,[{...near,pos:vec(300,190,120)},far])).toBe(true);
 });
 it('does not occlude for an opaque parcel behind the target',()=>{
  expect(step(2,[{...near,pos:vec(690,0,120)},far])).toBe(true);
 });
 it('respects vertical clearances in 3D, not a top-down 2D bounding box',()=>{
  expect(step(2,[{...near,pos:vec(300,0,850)},far])).toBe(true);
 });
 it('uses actual body envelope and never mutates the original body data',()=>{
  const parts=[near,far];const before=JSON.stringify(parts);
  expect(sightlineClearOfBodies(ctx(2).originMm,far,parts)).toBe(false);
  expect(sightlineHitsSolid(ctx(2).originMm,far.pos,bodySightOccluder(near))).toBe(true);
  expect(JSON.stringify(parts)).toBe(before);
 });
 it('does not let a target body occlude itself',()=>{
  expect(sightlineClearOfBodies(ctx(2).originMm,far,[far])).toBe(true);
 });
 it('enforces bounded sensing mode validation at the worker scene boundary',()=>{
  const p=(mode:number)=>[{
   id:'prox',kind:'inductive-prox',originMm:vec(0,0,0),
   yawDeg:0 as const,params:{beamMode:1,occlusionMode:mode},
  }];
  expect(()=>validatePlacements(p(2),PLANT_EQUIPMENT)).not.toThrow();
  expect(()=>validatePlacements(p(4),PLANT_EQUIPMENT)).toThrow(/parameter/);
  expect(()=>validatePlacements(p(-1),PLANT_EQUIPMENT)).toThrow(/parameter/);
 });
});
