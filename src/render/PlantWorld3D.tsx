/**
 * P3 read-only original primitive 3D plant drawings and movable bodies.
 * All geometry and movement is determined in the simulation worker. This
 * component may never mutate project data, sample sensors, or move a body.
 * World millimetres map to THREE metres. Plant x/y floor -> THREE x/z.
 */
import type {SceneRuntime} from '../plant/world/runner';
import type { ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { proposeSensorMount, RAIL_KINDS, SENSOR_KINDS } from './scene-authoring';
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
/**
 * Original low-cost 3D factory details, following the worker's actual equipment
 * positions and saved parameters. These are strictly cosmetic: no conveyor
 * speed, collision, PLC signal or sensor hit is computed by these meshes.
 */
function TransportDetails({item,engaged}:{
 item:{kind:string;originMm:{x:number;y:number};yawDeg:number;params:Record<string,number>};
 engaged:boolean;
}) {
 const length=(item.params.lengthMm??600)/1000;
 const width=(item.params.widthMm??300)/1000;
 const loc:[number,number,number]=[item.originMm.x/1000,0,item.originMm.y/1000];
 const step=Math.max(3,Math.min(14,Math.round(length/.11)));
 const roller=item.kind==='roller-conveyor';
 if(!RAIL_KINDS.has(item.kind))return null;
 return <group name="original-3d-conveyor-hardware" position={loc}
   rotation={[0,-item.yawDeg*Math.PI/180,0]}>
  {[-1,1].map(sign=><mesh key={sign} position={[0,.14,sign*(width/2-.015)]}>
    <boxGeometry args={[length,.14,.035]}/>
    <meshStandardMaterial color="#879aa7" metalness={.48} roughness={.56}/>
   </mesh>)}
  {roller ? Array.from({length:step},(_,i)=>{
    const x=-length/2+(i+.5)*length/step;
    return <mesh key={i} position={[x,.155,0]} rotation={[Math.PI/2,0,0]}>
     <cylinderGeometry args={[.038,.038,Math.max(.08,width-.085),9]}/>
     <meshStandardMaterial color={engaged?'#abc5d0':'#7b8992'}
       metalness={.58} roughness={.44}/>
    </mesh>;
   }) : <mesh position={[0,.135,0]}>
    <boxGeometry args={[Math.max(.09,length-.04),.025,Math.max(.08,width-.08)]}/>
    <meshStandardMaterial color={engaged?'#4a8cb4':'#3d617b'} roughness={.82}/>
   </mesh>}
  <mesh position={[length/2-.08,.03,-width/2-.09]}>
   <cylinderGeometry args={[.08,.08,.14,12]}/>
   <meshStandardMaterial color="#c58339" metalness={.3}/>
  </mesh>
 </group>;
}
function TurntableDetails({item,rotated}:{
 item:{originMm:{x:number;y:number};yawDeg:number};rotated:boolean;
}) {
 return <group position={[item.originMm.x/1000,0,item.originMm.y/1000]}
   rotation={[0,-item.yawDeg*Math.PI/180,0]}>
   <mesh position={[0,.155,0]} rotation={[Math.PI/2,0,0]}>
    <torusGeometry args={[.195,.024,8,32]}/>
    <meshStandardMaterial color="#c7a25f" metalness={.55}/>
   </mesh>
   <mesh position={[0,.13,0]}>
    <boxGeometry args={[.29,.035,.06]}/>
    <meshStandardMaterial color={rotated?'#6ccdb6':'#dae3ed'}/>
   </mesh>
 </group>;
}
/**
 * The line indicates the *placement relationship* between the authored
 * photoeye and carrier, not a raycast. Actual 'present' state comes only from
 * the sensor plugin in the authoritative worker.
 */
function SensorMountGuide({item,project,active}:{
 item:{id:string;kind:string;originMm:{x:number;y:number}};
 project:ProjectFile;active:boolean;
}) {
 if(!SENSOR_KINDS.has(item.kind))return null;
 const device=project.components.find(c=>c.id===item.id);
 if(!device)return null;
 const mount=proposeSensorMount(device.kind,{x:device.x,y:device.y},project,1);
 const carrier=project.components.find(c=>c.id===mount?.carrierId);
 if(!carrier)return null;
 const sensor=[item.originMm.x/1000,.23,item.originMm.y/1000] as [number,number,number];
 const target=[(carrier.x+85-540)/100,.23,(carrier.y+65-290)/100] as [number,number,number];
 const distance=Math.hypot(sensor[0]-target[0],sensor[2]-target[2]);
 if(distance<.055||distance>.4)return null;
 return <group name="visual-sensor-mount-beam-not-worker-raycast">
   <Line points={[sensor,target]} color={active?'#57e6bd':'#f18b72'}
     lineWidth={1.5} dashed dashSize={.035} gapSize={.018}/>
   <mesh position={sensor}>
    <sphereGeometry args={[.035,8,8]}/>
    <meshStandardMaterial color={active?'#47f8c8':'#ea966e'}
      emissive={active?'#47dba9':'#772d25'} emissiveIntensity={.4}/>
   </mesh>
 </group>;
}

export function PlantWorld3D({project,scene,onPointerDownPart,onPointerMovePart,onPointerUpPart,onFocusPart}:{
  project:ProjectFile;scene:SceneRuntime;
  onPointerDownPart:(event:ThreeEvent<PointerEvent>,id:string)=>void;
  onPointerMovePart:(event:ThreeEvent<PointerEvent>)=>void;
  onPointerUpPart:(event:ThreeEvent<PointerEvent>)=>void;
  onFocusPart:(id:string)=>void;
}){
 const stations=plantPlacements(project);
 return <group name="worker-authored-plant-world">
  {stations.map(item=>{
    const def=PLANT_EQUIPMENT[item.kind];
    const state=scene.world.model[item.id]??def.fresh(item.params);
    const ctx={id:item.id,originMm:item.originMm,yawDeg:item.yawDeg,params:item.params};
    return <group key={item.id}
      onPointerDown={e=>onPointerDownPart(e,item.id)}
      onPointerMove={onPointerMovePart} onPointerUp={onPointerUpPart}
      onDoubleClick={e=>{e.stopPropagation();onFocusPart(item.id);}}>
      {def.describe(state,ctx).map((drawing,index)=>
        <Drawing key={drawing.part+'-'+index} drawing={drawing}/>)}
      {RAIL_KINDS.has(item.kind)&&<TransportDetails item={item} engaged={state.engaged}/>}
      {item.kind==='turntable'&&<TurntableDetails item={item} rotated={state.done}/>}
      {SENSOR_KINDS.has(item.kind)&&<SensorMountGuide item={item} project={project}
        active={scene.signals[item.id]?.present===true}/>} 
    </group>;
  })}
  {scene.world.bodies.map(body=><PhysicalBody key={body.id} body={body}/>)}
 </group>;
}
