/**
 * Three-dimensional sandbox workbench. This is a renderer/controller only.
 * The Web Worker owns the electrical/PLC state; all colors and device motion derive
 * exclusively from RenderSnapshot, never from local simulated physics.
 *
 * Original low-poly equipment geometry, no proprietary meshes or trademarks.
 */
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Grid, Html, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { CatmullRomCurve3, Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import { COMPONENTS, type ComponentKind } from '../components/registry';
import type { PlacedComponent, ProjectFile, RenderSnapshot, XY } from '../sim/signals';
import type { Parcel } from '../plant/sorting-conveyor';
import { supportsWebGL } from '../components/SceneShell';
import { clamp, projectPlacement, terminalPoint, worldPosition } from './scene-coordinates';
import { perDeviceLive } from '../sim/device-state';
import { PlantWorld3D } from './PlantWorld3D';
import { PLANT_EQUIPMENT } from '../plant/equipment';
import { footprintOf } from '../workspace/floor-plan';
import { clampPlacement } from '../workspace/geometry';
import type { GridStep } from '../workspace/types';
import { WorkcellCameraRig } from './WorkcellCameraRig';
import { type CameraPose, type WorkcellCameraMode } from './workcell-camera';

const additiveSelection = (value: unknown): boolean => {
  const event = value as { ctrlKey?: boolean; metaKey?: boolean;
    nativeEvent?: { ctrlKey?: boolean; metaKey?: boolean } };
  return Boolean(event.ctrlKey || event.metaKey || event.nativeEvent?.ctrlKey || event.nativeEvent?.metaKey);
};
const COLORS = {
  chassis: '#35546b', steel: '#829bb0', panel: '#192b3c', light: '#d3e4ef',
  live: '#20d6a6', off: '#52677c', highlight: '#ffa633', cable: '#7793ad',
};

function DeviceSculpture({ kind, active, pressed, motorAngleRad, parcel, tankLevelMl, rod, lamps }: {
  kind: ComponentKind; active: boolean; pressed: boolean; motorAngleRad: number;
  parcel?: Parcel | null; tankLevelMl?: number;
  /** Pneumatic cylinder rod position, 0 retracted to 1 extended. */
  rod?: number;
  /** Which lamps of a stack light are lit. */
  lamps?: { R: boolean; Y: boolean; G: boolean };
}) {
  const status = active ? COLORS.live : COLORS.off;
  if (kind === 'tank') {
    const fraction = Math.max(0, Math.min(1, (tankLevelMl ?? 0)/1000));
    return <group>
      <mesh position={[0,0.16,0]}><cylinderGeometry args={[0.79,0.82,0.18,24]} />
        <meshStandardMaterial color={COLORS.chassis} metalness={0.55} /></mesh>
      <mesh position={[0,0.92,0]}><cylinderGeometry args={[0.74,0.74,1.42,24,1,true]} />
        <meshStandardMaterial color="#a7d8e5" transparent opacity={0.24} side={2} roughness={0.25} metalness={0.22} depthWrite={false} /></mesh>
      <mesh position={[0,0.20,0]}><torusGeometry args={[0.76,0.07,8,24]} />
        <meshStandardMaterial color={COLORS.steel} /></mesh>
      <mesh position={[0,1.62,0]} rotation={[Math.PI/2,0,0]}>
        <torusGeometry args={[0.74,0.07,8,24]} /><meshStandardMaterial color={COLORS.steel} /></mesh>
      {fraction > 0 && <mesh position={[0,0.24+fraction*0.66,0]}>
        <cylinderGeometry args={[0.70,0.70,1.31*fraction,24]} />
        <meshStandardMaterial color="#1e9ec8" transparent opacity={0.72} roughness={0.2} /></mesh>}
      <mesh position={[0,0.78,-0.72]}><boxGeometry args={[0.12,0.9,0.06]} />
        <meshStandardMaterial color="#c6e2e8" /></mesh>
    </group>;
  }
  if (kind === 'pump') return <group>
    <mesh position={[0,0.46,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.36,0.36,0.8,18]} />
      <meshStandardMaterial color={active ? '#287f78' : COLORS.chassis} metalness={0.45} /></mesh>
    <mesh position={[0.5,0.45,0]}><boxGeometry args={[0.28,0.31,0.29]} />
      <meshStandardMaterial color={COLORS.steel} /></mesh>
    <mesh position={[-0.55,0.45,0]}><boxGeometry args={[0.25,0.26,0.27]} />
      <meshStandardMaterial color={COLORS.steel} /></mesh>
    <mesh position={[0,0.16,0]}><boxGeometry args={[0.92,0.12,0.68]} />
      <meshStandardMaterial color={COLORS.panel} /></mesh>
    <mesh position={[0,0.91,0]}><sphereGeometry args={[0.075,10,8]} />
      <meshStandardMaterial color={status} emissive={status} emissiveIntensity={0.7} /></mesh>
  </group>;
  if (kind === 'levelprobe') return <group>
    <mesh position={[0,0.47,0]}><boxGeometry args={[0.42,0.62,0.42]} />
      <meshStandardMaterial color={COLORS.chassis} metalness={0.25} /></mesh>
    <mesh position={[0,1.11,0]}><cylinderGeometry args={[0.06,0.06,0.79,10]} />
      <meshStandardMaterial color={COLORS.steel} metalness={0.6} /></mesh>
    <mesh position={[0,0.58,-0.23]}><sphereGeometry args={[0.11,12,8]} />
      <meshStandardMaterial color={status} emissive={status} emissiveIntensity={active?0.9:0.1} /></mesh>
  </group>;
  if (kind === 'drainvalve') return <group>
    <mesh position={[0,0.46,0]}><boxGeometry args={[0.94,0.43,0.49]} />
      <meshStandardMaterial color={COLORS.chassis} metalness={0.4} /></mesh>
    <mesh position={[-0.54,0.45,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.16,0.16,0.34,12]} />
      <meshStandardMaterial color={COLORS.steel} /></mesh>
    <mesh position={[0.54,0.45,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.16,0.16,0.34,12]} />
      <meshStandardMaterial color={COLORS.steel} /></mesh>
    <mesh position={[0,0.77,0]} rotation={[0,0,active?Math.PI/2:0]}>
      <mesh><boxGeometry args={[0.77,0.1,0.14]} />
        <meshStandardMaterial color={active?'#f0a75a':COLORS.steel} /></mesh>
    </mesh>
    <mesh position={[0,0.94,0.25]}><sphereGeometry args={[0.06,10,8]} />
      <meshStandardMaterial color={status} emissive={status} emissiveIntensity={0.7} /></mesh>
  </group>;
  if (kind === 'conveyor') return <group>
    <mesh position={[0,0.46,0]}><boxGeometry args={[4.0,0.24,0.95]} />
      <meshStandardMaterial color="#243d4c" metalness={0.4} roughness={0.6} /></mesh>
    <mesh position={[0,0.60,0]}><boxGeometry args={[3.95,0.045,0.78]} />
      <meshStandardMaterial color={active ? '#347181' : '#243847'} roughness={0.85} /></mesh>
    {[-0.55,0.55].map(z => <mesh key={z} position={[0,0.66,z]}>
      <boxGeometry args={[4.1,0.2,0.055]} /><meshStandardMaterial color={COLORS.steel} metalness={0.6} /></mesh>)}
    {[-1.72,-1.17,-0.62,-0.07,0.48,1.03,1.58].map(x => <mesh key={x}
      position={[x,0.33,0]} rotation={[Math.PI/2,0,0]}>
      <cylinderGeometry args={[0.14,0.14,0.79,12]} />
      <meshStandardMaterial color="#607b8f" metalness={0.5} /></mesh>)}
    {[-1.45,1.45].map(x => [-0.4,0.4].map(z => <mesh key={`${x}-${z}`} position={[x,0.17,z]}>
      <boxGeometry args={[0.08,0.46,0.08]} /><meshStandardMaterial color={COLORS.steel} /></mesh>))}
    {parcel && <group position={[-1.9 + parcel.position*3.8, 0.87,
      parcel.route === 'reject' ? 0.9 : 0]}>
      <mesh><boxGeometry args={[0.42,0.40,0.40]} />
        <meshStandardMaterial color={parcel.kind === 'marked' ? '#f0a75a' : '#7cb4c9'} /></mesh>
      <mesh position={[0,0.205,0]}><boxGeometry args={[0.26,0.015,0.26]} />
        <meshStandardMaterial color={parcel.kind === 'marked' ? '#602c28' : '#d3e4ef'} /></mesh>
    </group>}
    <mesh position={[0,0.15,-0.57]}><boxGeometry args={[0.52,0.24,0.23]} />
      <meshStandardMaterial color={status} emissive={active ? COLORS.live : '#000000'} emissiveIntensity={0.22} /></mesh>
  </group>;
  if (kind === 'photoeye') return <group>
    <mesh position={[0,0.44,0]}><boxGeometry args={[0.48,0.60,0.48]} />
      <meshStandardMaterial color={COLORS.chassis} metalness={0.45} /></mesh>
    <mesh position={[0,0.55,-0.26]}><boxGeometry args={[0.28,0.28,0.045]} />
      <meshStandardMaterial color={COLORS.panel} /></mesh>
    <mesh position={[0,0.58,-0.29]}><sphereGeometry args={[0.105,16,10]} />
      <meshStandardMaterial color={status} emissive={status} emissiveIntensity={active ? 0.8 : 0.1} /></mesh>
    <mesh position={[0,0.1,0]}><boxGeometry args={[0.12,0.28,0.12]} />
      <meshStandardMaterial color={COLORS.steel} /></mesh>
  </group>;
  if (kind === 'diverter') return <group>
    <mesh position={[0,0.29,0]}><boxGeometry args={[0.9,0.54,0.75]} />
      <meshStandardMaterial color={COLORS.chassis} metalness={0.3} /></mesh>
    <group rotation={[0, active ? 0.65 : 0, 0]}>
      <mesh position={[0.35,0.55,0]}><boxGeometry args={[1.04,0.12,0.18]} />
        <meshStandardMaterial color={active ? '#f0a75a' : COLORS.steel} metalness={0.4} /></mesh>
    </group>
    <mesh position={[-0.28,0.65,-0.3]}><sphereGeometry args={[0.06,8,8]} />
      <meshStandardMaterial color={status} emissive={status} emissiveIntensity={0.5} /></mesh>
  </group>;
  if (kind === 'breaker' || kind === 'overload') return <group>
    <mesh position={[0, 0.47, 0]}><boxGeometry args={[0.84,0.83,0.68]} />
      <meshStandardMaterial color={COLORS.chassis} metalness={0.22} /></mesh>
    <mesh position={[0,0.53,-0.355]}><boxGeometry args={[0.56,0.48,0.04]} />
      <meshStandardMaterial color={COLORS.panel} /></mesh>
    <group rotation={[0,0,active ? 0 : -0.75]}>
      <mesh position={[0,0.62,-0.41]}><boxGeometry args={[0.12,0.43,0.12]} />
        <meshStandardMaterial color={active ? COLORS.live : '#e76c66'} metalness={0.3} /></mesh>
    </group>
    <mesh position={[0.29,0.84,-0.38]}><sphereGeometry args={[0.06,10,8]} />
      <meshStandardMaterial color={status} emissive={status} emissiveIntensity={0.48} /></mesh>
  </group>;
  if (kind === 'lamp') return <group>
    <mesh position={[0,0.20,0]}><cylinderGeometry args={[0.40,0.40,0.18,18]} />
      <meshStandardMaterial color={COLORS.panel} metalness={0.5} /></mesh>
    <mesh position={[0,0.53,0]}><sphereGeometry args={[0.33,18,14]} />
      <meshStandardMaterial color={active ? '#f4bc65' : '#637382'}
        emissive={active ? '#e8a438' : '#000000'} emissiveIntensity={active ? 0.9 : 0} /></mesh>
  </group>;
  if (kind === 'motor' || kind === 'revmotor') return <group>
    <mesh position={[0, 0.46, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.34, 0.34, 0.84, 18]} /><meshStandardMaterial color={active ? '#247f72' : COLORS.chassis} metalness={0.35} roughness={0.5} />
    </mesh>
    {[-0.34, -0.2, -0.06, 0.08, 0.22, 0.36].map(x => <mesh key={x} position={[x, 0.46, 0]} rotation={[0, 0, Math.PI / 2]}>
      <torusGeometry args={[0.35, 0.018, 5, 20]} /><meshStandardMaterial color={COLORS.steel} />
    </mesh>)}
    <mesh position={[0.58, 0.46, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.09, 0.09, 0.5, 12]} /><meshStandardMaterial color={COLORS.light} metalness={0.65} />
    </mesh>
    <mesh position={[0, 0.17, 0]}><boxGeometry args={[0.9, 0.12, 0.68]} /><meshStandardMaterial color={COLORS.panel} /></mesh>
    <mesh position={[0, 0.9, 0.05]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color={status} emissive={status} emissiveIntensity={0.5} /></mesh>
    <group position={[0.90, 0.46, 0]} rotation={[motorAngleRad, 0, 0]}>
      {[0, 1, 2].map(i => <mesh key={i} position={[0, Math.cos(i * Math.PI * 2 / 3) * 0.18, Math.sin(i * Math.PI * 2 / 3) * 0.18]} rotation={[i * Math.PI * 2 / 3, 0, 0]}>
        <boxGeometry args={[0.04, 0.26, 0.1]} />
        <meshStandardMaterial color={COLORS.light} metalness={0.55} />
      </mesh>)}
    </group>
  </group>;
  if (kind === 'start' || kind === 'stop' || kind === 'estop' || kind === 'reversebutton') return <group>
    <mesh position={[0, 0.22, 0]}><boxGeometry args={[0.86, 0.38, 0.76]} /><meshStandardMaterial color={COLORS.chassis} metalness={0.2} /></mesh>
    <mesh position={[0, pressed ? 0.39 : 0.47, 0]}><cylinderGeometry args={[0.23, 0.26, 0.15, 24]} />
      <meshStandardMaterial color={kind === 'start' ? '#16a77b' : kind === 'reversebutton' ? '#e3a14c' : '#d84e4a'} metalness={0.15} />
    </mesh>
    <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.32, 0.32, 0.08, 24]} /><meshStandardMaterial color={COLORS.steel} metalness={0.35} /></mesh>
  </group>;
  if (kind === 'stacklight') {
    const segments = [['G', '#27c46b', 0.42], ['Y', '#e8b923', 0.72], ['R', '#dd4b45', 1.02]] as const;
    return <group>
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.34, 0.38, 0.14, 20]} /><meshStandardMaterial color={COLORS.panel} /></mesh>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.06, 0.06, 0.8, 10]} /><meshStandardMaterial color={COLORS.steel} /></mesh>
      {segments.map(([name, colour, y]) => { const lit = lamps?.[name] === true;
        return <mesh key={name} position={[0, y, 0]}><cylinderGeometry args={[0.24, 0.24, 0.24, 20]} />
          <meshStandardMaterial color={lit ? colour : '#3a4651'} emissive={lit ? colour : '#000000'} emissiveIntensity={lit ? 1.1 : 0} transparent opacity={lit ? 1 : 0.7} /></mesh>; })}
    </group>;
  }
  if (kind === 'cylinder') {
    const out = Math.max(0, Math.min(1, rod ?? 0));
    return <group>
      <mesh position={[0, 0.16, 0]}><boxGeometry args={[1.4, 0.1, 0.5]} /><meshStandardMaterial color={COLORS.panel} /></mesh>
      <mesh position={[-0.35, 0.48, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.2, 0.2, 0.8, 20]} />
        <meshStandardMaterial color={active ? '#2f7f9c' : COLORS.chassis} metalness={0.55} roughness={0.35} /></mesh>
      <mesh position={[0.05 + out * 0.4, 0.48, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 0.8, 12]} />
        <meshStandardMaterial color={COLORS.steel} metalness={0.8} roughness={0.2} /></mesh>
      <mesh position={[0.45 + out * 0.4, 0.48, 0]}><boxGeometry args={[0.1, 0.34, 0.34]} /><meshStandardMaterial color={COLORS.light} /></mesh>
      <mesh position={[-0.58, 0.78, 0]}><boxGeometry args={[0.2, 0.14, 0.26]} /><meshStandardMaterial color={status} emissive={status} emissiveIntensity={0.35} /></mesh>
    </group>;
  }
  if (kind === 'contactor' || kind === 'relay' || kind === 'timerelay' || kind === 'forwardcontactor' || kind === 'reversecontactor') return <group>
    <mesh position={[0, 0.5, 0]}><boxGeometry args={[1, 0.89, 0.78]} /><meshStandardMaterial color={COLORS.chassis} /></mesh>
    <mesh position={[0, 0.75, -0.4]}><boxGeometry args={[0.72, 0.3, 0.04]} /><meshStandardMaterial color={COLORS.panel} /></mesh>
    {[-0.27, 0, 0.27].map(x => <mesh key={x} position={[x, 0.51, -0.405]}>
      <boxGeometry args={[0.16, 0.16, 0.05]} /><meshStandardMaterial color={COLORS.steel} />
    </mesh>)}
    <mesh position={[0, 0.96, 0]}><boxGeometry args={[0.8, 0.09, 0.68]} /><meshStandardMaterial color={status} emissive={status} emissiveIntensity={0.26} /></mesh>
  </group>;
  if (kind === 'three-phase-supply') return <group>
    <mesh position={[0,0.55,0]}><boxGeometry args={[1.22,0.96,0.78]}/>
      <meshStandardMaterial color="#526d87" metalness={0.3}/></mesh>
    {[-0.26,0,0.26].map((x,i)=><mesh key={i} position={[x,0.78,-0.42]}>
      <boxGeometry args={[0.18,0.26,0.06]}/>
      <meshStandardMaterial color={active?'#d7bb76':'#66737e'} emissive={active?'#54401d':'#000000'}/>
    </mesh>)}
    <mesh position={[0,1.08,0]}><boxGeometry args={[1.1,0.10,0.74]}/>
      <meshStandardMaterial color="#ac9b70"/></mesh>
  </group>;
  if (kind === 'star-delta-drive') return <group>
    <mesh position={[0,0.32,0]} rotation={[0,0,Math.PI/2]}>
      <cylinderGeometry args={[0.42,0.42,1.24,18]}/>
      <meshStandardMaterial color={active?'#437f92':'#607588'} metalness={0.48}/></mesh>
    <mesh position={[0,0.80,-0.23]}><boxGeometry args={[0.94,0.45,0.32]}/>
      <meshStandardMaterial color="#4e617b"/></mesh>
    {[-0.27,0,0.27].map((x,i)=><mesh key={i} position={[x,0.86,-0.405]}>
      <boxGeometry args={[0.18,0.16,0.05]}/>
      <meshStandardMaterial color={active?'#5bcaaa':'#bfa46c'} emissive={active?'#164334':'#000000'}/></mesh>)}
    <mesh position={[0,0.06,0]}><boxGeometry args={[1.48,0.12,0.9]}/>
      <meshStandardMaterial color="#6d7480"/></mesh>
  </group>;
  if (kind === 'supply') return <group>
    <mesh position={[0, 0.43, 0]}><boxGeometry args={[1.04, 0.76, 0.74]} /><meshStandardMaterial color={COLORS.chassis} /></mesh>
    <mesh position={[0, 0.56, -0.38]}><boxGeometry args={[0.73, 0.19, 0.04]} /><meshStandardMaterial color={COLORS.panel} /></mesh>
    {[-0.2, 0, 0.2].map(x => <mesh key={x} position={[x, 0.75, 0.0]}>
      <boxGeometry args={[0.095, 0.04, 0.48]} /><meshStandardMaterial color={COLORS.steel} /></mesh>)}
    <mesh position={[0.34, 0.24, -0.39]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color={COLORS.live} emissive={COLORS.live} emissiveIntensity={0.5} /></mesh>
  </group>;
  return <group>
    <mesh position={[0, 0.46, 0]}><boxGeometry args={[1.15, 0.82, 0.68]} /><meshStandardMaterial color={COLORS.chassis} metalness={0.2} /></mesh>
    <mesh position={[0, 0.60, -0.35]}><boxGeometry args={[0.94, 0.35, 0.05]} /><meshStandardMaterial color={COLORS.panel} /></mesh>
    {[-0.28, -0.08, 0.12, 0.32].map((x, i) => <mesh key={i} position={[x, 0.69, -0.385]}>
      <boxGeometry args={[0.12, 0.07, 0.02]} /><meshStandardMaterial color={active ? COLORS.live : COLORS.steel} emissive={active ? COLORS.live : '#000000'} emissiveIntensity={0.24} /></mesh>)}
    <mesh position={[0, 0.25, -0.355]}><boxGeometry args={[0.82, 0.1, 0.04]} /><meshStandardMaterial color={COLORS.steel} /></mesh>
  </group>;
}

function Device3D({ c, project, active, motorAngleRad, direction, parcel, tankLevelMl, rod, lamps, editable, selected, selectedTerminal, moveTarget, onTerminal, onOperate, onSelect, onPress, onMoveDrag, onEndDrag, onFocus }: {
  c: PlacedComponent; project: ProjectFile; active: boolean; motorAngleRad: number; direction?: 'stopped' | 'forward' | 'reverse'; parcel?: Parcel | null; tankLevelMl?: number; rod?: number; lamps?: { R: boolean; Y: boolean; G: boolean };
  editable: boolean; selected: boolean; selectedTerminal: string | null; moveTarget: string | null;
  onTerminal: (id: string) => void; onOperate: (id: string) => void;
  onSelect: (id: string, additive: boolean) => void;
  onPress: (event: ThreeEvent<PointerEvent>, id: string) => void;
  onMoveDrag: (event: ThreeEvent<PointerEvent>) => void;
  onEndDrag: (event: ThreeEvent<PointerEvent>) => void;
  onFocus: (id: string) => void;
}) {
  const [x, y, z] = worldPosition(c);
  const def = COMPONENTS[c.kind];
  const plant = Boolean(PLANT_EQUIPMENT[c.kind]);
  const footprint = plant ? footprintOf(c, project.params) : null;
  // P3 equipment uses the real worker-owned 3D shapes, not duplicated large
  // placeholder housings. Its outline is only a selection/drag affordance.
  return <group position={[x, y, z]} rotation={[0, -(c.yawDeg ?? 0) * Math.PI / 180, 0]}>
    <mesh position={[0, plant ? 0.02 : 0.035, 0]}
      onPointerDown={e => onPress(e, c.id)}
      onPointerMove={onMoveDrag} onPointerUp={onEndDrag}
      onDoubleClick={e => { e.stopPropagation(); onFocus(c.id); }}>
      <boxGeometry args={[plant ? (footprint!.yawDeg === 90 || footprint!.yawDeg === 270 ? footprint!.depth : footprint!.width)/100 : 1.5,
        plant ? 0.025 : 0.08,
        plant ? (footprint!.yawDeg === 90 || footprint!.yawDeg === 270 ? footprint!.width : footprint!.depth)/100 : 1.2]} />
      {plant
        ? <meshStandardMaterial color={selected || moveTarget === c.id ? COLORS.highlight : COLORS.panel}
            transparent opacity={selected || moveTarget === c.id ? 0.55 : 0.15} depthWrite={false} />
        : <meshStandardMaterial color={selected || moveTarget === c.id ? COLORS.highlight : COLORS.panel} />}
    </mesh>
    {!plant && <group onPointerDown={e => onPress(e, c.id)}
      onPointerMove={onMoveDrag} onPointerUp={onEndDrag}
      onDoubleClick={e => { e.stopPropagation(); onFocus(c.id); }}>
      <DeviceSculpture kind={c.kind} active={active} pressed={c.pressed} motorAngleRad={motorAngleRad}
        parcel={c.kind === 'conveyor' ? parcel : null}
        tankLevelMl={c.kind === 'tank' ? tankLevelMl : undefined}
        rod={c.kind === 'cylinder' ? rod : undefined} lamps={c.kind === 'stacklight' ? lamps : undefined} />
    </group>}
    <Html position={[0, 1.22, 0]} center distanceFactor={11}>
      <div className="sandbox-3d-label">
        <strong>{def.label}</strong>
        <small>{c.kind === 'revmotor' ? (direction ?? 'stopped').toUpperCase() :
          c.kind === 'forwardcontactor' || c.kind === 'reversecontactor' ? (active ? 'CLOSED' : 'OPEN') :
          c.kind === 'motor' ? (active ? 'RUNNING' : 'STOPPED') :
          c.kind === 'contactor' || c.kind === 'relay' ? (active ? 'ENERGISED' : 'OFF') :
          c.kind === 'timerelay' ? (active ? 'CONTACTS ON' : 'OFF') :
          c.kind === 'stacklight' ? (['R', 'Y', 'G'].filter(l => lamps?.[l as 'R' | 'Y' | 'G']).join(' · ') || 'ALL OFF') :
          c.kind === 'cylinder' ? (rod === undefined ? 'RETRACTED' : rod >= 0.999 ? 'EXTENDED' : rod <= 0.001 ? 'RETRACTED' : `MOVING ${Math.round(rod * 100)}%`) :
          c.kind === 'plc' || c.kind === 'plc16' ? (active ? 'POWERED' : 'UNPOWERED') :
          c.kind === 'conveyor' ? (active ? 'BELT MOVING' : 'BELT STOPPED') :
          c.kind === 'photoeye' ? (active ? 'MARK DETECTED' : 'NO MARK') :
          c.kind === 'diverter' ? (active ? 'REJECT ACTIVE' : 'PASS') :
          c.kind === 'tank' ? `${Math.round(tankLevelMl ?? 0)} / 1000 ml` :
          c.kind === 'pump' ? (active ? 'PUMPING' : 'STOPPED') :
          c.kind === 'levelprobe' ? (active ? 'HIGH LEVEL' : 'LOW LEVEL') :
          c.kind === 'drainvalve' ? (active ? 'DRAIN OPEN' : 'CLOSED') :
          c.kind === 'breaker' ? (active ? 'CLOSED' : 'TRIPPED') :
          c.kind === 'overload' ? (active ? '95-96 CLOSED' : 'TRIPPED') :
          c.kind === 'lamp' ? (active ? 'ILLUMINATED' : 'OFF') :
          c.kind === 'supply' ? '24 V DC' : c.kind === 'estop' ?
          (c.pressed ? 'OPEN · LATCHED' : 'NC · RESET') : c.pressed ? 'PRESSED' : 'RELEASED'}</small>
        {(c.kind === 'start' || c.kind === 'stop' || c.kind === 'estop' || c.kind === 'reversebutton') && <button type="button"
          disabled={false} onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onOperate(c.id); }}>{c.pressed ? 'Release' : 'Press'}</button>}
      </div>
    </Html>
    {def.terminals.map(t => {
      const fullId = `${c.id}.${t.name}`;
      const selected = selectedTerminal === fullId;
      const position: [number, number, number] = [t.side === 'left' ? -0.64 : 0.64, 0.35, (t.y - 65) / 120];
      return <group key={t.name} position={position}>
        <mesh onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); if (editable) onTerminal(fullId); }}>
          <sphereGeometry args={[0.105, 12, 8]} />
          <meshStandardMaterial color={selected ? COLORS.highlight : COLORS.light}
            emissive={selected ? COLORS.highlight : '#000000'} emissiveIntensity={0.35} />
        </mesh>
        <Html position={[t.side === 'left' ? -0.14 : 0.14, 0.09, 0]} center distanceFactor={12}>
          <button type="button" className={`sandbox-3d-terminal ${selected ? 'selected' : ''}`}
            data-scene-terminal-id={fullId} disabled={!editable}
            aria-label={`Connect ${fullId} in 3D`}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onTerminal(fullId); }}>{t.name}</button>
        </Html>
      </group>;
    })}
  </group>;
}

function Cable3D({ project, from, to, live }: { project: ProjectFile; from: string; to: string; live: boolean }) {
  const curve = useMemo(() => {
    const p1 = terminalPoint(project, from);
    const p2 = terminalPoint(project, to);
    if (!p1 || !p2) return null;
    const distance = p1.distanceTo(p2);
    const rise = clamp(0.25 + distance * 0.09, 0.26, 0.78);
    const a = p1.clone().add(new Vector3(0, rise, 0));
    const b = p2.clone().add(new Vector3(0, rise, 0));
    const middle = p1.clone().add(p2).multiplyScalar(0.5).add(new Vector3(0, rise + 0.1, 0));
    return new CatmullRomCurve3([p1, a, middle, b, p2]);
  }, [project, from, to]);
  if (!curve) return null;
  return <mesh>
    <tubeGeometry args={[curve, 20, 0.025, 5, false]} />
    <meshStandardMaterial color={live ? COLORS.live : COLORS.cable} emissive={live ? COLORS.live : '#000000'} emissiveIntensity={live ? 0.2 : 0} />
  </mesh>;
}

type DeviceDrag = {
  id: string; pointerId: number; start: {x:number;z:number};
  origin: XY; preview: XY;
};

/** This scene owns camera and pointer gestures, NEVER PLC or physics state.
 * A dragged machine is a temporary ghost until the worker acknowledges 'move'.
 */
function Workbench({ project, snapshot, editable, grid, mode, selectedDeviceIds, selectedTerminal, moveTarget, onTerminal, onOperate, onSelect, onPlaceAt, onMove, onCameraPose }: {
  project: ProjectFile; snapshot: RenderSnapshot; editable: boolean; grid: GridStep;
  mode:WorkcellCameraMode;
  selectedDeviceIds: readonly string[]; selectedTerminal: string | null; moveTarget: string | null;
  onTerminal: (id: string) => void; onOperate: (id: string) => void;
  onSelect: (id: string, additive: boolean) => void; onPlaceAt: (at: XY) => void;
  onMove: (id:string,at:XY)=>void;
  onCameraPose:(pose:CameraPose)=>void;
}) {
  const { camera, gl } = useThree();
  const [interest,setInterest]=useState<[number,number,number]>([0,0,0]);
  const [drag,setDrag]=useState<DeviceDrag|null>(null);
  const currentDrag=useRef<DeviceDrag|null>(null);
  const poseCallback=useRef(onCameraPose);
  poseCallback.current=onCameraPose;
  // Direct, mouse-driven drag uses a ray through the current perspective camera.
  // The worker's project is unchanged until pointer release and acknowledgement.
  const floorPoint=(event:ThreeEvent<PointerEvent>):{x:number;z:number}|null=>{
    const bounds=gl.domElement.getBoundingClientRect();
    const pointer=new Vector2(
      ((event.nativeEvent.clientX-bounds.left)/bounds.width)*2-1,
      -((event.nativeEvent.clientY-bounds.top)/bounds.height)*2+1,
    );
    const ray=new Raycaster(); ray.setFromCamera(pointer,camera);
    const hit=new Vector3();
    return ray.ray.intersectPlane(new Plane(new Vector3(0,1,0),0),hit)
      ? {x:hit.x,z:hit.z} : null;
  };
  const focus=(id:string)=>{
    const item=project.components.find(c=>c.id===id);
    if(!item)return;
    const [x,,z]=worldPosition(item);
    setInterest([x,0.3,z]);
  };
  const start=(event:ThreeEvent<PointerEvent>,id:string)=>{
    if(event.button!==0)return;
    event.stopPropagation();
    const additive=additiveSelection(event);
    onSelect(id,additive);
    if(!editable||mode!=='orbit'||additive)return;
    const item=project.components.find(c=>c.id===id);
    const point=floorPoint(event);
    if(!item||!point)return;
    const next:DeviceDrag={
      id,pointerId:event.pointerId,start:point,
      origin:{x:item.x,y:item.y},preview:{x:item.x,y:item.y},
    };
    currentDrag.current=next;setDrag(next);
    const target=event.target;
    if(target && 'setPointerCapture' in target && typeof target.setPointerCapture==='function')
      target.setPointerCapture(event.pointerId);
  };
  const translated=(gesture:DeviceDrag,point:{x:number;z:number}):XY=>
    clampPlacement({
      x:gesture.origin.x+(point.x-gesture.start.x)*100,
      y:gesture.origin.y+(point.z-gesture.start.z)*100,
    },grid);
  const moveGesture=(event:ThreeEvent<PointerEvent>)=>{
    const active=currentDrag.current;
    if(!active||active.pointerId!==event.pointerId)return;
    event.stopPropagation();
    const point=floorPoint(event);if(!point)return;
    const next={...active,preview:translated(active,point)};
    currentDrag.current=next;setDrag(next);
  };
  const endGesture=(event:ThreeEvent<PointerEvent>)=>{
    const active=currentDrag.current;
    if(!active||active.pointerId!==event.pointerId)return;
    event.stopPropagation();
    const point=floorPoint(event);
    const to=point?translated(active,point):active.preview;
    currentDrag.current=null;setDrag(null);
    const target=event.target;
    if(target && 'hasPointerCapture' in target && typeof target.hasPointerCapture==='function' &&
      'releasePointerCapture' in target && typeof target.releasePointerCapture==='function' &&
      target.hasPointerCapture(event.pointerId))
      target.releasePointerCapture(event.pointerId);
    if(editable&&(to.x!==active.origin.x||to.y!==active.origin.y))
      onMove(active.id,to);
  };
  const preview=drag&&project.components.find(c=>c.id===drag.id);
  const plan=preview?footprintOf(preview,project.params):null;
  const ghost=drag?worldPosition(drag.preview):null;
  return <>
    <color attach="background" args={['#0c1927']} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[-4, 9, 6]} intensity={1.7} />
    <directionalLight position={[8, 4, -5]} intensity={0.6} color="#a5d5ff" />
    <mesh position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}
      onClick={event => { if (moveTarget && editable) { event.stopPropagation(); onPlaceAt(projectPlacement(event.point)); } }}
      onDoubleClick={event=>{if(mode==='orbit'){event.stopPropagation();setInterest([event.point.x,0,event.point.z]);}}}>
      <planeGeometry args={[11.3, 6.3]} />
      <meshStandardMaterial color="#152a3d" />
    </mesh>
    <Grid position={[0, -0.075, 0]} args={[11, 6]} cellSize={0.5}
      cellColor="#28465c" sectionColor="#46718d" cellThickness={0.6} sectionThickness={1}
      fadeDistance={35} infiniteGrid={false} />
    {project.wires.map(w => <Cable3D key={w.id} project={project} from={w.from} to={w.to}
      live={snapshot.voltages[w.from] === 24 && snapshot.voltages[w.to] === 24} />)}
    <PlantWorld3D project={project} scene={snapshot.plantWorld}
      onPointerDownPart={start} onPointerMovePart={moveGesture}
      onPointerUpPart={endGesture} onFocusPart={focus} />
    {project.components.map(c => <Device3D key={c.id} c={c} project={project} editable={editable}
       selected={selectedDeviceIds.includes(c.id)}
      motorAngleRad={c.kind === 'revmotor' ? snapshot.reverseMotorAngleRad : snapshot.motorAngles[c.id] ?? snapshot.motorAngleRad}
      direction={c.kind === 'revmotor' ? snapshot.motorDirection : undefined}
      parcel={c.kind === 'conveyor' ? snapshot.lanes[c.id]?.parcel ?? null : null} tankLevelMl={c.kind === 'tank' ? snapshot.vessels[c.id]?.levelMl ?? 0 : 0}
      rod={c.kind === 'cylinder' ? snapshot.cylinders[c.id]?.position ?? 0 : undefined}
      lamps={c.kind === 'stacklight' ? { R: !!snapshot.deviceOn[`${c.id}-R`], Y: !!snapshot.deviceOn[`${c.id}-Y`], G: !!snapshot.deviceOn[`${c.id}-G`] } : undefined}
      selectedTerminal={selectedTerminal} moveTarget={moveTarget}
      active={perDeviceLive(snapshot, c) ?? (c.kind === 'revmotor' ? snapshot.motorDirection !== 'stopped' :
        c.kind === 'forwardcontactor' ? snapshot.forwardContactorOn :
        c.kind === 'reversecontactor' ? snapshot.reverseContactorOn :
        c.kind === 'photoeye' ? snapshot.io.Photoeye :
        c.kind === 'levelprobe' ? snapshot.io.TankHigh :
        c.kind === 'estop' ? !c.pressed :
        c.kind === 'start' || c.kind === 'stop' || c.kind === 'reversebutton' ? c.pressed : false)}
      onTerminal={onTerminal} onOperate={onOperate} onSelect={onSelect}
      onPress={start} onMoveDrag={moveGesture} onEndDrag={endGesture} onFocus={focus} />)}
    {ghost&&preview&&plan&&<mesh position={[ghost[0],0.075,ghost[2]]}
      rotation={[0,-(preview.yawDeg??0)*Math.PI/180,0]}>
      <boxGeometry args={[plan.width/100,.06,plan.depth/100]} />
      <meshBasicMaterial color="#ffa633" transparent opacity={.42} depthWrite={false} wireframe />
    </mesh>}
    <WorkcellCameraRig mode={mode} editableCamera={!drag} project={project}
      interest={interest} onPose={pose=>poseCallback.current(pose)} />
    <GizmoHelper alignment="bottom-right" margin={[76, 76]}>
      <GizmoViewport axisColors={['#d45b59', '#4db987', '#549fea']} labelColor="#ffffff" />
    </GizmoHelper>
  </>;
}

export type Sandbox3DProps = {
  project: ProjectFile; snapshot: RenderSnapshot;
  editable: boolean; grid?: GridStep; selectedTerminal: string | null; moveTarget: string | null;
  selectedDeviceId: string | null; selectedDeviceIds?: readonly string[];
  onSelectDevice: (id: string, additive?: boolean) => void;
  onTerminal: (id: string) => void;
  onOperate: (id: string) => void;
  onPlace: (kind: ComponentKind, at: XY) => void;
  onMove: (id: string, at: XY) => void;
  onMoveFinished: () => void;
};
export function Sandbox3D(props: Sandbox3DProps) {
  const available = useMemo(supportsWebGL, []);
  const camera = useRef<Camera | null>(null);
  const [cameraMode,setCameraMode]=useState<WorkcellCameraMode>('orbit');
  const [cameraPose,setCameraPose]=useState<CameraPose|null>(null);
  const onPlaceAt = (at: XY) => {
    if (!props.moveTarget) return;
    props.onMove(props.moveTarget, at);
    props.onMoveFinished();
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!props.editable || !available) return;
    const kind = event.dataTransfer.getData('text/plain').replace(/^add:/, '') as ComponentKind;
    if (!Object.hasOwn(COMPONENTS, kind) || !camera.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const mouse = new Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
      -((event.clientY - rect.top) / rect.height * 2 - 1));
    const ray = new Raycaster();
    ray.setFromCamera(mouse, camera.current);
    const point = new Vector3();
    if (ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), point)) {
      props.onPlace(kind, projectPlacement(point));
    }
  };
  return <div className="sandbox-3d-shell" aria-label="Interactive 3D industrial automation workspace"
    onDragOver={event => { if (props.editable && available) event.preventDefault(); }} onDrop={drop}>
    <div className="sandbox-3d-camera-controls" role="group" aria-label="3D navigation camera">
      {([
        ['orbit','Orbit'],['fly','Fly'],['first-person','First Person'],
      ] as const).map(([id,label])=><button key={id} type="button"
        data-3d-camera-mode={id} aria-pressed={cameraMode===id}
        disabled={!available} onClick={()=>{setCameraMode(id);setCameraPose(null);}}>
        {label}</button>)}
    </div>
    {available ? <Canvas className="sandbox-three-canvas" dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      camera={{ position: [7, 8.5, 10], fov: 42, near: 0.1, far: 120 }}
      onCreated={state => { camera.current = state.camera; state.camera.lookAt(0, 0, 0); }}>
      <Workbench project={props.project} snapshot={props.snapshot} editable={props.editable}
        grid={props.grid??5} mode={cameraMode} onMove={props.onMove}
        onCameraPose={setCameraPose}
        selectedDeviceIds={props.selectedDeviceIds ?? []}
        selectedTerminal={props.selectedTerminal} moveTarget={props.moveTarget}
        onTerminal={props.onTerminal} onOperate={props.onOperate}
        onSelect={props.onSelectDevice} onPlaceAt={onPlaceAt} />
    </Canvas> : <div className="sandbox-3d-fallback" role="status">
      <strong>3D renderer unavailable on this device</strong>
      <p>The PLC simulator still runs. Use the component patch panel below to wire, operate and inspect devices without WebGL.</p>
    </div>}
    <div className="sandbox-3d-hud">
      <span data-3d-camera-status>{cameraMode==='orbit'
        ? '3D ORBIT · Drag to rotate · Right drag to pan · Wheel zoom · Double-click to focus'
        : cameraMode==='fly'
        ? '3D FLY · Focus scene, WASD to move · Q/E height · Right drag to look'
        : '3D FIRST PERSON · Eye height 1.8 m · Focus scene, WASD to walk · Right drag to look'}
        {cameraMode!=='orbit'&&cameraPose
          ? ` · Camera ${cameraPose.x.toFixed(2)}, ${cameraPose.y.toFixed(2)}, ${cameraPose.z.toFixed(2)} m` : ''}</span>
      <span>{props.moveTarget ? 'Move selected: click the 3D workbench floor' :
        props.selectedDeviceId ? `Selected: ${props.selectedDeviceId} · Drag the model to move (paused)`
        : 'Select a 3D machine or terminal · paused editing'}</span>
    </div>
  </div>;
}
