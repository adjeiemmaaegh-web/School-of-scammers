import {describe,it,expect} from 'vitest';
import {MATERIAL_LINE_LAYOUT,MATERIAL_LINE_PROGRAM,loadMaterialLineExercise} from '../src/engineering/workcell-material-exercise';
import {DEFAULT_OPERATOR_PANEL,initialWorkcellPlcState,stepWorkcellPlc} from '../src/engineering/workcell-plc';
import {injectMaterial,initialMaterialFlow,stepMaterialFlow,sampleMaterialSensors,materialWorldPosition,MAX_MATERIAL_UNITS} from '../src/engineering/workcell-material';
import {initialScan,validateLayout} from '../src/engineering/workcell-layout';
import {validateLadder} from '../src/engineering/ladder';

const layout=MATERIAL_LINE_LAYOUT;
const run=(kind:'carton'|'metal'='carton',n=75)=>{
 let state=initialWorkcellPlcState();
 state={...state,material:injectMaterial(layout,state.material,'belt1',kind,0)};
 const snapshots:typeof state[]=[];
 for(let i=0;i<n;i++){
  state=stepWorkcellPlc(layout,MATERIAL_LINE_PROGRAM,state,DEFAULT_OPERATOR_PANEL,{control1:true},100,{materialFlow:true});
  snapshots.push(state);
 }
 return {state,snapshots};
};
describe('simulated geometry-driven industrial material handling',()=>{
 it('loads one valid portable parcel sorter and keeps the program immutable between loads',()=>{
  const first=loadMaterialLineExercise(),second=loadMaterialLineExercise();
  expect(validateLayout(first.layout)).toEqual(layout);
  expect(validateLadder(first.program)).toEqual([]);
  first.layout.equipment[0].label='mutated';
  expect(second.layout.equipment[0].label).not.toBe('mutated');
 });
 it('inserts a unique carton on a conveyor and records an exact simulated-time event',()=>{
  const zero=initialMaterialFlow();
  const loaded=injectMaterial(layout,zero,'belt1','carton',0);
  expect(loaded.units).toEqual([{id:'part-1',kind:'carton',conveyorId:'belt1',progress:.05}]);
  expect(loaded.nextId).toBe(2);
  expect(loaded.events[0]).toEqual({kind:'injected',unitId:'part-1',timeMs:0,conveyorId:'belt1'});
  expect(zero.units).toHaveLength(0);
  expect(()=>injectMaterial(layout,loaded,'belt1','carton',0)).toThrow(/infeed occupied/);
 });
 it('models no conveyor movement without the PLC-run command',()=>{
  const initial={...initialWorkcellPlcState(),material:injectMaterial(layout,initialMaterialFlow(),'belt1','carton',0)};
  const a=stepWorkcellPlc(layout,MATERIAL_LINE_PROGRAM,initial,DEFAULT_OPERATOR_PANEL,{control1:false},100,{materialFlow:true});
  expect(a.outputs.BELT1_CMD).toBe(false);
  expect(a.material.units[0].progress).toBe(.05);
  expect(a.material.completed+a.material.diverted).toBe(0);
  const halted=stepWorkcellPlc(layout,MATERIAL_LINE_PROGRAM,a,{...DEFAULT_OPERATOR_PANEL,GuardClosed:false},{control1:true},100,{materialFlow:true});
  expect(halted.outputs.BELT1_CMD).toBe(false);
  expect(halted.material.units[0].progress).toBe(.05);
 });
 it('samples physical photoeyes on prior scan positions, not fabricated field toggles',()=>{
  let s={...initialWorkcellPlcState(),material:injectMaterial(layout,initialMaterialFlow(),'belt1','carton',0)};
  expect(sampleMaterialSensors(layout,s.material).beam1).toBe(false);
  for(let i=0;i<12;i++)s=stepWorkcellPlc(layout,MATERIAL_LINE_PROGRAM,s,DEFAULT_OPERATOR_PANEL,{control1:true,beam1:false},100,{materialFlow:true});
  expect(sampleMaterialSensors(layout,s.material).beam1).toBe(true);
  const next=stepWorkcellPlc(layout,MATERIAL_LINE_PROGRAM,s,DEFAULT_OPERATOR_PANEL,{control1:true,beam1:false},100,{materialFlow:true});
  expect(next.outputs.REJECT1_CMD).toBe(true);
  expect(next.plant.devices.beam1.active).toBe(true);
  expect(next.material.units[0].progress).toBeGreaterThan(s.material.units[0].progress);
 });
 it('the integrated parcel advances, triggers PLC pusher and is diverted with an event',()=>{
  const {state,snapshots}=run();
  expect(snapshots.some(s=>s.outputs.REJECT1_CMD===true)).toBe(true);
  expect(snapshots.some(s=>s.plant.devices.reject1.value>=0.3)).toBe(true);
  expect(state.material.units).toHaveLength(0);
  expect(state.material.diverted).toBe(1);
  expect(state.material.completed).toBe(0);
  const event=state.material.events.at(-1);
  expect(event?.kind).toBe('diverted');
  expect(event?.unitId).toBe('part-1');
 });
 it('guard or E-stop inhibits motion immediately; cargo remains until restart',()=>{
  let s={...initialWorkcellPlcState(),material:injectMaterial(layout,initialMaterialFlow(),'belt1','carton',0)};
  for(let i=0;i<6;i++)s=stepWorkcellPlc(layout,MATERIAL_LINE_PROGRAM,s,DEFAULT_OPERATOR_PANEL,{control1:true},100,{materialFlow:true});
  const before=s.material.units[0].progress;
  for(const panel of [{...DEFAULT_OPERATOR_PANEL,GuardClosed:false},{...DEFAULT_OPERATOR_PANEL,EStopOK:false}]){
   s=stepWorkcellPlc(layout,MATERIAL_LINE_PROGRAM,s,panel,{control1:true},100,{materialFlow:true});
   expect(s.plant.devices.belt1.active).toBe(false);
   expect(s.material.units[0].progress).toBe(before);
  }
  s=stepWorkcellPlc(layout,MATERIAL_LINE_PROGRAM,s,DEFAULT_OPERATOR_PANEL,{control1:true},100,{materialFlow:true});
  expect(s.material.units[0].progress).toBeGreaterThan(before);
 });
 it('inductive proximity detects metal but not cardboard at identical positions',()=>{
  const modified=validateLayout({...layout,equipment:layout.equipment.map(e=>e.id==='beam1'?{...e,kind:'proximity'}:e)});
  const place=(kind:'carton'|'metal')=>{
   let state=injectMaterial(modified,initialMaterialFlow(),'belt1',kind,0);
   for(let i=0;i<12;i++)state=stepMaterialFlow(modified,state,initialScan(),{belt1:true},100);
   return sampleMaterialSensors(modified,state).beam1;
  };
  expect(place('carton')).toBe(false);
  expect(place('metal')).toBe(true);
 });
 it('different conveyor rotation changes material world position predictably',()=>{
  expect(materialWorldPosition({x:0,z:0,rotation:0},1).x).toBeGreaterThan(0);
  expect(materialWorldPosition({x:0,z:0,rotation:1},1).z).toBeLessThan(0);
  expect(materialWorldPosition({x:2,z:3,rotation:2},1).x).toBeLessThan(2);
 });
 it('requires valid conveyor, cargo kind, bounded simulated time and infeed spacing',()=>{
  const s=initialMaterialFlow();
  expect(()=>injectMaterial(layout,s,'beam1','carton',0)).toThrow(/existing conveyor/);
  expect(()=>injectMaterial(layout,s,'belt1','wood' as 'carton',0)).toThrow(/material type/);
  expect(()=>injectMaterial(layout,s,'belt1','carton',-1)).toThrow(/clock/);
  const after=injectMaterial(layout,s,'belt1','carton',0);
  expect(()=>stepMaterialFlow(layout,after,initialScan(),{},1001)).toThrow(/scan interval/);
  expect(()=>stepMaterialFlow(layout,after,initialScan(),{},0)).toThrow(/scan interval/);
  expect(MAX_MATERIAL_UNITS).toBe(16);
 });
 it('a continuous conveyor with no pusher completes rather than silently deleting cargo',()=>{
  const simplified=validateLayout({...layout,equipment:layout.equipment.filter(e=>e.id!=='reject1')});
  let s=injectMaterial(simplified,initialMaterialFlow(),'belt1','carton',0);
  for(let i=0;i<30;i++)s=stepMaterialFlow(simplified,s,{timeMs:i*100,devices:{}},{belt1:true},100);
  expect(s.units).toHaveLength(0);
  expect(s.completed).toBe(1);
  expect(s.diverted).toBe(0);
  expect(s.events.at(-1)?.kind).toBe('completed');
 });
 it('identical scan sequences yield identical parcel IDs, outputs, counters, clocks and evidence',()=>{
  expect(run('metal')).toEqual(run('metal'));
 });
 it('the legacy manually-toggled sensor curriculum is unchanged unless geometric mode opted in',()=>{
  let s=initialWorkcellPlcState();
  s=stepWorkcellPlc(layout,MATERIAL_LINE_PROGRAM,s,DEFAULT_OPERATOR_PANEL,{control1:true,beam1:true},100);
  expect(s.outputs.REJECT1_CMD).toBe(true);
  expect(s.material).toEqual(initialMaterialFlow());
 });
});
