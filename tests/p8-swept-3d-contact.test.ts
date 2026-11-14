import {describe,it,expect} from 'vitest';
import {vec} from '../src/plant/world/math';
import type {Body,EquipmentPlacement} from '../src/plant/world/types';
import {bodyEnvelope,bodyVolumeOverlap,sweptBodyContact,sweptPlacementContact}
 from '../src/plant/world/swept-contact';
import {STATIC_SOLID_KINDS,staticSolidSize,newlyContactsStaticSolid}
 from '../src/plant/world/solid-geometry';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {validatePlacements} from '../src/plant/world/runner';

const parcel=(id:string,x:number,y=0,z=120):Body=>({
 id,shape:'box',size:vec(80,80,80),massKg:1,pos:vec(x,y,z),
 yawDeg:0,vel:vec(),supportedBy:null,tags:{},
});
const obstacle=(kind:string,x:number,mode=1):EquipmentPlacement=>({
 id:'solid',kind,originMm:vec(x,0,0),yawDeg:0,
 params:{blockMaterialFlow:mode},
});
describe('P8 continuous 3D material-flow collision and stationary equipment contracts',()=>{
 it('detects a completely crossed body although both endpoints are separated',()=>{
  const a=parcel('a',-300),b=parcel('b',0);
  const crossing=sweptBodyContact(a,b,vec(600,0,0));
  expect(crossing).not.toBeNull();
  expect(crossing!).toBeGreaterThan(0);
  expect(crossing!).toBeLessThan(.5);
  expect(bodyVolumeOverlap(a,b)).toBe(false);
  expect(bodyVolumeOverlap({...a,pos:vec(300,0,120)},b)).toBe(false);
 });
 it('does not report contact for a differently elevated or laterally offset machine',()=>{
  const a=parcel('a',-300),b=parcel('b',0,0,850);
  expect(sweptBodyContact(a,b,vec(600,0,0))).toBeNull();
  expect(sweptBodyContact(a,parcel('b',0,250),vec(600,0,0))).toBeNull();
 });
 it('distinguishes sliding away from an initial touch versus moving inward',()=>{
  const b=parcel('b',0),a=parcel('a',-80);
  expect(sweptBodyContact(a,b,vec(-300,0,0))).toBeNull();
  expect(sweptBodyContact(a,b,vec(300,0,0))).toBe(0);
 });
 it('keeps intentional historical overlapping bodies from becoming trapped',()=>{
  const a=parcel('a',0),b=parcel('b',0);
  expect(sweptBodyContact(a,b,vec(600,0,0))).toBeNull();
 });
 it('uses rotated body widths and heights rather than a flat 2D shortcut',()=>{
  const a={...parcel('a',-300,0),size:vec(300,60,80),yawDeg:90 as const};
  const b=parcel('b',0,115);
  expect(bodyEnvelope(a).half.x).toBe(30);
  expect(bodyEnvelope(a).half.y).toBe(150);
  expect(sweptBodyContact(a,b,vec(600,0,0))).not.toBeNull();
  expect(sweptBodyContact({...a,yawDeg:0},b,vec(600,0,0))).toBeNull();
 });
 it('prevents passage through an entire thin enclosure between 10ms samples',()=>{
  const solid=obstacle('proportional-valve',0);
  const start=parcel('a',-400),end={...start,pos:vec(400,0,120)};
  const size=staticSolidSize(solid.kind)!;
  expect(sweptPlacementContact(start,solid,size,vec(800,0,0))).not.toBeNull();
  expect(newlyContactsStaticSolid(start,end,[solid])).toBe(true);
  expect(newlyContactsStaticSolid(start,end,[{...solid,params:{blockMaterialFlow:0}}]))
   .toBe(false);
 });
 it('never invents a contact when an existing parcel is inside a structure',()=>{
  const solid=obstacle('shelf',0);
  const start=parcel('a',0),end={...start,pos:vec(100,0,120)};
  expect(newlyContactsStaticSolid(start,end,[solid])).toBe(false);
 });
 it('all newly opt-in stationary solids use the exact existing worker-registry dimensions',()=>{
  expect(STATIC_SOLID_KINDS.length).toBeGreaterThan(2);
  for(const kind of STATIC_SOLID_KINDS){
   expect(staticSolidSize(kind)).toEqual(PLANT_EQUIPMENT[kind].footprint);
   expect(PLANT_EQUIPMENT[kind].params.some(x=>x.key==='blockMaterialFlow'))
    .toBe(true);
   const item=obstacle(kind,0);
   expect(()=>validatePlacements([item],PLANT_EQUIPMENT)).not.toThrow();
   expect(()=>validatePlacements([{...item,params:{blockMaterialFlow:2}}],
     PLANT_EQUIPMENT)).toThrow(/parameter/);
  }
 });
});
