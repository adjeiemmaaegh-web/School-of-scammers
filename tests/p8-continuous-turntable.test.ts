import {describe,it,expect} from 'vitest';
import {freshWorld} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';
import {freshRuntime,stepScene} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import type {Body,EquipmentPlacement} from '../src/plant/world/types';

const item=(rotateCargo:number):EquipmentPlacement=>({
 id:'table',kind:'turntable',originMm:vec(0,0,0),yawDeg:0,
 params:{turnMs:1000,rotateCargo},
});
const cargo:Body={
 id:'b1',shape:'box',pos:vec(100,0,120),size:vec(80,80,80),
 yawDeg:0,vel:vec(),massKg:1,supportedBy:'table',tags:{material:'cardboard'},
};
const setup=(mode:number)=>{
 const world={...freshWorld(12),bodies:[cargo]};
 return {item:item(mode),rt:freshRuntime(world,[item(mode)],PLANT_EQUIPMENT)};
};
describe('P8 worker-timed continuous turntable cargo indexing',()=>{
 it('rotates actual world cargo around the table centre over many physical 10ms steps',()=>{
  const {item,rt}=setup(1);
  let scene=rt;
  for(let i=0;i<10;i++)scene=stepScene(scene,[item],PLANT_EQUIPMENT,{
   table:{turn:true,run:true},
  });
  const body=scene.world.bodies[0];
  expect(scene.signals.table.busy).toBe(true);
  expect(scene.signals.table.angleDeg).toBeCloseTo(45,3);
  expect(body.pos.x).toBeCloseTo(70.71,0);
  expect(body.pos.y).toBeCloseTo(70.71,0);
  expect(body.visualYawDeg).toBeCloseTo(45,3);
  expect(body.yawDeg).toBe(0);
 });
 it('finishes one quarter-turn without bouncing the model back on button release',()=>{
  const {item,rt}=setup(1);
  let scene=rt;
  for(let i=0;i<20;i++)scene=stepScene(scene,[item],PLANT_EQUIPMENT,{
   table:{turn:true,run:true},
  });
  expect(scene.signals.table.angleDeg).toBeCloseTo(90,4);
  expect(scene.signals.table.rotated).toBe(true);
  expect(scene.world.model.table.phase).toBe(1);
  expect(scene.world.bodies[0].pos.x).toBeCloseTo(0,0);
  expect(scene.world.bodies[0].pos.y).toBeCloseTo(100,0);
  expect(scene.world.bodies[0].yawDeg).toBe(90);
  const parked=stepScene(scene,[item],PLANT_EQUIPMENT,{
   table:{turn:false,run:false},
  });
  expect(parked.signals.table.angleDeg).toBe(90);
  expect(parked.signals.table.home).toBe(false);
  expect(parked.world.model.table.phase).toBe(1);
 });
 it('indexes again when the command is released and reasserted',()=>{
  const {item,rt}=setup(1);
  let scene=rt;
  for(let i=0;i<20;i++)scene=stepScene(scene,[item],PLANT_EQUIPMENT,{
   table:{turn:true,run:false},
  });
  scene=stepScene(scene,[item],PLANT_EQUIPMENT,{table:{turn:false,run:false}});
  for(let i=0;i<20;i++)scene=stepScene(scene,[item],PLANT_EQUIPMENT,{
   table:{turn:true,run:false},
  });
  expect(scene.world.model.table.phase).toBe(2);
  expect(scene.signals.table.angleDeg).toBeCloseTo(180,5);
  expect(scene.world.bodies[0].yawDeg).toBe(180);
  expect(scene.world.bodies[0].pos.x).toBeCloseTo(-100,0);
 });
 it('keeps legacy turntable projects on their original discrete indexing path',()=>{
  const {item,rt}=setup(0);
  let scene=rt;
  for(let i=0;i<10;i++)scene=stepScene(scene,[item],PLANT_EQUIPMENT,{
   table:{turn:true,run:false},
  });
  expect(scene.world.bodies[0].pos.x).toBe(100);
  expect(scene.world.bodies[0].pos.y).toBe(0);
  expect(scene.world.bodies[0].visualYawDeg).toBeUndefined();
  for(let i=0;i<10;i++)scene=stepScene(scene,[item],PLANT_EQUIPMENT,{
   table:{turn:true,run:false},
  });
  expect(scene.world.bodies[0].yawDeg).toBe(90);
  expect(scene.world.bodies[0].pos.x).toBe(100);
  expect(scene.world.bodies[0].pos.y).toBe(0);
 });
});
