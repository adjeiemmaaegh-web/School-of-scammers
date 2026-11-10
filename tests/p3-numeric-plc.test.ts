import {describe,expect,it} from 'vitest';
import {createWorld,renderSnapshot,tick,validateProject} from '../src/sim/orchestrator';
import {spawnBody} from '../src/plant/world/bodies';
import {solverWires} from '../src/sim/faults';
import type {Command,WorldState} from '../src/sim/signals';

const ST=['VAR_INPUT',' Analog0 : REAL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;','END_VAR',
 'Out0 := Analog0 > 12.5;'].join('\n');
const parts:Command[]=[
 {k:'place',id:'supply',kind:'supply',at:{x:10,y:10}},
 {k:'place',id:'ctrl',kind:'plc16',at:{x:300,y:10}},
 {k:'place',id:'weight',kind:'weigh-cell',at:{x:720,y:200}},
 {k:'place',id:'lamp',kind:'lamp',at:{x:900,y:230}},
];
const wires:Command[]=[
 {k:'wire',id:'s1',from:'supply.P24',to:'ctrl.L+'},
 {k:'wire',id:'s2',from:'supply.M0',to:'ctrl.M'},
 {k:'wire',id:'s3',from:'supply.P24',to:'weight.L+'},
 {k:'wire',id:'s4',from:'supply.M0',to:'weight.M'},
 {k:'wire',id:'numeric',from:'weight.AN_weightKg',to:'ctrl.AI0'},
 {k:'wire',id:'s5',from:'ctrl.Q0.0',to:'lamp.L+'},
 {k:'wire',id:'s6',from:'supply.M0',to:'lamp.M-'},
];
const setup=()=>{
 const w=tick(createWorld(),[...parts,...wires,{k:'loadST',source:ST}]).world;
 expect(w.lastError).toBeNull();
 return w;
};
const loadedBody=(w:WorldState,kg:number):WorldState=>{
 const station=w.project.components.find(c=>c.id==='weight')!;
 const x=(station.x+85-540)*10,y=(station.y+65-290)*10;
 return {...w,plantWorld:{...w.plantWorld,
  world:spawnBody(w.plantWorld.world,'test',{size:{x:100,y:90,z:75},massKg:kg,
    pos:{x,y,z:0}})}};
};
describe('P3 isolated analog process sensor and real PLC16 Structured Text',()=>{
 it('produces numeric kilogram input from physical body and lights a wired output',()=>{
  let w=loadedBody(setup(),15);
  w=tick(w,[{k:'run'}]).world;
  for(let i=0;i<4;i++)w=tick(w).world;
  expect(w.lastError).toBeNull();
  expect(w.plcs.ctrl.tagInputs.Analog0).toBeGreaterThan(12.5);
  expect(w.plcs.ctrl.coils.Out0).toBe(true);
  expect(w.deviceOn.lamp).toBe(true);
  expect(renderSnapshot(w).plcs.ctrl.io.analogInputs?.[0]).toMatchObject({
   source:'weight.AN_weightKg',unit:'kg',connected:true,tag:'Analog0',
  });
  expect(solverWires(w.project)).not.toContainEqual(['weight.AN_weightKg','ctrl.AI0']);
  expect(validateProject(JSON.parse(JSON.stringify(w.project)))).toEqual(w.project);
 });
 it('refuses mixing numeric and 24V or driving one AI0 from two sensors',()=>{
  let w=setup();
  w=tick(w,[{k:'wire',id:'bad',from:'supply.P24',to:'ctrl.AI1'}]).world;
  expect(w.lastError).toMatch(/Numeric signals/);
  expect(w.project.wires.some(x=>x.id==='bad')).toBe(false);
  expect(()=>validateProject({...w.project,wires:[...w.project.wires,
   {id:'bad',from:'supply.P24',to:'ctrl.AI1'}]})).toThrow(/Numeric signals/);
  w=tick(w,[{k:'place',id:'another',kind:'weigh-cell',at:{x:720,y:350}}]).world;
  w=tick(w,[{k:'wire',id:'duplicate',from:'another.AN_weightKg',to:'ctrl.AI0'}]).world;
  expect(w.lastError).toMatch(/one (?:numeric|signal) source/i);
 });
 it('a physically disconnected or unpowered sensor cannot silently read 0 kg',()=>{
  let w=loadedBody(setup(),15);
  w=tick(w,[{k:'unwire',id:'s3'}]).world; // measurement supply disconnected
  w=tick(w,[{k:'run'}]).world;
  expect(w.running).toBe(false);
  expect(w.lastError).toMatch(/Numeric input Analog0 has no connected (?:process )?source/);
  expect(w.deviceOn.lamp).toBeUndefined();
 });
 it('opening a numeric wire at runtime fails closed instead of commanding lamp ON',()=>{
  let w=loadedBody(setup(),15);
  w=tick(w,[{k:'run'}]).world;
  for(let i=0;i<4;i++)w=tick(w).world;
  expect(w.deviceOn.lamp).toBe(true);
  w=tick(w,[{k:'injectFault',kind:'wire-open',target:'numeric',hidden:false}]).world;
  expect(w.running).toBe(false);
  expect(w.lastError).toMatch(/Numeric input Analog0/);
  expect(w.deviceOn.lamp).toBeUndefined();
 });
});
