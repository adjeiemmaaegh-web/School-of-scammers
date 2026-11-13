/** P23 instructor-only 24V two-belt ST program. Never ship reference logic. */
import {p22ReferenceProject} from './p22-zone-programs';
import {createWorld,tick} from '../../src/sim/orchestrator';
import type {ProjectFile,Wire} from '../../src/sim/signals';

export type P23Controller='correct'|'ignore-downstream'|'receiver-off'|
 'never-third'|'blind-upstream'|'no-reset';
export function p23ReferenceProject(kind:P23Controller='correct'):ProjectFile{
 const p=p22ReferenceProject(kind==='never-third'?'never-third':
  kind==='blind-upstream'?'blind-trip':kind==='no-reset'?'no-reset':'correct');
 const old7='7: Out1 := TRUE; Out4 := TRUE; Out0 := In6 AND NOT In5 AND NOT In1; IF Out0 THEN Phase := 8; END_IF;';
 const old7Never='7: Out1 := TRUE; Out4 := TRUE;';
 const new7=kind==='never-third'?
  '7: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE;':
  '7: Out1 := TRUE; Out4 := TRUE; '+(kind==='receiver-off'?'':'Out5 := TRUE; ')+
  'Out0 := In6 AND NOT In5 AND NOT In1'+(kind==='ignore-downstream'?'':' AND NOT In7')+
  '; IF Out0 THEN Phase := 8; END_IF;';
 const old=kind==='never-third'?old7Never:old7;
 let source=(p.stSource??'')
  .replace(' In6 : BOOL;',' In6 : BOOL;\n In7 : BOOL;')
  .replace(' Out4 : BOOL;',' Out4 : BOOL;\n Out5 : BOOL;')
  .replace('Out4 := FALSE;','Out4 := FALSE;\nOut5 := FALSE;')
  .replace(old,new7)
  .replace('8: Out1 := TRUE; Out4 := TRUE;',
   '8: Out1 := TRUE; Out4 := TRUE; '+(kind==='receiver-off'?'':'Out5 := TRUE;'));
 if(source===p.stSource||!source.includes('In7 : BOOL;')||
    !source.includes('Out5 : BOOL;')||!source.includes(new7))
  throw new Error('P23 test-only ST transform failed');
 const links:ReadonlyArray<[string,string]>=[
  ['scene-plc.Q0.5','receiver.CMD_run+'],
  ['scene-supply.M0','receiver.M-'],
  ['scene-supply.P24','receiver.L+'],
  ['scene-supply.M0','receiver.M'],
  ['receiver.OUT_zoneFull','scene-plc.I0.7'],
 ];
 const wires:Wire[]=[...p.wires,...links.map(([from,to],i)=>({
  id:'p23-receiver-wire-'+i,from,to}))];
 const project:ProjectFile={...p,language:'st',stSource:source,
  components:[...p.components,{
   id:'receiver',kind:'belt-conveyor',x:515,y:225,pressed:false}],
  wires,params:{...p.params,
   receiver:{lengthMm:600,widthMm:150,speedMmS:250,
    zoneSensorMode:1,zoneCapacity:1}}};
 const loaded=tick(createWorld(),[{k:'loadProject',project}]).world;
 if(loaded.lastError)throw new Error('P23 source failed worker load '+loaded.lastError);
 return loaded.project;
}
