/**
 * P3 source-owned entry for ten open, editable factory learning layouts.
 * This only PLACES equipment and a default PLC/24V supply. No automatic
 * wiring, hidden reference programs or grading. Learner must wire/program.
 */
import {SCENES} from '../plant/scenes/catalogue';
import {defaultProgramFor} from './plcs';
import type {ProjectFile,PlacedComponent} from './signals';
const px=(mm:number):number=>Math.max(0,Math.min(910,Math.round(mm/10+455)));
const py=(mm:number):number=>Math.max(0,Math.min(450,Math.round(mm/10+225)));
export function makePlantSceneProject(id:string):ProjectFile{
 const scene=SCENES.find(s=>s.id===id);
 if(!scene)throw new Error('Unknown original plant scene '+id);
 const equipment:PlacedComponent[]=scene.equipment.map(p=>({
  id:p.id,kind:p.kind as PlacedComponent['kind'],
  x:px(p.originMm.x),y:py(p.originMm.y),pressed:false,
  ...(p.yawDeg?{yawDeg:p.yawDeg}:{}),
  ...(p.originMm.z?{elevationMm:p.originMm.z}:{}),
 }));
 const first=defaultProgramFor('plc16');
 const components:PlacedComponent[]=[
  {id:'scene-plc',kind:'plc16',x:10,y:10,pressed:false},
  {id:'scene-supply',kind:'supply',x:10,y:200,pressed:false},
  ...equipment,
 ];
 const params=Object.fromEntries(scene.equipment.filter(p=>Object.keys(p.params).length)
   .map(p=>[p.id,{...p.params}]));
 return {formatVersion:1,components,wires:[],program:first.program,
  language:'ladder',stSource:first.stSource,
  ...(Object.keys(params).length?{params}:{})};
}
