import { Canvas } from '@react-three/fiber';
import {SceneShell} from './SceneShell';
import { useMemo } from 'react';
import { OrbitControls, Text } from '@react-three/drei';
import type { ProcessState } from '../engineering/conveyor-process';

/** Pure rendering adapter: no clock, physics, or PLC logic runs in the scene. */
export function processVisualState(process: ProcessState) {
  return {
    packages: process.products.map(p => ({
      id: p.id,
      position: [p.xMm / 1000 - 2, 0.92, p.lane === 'reject' ? -1.05 : 0] as [number,number,number],
      rejected: p.classified,
    })),
    beltRunning: process.motorFeedback,
    photoeyeActive: process.photoeye,
    exitActive: process.exitSensor,
    diverterActive: process.diverterExtended,
    diverterPosition: process.diverterPosition,
    jammed: process.faults.productJam,
  };
}

/** Geometric detail is derived from state only; no simulation is run by rendering. */
function Roller({x}:{x:number}) {
  return <mesh position={[x,0.77,0]} rotation={[Math.PI/2,0,0]}>
    <cylinderGeometry args={[0.07,0.07,1.12,12]}/>
    <meshStandardMaterial color="#718399" metalness={0.82} roughness={0.27}/>
  </mesh>;
}
function Photoeye({x,active,label}:{x:number;active:boolean;label:string}) {
  return <group position={[x,0,0]}>
    <mesh position={[0,1.04,0.75]}><boxGeometry args={[0.17,0.2,0.23]}/><meshStandardMaterial color="#263b53" metalness={0.55}/></mesh>
    <mesh position={[0,1.05,0.875]}><sphereGeometry args={[0.055,12,8]}/><meshStandardMaterial color={active?'#22d3ee':'#f87171'} emissive={active?'#0891b2':'#7f1d1d'} emissiveIntensity={0.8}/></mesh>
    <mesh position={[0,0.55,0.75]}><cylinderGeometry args={[0.025,0.025,0.8,8]}/><meshStandardMaterial color="#9aaaba" metalness={0.7}/></mesh>
    <Text position={[0,1.38,0.8]} fontSize={0.11} color="#cbd5e1">{label}</Text>
  </group>;
}
function SafetyFence({z}:{z:number}) {
  return <group position={[0,0,z]}>
    {[-2.15,-1.08,0,1.08,2.15].map(x=><mesh key={x} position={[x,0.88,0]}><boxGeometry args={[0.045,1.75,0.045]}/><meshStandardMaterial color="#eab308" metalness={0.5}/></mesh>)}
    {[0.2,0.8,1.55].map(y=><mesh key={y} position={[0,y,0]}><boxGeometry args={[4.35,0.025,0.025]}/><meshStandardMaterial color="#94a3b8" metalness={0.6}/></mesh>)}
  </group>;
}
export function ProcessConveyor3D({process}:{process:ProcessState}) {
  const scene = processVisualState(process);
  const rollerPositions=useMemo(()=>Array.from({length:17},(_,i)=>-1.98+i*0.2475),[]);
  return <SceneShell title="PLC-driven conveyor process" summary={`Belt: ${scene.beltRunning?'MOVING':'STOPPED'}. Products: ${scene.packages.length}. Photoeye: ${scene.photoeyeActive?'ACTIVE':'CLEAR'}. Diverter: ${scene.diverterActive?'EXTENDED':'RETRACTED/IN TRANSIT'}.`}>
    <Canvas camera={{position:[4.7,3.7,6.7],fov:48}}>
      <color attach="background" args={['#0e1726']}/>
      <ambientLight intensity={0.85}/><hemisphereLight args={["#c6d7ec","#182234",1.15]}/>
      <directionalLight position={[3,8,5]} intensity={2.3} castShadow/>
      <gridHelper args={[12,24,'#34455d','#233246']}/>
      <mesh position={[0,-0.055,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[12,12]}/><meshStandardMaterial color="#172435" roughness={0.95}/></mesh>
      <SafetyFence z={1.48}/><SafetyFence z={-1.48}/>
      <mesh position={[0,0.49,0]}><boxGeometry args={[4.45,0.15,1.4]}/><meshStandardMaterial color="#506176" metalness={0.7} roughness={0.35}/></mesh>
      {rollerPositions.map(x=><Roller key={x} x={x}/>)}
      <mesh position={[-2.0,0.65,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.16,0.16,1.28,18]}/><meshStandardMaterial color="#94a3b8" metalness={0.8}/></mesh>
      <mesh position={[2.0,0.65,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.16,0.16,1.28,18]}/><meshStandardMaterial color="#94a3b8" metalness={0.8}/></mesh>
      <group position={[2.05,0.43,0.94]}>
        <mesh><boxGeometry args={[0.55,0.43,0.4]}/><meshStandardMaterial color="#2d7185" metalness={0.5}/></mesh>
        <mesh position={[0.39,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.16,0.16,0.32,16]}/><meshStandardMaterial color="#9aa8b9" metalness={0.75}/></mesh>
        <Text position={[0,0.34,0]} fontSize={0.12} color="#e2e8f0">M1</Text>
      </group>
      <mesh position={[0,0.6,0]}><boxGeometry args={[4.3,0.22,1.3]}/><meshStandardMaterial color={scene.beltRunning?'#245b62':'#303e52'} roughness={0.8}/></mesh>
      {[-1.85,1.85].map(x=>[-0.52,0.52].map(z=><mesh key={`${x}:${z}`} position={[x,0.17,z]}><boxGeometry args={[0.12,0.8,0.12]}/><meshStandardMaterial color="#8294a9"/></mesh>))}
      {[-0.72,0.72].map(z=><mesh key={z} position={[0,0.82,z]}><boxGeometry args={[4.3,0.1,0.08]}/><meshStandardMaterial color="#94a3b8"/></mesh>)}
      {scene.packages.map(p=><mesh key={p.id} position={p.position}><boxGeometry args={[0.34,0.35,0.34]}/><meshStandardMaterial color={p.rejected?'#e4a448':'#61b4d7'}/></mesh>)}
<Photoeye x={-1} active={scene.photoeyeActive} label="PE1"/>
<Photoeye x={1.8} active={scene.exitActive} label="PE2"/>
      <mesh position={[0.56,0.93,-0.68]} rotation={[0,scene.diverterPosition*0.7,0]}><boxGeometry args={[0.12,0.4,0.85]}/><meshStandardMaterial color={scene.diverterActive?'#eab308':'#64748b'}/></mesh>
      <mesh position={[0.8,0.58,-1.05]}><boxGeometry args={[1.7,0.16,0.7]}/><meshStandardMaterial color="#475569" metalness={0.4}/></mesh>
      <group position={[-1.6,0.4,-1.05]}>
        <mesh><boxGeometry args={[0.65,0.78,0.28]}/><meshStandardMaterial color="#b5c5d5" metalness={0.5}/></mesh>
        <mesh position={[0,0.2,0.15]}><boxGeometry args={[0.48,0.27,0.035]}/><meshStandardMaterial color="#122338"/></mesh>
        <mesh position={[-0.15,0.2,0.175]}><sphereGeometry args={[0.045,12,8]}/><meshStandardMaterial color={scene.beltRunning?'#4ade80':'#f59e0b'} emissive={scene.beltRunning?'#166534':'#78350f'}/></mesh>
        <Text position={[0,0.52,0.17]} fontSize={0.11} color="#0f172a">CONTROL</Text>
      </group>
      <Text position={[0,1.75,0]} fontSize={0.2} color="#e2e8f0">{scene.jammed?'JAM DETECTED':scene.beltRunning?'BELT MOVING':'BELT STOPPED'} · {scene.packages.length} PRODUCTS</Text>
      <OrbitControls makeDefault minDistance={3} maxDistance={12} maxPolarAngle={Math.PI/2.1}/>
    </Canvas>
  </SceneShell>;
}
