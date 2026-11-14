/**
 * Offline teacher reference PLC programs for P16 fault-variance tests.
 * These are test-only sources. They never enter a learner project or
 * production simulator as hidden, automatically executed logic.
 */
import {makePlantSceneProject} from '../../src/sim/p3-scene-import';
import {createWorld,tick} from '../../src/sim/orchestrator';
import {advancedSpecFor} from '../../src/plant/scenes/matrix-p14';
import {AUTO_FACTORY_SPECS} from '../../src/plant/scenes/matrix-p15-autonomous-factory';
import type {ProjectFile,Wire} from '../../src/sim/signals';

export type P16Original='robot-sort'|'gantry-transfer'|'palletizing'|'bottle-line';
const robotClauses=[
 'IF In0 THEN Phase := 1; END_IF;',
 'IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
 'IF In1 THEN Lane := In2; Phase := 3; END_IF;',
 'Out1 := TRUE; Out3 := Lane; IF In3 THEN Phase := 4; END_IF;',
 'Out1 := TRUE; Out2 := TRUE; Out3 := Lane; IF NOT In4 THEN Phase := 5; END_IF;',
 'Out1 := TRUE; Out2 := TRUE; Out3 := Lane; IF In4 THEN Phase := 6; END_IF;',
 'Out2 := TRUE; Out3 := Lane; IF NOT In3 THEN Phase := 7; END_IF;',
 'Out3 := Lane; IF NOT In4 THEN Phase := 8; END_IF;',
 'Out3 := Lane; IF In4 THEN Count := Count + 1; Phase := 1; END_IF;',
];
const factoryClauses:Record<Exclude<P16Original,'robot-sort'>,string[]>={
 'gantry-transfer':[
  'IF In0 THEN Phase := 1; END_IF;',
  'IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
  'IF In1 THEN Phase := 3; END_IF;',
  'Out1 := TRUE; IF In2 THEN Phase := 4; END_IF;',
  'Out1 := TRUE; Out2 := TRUE; IF NOT In3 THEN Phase := 5; END_IF;',
  'Out1 := TRUE; Out2 := TRUE; IF In3 THEN Phase := 6; END_IF;',
  'Out2 := TRUE; IF NOT In2 THEN Phase := 7; END_IF;',
  'IF NOT In3 THEN Phase := 8; END_IF;',
  'IF In3 THEN Count := Count + 1; Phase := 1; END_IF;',
 ],
 palletizing:[
  'IF In0 THEN Phase := 1; END_IF;',
  'IF Count < 8 AND NOT In3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
  'IF In1 THEN Phase := 3; END_IF;',
  'Out1 := TRUE; Wait := 0; Phase := 4;',
  'IF In2 THEN Phase := 5; ELSIF Wait >= 3 THEN Phase := 3; ELSE Wait := Wait + 1; END_IF;',
  'Out2 := TRUE; IF NOT In2 THEN Phase := 6; END_IF;',
  'Count := Count + 1; Phase := 1;',
 ],
 'bottle-line':[
  'IF In0 THEN Phase := 1; END_IF;',
  'IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
  'Out1 := TRUE; IF In1 THEN Phase := 3; END_IF;',
  'Out2 := TRUE; IF In2 THEN Phase := 4; END_IF;',
  'Out1 := TRUE; IF In3 THEN Phase := 5; END_IF;',
  'Out3 := TRUE; IF In4 THEN Phase := 6; END_IF;',
  'Out1 := TRUE; IF In5 THEN Phase := 7; END_IF;',
  'Out1 := TRUE; IF NOT In5 THEN Count := Count + 1; Phase := 1; END_IF;',
 ],
};
function program(scene:P16Original):string{
 const robot=scene==='robot-sort';
 const inputs=robot?5:scene==='bottle-line'?6:4;
 const outputs=robot?6:scene==='palletizing'?3:4;
 const initial=[
  'VAR_INPUT',...Array.from({length:inputs},(_,i)=>' In'+i+' : BOOL;'),
  'END_VAR','VAR_OUTPUT',...Array.from({length:outputs},(_,i)=>' Out'+i+' : BOOL;'),
  'END_VAR','VAR',' Phase : INT := 0;',' Count : INT := 0;',
  ...(robot?[' Lane : BOOL := FALSE;']:scene==='palletizing'?[' Wait : INT := 0;']:[]),
  'END_VAR',
  ...Array.from({length:outputs},(_,i)=>'Out'+i+' := FALSE;'),
 ];
 if(robot)initial.push('Out3 := Lane;','Out4 := Phase > 0 AND Phase < 9;',
  'Out5 := Phase > 0 AND Phase < 9;');
 if(scene==='gantry-transfer')initial.push('Out3 := Phase > 0 AND Phase < 9;');
 const steps=robot?robotClauses:factoryClauses[scene];
 return [...initial,'CASE Phase OF',...steps.map((command,i)=>i+': '+command),
  '9: Out0 := FALSE;','END_CASE;'].join('\n');
}
function links(scene:P16Original):[string,string][]{
 const pairs:[string,string][]=[
  ['scene-supply.P24','scene-plc.L+'],['scene-supply.M0','scene-plc.M'],
 ];
 if(scene==='robot-sort'){
  const outputs:[string,string][]=[
   ['feeder','feed'],['robot','grip'],['robot','dispatch'],
   ['robot','routeMetal'],['metal-out','run'],['plain-out','run'],
  ];
  outputs.forEach(([id,command],i)=>{
   pairs.push(['scene-plc.Q0.'+i,id+'.CMD_'+command+'+'],
    ['scene-supply.M0',id+'.M-']);
  });
  const inputs:[string,string][]=[
   ['pickup','present'],['eye','present'],['robot','partHeld'],['robot','inPosition'],
  ];
  inputs.forEach(([id,signal],i)=>pairs.push(
   [id+'.OUT_'+signal,'scene-plc.I0.'+(i+1)],
   ['scene-supply.P24',id+'.L+'],['scene-supply.M0',id+'.M']));
 }else{
  const main=advancedSpecFor(scene)!;
  main.commands.forEach(({actor,command},i)=>pairs.push(
   ['scene-plc.Q0.'+i,actor+'.CMD_'+command+'+'],
   ['scene-supply.M0',actor+'.M-']));
  const additional=AUTO_FACTORY_SPECS.find(s=>s.sceneId===scene)!;
  additional.outputs.forEach(([i,id,command])=>pairs.push(
   ['scene-plc.Q0.'+i,id+'.CMD_'+command+'+'],
   ['scene-supply.M0',id+'.M-']));
  additional.sensors.forEach(([id,signal,i])=>pairs.push(
   [id+'.OUT_'+signal,'scene-plc.I0.'+i],
   ['scene-supply.P24',id+'.L+'],['scene-supply.M0',id+'.M']));
 }
 return pairs;
}
export function p16ReferenceProject(scene:P16Original):ProjectFile{
 const original=makePlantSceneProject(scene);
 const wires:Wire[]=links(scene).map(([from,to],i)=>({
  id:'p16-teacher-wire-'+i,from,to,
 }));
 const project:ProjectFile={...original,wires,language:'st',stSource:program(scene),
  ...(scene==='robot-sort'?{params:{
   ...original.params,
   robot:{...original.params?.robot,sortMode:1},
   eye:{...original.params?.eye,rangeMm:400},
  }}:{})};
 const loaded=tick(createWorld(),[{k:'loadProject',project}]).world;
 if(loaded.lastError)throw new Error('P16 reference fixture must load: '+loaded.lastError);
 return loaded.project;
}
