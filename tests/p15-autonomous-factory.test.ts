import {describe,expect,it} from 'vitest';
import {createWorld,tick} from '../src/sim/orchestrator';
import {makePlantSceneProject} from '../src/sim/p3-scene-import';
import {advancedSpecFor} from '../src/plant/scenes/matrix-p14';
import {AUTO_FACTORY_SPECS,autoFactoryPreflight,runP15AutonomousFactory,
 type AutoFactoryKind} from '../src/plant/scenes/matrix-p15-autonomous-factory';
import type {ProjectFile,Wire} from '../src/sim/signals';

function statements(id:AutoFactoryKind):string[]{
 if(id==='gantry-transfer')return [
  'IF In0 THEN Phase := 1; END_IF;',
  'IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
  'IF In1 THEN Phase := 3; END_IF;',
  'Out1 := TRUE; IF In2 THEN Phase := 4; END_IF;',
  'Out1 := TRUE; Out2 := TRUE; IF NOT In3 THEN Phase := 5; END_IF;',
  'Out1 := TRUE; Out2 := TRUE; IF In3 THEN Phase := 6; END_IF;',
  'Out2 := TRUE; IF NOT In2 THEN Phase := 7; END_IF;',
  'IF NOT In3 THEN Phase := 8; END_IF;',
  'IF In3 THEN Count := Count + 1; Phase := 1; END_IF;',
 ];
 if(id==='palletizing')return [
  'IF In0 THEN Phase := 1; END_IF;',
  'IF Count < 8 AND NOT In3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
  'IF In1 THEN Phase := 3; END_IF;',
  'Out1 := TRUE; Wait := 0; Phase := 4;',
  'IF In2 THEN Phase := 5; ELSIF Wait >= 3 THEN Phase := 3; ELSE Wait := Wait + 1; END_IF;',
  'Out2 := TRUE; IF NOT In2 THEN Phase := 6; END_IF;',
  'Count := Count + 1; Phase := 1;',
 ];
 return [
  'IF In0 THEN Phase := 1; END_IF;',
  'IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
  'Out1 := TRUE; IF In1 THEN Phase := 3; END_IF;',
  'Out2 := TRUE; IF In2 THEN Phase := 4; END_IF;',
  'Out1 := TRUE; IF In3 THEN Phase := 5; END_IF;',
  'Out3 := TRUE; IF In4 THEN Phase := 6; END_IF;',
  'Out1 := TRUE; IF In5 THEN Phase := 7; END_IF;',
  'Out1 := TRUE; IF NOT In5 THEN Count := Count + 1; Phase := 1; END_IF;',
 ];
}
export function factorySource(id:AutoFactoryKind,variant:'case'|'if'='case'):string{
 const inputs=id==='bottle-line'?6:4,outputs=id==='palletizing'?3:4;
 const lines=statements(id);
 const all=[
  'VAR_INPUT',...Array.from({length:inputs},(_,i)=>' In'+i+' : BOOL;'),
  'END_VAR','VAR_OUTPUT',...Array.from({length:outputs},(_,i)=>' Out'+i+' : BOOL;'),
  'END_VAR','VAR',' Phase : INT := 0;',' Count : INT := 0;',
  ' Wait : INT := 0;','END_VAR',
  ...Array.from({length:outputs},(_,i)=>'Out'+i+' := FALSE;'),
  ...(id==='gantry-transfer'?['Out3 := Phase > 0 AND Phase < 9;']:[]),
 ];
 if(variant==='case')return [...all,'CASE Phase OF',
  ...lines.map((line,i)=>i+': '+line),'9: Out0 := FALSE;','END_CASE;'].join('\n');
 return [...all,...lines.map((line,i)=>(i===0?'IF':'ELSIF')+
  ' Phase = '+i+' THEN '+line),'END_IF;'].join('\n');
}
export function factoryProject(id:AutoFactoryKind,source=factorySource(id)):ProjectFile{
 const raw=makePlantSceneProject(id),spec=advancedSpecFor(id)!;
 const ends:[string,string][]=[
  ['scene-supply.P24','scene-plc.L+'],['scene-supply.M0','scene-plc.M'],
 ];
 spec.commands.forEach(({actor,command},i)=>{
  ends.push(['scene-plc.Q0.'+i,actor+'.CMD_'+command+'+'],
   ['scene-supply.M0',actor+'.M-']);
 });
 const auto=AUTO_FACTORY_SPECS.find(s=>s.sceneId===id)!;
 auto.outputs.forEach(([i,actor,command])=>
  ends.push(['scene-plc.Q0.'+i,actor+'.CMD_'+command+'+'],
   ['scene-supply.M0',actor+'.M-']));
 auto.sensors.forEach(([actor,signal,i])=>{
  ends.push([actor+'.OUT_'+signal,'scene-plc.I0.'+i],
   ['scene-supply.P24',actor+'.L+'],['scene-supply.M0',actor+'.M']);
 });
 const wires:Wire[]=ends.map(([from,to],i)=>({id:'p15fc'+i,from,to}));
 const project:ProjectFile={...raw,wires,language:'st',stSource:source};
 const loaded=tick(createWorld(),[{k:'loadProject',project}]).world;
 expect(loaded.lastError).toBeNull();
 return loaded.project;
}
describe('P15 autonomous physical-process workers with feedback, batch repair and bounded throughput',()=>{
 it.each(AUTO_FACTORY_SPECS.map(s=>s.sceneId))(
  '%s uses one 24V start to complete genuine sensor-driven multiple products and recover fault',
  id=>{
   const p=factoryProject(id);
   const before=JSON.stringify(p);
   expect(autoFactoryPreflight(p,id)).toEqual([]);
   const result=runP15AutonomousFactory(p,id);
   expect(result.status,JSON.stringify(result,null,2)).toBe('passed');
   expect(result.produced).toBe(id==='palletizing'?8:3);
   expect(result.completed).toBe(result.expected);
   expect(result.faultRecovered).toBe(true);
   expect(result.simulatedMs).toBeGreaterThan(0);
   expect(result.throughputPerSimHour).toBeGreaterThan(0);
   expect(result.cases.every(c=>c.pass)).toBe(true);
   expect(JSON.stringify(p)).toBe(before);
   expect(before).not.toContain('p15-auto-factory-start');
  },60000);
 it.each(AUTO_FACTORY_SPECS.map(s=>s.sceneId))(
  '%s accepts a distinct IF/ELSIF controller, not a fixed known source signature',
  id=>{
   const r=runP15AutonomousFactory(factoryProject(id,factorySource(id,'if')),id);
   expect(r.status,JSON.stringify(r.cases)).toBe('passed');
  },60000);
 it.each(AUTO_FACTORY_SPECS.map(s=>s.sceneId))(
  '%s rejects an always-on or always-off PLC and missing physical feedback',
  id=>{
   const p=factoryProject(id);
   const wrongOn=factorySource(id).replace('Out0 := FALSE;','Out0 := TRUE;');
   const wrongOff=factorySource(id).replace('IF In0 THEN Phase := 1; END_IF;',
    'IF FALSE THEN Phase := 1; END_IF;');
   expect(runP15AutonomousFactory({...p,stSource:wrongOn},id).status).toBe('failed');
   expect(runP15AutonomousFactory({...p,stSource:wrongOff},id).status).toBe('failed');
   const spec=AUTO_FACTORY_SPECS.find(s=>s.sceneId===id)!;
   const sensor=spec.sensors[0][0];
   const missing={...p,wires:p.wires.filter(w=>w.from!==sensor+'.OUT_present')};
   expect(runP15AutonomousFactory(missing,id).status).toBe('blocked');
  },60000);
});
