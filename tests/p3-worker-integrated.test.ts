import {describe,expect,it} from 'vitest';
import {createWorld,renderSnapshot,tick,validateProject} from '../src/sim/orchestrator';
import {SCENES} from '../src/plant/scenes/catalogue';
import type {Command,WorldState} from '../src/sim/signals';

const ST=['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;','END_VAR',
 'Out0 := In0;','Out1 := In1;'].join('\n');
const parts:Command[]=[
 {k:'place',id:'supply',kind:'supply',at:{x:20,y:10}},
 {k:'place',id:'plc16',kind:'plc16',at:{x:260,y:10}},
 {k:'place',id:'feeder',kind:'box-feeder',at:{x:700,y:250}},
 {k:'place',id:'eye',kind:'geometry-photoeye',at:{x:700,y:250}},
 {k:'place',id:'lamp',kind:'lamp',at:{x:890,y:250}},
];
const wires:Command[]=[
 {k:'wire',id:'w1',from:'supply.P24',to:'plc16.L+'},
 {k:'wire',id:'w2',from:'supply.M0',to:'plc16.M'},
 {k:'wire',id:'w3',from:'supply.P24',to:'plc16.I0.0'},
 {k:'wire',id:'w4',from:'plc16.Q0.0',to:'feeder.CMD_enable+'},
 {k:'wire',id:'w5',from:'supply.M0',to:'feeder.M-'},
 {k:'wire',id:'w6',from:'supply.P24',to:'eye.L+'},
 {k:'wire',id:'w7',from:'supply.M0',to:'eye.M'},
 {k:'wire',id:'w8',from:'eye.OUT_present',to:'plc16.I0.1'},
 {k:'wire',id:'w9',from:'plc16.Q0.1',to:'lamp.L+'},
 {k:'wire',id:'w10',from:'supply.M0',to:'lamp.M-'},
];
function configured(){
 let w=tick(createWorld(),[...parts,...wires,{k:'loadST',source:ST}]).world;
 expect(w.lastError).toBeNull();
 expect(w.project.wires).toHaveLength(wires.length);
 return w;
}
const scan=(w:WorldState,count:number)=>{
 for(let n=0;n<count;n++)w=tick(w).world;
 return w;
};
describe('P3 electrical->process->sensor->PLC->output real worker integration',()=>{
 it('a real wired PLC output drives feeder, a physical body triggers geometry eye, then another PLC output lights a lamp',()=>{
  let w=tick(configured(),[{k:'run'}]).world;
  w=scan(w,30);
  expect(w.lastError).toBeNull();
  expect(w.plantWorld.world.spawnedCount).toBeGreaterThan(0);
  expect(w.plantWorld.world.bodies.length).toBeGreaterThan(0);
  expect(w.plantWorld.signals.eye.present).toBe(true);
  expect(w.plcs.plc16.tagInputs.In1).toBe(true);
  expect(w.plcs.plc16.coils.Out1).toBe(true);
  expect(w.deviceOn.lamp).toBe(true);
  expect(renderSnapshot(w).plantWorld.world.timeMs).toBeGreaterThan(1000);
  expect(w.plantWorld.world.spawnedCount-w.plantWorld.world.despawnedCount)
   .toBe(w.plantWorld.world.bodies.length);
 });
 it('requires real powered digital command wiring, not just a visual equipment model',()=>{
  let w=tick(createWorld(),parts).world;
  w=scan(tick(w,[{k:'run'}]).world,35);
  expect(w.plantWorld.world.spawnedCount).toBe(0);
 });
 it('ten original factory scenes load as empty-programmable workspace layouts',()=>{
  for(const scene of SCENES){
   const w=tick(createWorld(),[{k:'loadPlantScene',id:scene.id}]).world;
   expect(w.lastError).toBeNull();
   expect(w.project.components.length).toBe(scene.equipment.length+2);
   expect(w.project.wires).toHaveLength(0);
   expect(validateProject(JSON.parse(JSON.stringify(w.project)))).toEqual(w.project);
  }
 });
 it('faults alter physics, persist in project and clear only when paused',()=>{
  let w=configured();
  w=tick(w,[{k:'setPlantFault',id:'feeder',fault:'feeder-empty'}]).world;
  expect(w.project.plantFaults?.feeder).toBe('feeder-empty');
  w=scan(tick(w,[{k:'run'}]).world,35);
  expect(w.plantWorld.world.spawnedCount).toBe(0);
  const refused=tick(w,[{k:'setPlantFault',id:'feeder',fault:null}]).world;
  expect(refused.lastError).toMatch(/Pause/);
  w=tick(w,[{k:'pause'},{k:'setPlantFault',id:'feeder',fault:null}]).world;
  expect(w.project.plantFaults).toBeUndefined();
  expect(()=>validateProject({...w.project,plantFaults:{feeder:'invalid'}})).toThrow(/Invalid plant/);
 });
});
