/** Instructor-only genuine original gate scene PLC fixture. NOT embedded
 * in the learner app; the grader evaluates whatever PLC source is authored. */
import {makePlantSceneProject} from '../../src/sim/p3-scene-import';
import {createWorld,tick} from '../../src/sim/orchestrator';
import type {ProjectFile,Wire} from '../../src/sim/signals';
export type P20Controller='correct'|'no-reset'|'gate-held'|'early-reset'|'never-feed';
export function p20ReferenceProject(controller:P20Controller='correct'):ProjectFile{
 const project=makePlantSceneProject('gate-accumulation');
 const components=project.components.map(c=>c.id==='feeder'?
  {...c,x:430,y:225}:c);
 const pairs:ReadonlyArray<[string,string]>=[
  ['scene-supply.P24','scene-plc.L+'],
  ['scene-supply.M0','scene-plc.M'],
  ['scene-plc.Q0.0','feeder.CMD_feed+'],
  ['scene-supply.M0','feeder.M-'],
  ['scene-plc.Q0.1','belt.CMD_run+'],
  ['scene-supply.M0','belt.M-'],
  ['scene-plc.Q0.2','stopper.CMD_extend+'],
  ['scene-supply.M0','stopper.M-'],
  ['scene-plc.Q0.3','belt.CMD_resetJam+'],
  ['scene-supply.P24','belt.L+'],
  ['scene-supply.M0','belt.M'],
  ['scene-supply.P24','stopper.L+'],
  ['scene-supply.M0','stopper.M'],
  ['belt.OUT_obstructionTripped','scene-plc.I0.1'],
  ['stopper.OUT_retracted','scene-plc.I0.2'],
 ];
 const wires:Wire[]=pairs.map(([from,to],i)=>({
  id:'p20-original-physical-wire-'+i,from,to}));
 const phase1=controller==='never-feed'?
  '1: Out1 := TRUE; Out2 := TRUE; Phase := 2;':
  '1: Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Phase := 2;';
 const phase3=controller==='gate-held'?
  '3: Out1 := TRUE; Out2 := TRUE; IF In2 THEN Phase := 4; END_IF;':
  '3: Out1 := TRUE; IF In2 THEN Phase := 4; END_IF;';
 const output4=controller==='no-reset'?'FALSE':
  controller==='early-reset'?'In3':'In3';
 const source=[
  'VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',' In2 : BOOL;',' In3 : BOOL;','END_VAR',
  'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',' Out2 : BOOL;',' Out3 : BOOL;','END_VAR',
  'VAR',' Phase : INT := 0;','END_VAR',
  'Out0 := FALSE;','Out1 := FALSE;','Out2 := FALSE;',
  'Out3 := '+(controller==='early-reset'?'In3':'FALSE')+';',
  'CASE Phase OF',
  '0: IF In0 THEN Phase := 1; END_IF;',
  phase1,
  '2: Out1 := TRUE; Out2 := TRUE; IF In1 THEN Phase := 3; END_IF;',
  phase3,
  '4: Out1 := TRUE; Out3 := '+output4+';',
  'END_CASE;',
 ].join('\n');
 const candidate:ProjectFile={...project,components,wires,language:'st',
  stSource:source,params:{...project.params,
   belt:{...project.params?.belt,jamResetMode:1,obstructionTripMode:1}}};
 const loaded=tick(createWorld(),[{k:'loadProject',project:candidate}]).world;
 if(loaded.lastError)throw new Error('Original P20 machine fixture invalid: '+loaded.lastError);
 return loaded.project;
}
