import {describe,it,expect} from 'vitest';
import {EQUIPMENT_KINDS,addEquipment,validateLayout,parseLayout,serializeLayout,defaultLayout,stepWorkcell,initialScan,deviceSignals} from '../src/engineering/workcell-layout';
import {WORKCELL_PRESETS,loadWorkcellPreset} from '../src/engineering/workcell-presets';
import {initialWorkcellPlcState,stepWorkcellPlc,DEFAULT_OPERATOR_PANEL} from '../src/engineering/workcell-plc';
import {validateLadder} from '../src/engineering/ladder';

describe('production educational factory-machine catalogue',()=>{
 it('offers all supported device types as a finite validated palette',()=>{
  expect(EQUIPMENT_KINDS).toHaveLength(13);
  for(const kind of ['vfd','lift','pusher','valve','proximity','indicator'])expect(EQUIPMENT_KINDS).toContain(kind);
  for(const kind of EQUIPMENT_KINDS)expect(validateLayout(addEquipment(defaultLayout(),kind)).equipment.at(-1)?.kind).toBe(kind);
 });
 it('loads four distinct validated factory layouts with meaningful ladder programs',()=>{
  expect(WORKCELL_PRESETS.map(p=>p.id)).toEqual(['conveyor-sort','packaging-cell','vertical-transfer','process-skid']);
  for(const preset of WORKCELL_PRESETS){
   const loaded=loadWorkcellPreset(preset.id);
   expect(validateLayout(loaded.layout)).toEqual(loaded.layout);
   expect(validateLadder(loaded.program)).toEqual([]);
   expect(loaded.layout.equipment.length).toBeGreaterThanOrEqual(4);
   expect(new Set(loaded.layout.equipment.map(x=>x.tag)).size).toBe(loaded.layout.equipment.length);
   expect(parseLayout(serializeLayout(loaded.layout))).toEqual(loaded.layout);
   expect(loaded.program.rungs.length).toBeGreaterThan(0);
  }
 });
 it('never shares mutable layout or PLC objects between scenario loads',()=>{
  const a=loadWorkcellPreset('vertical-transfer');
  a.layout.equipment[0].label='changed';
  const first=a.program.rungs[0].elements[0];
  if(first.type==='contact')first.tag='not-real';
  const b=loadWorkcellPreset('vertical-transfer');
  expect(b.layout.equipment[0].label).not.toBe('changed');
  const unchanged=b.program.rungs[0].elements[0];
  expect(unchanged.type==='contact'&&unchanged.tag).not.toBe('not-real');
 });
 it('rejects unknown scenario identifiers rather than silently selecting the default',()=>{
  expect(()=>loadWorkcellPreset('unknown-scene')).toThrow(/Unknown workcell scenario/);
  expect(()=>loadWorkcellPreset('')).toThrow();
 });
 it('models speed, position and valve travel deterministically using simulated clock',()=>{
  const scene=loadWorkcellPreset('vertical-transfer').layout;
  const devices=Object.fromEntries(scene.equipment.map(x=>[x.id,true]));
  const s1=stepWorkcell(scene,initialScan(),devices,100);
  const s2=stepWorkcell(scene,s1,devices,100);
  expect(s2.devices.lf3.value).toBeGreaterThan(s1.devices.lf3.value);
  expect(s2.devices.vf3.value).toBeGreaterThan(s1.devices.vf3.value);
  expect(s2.devices.vl3.value).toBeGreaterThan(s1.devices.vl3.value);
  expect(s2).toEqual(stepWorkcell(scene,s1,devices,100));
  const tags=deviceSignals(scene,s2);
  expect(tags.LF3_POSITION_PERCENT).toBeGreaterThan(0);
  expect(tags.VF3_SPEED_PERCENT).toBeGreaterThan(0);
  expect(tags.VL3_OPEN_PERCENT).toBeGreaterThan(0);
  expect(tags.VF3_AT_SPEED).toBe(false);
 });
 it('reaches bounded simulated lift end-stop and VFD nominal speed',()=>{
  const scene=loadWorkcellPreset('vertical-transfer').layout;
  let state=initialScan();
  for(let i=0;i<40;i++)state=stepWorkcell(scene,state,{lf3:true,vf3:true,vl3:true},100);
  expect(state.devices.lf3.value).toBe(1);
  expect(state.devices.vf3.value).toBe(1);
  expect(state.devices.vl3.value).toBe(1);
  const sig=deviceSignals(scene,state);
  expect(sig.LF3_EXTENDED).toBe(true);
  expect(sig.VF3_AT_SPEED).toBe(true);
  for(let i=0;i<40;i++)state=stepWorkcell(scene,state,{},100);
  expect(state.devices.lf3.value).toBe(0);
  expect(state.devices.vf3.value).toBe(0);
  expect(state.devices.vl3.value).toBe(0);
  expect(deviceSignals(scene,state).LF3_RETRACTED).toBe(true);
 });
 it('models a packaging pusher stroke with separate proximity sensor field input',()=>{
  const {layout,program}=loadWorkcellPreset('packaging-cell');
  let s=stepWorkcellPlc(layout,program,initialWorkcellPlcState(),DEFAULT_OPERATOR_PANEL,{px2:true},100);
  expect(s.outputs.CV2_CMD).toBe(true);
  expect(s.outputs.PS2_CMD).toBe(true);
  expect(s.outputs.LT2_CMD).toBe(true);
  expect(s.plant.devices.ps2.value).toBeGreaterThan(0);
  expect(s.plant.devices.px2.active).toBe(true);
  expect(s.trace).toHaveLength(3);
  s=stepWorkcellPlc(layout,program,s,DEFAULT_OPERATOR_PANEL,{px2:false},100);
  expect(s.outputs.CV2_CMD).toBe(false);
  expect(s.outputs.PS2_CMD).toBe(false);
  expect(s.plant.devices.ps2.active).toBe(false);
 });
 it('constrains physical actuator commands when E-stop or guard is unsafe',()=>{
  const {layout,program}=loadWorkcellPreset('vertical-transfer');
  const safe=stepWorkcellPlc(layout,program,initialWorkcellPlcState(),DEFAULT_OPERATOR_PANEL,{pe3:true});
  expect(safe.plant.devices.lf3.active).toBe(true);
  for(const panel of [{...DEFAULT_OPERATOR_PANEL,EStopOK:false},{...DEFAULT_OPERATOR_PANEL,GuardClosed:false},{...DEFAULT_OPERATOR_PANEL,AutoEnable:false}]){
   const blocked=stepWorkcellPlc(layout,program,safe,panel,{pe3:true});
   expect(blocked.plant.devices.lf3.active).toBe(false);
   expect(blocked.plant.devices.vf3.active).toBe(false);
   expect(blocked.plant.devices.vl3.active).toBe(false);
  }
 });
 it('tank commissioning combines pump, valve, indicator and vessel level feedback',()=>{
  const {layout,program}=loadWorkcellPreset('process-skid');
  let s=stepWorkcellPlc(layout,program,initialWorkcellPlcState(),DEFAULT_OPERATOR_PANEL,{pe4:true});
  for(let i=0;i<12;i++)s=stepWorkcellPlc(layout,program,s,DEFAULT_OPERATOR_PANEL,{pe4:true});
  expect(s.plant.devices.pm4.active).toBe(true);
  expect(s.plant.devices.vl4.value).toBe(1);
  expect(s.plant.devices.tk4.value).toBeGreaterThan(0);
  expect(s.plant.devices.lt4.active).toBe(true);
  const tags=deviceSignals(layout,s.plant);
  expect(tags.TK4_LEVEL_PERCENT).toBeGreaterThan(0);
 });
 it('original default conveyor demo remains unchanged',()=>{
  const {layout,program}=loadWorkcellPreset('conveyor-sort');
  expect(layout).toEqual(defaultLayout());
  expect(program.rungs.map(x=>x.coil)).toEqual(['CV1_CMD','CY1_CMD']);
 });
 it('machine results reproduce exactly for identical scan sequences and operator inputs',()=>{
  const {layout,program}=loadWorkcellPreset('packaging-cell');
  const run=()=>{
   let s=initialWorkcellPlcState();
   for(const input of [false,true,true,false,true,false,true]){
    s=stepWorkcellPlc(layout,program,s,DEFAULT_OPERATOR_PANEL,{px2:input},100);
   }
   return s;
  };
  expect(run()).toEqual(run());
 });
});
