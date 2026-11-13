/** Instructor-only original gate-accumulation + actual pusher training source.
 * Never installed into the learner's project or production application.
 */
import {makePlantSceneProject} from '../../src/sim/p3-scene-import';
import {createWorld,tick} from '../../src/sim/orchestrator';
import type {ProjectFile,Wire} from '../../src/sim/signals';
export type P21Controller='correct'|'no-reset'|'held-gate'|'early-reset'|'one-body'|'no-pusher';
export function p21ReferenceProject(kind:P21Controller='correct'):ProjectFile{
 const base=makePlantSceneProject('gate-accumulation');
 const components=[...base.components.map(c=>c.id==='feeder'?{...c,x:430,y:225}:c),
  {id:'pusher',kind:'pusher' as const,x:473,y:225,pressed:false}];
 const pairs:ReadonlyArray<[string,string]>=[
  ['scene-supply.P24','scene-plc.L+'],['scene-supply.M0','scene-plc.M'],
  ['scene-plc.Q0.0','feeder.CMD_feed+'],['scene-supply.M0','feeder.M-'],
  ['scene-plc.Q0.1','belt.CMD_run+'],['scene-supply.M0','belt.M-'],
  ['scene-plc.Q0.2','stopper.CMD_extend+'],['scene-supply.M0','stopper.M-'],
  ['scene-plc.Q0.3','belt.CMD_resetJam+'],
  ['scene-plc.Q0.4','pusher.CMD_extend+'],['scene-supply.M0','pusher.M-'],
  ['scene-supply.P24','belt.L+'],['scene-supply.M0','belt.M'],
  ['scene-supply.P24','stopper.L+'],['scene-supply.M0','stopper.M'],
  ['scene-supply.P24','pusher.L+'],['scene-supply.M0','pusher.M'],
  ['belt.OUT_accumulationTripped','scene-plc.I0.1'],
  ['stopper.OUT_retracted','scene-plc.I0.2'],
  ['pusher.OUT_extended','scene-plc.I0.3'],
 ];
 const wires:Wire[]=pairs.map(([from,to],i)=>({
  id:'p21-actual-wiring-'+i,from,to}));
 const phase3=kind==='one-body'?
  '3: Out1 := TRUE; Out2 := TRUE; Phase := 4;':
  '3: Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Phase := 4;';
 const phase4=kind==='early-reset'?
  '4: Out1 := TRUE; Out2 := TRUE; Out3 := In4; IF In1 THEN Phase := 5; END_IF;':
  '4: Out1 := TRUE; Out2 := TRUE; IF In1 THEN Phase := 5; END_IF;';
 const phase5=kind==='held-gate'?
  '5: Out1 := TRUE; Out2 := TRUE; Out4 := TRUE; IF In2 AND In3 THEN Phase := 6; END_IF;':
  kind==='no-pusher'?
   '5: Out1 := TRUE; IF In2 AND In3 THEN Phase := 6; END_IF;':
   '5: Out1 := TRUE; Out4 := TRUE; IF In2 AND In3 THEN Phase := 6; END_IF;';
 const phase6=kind==='no-reset'?
  '6: Out1 := TRUE; Out4 := TRUE; IF In4 THEN Phase := 7; END_IF;':
  '6: Out1 := TRUE; Out4 := TRUE; Out3 := In4; IF In4 THEN Phase := 7; END_IF;';
 const source=[
  'VAR_INPUT',...Array.from({length:5},(_,i)=>' In'+i+' : BOOL;'),
  'END_VAR','VAR_OUTPUT',...Array.from({length:5},(_,i)=>' Out'+i+' : BOOL;'),
  'END_VAR','VAR',' Phase : INT := 0;',' Delay : INT := 0;','END_VAR',
  ...Array.from({length:5},(_,i)=>'Out'+i+' := FALSE;'),
  'CASE Phase OF',
  '0: IF In0 THEN Phase := 1; END_IF;',
  '1: Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Phase := 2;',
  '2: Out1 := TRUE; Out2 := TRUE; Delay := Delay + 1; IF Delay >= 23 THEN Phase := 3; END_IF;',
  phase3,phase4,phase5,phase6,
  '7: Out1 := TRUE; Out4 := TRUE;',
  'END_CASE;',
 ].join('\n');
 const project:ProjectFile={...base,components,wires,language:'st',stSource:source,
  params:{...base.params,
   belt:{...base.params?.belt,lengthMm:600,widthMm:150,speedMmS:250,
    jamResetMode:1,obstructionTripMode:0,accumulationTripMode:1,
    accumulationDwellMs:200},
   pusher:{speedMmS:250,strokeMm:260,maxMassKg:20}}};
 const w=tick(createWorld(),[{k:'loadProject',project}]).world;
 if(w.lastError)throw new Error('P21 actual PLC fixture failed initial validation '+w.lastError);
 return w.project;
}
