/**
 * P7 original, low-poly, semantic 3D machinery drawn from the exact worker P3
 * equipment descriptions. The worker alone determines body positions, scan
 * truth, equipment states, parameters and fault indicators. No visual frame
 * changes a sensor or writes a PLC signal.
 */
import {Html} from '@react-three/drei';
import type {ThreeEvent} from '@react-three/fiber';
import type {SceneRuntime} from '../plant/world/runner';
import type {ProjectFile} from '../sim/signals';
import {PLANT_EQUIPMENT} from '../plant/equipment';
import {plantPlacements} from '../sim/p3-plant-bridge';
import {P7_SENSOR_KINDS} from './scene-authoring';
import {opticalZoneOf,type OpticalZone} from '../plant/equipment/sensor-zone';
import type {Body,EquipmentDrawing,LiveSignal} from '../plant/world/types';

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
const isTransport=(kind:string)=>kind==='roller-conveyor'||kind==='belt-conveyor';
const clampPositive=(n:number)=>Math.max(.015,n);

function PhysicalBody({body}:{body:Body}){
 const colour=body.tags.jammed===true?'#d6785c':body.tags.material==='metal'?'#a1afbb':
  body.tags.marked===true?'#bd9758':'#c9ad79';
 return <mesh position={bodyPosition(body)} rotation={[0,-body.yawDeg*Math.PI/180,0]}>
   {body.shape==='box'?<boxGeometry args={boxSize(body.size)}/>:
    <cylinderGeometry args={[metres(body.size.x/2),metres(body.size.x/2),metres(body.size.z),14]}/>}
   <meshStandardMaterial color={colour} roughness={0.78} metalness={body.tags.material==='metal'?.48:.05}/>
 </mesh>;
}

/** Draw only bounded fixed geometry from P3 model; the moving product never
 * belongs to these procedural illustrations. Rollers are visibly distinct
 * from belts, and the circular turntable retains its P3 physics silhouette.
 */
function Drawing({drawing,kind}:{drawing:EquipmentDrawing;kind:string}){
 const [len,height,depth]=boxSize(drawing.size);
 const roller=isTransport(kind)&&drawing.shape==='box';
 const rollers=Math.min(16,Math.max(4,Math.round(len/.075)));
 const railWidth=.028;
 return <group position={equipmentPosition(drawing)}
   rotation={[0,-drawing.yawDeg*Math.PI/180,0]}>
   {roller ? <>
     <mesh position={[0,-height*.22,0]}>
       <boxGeometry args={[len,clampPositive(height*.4),depth]}/>
       <meshStandardMaterial color={drawing.colour} metalness={.25} roughness={.64}/>
     </mesh>
     {[-1,1].map(side=><mesh key={'rail-'+side}
       position={[0,height*.23,side*(depth/2-railWidth/2)]}>
       <boxGeometry args={[len,clampPositive(height*.46),railWidth]}/>
       <meshStandardMaterial color="#9caebb" metalness={.48}/>
     </mesh>)}
     {kind==='roller-conveyor'
       ? Array.from({length:rollers},(_,i)=><mesh key={'roller-'+i}
          position={[-len/2+(i+.5)*len/rollers,height*.36,0]}
          rotation={[Math.PI/2,0,0]}>
          <cylinderGeometry args={[Math.min(.027,len/rollers*.3),Math.min(.027,len/rollers*.3),
             Math.max(.05,depth-.057),8]}/>
          <meshStandardMaterial color="#b4c0ca" metalness={.42} roughness={.46}/>
         </mesh>)
       : <mesh position={[0,height*.31,0]}>
           <boxGeometry args={[len-.025,.016,depth-.045]}/>
           <meshStandardMaterial color="#33515d" roughness={.94}/>
         </mesh>}
     <mesh position={[len/2-.065,-height*.52,depth/2+.065]}>
       <boxGeometry args={[.12,.16,.13]}/>
       <meshStandardMaterial color="#d58e38" metalness={.32}/>
     </mesh>
   </> : kind==='turntable'&&drawing.shape==='cylinder' ? <>
     <mesh><cylinderGeometry args={[len/2,len/2,height,28]}/>
       <meshStandardMaterial color={drawing.colour} metalness={.32} roughness={.65}/></mesh>
     <mesh position={[0,height/2+.008,0]} rotation={[-Math.PI/2,0,0]}>
       <torusGeometry args={[len*.37,.014,6,32]}/>
       <meshStandardMaterial color="#d3bd6e" metalness={.3}/></mesh>
     {[-.11,0,.11].map(offset=><mesh key={offset}
       position={[0,height/2+.016,offset]}>
       <boxGeometry args={[len*.78,.015,.027]}/>
       <meshStandardMaterial color="#b6c4cd" metalness={.45}/></mesh>)}
   </> : <mesh>
      {drawing.shape==='box'?<boxGeometry args={[len,height,depth]}/>:
       <cylinderGeometry args={[len/2,len/2,height,20]}/>}
      <meshStandardMaterial color={drawing.colour} metalness={.25} roughness={.6}/>
   </mesh>}
 </group>;
}
/** This volume is projected from the *same* sensor-zone descriptor read
 * by the authoritative worker. Area mode shows the historical square.
 * Directional mode shows a forward-facing bounded sensing strip, not a
 * decorative beam with sensing semantics the worker does not implement.
 * The visible above-floor part is 0..600mm, matching the bounded body world.
 */
function OpticalSensingVolume({zone,on}:{zone:OpticalZone;on:boolean}){
 const directional=zone.shape==='forward';
 const length=directional?metres(zone.rangeMm):metres(zone.rangeMm*2);
 const width=directional?metres(zone.beamWidthMm):metres(zone.rangeMm*2);
 const height=metres(zone.heightMm/2);
 const offsetX=directional?length/2:0;
 return <group rotation={[0,-zone.yawDeg*Math.PI/180,0]}
     name={directional?'worker-forward-sensing-region':'worker-area-sensing-region'}>
   <mesh raycast={()=>{}} position={[offsetX,height/2,0]}>
     <boxGeometry args={[length,height,width]}/>
     <meshBasicMaterial color={on?'#49dfb5':'#48b4e2'}
       transparent opacity={on?.095:.035} depthWrite={false}/>
   </mesh>
   <mesh raycast={()=>{}} position={[offsetX,height/2,0]}>
     <boxGeometry args={[length,height,width]}/>
     <meshBasicMaterial color={on?'#72eec3':'#5b9dc5'}
       transparent opacity={on?.43:.20} wireframe depthWrite={false}/>
   </mesh>
 </group>;
}
const formatSignal=(name:string,value:boolean|number)=>
 `${name}: ${typeof value==='boolean'?(value?'ON':'OFF'):Number(value.toFixed(2))}`;
function PlantSignalOverlay({id,signals,fault}:{id:string;signals:LiveSignal;fault?:string}){
 const values=Object.entries(signals);
 return <Html center position={[0,.8,0]} distanceFactor={9}
   style={{pointerEvents:'none'}} occlude={false}>
   <div className="p7-3d-live-tags" data-p7-signals={id} role="status">
     <strong>{id} · simulated I/O</strong>
     {values.map(([name,value])=><span key={name} data-p7-signal-name={name}>
       {formatSignal(name,value)}</span>)}
     {fault&&<span>Model fault: {fault}</span>}
   </div>
 </Html>;
}
export function PlantWorld3D({project,scene,onPointerDownPart,onPointerMovePart,onPointerUpPart,onFocusPart,
 selectedIds=[],showZones=false,showSignals=false}:{
  project:ProjectFile;scene:SceneRuntime;
  onPointerDownPart:(event:ThreeEvent<PointerEvent>,id:string)=>void;
  onPointerMovePart:(event:ThreeEvent<PointerEvent>)=>void;
  onPointerUpPart:(event:ThreeEvent<PointerEvent>)=>void;
  onFocusPart:(id:string)=>void;
  selectedIds?:readonly string[];
  showZones?:boolean;showSignals?:boolean;
}){
 const stations=plantPlacements(project);
 return <group name="worker-authored-plant-world">
  {stations.map(item=>{
    const def=PLANT_EQUIPMENT[item.kind];
    const state=scene.world.model[item.id]??def.fresh(item.params);
    const ctx={id:item.id,originMm:item.originMm,yawDeg:item.yawDeg,params:item.params};
    const optical=P7_SENSOR_KINDS.has(item.kind);
    const active=Object.values(scene.signals[item.id]??{}).some(v=>v===true);
    const zone=optical?opticalZoneOf(item.kind,ctx,project.plantFaults?.[item.id]??null):null;
    return <group key={item.id}
      onPointerDown={e=>onPointerDownPart(e,item.id)}
      onPointerMove={onPointerMovePart} onPointerUp={onPointerUpPart}
      onDoubleClick={e=>{e.stopPropagation();onFocusPart(item.id);}}>
      {def.describe(state,ctx).map((drawing,index)=>
        <Drawing kind={item.kind} key={drawing.part+'-'+index} drawing={drawing}/>)}
      {showZones&&optical&&<group
        position={[metres(item.originMm.x),0,metres(item.originMm.y)]}>
        {zone&&<OpticalSensingVolume zone={zone} on={active}/>}
      </group>}
      {showSignals&&selectedIds.includes(item.id)&&<group
        position={[metres(item.originMm.x),0,metres(item.originMm.y)]}>
        <PlantSignalOverlay id={item.id} signals={scene.signals[item.id]??{}}
          fault={project.plantFaults?.[item.id]}/>
      </group>}
    </group>;
  })}
  {scene.world.bodies.map(body=><PhysicalBody key={body.id} body={body}/>)}
 </group>;
}
