/**
 * Test-only instructor source for P19. Never installed into learner product.
 * Original 24V bottle workcell, with actual PLC jam and restore terminals.
 */
import {p16ReferenceProject} from './p16-autonomous-programs';
import {createWorld,tick} from '../../src/sim/orchestrator';
import type {ProjectFile,Wire} from '../../src/sim/signals';

export type P19Controller='correct'|'no-reset'|'held-reset'|'wrong-start';
export function p19ReferenceProject(kind:P19Controller='correct'):ProjectFile{
 const base=p16ReferenceProject('bottle-line');
 if(!base.stSource)throw new Error('P19 reference PLC source is missing');
 let st=base.stSource;
 const pairs:[string,string][]=[
  [' In5 : BOOL;\nEND_VAR',
   ' In5 : BOOL;\n In6 : BOOL;\n In7 : BOOL;\n In8 : BOOL;\nEND_VAR'],
  [' Out3 : BOOL;\nEND_VAR',
   ' Out3 : BOOL;\n Out4 : BOOL;\n Out5 : BOOL;\nEND_VAR'],
  ['Out3 := FALSE;',
   'Out3 := FALSE;\nOut4 := In6 AND In7;\nOut5 := '+
    (kind==='held-reset'?'TRUE':kind==='no-reset'?'FALSE':
     'In8 AND In7')+';'],
 ];
 if(kind==='wrong-start')pairs.push([
  'IF In0 THEN Phase := 1; END_IF;',
  'IF FALSE THEN Phase := 1; END_IF;',
 ]);
 for(const [from,to] of pairs){
  if(st.split(from).length!==2)throw Error('P19 PLC fixture source anchor not unique '+from);
  st=st.replace(from,to);
 }
 const extra:[string,string][]=[
  ['scene-plc.Q0.4','belt.CMD_resetJam+'],
  ['belt.OUT_jam','scene-plc.I0.6'],
  ['scene-supply.P24','belt.L+'],
  ['scene-supply.M0','belt.M'],
  ['scene-plc.Q0.5','belt.CMD_resetRestart+'],
  ['belt.OUT_restartRequired','scene-plc.I1.0'],
 ];
 const wires:Wire[]=[...base.wires,...extra.map(([from,to],i)=>({
  id:'p19-fixture-wire-'+i,from,to,
 }))];
 const p:ProjectFile={...base,wires,language:'st',stSource:st,
  params:{...base.params,belt:{...base.params?.belt,
   jamResetMode:1,restartHoldMode:1}}};
 const loaded=tick(createWorld(),[{k:'loadProject',project:p}]).world;
 if(loaded.lastError)throw Error('P19 reference project must validate: '+loaded.lastError);
 return loaded.project;
}
