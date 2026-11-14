import {describe,expect,it} from 'vitest';
import {freshWorld,spawnBody,conserved} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';
import type {EquipmentPlacement} from '../src/plant/world/types';
import {freshRuntime,stepScene,validatePlacements} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {intersectsStaticSolid,newlyContactsStaticSolid} from '../src/plant/world/solid-geometry';

const place=(id:string,kind:string,x:number,y:number,yawDeg:EquipmentPlacement['yawDeg']=0,
 params:Record<string,number>={},z=0):EquipmentPlacement=>({
 id,kind,originMm:vec(x,y,z),yawDeg,params,
});
const belt=()=>place('belt','belt-conveyor',0,0,0,{lengthMm:1000,speedMmS:500});
const rack=(blockMaterialFlow=1,yawDeg:EquipmentPlacement['yawDeg']=90,z=0)=>
 place('rack','shelf',400,400,yawDeg,{blockMaterialFlow},z);
const tank=(blockMaterialFlow=1)=>place('tank','process-tank',300,0,0,{blockMaterialFlow});
const run=(placements:EquipmentPlacement[],count=30)=>{
 const world=spawnBody(freshWorld(19),'p8', {size:vec(80,80,80),massKg:1,pos:vec(-200,0,120)});
 let runtime=freshRuntime(world,placements,PLANT_EQUIPMENT);
 for(let i=0;i<count;i++)runtime=stepScene(runtime,placements,PLANT_EQUIPMENT,{
  belt:{run:true},
 });
 return runtime;
};

describe('P8 opt-in fixed-solid material-flow collisions',()=>{
 it('stops a worker-driven conveyor parcel at a rotated rack and records a real jam',()=>{
  const rt=run([belt(),rack()]);
  expect(rt.world.bodies).toHaveLength(1);
  expect(rt.world.bodies[0].pos.x).toBeLessThan(100);
  expect(rt.world.bodies[0].tags.jammed).toBe(true);
  expect(rt.signals.belt.jam).toBe(true);
  expect(rt.world.events.some(event=>event.kind==='jam'&&
   event.detail.includes('fixed solid'))).toBe(true);
  expect(conserved(rt.world)).toBe(true);
 });
 it('preserves historic unblocked conveyor projects when optional solid flag is off',()=>{
  const rt=run([belt(),rack(0)]);
  expect(rt.world.bodies[0].pos.x).toBeGreaterThan(100);
  expect(rt.world.bodies[0].tags.jammed).not.toBe(true);
 });
 it('honors the rack yaw instead of applying an oversized world-axis box',()=>{
  const rotated=run([belt(),rack(1,90)]);
  const clear=run([belt(),rack(1,0)]);
  expect(rotated.world.bodies[0].pos.x).toBeLessThan(100);
  expect(clear.world.bodies[0].pos.x).toBeGreaterThan(100);
 });
 it('honors elevation: a high rack cannot block the low conveyor',()=>{
  const rt=run([belt(),rack(1,90,1000)]);
  expect(rt.world.bodies[0].pos.x).toBeGreaterThan(100);
 });
 it('also blocks an actual process-vessel envelope only with its flag enabled',()=>{
  expect(run([belt(),tank(1)]).world.bodies[0].pos.x).toBeLessThan(-50);
  expect(run([belt(),tank(0)]).world.bodies[0].pos.x).toBeGreaterThan(100);
 });
 it('does not freeze material that already overlaps a historic solid position',()=>{
  const source=spawnBody(freshWorld(4),'legacy',{size:vec(80,80,80),
   massKg:1,pos:vec(150,0,120)});
  const b=source.bodies[0];
  const r=place('rack','shelf',400,400,90,{blockMaterialFlow:1});
  expect(intersectsStaticSolid(b,r)).toBe(true);
  expect(newlyContactsStaticSolid(b,{...b,pos:vec(160,0,120)},[r])).toBe(false);
 });
 it('rejects invalid collision flags through authoritative parameter validation',()=>{
  expect(()=>validatePlacements([rack(2)],PLANT_EQUIPMENT)).toThrow(/parameter/);
  expect(()=>validatePlacements([tank(-1)],PLANT_EQUIPMENT)).toThrow(/parameter/);
  expect(()=>validatePlacements([rack(1),tank(1)],PLANT_EQUIPMENT)).not.toThrow();
 });
});
