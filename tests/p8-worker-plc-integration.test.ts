import {describe,expect,it} from 'vitest';
import {createWorld,tick} from '../src/sim/orchestrator';
import type {Command,WorldState} from '../src/sim/signals';

/** Full original power → physical feeder → optical body → PLC16 ST → lamp path.
 * Only the new optical envelope blocks the same genuine worker body.
 * 3D geometry is defined by saved placement coordinates, not a synthetic signal.
 */
const ST=['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;','END_VAR',
 'Out0 := In0;','Out1 := In1;'].join('\n');
const parts:Command[]=[
 {k:'place',id:'supply',kind:'supply',at:{x:20,y:10}},
 {k:'place',id:'plc16',kind:'plc16',at:{x:260,y:10}},
 {k:'place',id:'feeder',kind:'box-feeder',at:{x:575,y:250}},
 {k:'place',id:'eye',kind:'geometry-photoeye',at:{x:500,y:250}},
 {k:'place',id:'rack',kind:'shelf',at:{x:540,y:290}},
 {k:'place',id:'lamp',kind:'lamp',at:{x:890,y:250}},
 {k:'editWorkspace',edit:{kind:'rotate',ids:['rack'],degrees:90}},
];
const links:Command[]=[
 ['supply.P24','plc16.L+'],['supply.M0','plc16.M'],
 ['supply.P24','plc16.I0.0'],['plc16.Q0.0','feeder.CMD_enable+'],
 ['supply.M0','feeder.M-'],['supply.P24','eye.L+'],
 ['supply.M0','eye.M'],['eye.OUT_present','plc16.I0.1'],
 ['plc16.Q0.1','lamp.L+'],['supply.M0','lamp.M-'],
].map(([from,to],i)=>({k:'wire',id:'w'+(i+1),from,to}));
const scan=(start:WorldState,count:number):WorldState=>{
 let state=start;
 for(let i=0;i<count;i++)state=tick(state).world;
 return state;
};
const build=(blocked:boolean):WorldState=>{
 const actions:Command[]=[...parts,...links,{k:'loadST',source:ST},
  {k:'setParam',id:'eye',key:'rangeMm',value:800},
  {k:'setParam',id:'eye',key:'responseMs',value:0},
  {k:'setParam',id:'eye',key:'beamMode',value:1},
  {k:'setParam',id:'eye',key:'beamWidthMm',value:100},
  {k:'setParam',id:'eye',key:'occlusionMode',value:blocked?1:0},
 ];
 const state=tick(createWorld(),actions).world;
 expect(state.lastError).toBeNull();
 expect(state.project.wires).toHaveLength(10);
 expect(state.project.components.find(c=>c.id==='rack')?.yawDeg).toBe(90);
 return state;
};
describe('P8 worker optics feed the real programmed PLC rather than renderer state',()=>{
 it('blocks a real powered feeder target behind a rack and does not falsely energize a lamp',()=>{
  const state=scan(tick(build(true),[{k:'run'}]).world,32);
  expect(state.lastError).toBeNull();
  expect(state.plantWorld.world.spawnedCount).toBeGreaterThan(0);
  expect(state.plantWorld.signals.eye.present).toBe(false);
  expect(state.plcs.plc16.tagInputs.In1).toBe(false);
  expect(state.plcs.plc16.coils.Out1).toBe(false);
  expect(state.deviceOn.lamp).toBe(false);
 });
 it('a legacy non-occluding scene detects the very same worker-generated target',()=>{
  const state=scan(tick(build(false),[{k:'run'}]).world,32);
  expect(state.lastError).toBeNull();
  expect(state.plantWorld.world.spawnedCount).toBeGreaterThan(0);
  expect(state.plantWorld.signals.eye.present).toBe(true);
  expect(state.plcs.plc16.tagInputs.In1).toBe(true);
  expect(state.plcs.plc16.coils.Out1).toBe(true);
  expect(state.deviceOn.lamp).toBe(true);
 });
});
