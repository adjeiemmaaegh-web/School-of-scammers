/**
 * Three-dimensional sandbox workbench. This is a renderer/controller only.
 * The Web Worker owns the electrical/PLC state; all colors and device motion derive
 * exclusively from RenderSnapshot, never from local simulated physics.
 *
 * Original low-poly equipment geometry, no proprietary meshes or trademarks.
 */
import { useMemo, useRef, type DragEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Html, OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { CatmullRomCurve3, Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import { COMPONENTS, type ComponentKind } from '../components/registry';
import type { PlacedComponent, ProjectFile, RenderSnapshot, XY } from '../sim/signals';
import { supportsWebGL } from '../components/SceneShell';
import { clamp, projectPlacement, terminalPoint, worldPosition } from './scene-coordinates';

const COLORS = {
  chassis: '#35546b', steel: '#829bb0', panel: '#192b3c', light: '#d3e4ef',
  live: '#20d6a6', off: '#52677c', highlight: '#ffa633', cable: '#7793ad',
};

function DeviceSculpture({ kind, active, pressed, motorAngleRad }: { kind: ComponentKind; active: boolean; pressed: boolean; motorAngleRad: number }) {
  const status = active ? COLORS.live : COLORS.off;
  if (kind === 'motor') return <group>
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
  if (kind === 'start' || kind === 'stop') return <group>
    <mesh position={[0, 0.22, 0]}><boxGeometry args={[0.86, 0.38, 0.76]} /><meshStandardMaterial color={COLORS.chassis} metalness={0.2} /></mesh>
    <mesh position={[0, pressed ? 0.39 : 0.47, 0]}><cylinderGeometry args={[0.23, 0.26, 0.15, 24]} />
      <meshStandardMaterial color={kind === 'start' ? '#16a77b' : '#d84e4a'} metalness={0.15} />
    </mesh>
    <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.32, 0.32, 0.08, 24]} /><meshStandardMaterial color={COLORS.steel} metalness={0.35} /></mesh>
  </group>;
  if (kind === 'contactor') return <group>
    <mesh position={[0, 0.5, 0]}><boxGeometry args={[1, 0.89, 0.78]} /><meshStandardMaterial color={COLORS.chassis} /></mesh>
    <mesh position={[0, 0.75, -0.4]}><boxGeometry args={[0.72, 0.3, 0.04]} /><meshStandardMaterial color={COLORS.panel} /></mesh>
    {[-0.27, 0, 0.27].map(x => <mesh key={x} position={[x, 0.51, -0.405]}>
      <boxGeometry args={[0.16, 0.16, 0.05]} /><meshStandardMaterial color={COLORS.steel} />
    </mesh>)}
    <mesh position={[0, 0.96, 0]}><boxGeometry args={[0.8, 0.09, 0.68]} /><meshStandardMaterial color={status} emissive={status} emissiveIntensity={0.26} /></mesh>
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

function Device3D({ c, active, motorAngleRad, editable, selectedTerminal, moveTarget, onTerminal, onOperate, onSelect }: {
  c: PlacedComponent; active: boolean; motorAngleRad: number; editable: boolean; selectedTerminal: string | null; moveTarget: string | null;
  onTerminal: (id: string) => void; onOperate: (id: string, pressed: boolean) => void; onSelect: (id: string) => void;
}) {
  const [x, y, z] = worldPosition(c);
  const def = COMPONENTS[c.kind];
  return <group position={[x, y, z]}>
    <mesh position={[0, 0.035, 0]} onClick={e => { e.stopPropagation(); onSelect(c.id); }}>
      <boxGeometry args={[1.5, 0.08, 1.2]} />
      <meshStandardMaterial color={moveTarget === c.id ? COLORS.highlight : COLORS.panel} />
    </mesh>
    <group onClick={e => { e.stopPropagation(); onSelect(c.id); }}>
      <DeviceSculpture kind={c.kind} active={active} pressed={c.pressed} motorAngleRad={motorAngleRad} />
    </group>
    <Html position={[0, 1.22, 0]} center distanceFactor={11}>
      <div className="sandbox-3d-label">
        <strong>{def.label}</strong>
        <small>{c.kind === 'motor' ? (active ? 'RUNNING' : 'STOPPED') :
          c.kind === 'contactor' ? (active ? 'ENERGISED' : 'OFF') :
          c.kind === 'plc' ? (active ? 'POWERED' : 'UNPOWERED') : c.kind === 'supply' ? '24 V DC' : c.pressed ? 'PRESSED' : 'RELEASED'}</small>
        {(c.kind === 'start' || c.kind === 'stop') && <button type="button"
          disabled={false} onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onOperate(c.id, !c.pressed); }}>{c.pressed ? 'Release' : 'Press'}</button>}
      </div>
    </Html>
    {def.terminals.map(t => {
      const fullId = `${c.id}.${t.name}`;
      const selected = selectedTerminal === fullId;
      const position: [number, number, number] = [t.side === 'left' ? -0.64 : 0.64, 0.35, (t.y - 65) / 120];
      return <group key={t.name} position={position}>
        <mesh onClick={e => { e.stopPropagation(); if (editable) onTerminal(fullId); }}>
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

function Workbench({ project, snapshot, editable, selectedTerminal, moveTarget, onTerminal, onOperate, onSelect, onPlaceAt }: {
  project: ProjectFile; snapshot: RenderSnapshot; editable: boolean;
  selectedTerminal: string | null; moveTarget: string | null;
  onTerminal: (id: string) => void; onOperate: (id: string, pressed: boolean) => void;
  onSelect: (id: string) => void; onPlaceAt: (at: XY) => void;
}) {
  return <>
    <color attach="background" args={['#0c1927']} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[-4, 9, 6]} intensity={1.7} />
    <directionalLight position={[8, 4, -5]} intensity={0.6} color="#a5d5ff" />
    <mesh position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}
      onClick={event => { if (moveTarget && editable) { event.stopPropagation(); onPlaceAt(projectPlacement(event.point)); } }}>
      <planeGeometry args={[11.3, 6.3]} />
      <meshStandardMaterial color="#152a3d" />
    </mesh>
    <Grid position={[0, -0.075, 0]} args={[11, 6]} cellSize={0.5}
      cellColor="#28465c" sectionColor="#46718d" cellThickness={0.6} sectionThickness={1}
      fadeDistance={35} infiniteGrid={false} />
    {project.wires.map(w => <Cable3D key={w.id} project={project} from={w.from} to={w.to}
      live={snapshot.voltages[w.from] === 24 && snapshot.voltages[w.to] === 24} />)}
    {project.components.map(c => <Device3D key={c.id} c={c} editable={editable} motorAngleRad={snapshot.motorAngleRad}
      selectedTerminal={selectedTerminal} moveTarget={moveTarget}
      active={c.kind === 'motor' ? snapshot.motorOn : c.kind === 'contactor' ? snapshot.contactorOn :
        c.kind === 'plc' ? snapshot.io.PlcPowered : c.kind === 'start' || c.kind === 'stop' ? c.pressed : false}
      onTerminal={onTerminal} onOperate={onOperate} onSelect={onSelect} />)}
    <OrbitControls makeDefault enablePan enableZoom enableRotate
      minDistance={4.4} maxDistance={23} minPolarAngle={0.1} maxPolarAngle={Math.PI / 2.05}
      target={[0, 0, 0]} />
    <GizmoHelper alignment="bottom-right" margin={[76, 76]}><GizmoViewport axisColors={['#d45b59', '#4db987', '#549fea']} labelColor="#ffffff" /></GizmoHelper>
  </>;
}

export type Sandbox3DProps = {
  project: ProjectFile; snapshot: RenderSnapshot;
  editable: boolean; selectedTerminal: string | null; moveTarget: string | null;
  selectedDeviceId: string | null; onSelectDevice: (id: string) => void;
  onTerminal: (id: string) => void;
  onOperate: (id: string, pressed: boolean) => void;
  onPlace: (kind: ComponentKind, at: XY) => void;
  onMove: (id: string, at: XY) => void;
  onMoveFinished: () => void;
};
export function Sandbox3D(props: Sandbox3DProps) {
  const available = useMemo(supportsWebGL, []);
  const camera = useRef<Camera | null>(null);
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
    {available ? <Canvas className="sandbox-three-canvas" dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      camera={{ position: [7, 8.5, 10], fov: 42, near: 0.1, far: 120 }}
      onCreated={state => { camera.current = state.camera; state.camera.lookAt(0, 0, 0); }}>
      <Workbench project={props.project} snapshot={props.snapshot} editable={props.editable}
        selectedTerminal={props.selectedTerminal} moveTarget={props.moveTarget}
        onTerminal={props.onTerminal} onOperate={props.onOperate}
        onSelect={props.onSelectDevice} onPlaceAt={onPlaceAt} />
    </Canvas> : <div className="sandbox-3d-fallback" role="status">
      <strong>3D renderer unavailable on this device</strong>
      <p>The PLC simulator still runs. Use the component patch panel below to wire, operate and inspect devices without WebGL.</p>
    </div>}
    <div className="sandbox-3d-hud">
      <span>3D WORKBENCH · Orbit: drag · Pan: right-drag · Zoom: wheel</span>
      <span>{props.moveTarget ? 'Move selected: click the workbench floor' : props.selectedDeviceId ? `Selected: ${props.selectedDeviceId}` : 'Select a device or terminal'}</span>
    </div>
  </div>;
}
