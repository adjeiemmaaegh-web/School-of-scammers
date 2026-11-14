import {describe,it,expect} from 'vitest';
import {createWorld,tick} from '../src/sim/orchestrator';
import type {Command,WorldState} from '../src/sim/signals';
const ST=['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;','END_VAR',
 'Out0 := In0;','Out1 := In0;'].join('\n');
const parts:Command[]=[
 {k:'place',id:'supply',kind:'supply',at:{x:20,y:10}},
 {k:'place',id:'ctrl',kind:'plc16',at:{x:260,y:10}},
 {k:'place',id:'belt',kind:'belt-conveyor',at:{x:455,y:225}},
 {k:'place',id:'feeder',kind:'box-feeder',at:{x:435,y:225}},
];
const links:Command[]=[
 ['supply.P24','ctrl.L+'],['supply.M0','ctrl.M'],
 ['supply.P24','ctrl.I0.0'],['ctrl.Q0.0','belt.CMD_run+'],
 ['supply.M0','belt.M-'],['ctrl.Q0.1','feeder.CMD_enable+'],
 ['supply.M0','feeder.M-'],
].map(([from,to],i)=>({k:'wire',id:'w'+(i+1),from,to}));
const configured=()=>{
 const world=tick(createWorld(),[...parts,...links,
  {k:'loadST',source:ST},
  {k:'setParam',id:'belt',key:'speedMmS',value:500},
 ]).world;
 expect(world.lastError).toBeNull();
 expect(world.project.wires).toHaveLength(7);
 return world;
};
const advance=(initial:WorldState,scans:number)=>{
 let state=initial;
 for(let i=0;i<scans;i++)state=tick(state).world;
 return state;
};
describe('P8 genuine PLC-to-belt numeric speed fallback',()=>{
 it('respects the saved speed dial on an unwired analog channel so actual material advances',()=>{
  const state=advance(tick(configured(),[{k:'run'}]).world,43);
  expect(state.lastError).toBeNull();
  expect(state.plcs.ctrl.coils.Out0).toBe(true);
  expect(state.plcs.ctrl.coils.Out1).toBe(true);
  expect(state.plantWorld.signals.belt.moving).toBe(true);
  expect(state.plantWorld.signals.belt.speed).toBe(500);
  expect(state.plantWorld.world.spawnedCount).toBeGreaterThan(0);
  expect(state.plantWorld.world.bodies[0].pos.x).toBeGreaterThan(-150);
 });
 it('does not synthesize motion in a disconnected PLC or unpowered belt',()=>{
  const initial=tick(createWorld(),[
   {k:'place',id:'belt',kind:'belt-conveyor',at:{x:455,y:225}},
   {k:'setParam',id:'belt',key:'speedMmS',value:500},
  ]).world;
  const state=advance(tick(initial,[{k:'run'}]).world,15);
  expect(state.plantWorld.signals.belt.moving).toBe(false);
  expect(state.plantWorld.signals.belt.speed).toBe(0);
 });
});
