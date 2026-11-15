/**
 * Original, procedural physical appearances for registered P3 plant equipment.
 *
 * This is VIEW ONLY. The authoritative worker still supplies drawing
 * dimensions, position, colour, actual mechanism progress and body movement.
 * Geometry is deliberately bounded to the real teaching-model footprint:
 * extra handles, feet, vents and trim convey machine identity, but create NO
 * additional PLC endpoints, collisions, sensors or implied manufacturer fidelity.
 * No textures, downloaded assets, fake factory devices or vendor logos.
 */
type Props = {
  kind:string;
  part:string;
  size:readonly [number,number,number];
  colour:string;
  /** 0..1, derived from actual worker state for an adjusting mechanism. */
  progress:number;
};
const METAL='#a9b8c2', DARK='#273846', EDGE='#d2dce0', AMBER='#e7ae4c';

function Housing({size,colour}:{size:readonly [number,number,number];colour:string}){
  const [w,h,d]=size;
  return <mesh castShadow receiveShadow>
    <boxGeometry args={[w,h,d]}/>
    <meshStandardMaterial color={colour} metalness={.55} roughness={.36}/>
  </mesh>;
}

/** Accurate body envelope plus visible motor shaft, gearbox, cooling ribs. */
function MixerMotor({size,colour}:{size:readonly [number,number,number];colour:string}){
 const [w,h,d]=size, radius=Math.min(w,d)*.36;
 return <group name="ux3-process-mixer-motor" data-ux3-model="mixer">
   <mesh position={[0,-h*.37,0]} castShadow>
     <cylinderGeometry args={[radius*.58,radius*.7,h*.15,16]}/>
     <meshStandardMaterial color={DARK} metalness={.58} roughness={.4}/>
   </mesh>
   <mesh position={[0,-h*.07,0]} castShadow>
     <cylinderGeometry args={[radius,radius,h*.65,24]}/>
     <meshStandardMaterial color={colour} metalness={.65} roughness={.34}/>
   </mesh>
   {[-.23,-.14,-.05,.04,.13].map((step,i)=><mesh key={i} position={[0,h*step,0]} castShadow>
     <torusGeometry args={[radius*1.025,Math.max(.006,radius*.065),6,22]}/>
     <meshStandardMaterial color={i%2?EDGE:METAL} metalness={.72} roughness={.35}/>
   </mesh>)}
   <mesh position={[0,h*.32,0]} castShadow>
     <cylinderGeometry args={[radius*.75,radius*.9,h*.18,20]}/>
     <meshStandardMaterial color={METAL} metalness={.72} roughness={.28}/>
   </mesh>
   <mesh position={[0,h*.44,0]}>
     <cylinderGeometry args={[radius*.43,radius*.43,h*.05,16]}/>
     <meshStandardMaterial color={DARK} metalness={.34}/>
   </mesh>
   <mesh position={[0,-h*.48,0]}>
     <cylinderGeometry args={[radius*.18,radius*.18,h*.18,12]}/>
     <meshStandardMaterial color={EDGE} metalness={.75}/>
   </mesh>
   <mesh position={[0,h*.15,-d*.48]}>
     <boxGeometry args={[w*.42,h*.21,d*.13]}/>
     <meshStandardMaterial color={DARK} metalness={.2}/>
   </mesh>
 </group>;
}

/** A throttling valve has two flanges, a bonnet and a visible live position. */
function IndustrialValve({size,colour,opening}:{size:readonly [number,number,number];colour:string;opening:number}){
 const [w,h,d]=size;
 return <group name="ux3-process-valve" data-ux3-model="valve">
   <mesh position={[0,-h*.12,0]} rotation={[0,0,Math.PI/2]} castShadow>
     <cylinderGeometry args={[d*.32,d*.32,w*.76,20]}/>
     <meshStandardMaterial color={colour} metalness={.52} roughness={.43}/>
   </mesh>
   {[-1,1].map(s=><mesh key={s} position={[s*w*.41,-h*.12,0]} rotation={[0,0,Math.PI/2]}>
     <cylinderGeometry args={[d*.43,d*.43,w*.15,20]}/>
     <meshStandardMaterial color={METAL} metalness={.8} roughness={.22}/>
   </mesh>)}
   <mesh position={[0,h*.15,0]}>
     <cylinderGeometry args={[w*.24,w*.27,h*.38,20]}/>
     <meshStandardMaterial color={DARK} metalness={.4}/>
   </mesh>
   <mesh position={[0,h*.37,0]}>
     <cylinderGeometry args={[w*.25,w*.25,h*.15,16]}/>
     <meshStandardMaterial color={colour} metalness={.42}/>
   </mesh>
   <group position={[0,h*.44,0]} rotation={[0,Math.PI*opening*.45,0]}>
     <mesh rotation={[-Math.PI/2,0,0]}>
       <torusGeometry args={[w*.27,Math.max(.008,w*.045),8,20]}/>
       <meshStandardMaterial color={AMBER} metalness={.48}/>
     </mesh>
     <mesh><boxGeometry args={[w*.46,.023,.025]}/>
       <meshStandardMaterial color={AMBER} metalness={.5}/></mesh>
   </group>
 </group>;
}

function HeatingModule({size,colour}:{size:readonly [number,number,number];colour:string}){
 const [w,h,d]=size;
 return <group name="ux3-process-heater" data-ux3-model="heater">
   <Housing size={[w*.86,h*.73,d*.87]} colour={DARK}/>
   <mesh position={[0,0,-d*.445]}>
     <boxGeometry args={[w*.72,h*.55,.017]}/>
     <meshStandardMaterial color={colour} metalness={.2} roughness={.52}/>
   </mesh>
   {[-.29,-.10,.10,.29].map((p,i)=><mesh key={i} position={[w*p,0,-d*.459]}>
     <boxGeometry args={[w*.055,h*.45,.012]}/>
     <meshStandardMaterial color={i%2?METAL:AMBER} metalness={.45} roughness={.32}/>
   </mesh>)}
   {[-1,1].map(s=><mesh key={s} position={[s*w*.38,0,d*.14]}>
     <boxGeometry args={[w*.06,h*.84,d*.58]}/>
     <meshStandardMaterial color={METAL} metalness={.62}/>
   </mesh>)}
 </group>;
}

function BottleHead({size,colour,cap}:{size:readonly [number,number,number];colour:string;cap:boolean}){
 const [w,h,d]=size;
 return <group name={cap?'ux3-capper-head':'ux3-filler-head'} data-ux3-model={cap?'capper':'filler'}>
   <mesh position={[0,-h*.34,0]}>
     <boxGeometry args={[w*.9,h*.09,d*.88]}/>
     <meshStandardMaterial color={DARK} metalness={.62}/>
   </mesh>
   {[-1,1].map(s=><mesh key={s} position={[s*w*.35,0,d*.31]}>
     <boxGeometry args={[w*.08,h*.68,d*.09]}/>
     <meshStandardMaterial color={METAL} metalness={.65}/>
   </mesh>)}
   <mesh position={[0,h*.23,0]}>
     <boxGeometry args={[w*.67,h*.23,d*.7]}/>
     <meshStandardMaterial color={colour} metalness={.42}/>
   </mesh>
   <mesh position={[0,-h*.06,0]}>
     <cylinderGeometry args={[w*.10,w*.10,h*.43,12]}/>
     <meshStandardMaterial color={EDGE} metalness={.76}/>
   </mesh>
   <mesh position={[0,-h*.26,0]}>
     {cap?<cylinderGeometry args={[w*.22,w*.22,h*.11,18]}/>:
       <coneGeometry args={[w*.13,h*.18,12]}/>}
     <meshStandardMaterial color={cap?AMBER:METAL} metalness={.57}/>
   </mesh>
   <mesh position={[w*.24,h*.24,-d*.36]}>
     <sphereGeometry args={[w*.075,10,8]}/>
     <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={.2}/>
   </mesh>
 </group>;
}

/** Only use where the worker exposes the same physical part; no dummy scene. */
export function PlantMachineVisual({kind,part,size,colour,progress}:Props){
 if(kind==='mixer'&&part==='agitator')
   return <MixerMotor size={size} colour={colour}/>;
 if(kind==='proportional-valve'&&part==='valve')
   return <IndustrialValve size={size} colour={colour} opening={progress}/>;
 if(kind==='heater'&&part==='element')
   return <HeatingModule size={size} colour={colour}/>;
 if(kind==='filler')
   return <BottleHead size={size} colour={colour} cap={false}/>;
 if(kind==='capper')
   return <BottleHead size={size} colour={colour} cap={true}/>;
 return null;
}
