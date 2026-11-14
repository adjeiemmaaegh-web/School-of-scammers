/** P25 instructor-only original PLC outfeed failure/repair program.
 * Source is tests/ ONLY: never installed in the learner application.
 */
import {p24ReferenceProject} from './p24-outfeed-hold-programs';
import {createWorld,tick} from '../../src/sim/orchestrator';
import type {ProjectFile,Wire} from '../../src/sim/signals';

export type P25Controller='correct'|'ignore-limit'|'no-timeout'|
 'auto-retry'|'never-retry'|'unsafe-feed'|'no-alarm'|'premature-release';

export function p25ReferenceProject(kind:P25Controller='correct'):ProjectFile{
 const p=p24ReferenceProject();
 const original=p.stSource??'';
 const old7='7: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; Out6 := NOT Released; IF In8 AND In11 AND In9 THEN Released := TRUE; END_IF; Out0 := In6 AND NOT In5 AND NOT In1 AND NOT In7 AND In10 AND Released; IF Out0 THEN Phase := 8; END_IF;';
 const old8='8: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; Out6 := FALSE;';
 const guard=kind==='premature-release'?'In8 AND In9':'In8 AND In11 AND In9';
 const phase7='7: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; Out6 := TRUE; IF '+
  guard+' THEN ReleaseElapsed := 0; Phase := 9; END_IF;';
 const phase9=kind==='ignore-limit'?
  '9: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; ReleaseElapsed := ReleaseElapsed + 1; IF ReleaseElapsed >= 8 THEN Phase := 10; END_IF;':
  kind==='no-timeout'?
  '9: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; ReleaseElapsed := ReleaseElapsed + 1; IF In10 THEN Phase := 10; END_IF;':
  '9: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; ReleaseElapsed := ReleaseElapsed + 1; IF In10 THEN Phase := 10; END_IF; IF ReleaseElapsed >= 8 AND NOT In10 THEN Phase := 11; END_IF;';
 const retry=kind==='never-retry'?'':kind==='auto-retry'?
  ' Phase := 9;':' IF In12 THEN ReleaseElapsed := 0; Phase := 9; END_IF;';
 const phase11='11: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; Out6 := TRUE; Out7 := '+
  (kind==='no-alarm'?'FALSE':'TRUE')+';'+
  (kind==='unsafe-feed'?' Out0 := In6 AND NOT In5;':'')+retry;
 const phase10='10: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; Out0 := In6 AND NOT In5 AND NOT In1 AND NOT In7 AND In10; IF Out0 THEN Phase := 12; END_IF;';
 const phase12='12: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE;';
 const source=original
  .replace(' In11 : BOOL;',' In11 : BOOL;\n In12 : BOOL;')
  .replace(' Out6 : BOOL;',' Out6 : BOOL;\n Out7 : BOOL;')
  .replace(' Released : BOOL := FALSE;',' Released : BOOL := FALSE;\n ReleaseElapsed : INT := 0;')
  .replace('Out6 := FALSE;','Out6 := FALSE;\nOut7 := FALSE;')
  .replace(old7,phase7)
  .replace(old8,[phase9,phase10,phase11,phase12].join('\n'));
 if(source===original||!source.includes(phase7)||!source.includes(phase11)||
    !source.includes(phase12)||!source.includes('In12 : BOOL;')||
    !source.includes('Out7 : BOOL;'))
  throw new Error('P25 test-only Structured Text transform did not apply');
 const links:ReadonlyArray<[string,string]>=[
  ['scene-plc.Q0.7','outfeed-alarm.L+'],
  ['scene-supply.M0','outfeed-alarm.M-'],
 ];
 const wires:Wire[]=[...p.wires,...links.map(([from,to],i)=>({
  id:'p25-real-fault-alarm-wire-'+i,from,to}))];
 const project:ProjectFile={...p,language:'st',stSource:source,
  components:[...p.components,{
   id:'outfeed-alarm',kind:'lamp',x:710,y:480,pressed:false}],wires};
 const loaded=tick(createWorld(),[{k:'loadProject',project}]).world;
 if(loaded.lastError)throw new Error('P25 instructor reference failed real worker load: '+loaded.lastError);
 return loaded.project;
}
