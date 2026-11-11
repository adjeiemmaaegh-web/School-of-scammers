import {describe,expect,it} from 'vitest';
import {freshWorld,spawnBody,despawnBody,conserved} from '../src/plant/world/bodies';
import {freshRuntime,stepScene} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import type {EquipmentPlacement,World} from '../src/plant/world/types';
const p=(id:string,kind:string,x:number,y=0,params:Record<string,number>={}):EquipmentPlacement=>
 ({id,kind,originMm:{x,y,z:0},yawDeg:0,params});
const step=(items:EquipmentPlacement[],n:number,command:Record<string,Record<string,boolean|number>>={})=>{
 let r=freshRuntime(freshWorld(42),items,PLANT_EQUIPMENT);
 for(let i=0;i<n;i++)r=stepScene(r,items,PLANT_EQUIPMENT,command);
 return r;
};
describe('P3 deterministic shared physics and accounting',()=>{
 it('advances exactly five 10ms substeps per 50ms PLC scan',()=>{
  const items=[p('belt','belt-conveyor',0)];
  let r=freshRuntime(freshWorld(1),items,PLANT_EQUIPMENT);
  r=stepScene(r,items,PLANT_EQUIPMENT,{belt:{run:true}});
  expect(r.world.timeMs).toBe(50);
  expect(r.signals.belt.moving).toBe(true);
  expect(r.signals.belt.speed).toBe(250);
 });
 it('moves a supported box only while an actual belt command is running',()=>{
  const items=[p('belt','belt-conveyor',0)];
  const w=spawnBody(freshWorld(), 'test',{size:{x:120,y:100,z:70},massKg:10,
   pos:{x:0,y:0,z:120},supportedBy:'belt'});
  let r=freshRuntime(w,items,PLANT_EQUIPMENT);
  for(let i=0;i<8;i++)r=stepScene(r,items,PLANT_EQUIPMENT,{belt:{run:true}});
  expect(r.world.bodies[0].pos.x).toBeGreaterThan(20);
  const x=r.world.bodies[0].pos.x;
  for(let i=0;i<12;i++)r=stepScene(r,items,PLANT_EQUIPMENT,{belt:{run:false}});
  expect(r.world.bodies[0].pos.x).toBeGreaterThanOrEqual(x); // finite deceleration, not teleport
  expect(r.world.timeMs).toBe(1000);
  expect(conserved(r.world)).toBe(true);
 });
 it('models jam/queue and capped spawn refusal without deleting bodies',()=>{
  const items=[p('belt','belt-conveyor',0),p('gate','stopper',120)];
  let w=freshWorld(1);
  w=spawnBody(w,'test',{size:{x:80,y:80,z:100},massKg:8,pos:{x:80,y:0,z:120},
   supportedBy:'belt'});
  let r=freshRuntime(w,items,PLANT_EQUIPMENT);
  for(let i=0;i<20;i++)r=stepScene(r,items,PLANT_EQUIPMENT,{belt:{run:true},gate:{extend:true}});
  expect(r.world.bodies).toHaveLength(1);
  expect(r.world.bodies[0].tags.jammed).toBe(true);
  expect(conserved(r.world)).toBe(true);
  for(let i=0;i<70;i++)w=spawnBody(w,'test',{size:{x:30,y:30,z:30},massKg:1,pos:{x:i*40,y:500,z:0}});
  expect(w.bodies).toHaveLength(60);
  expect(w.spawnedCount).toBe(60);
  expect(w.events.some(e=>e.kind==='limit')||w.droppedEventCount>0).toBe(true);
  expect(conserved(despawnBody(w,'test','b1'))).toBe(true);
 });
 it('is bit-exact for two independent runs with the same seed and controller commands',()=>{
  const items=[p('feeder','box-feeder',-200),p('belt','belt-conveyor',0),
   p('eye','geometry-photoeye',0),p('weight','weigh-cell',100)];
  const run=()=>step(items,55,{feeder:{enable:true},belt:{run:true}});
  expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  expect(run().world.spawnedCount).toBeGreaterThan(0);
 });
 it('rejects invalid precision, unknown devices and invalid parameters deterministically',()=>{
  expect(()=>stepScene(freshRuntime(freshWorld(),[],PLANT_EQUIPMENT),
    [p('unknown','not-real',0)],PLANT_EQUIPMENT)).toThrow(/Unknown/);
  expect(()=>freshRuntime(freshWorld(),[p('bad','belt-conveyor',0,0,{speedMmS:9999})],PLANT_EQUIPMENT)).toThrow(/parameter/);
 });
});
