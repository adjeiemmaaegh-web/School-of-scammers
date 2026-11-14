/** P22 instructor-only real 3-carton PLC. Never part of the learner app. */
import {p21ReferenceProject} from './p21-queue-programs';
import {createWorld,tick} from '../../src/sim/orchestrator';
import type {ProjectFile} from '../../src/sim/signals';

export type P22Controller='correct'|'unsafe-third'|'blind-trip'|'never-third'|'no-reset';
export function p22ReferenceProject(kind:P22Controller='correct'):ProjectFile{
 const p=p21ReferenceProject(kind==='no-reset'?'no-reset':'correct');
 const phase4='4: Out1 := TRUE; Out2 := TRUE; IF In1 THEN Phase := 5; END_IF;';
 const phase7='7: Out1 := TRUE; Out4 := TRUE;';
 const fullControl=kind==='unsafe-third'?'In6':
  kind==='blind-trip'?'In6 AND NOT In1':'In6 AND NOT In5';
 const early='4: Out1 := TRUE; Out2 := TRUE; Out0 := '+fullControl+
  '; IF In1 THEN Phase := 5; END_IF;';
 const after=kind==='never-third'?
  '7: Out1 := TRUE; Out4 := TRUE;':
  '7: Out1 := TRUE; Out4 := TRUE; Out0 := In6 AND NOT In5 AND NOT In1; IF Out0 THEN Phase := 8; END_IF;';
 const source=(p.stSource??'')
  .replace(' In4 : BOOL;',' In4 : BOOL;\n In5 : BOOL;\n In6 : BOOL;')
  .replace(phase4,early).replace(phase7,after)
  .replace('END_CASE;','8: Out1 := TRUE; Out4 := TRUE;\nEND_CASE;');
 if(source===p.stSource||!source.includes('In6 : BOOL;')||!source.includes(early))
  throw new Error('P22 reference source transform failed; no patched PLC');
 const project:ProjectFile={...p,language:'st',stSource:source,
  wires:[...p.wires,{
   id:'p22-actual-zone-input',from:'belt.OUT_zoneFull',to:'scene-plc.I0.5'}],
  params:{...p.params,belt:{...p.params?.belt,zoneSensorMode:1,zoneCapacity:2}}};
 const loaded=tick(createWorld(),[{k:'loadProject',project}]).world;
 if(loaded.lastError)throw new Error('P22 source failed real worker validation '+loaded.lastError);
 return loaded.project;
}
