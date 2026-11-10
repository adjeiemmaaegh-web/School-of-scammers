/**
 * P3 read-only original primitive 3D plant drawings and movable bodies.
 * All geometry and movement is determined in the simulation worker. This
 * component may never mutate project data, sample sensors, or move a body.
 * World millimetres map to THREE metres. Plant x/y floor -> THREE x/z.
 */
import type {SceneRuntime} from '../plant/world/runner';
import type {ProjectFile} from '../sim/signals';
import {PLANT_EQUIPMENT} from '../plant/equipment';
import {plantPlacements} from '../sim/p3-plant-bridge';
import type {Body,EquipmentDrawing} from '../plant/world/types';

const metres=(mm:number)=>mm/1000;
const bodyPosition=(body:Body):[number,number,number]=>[
 metres(body.pos.x),metres(body.pos.z+body.size.z/2),metres(body.pos.y),
];
const equipmentPosition=(drawing:EquipmentDrawing):[number,number,number]=>[
 metres(drawing.pos.x),metres(drawing.pos.z),metres(drawing.pos.y),
];
const boxSize=(size:{x:number;y:number;z:number}):[number,number,number]=>[
 metres(size.x),metres(size.z),metres(size.y),
];

function PhysicalBody({body}:{body:Body}){
 const colour=body.tags.jammed===true?'#d6785c':body.tags.material==='metal'?'#a1afbb':
  body.tags.marked===true?'#bd9758':'#c9ad79';
 return <mesh position={bodyPosition(body)} rotation={[0,-body.yawDeg*Math.PI/180,0]}>
   {body.shape==='box'?<boxGeometry args={boxSize(body.size)}/>:
    <cylinderGeometry args={[metres(body.size.x/2),metres(body.size.x/2),metres(body.size.z),14]}/>}
   <meshStandardMaterial color={colour} roughness={0.78} metalness={body.tags.material==='metal'?.48:.05}/>
 </mesh>;
}
function Drawing({drawing}:{drawing:EquipmentDrawing}){
 return <mesh position={equipmentPosition(drawing)} rotation={[0,-drawing.yawDeg*Math.PI/180,0]}>
  {drawing.shape==='box'?<boxGeometry args={boxSize(drawing.size)}/>:
   <cylinderGeometry args={[metres(drawing.size.x/2),metres(drawing.size.x/2),
     metres(drawing.size.z),20]}/>}
  <meshStandardMaterial color={drawing.colour} metalness={0.25} roughness={0.6}/>
 </mesh>;
}
export function PlantWorld3D({project,scene}:{project:ProjectFile;scene:SceneRuntime}){
 const stations=plantPlacements(project);
 return <group name="worker-authored-plant-world">
  {stations.map(item=>{
    const def=PLANT_EQUIPMENT[item.kind];
    const state=scene.world.model[item.id]??def.fresh(item.params);
    const ctx={id:item.id,originMm:item.originMm,yawDeg:item.yawDeg,params:item.params};
    return <group key={item.id}>
      {def.describe(state,ctx).map((drawing,index)=>
        <Drawing key={drawing.part+'-'+index} drawing={drawing}/>)}
    </group>;
  })}
  {scene.world.bodies.map(body=><PhysicalBody key={body.id} body={body}/>)}
 </group>;
}
