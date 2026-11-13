/** P24 instructor-only genuine Q0.6 stopper, sensor I0.11 and PLC sequence.
 * This is test-only source and is NOT bundled in the learner application.
 */
import {p23ReferenceProject} from './p23-handoff-programs';
import {createWorld,tick} from '../../src/sim/orchestrator';
import type {ProjectFile,Wire} from '../../src/sim/signals';

export type P24Controller='correct'|'premature-release'|'no-dwell'|
 'no-stop'|'never-release'|'unsafe-third'|'never-third'|'no-reset';
export function p24ReferenceProject(kind:P24Controller='correct'):ProjectFile{
 const p=p23ReferenceProject(kind==='no-reset'?'no-reset':'correct');
 const sourceBefore=p.stSource??'';
 const phase7='7: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; Out0 := In6 AND NOT In5 AND NOT In1 AND NOT In7; IF Out0 THEN Phase := 8; END_IF;';
 const releaseCondition=kind==='premature-release'?'In8 AND In7 AND In9':
  kind==='no-dwell'?'In8 AND In9':
  kind==='never-release'?'FALSE':'In8 AND In11 AND In9';
 const new7='7: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; '+
  (kind==='no-stop'?'Out6 := FALSE;':'Out6 := NOT Released;')+
  ' IF '+releaseCondition+' THEN Released := TRUE; END_IF;'+
  ' Out0 := '+(kind==='never-third'?'FALSE':
   'In6 AND NOT In5 AND NOT In1'+(kind==='unsafe-third'?'':' AND NOT In7')+
   ' AND In10 AND Released')+
  '; IF Out0 THEN Phase := 8; END_IF;';
 const code=sourceBefore
  .replace(' In7 : BOOL;', ' In7 : BOOL;\n In8 : BOOL;\n In9 : BOOL;\n In10 : BOOL;\n In11 : BOOL;')
  .replace(' Out5 : BOOL;', ' Out5 : BOOL;\n Out6 : BOOL;')
  .replace(' Delay : INT := 0;', ' Delay : INT := 0;\n Released : BOOL := FALSE;')
  .replace('Out5 := FALSE;', 'Out5 := FALSE;\nOut6 := FALSE;')
  .replace(phase7,new7)
  .replace('8: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE;',
   '8: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; Out6 := FALSE;');
 if(code===sourceBefore||!code.includes(new7)||
  !code.includes('In11 : BOOL;')||!code.includes('Out6 : BOOL;')||
  !code.includes('Released : BOOL := FALSE;'))
  throw new Error('P24 authentic test-only ST transform failed');
 const links:ReadonlyArray<[string,string]>=[
  ['scene-plc.Q0.6','outstop.CMD_extend+'],
  ['scene-supply.M0','outstop.M-'],
  ['scene-supply.P24','outstop.L+'],
  ['scene-supply.M0','outstop.M'],
  ['outstop.OUT_extended','scene-plc.I0.9'],
  ['outstop.OUT_retracted','scene-plc.I0.10'],
  ['outstop.OUT_heldLoad','scene-plc.I0.11'],
 ];
 const wires:Wire[]=[...p.wires,...links.map(([from,to],i)=>({
  id:'p24-real-stop-wire-'+i,from,to}))];
 const project:ProjectFile={...p,language:'st',stSource:code,
  components:[...p.components,{
   id:'outstop',kind:'stopper',x:535,y:225,pressed:false}],
  wires,params:{...p.params,
   outstop:{travelMs:100,holdSensorMode:1,holdDwellMs:200}}};
 const loaded=tick(createWorld(),[{k:'loadProject',project}]).world;
 if(loaded.lastError)throw new Error('P24 genuine training project failed worker load '+loaded.lastError);
 return loaded.project;
}
