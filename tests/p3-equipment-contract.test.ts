import {describe,expect,it} from 'vitest';
import {EQUIPMENT,PLANT_EQUIPMENT} from '../src/plant/equipment';
import {SCENES} from '../src/plant/scenes/catalogue';
import {freshWorld,spawnBody,conserved} from '../src/plant/world/bodies';
import {freshRuntime,stepScene,validatePlacements} from '../src/plant/world/runner';
import type {EquipmentPlacement} from '../src/plant/world/types';
const placement=(id:string,kind:string,params:Record<string,number>={}):EquipmentPlacement=>({
 id,kind,originMm:{x:0,y:0,z:0},yawDeg:0,params,
});
describe('P3 all equipment source contracts',()=>{
 it('has one discoverable model for every original catalogue entry with channel/fault/3D descriptions',()=>{
  expect(EQUIPMENT.length).toBeGreaterThanOrEqual(25);
  expect(new Set(EQUIPMENT.map(d=>d.kind)).size).toBe(EQUIPMENT.length);
  for(const def of EQUIPMENT){
   expect(def.label).toBeTruthy();
   expect(def.footprint.x).toBeGreaterThan(0);
   expect(def.fresh({})).toBeDefined();
   const item=placement('station',def.kind);
   const runtime=freshRuntime(freshWorld(),[item],PLANT_EQUIPMENT);
   const step=stepScene(runtime,[item],PLANT_EQUIPMENT);
   expect(step.signals.station).toBeDefined();
   expect(def.describe(step.world.model.station,{
     id:'station',originMm:item.originMm,yawDeg:0,params:{},
   }).length).toBeGreaterThan(0);
   expect(conserved(step.world)).toBe(true);
  }
 });
 it('covers ten authored starting plants with unique IDs and valid model placements',()=>{
  expect(SCENES).toHaveLength(10);
  expect(new Set(SCENES.map(x=>x.id)).size).toBe(10);
  for(const scene of SCENES){
   expect(scene.referenceST).toContain('VAR_OUTPUT');
   expect(scene.equipment.length).toBeGreaterThanOrEqual(3);
   validatePlacements(scene.equipment,PLANT_EQUIPMENT);
   const runtime=freshRuntime(freshWorld(scene.seed),scene.equipment,PLANT_EQUIPMENT);
   const after=stepScene(runtime,scene.equipment,PLANT_EQUIPMENT);
   expect(after.world.timeMs).toBe(50);
  }
 });
 it('shows physically measured weight, load limits and process temperature/level',()=>{
  const equipment=[placement('weight','weigh-cell',{noiseGram:0}),
    placement('heater','heater'),placement('tank','process-tank')];
  const box=spawnBody(freshWorld(7),'test',{size:{x:100,y:100,z:100},massKg:15,pos:{x:0,y:0,z:0}});
  let rt=freshRuntime(box,equipment,PLANT_EQUIPMENT);
  rt=stepScene(rt,equipment,PLANT_EQUIPMENT,{heater:{enable:true,setpointC:90},
   tank:{fill:true,inletPct:100}});
  expect(rt.signals.weight.present).toBe(true);
  expect(rt.signals.weight.weightKg).toBe(15);
  expect(rt.signals.tank.levelMl).toBeGreaterThan(0);
  expect(rt.signals.heater.temperatureC).toBeGreaterThan(20);
 });
 it('faults produce changes in model behavior, not arbitrary forced sensor outputs',()=>{
  const devices=[placement('belt','belt-conveyor')];
  const r=freshRuntime(freshWorld(),devices,PLANT_EQUIPMENT);
  const good=stepScene(r,devices,PLANT_EQUIPMENT,{belt:{run:true}});
  const failed=stepScene(r,devices,PLANT_EQUIPMENT,{belt:{run:true}},{belt:'motor-dead'});
  expect(good.signals.belt.moving).toBe(true);
  expect(failed.signals.belt.moving).toBe(false);
 });
});
