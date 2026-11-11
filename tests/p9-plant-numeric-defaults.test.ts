import {describe,expect,it} from 'vitest';
import {defaultUnwiredPlantNumber} from '../src/sim/p3-plant-bridge';
import {createWorld,tick} from '../src/sim/orchestrator';
import {makePlantSceneProject} from '../src/sim/p3-scene-import';

describe('P9 correct worker numeric defaults when no analog terminal is mapped',()=>{
 it('selects safe equipment-specific defaults rather than a universal zero',()=>{
  expect(defaultUnwiredPlantNumber('asrs-crane','bay',{})).toBe(1);
  expect(defaultUnwiredPlantNumber('heater','setpointC',{})).toBe(80);
  expect(defaultUnwiredPlantNumber('heater','setpointC',{ambientC:20,maxC:40})).toBe(40);
  expect(defaultUnwiredPlantNumber('heater','setpointC',{ambientC:35,maxC:120})).toBe(80);
  expect(defaultUnwiredPlantNumber('belt-conveyor','speed',{speedMmS:500})).toBe(500);
  expect(defaultUnwiredPlantNumber('process-tank','inletPct',{})).toBe(100);
  expect(defaultUnwiredPlantNumber('proportional-valve','openingPct',{})).toBe(0);
 });
 it('unwired crane must not throw when the real engine starts a warehouse scene',()=>{
  let w=tick(createWorld(),[{k:'loadPlantScene',id:'mini-warehouse'},{k:'run'}]).world;
  for(let n=0;n<10;n++)w=tick(w).world;
  expect(w.lastError).toBeNull();
  expect(w.plantWorld.world.model.crane).toBeDefined();
  expect(w.plantWorld.signals.crane).toBeDefined();
 });
 it('temperature presets start unpowered without an invalid 0°C setpoint exception',()=>{
  for(const id of ['mixing-tank','temperature-batch','flow-valve-diagnostics']){
   const project=makePlantSceneProject(id);
   let w=tick(createWorld(),[{k:'loadProject',project},{k:'run'}]).world;
   for(let n=0;n<10;n++)w=tick(w).world;
   expect(w.lastError).toBeNull();
   const heater=w.project.components.find(c=>c.kind==='heater')!;
   expect(typeof w.plantWorld.signals[heater.id].temperatureC).toBe('number');
  }
 });
});
