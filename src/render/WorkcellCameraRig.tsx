/**
 * FACTORY I/O-style 3D navigation: Orbit, Fly and an eye-height First Person
 * inspection camera. These are original camera controls, NOT real PLC signals.
 * First Person is deliberately not sensor detected; no camera pose is fed
 * into the authoritative Web Worker or into equipment sensors.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { ProjectFile } from '../sim/signals';
import {
  advanceCamera, initialNavigationPose, sceneCameraObstacles,
  type CameraKeys, type CameraPose, type WorkcellCameraMode,
} from './workcell-camera';

const INITIAL_KEYS:CameraKeys = {
  forward:false,back:false,left:false,right:false,rise:false,descend:false,
};
const KEY_FIELD:Readonly<Record<string,keyof CameraKeys>> = {
  w:'forward',arrowup:'forward',s:'back',arrowdown:'back',
  a:'left',arrowleft:'left',d:'right',arrowright:'right',
  e:'rise',q:'descend',
};
type Props = {
  mode:WorkcellCameraMode;
  editableCamera:boolean;
  project:ProjectFile;
  interest:[number,number,number];
  onPose:(pose:CameraPose)=>void;
};
export function WorkcellCameraRig({mode,editableCamera,project,interest,onPose}:Props){
  const {camera,gl}=useThree();
  const keys=useRef<CameraKeys>({...INITIAL_KEYS});
  const pose=useRef<CameraPose>(initialNavigationPose('fly'));
  const movingRight=useRef(false);
  const frame=useRef(0);
  const obstacles=useMemo(()=>sceneCameraObstacles(project),[project.components,project.params]);
  const poseCallback=useRef(onPose);
  poseCallback.current=onPose;

  useEffect(()=>{
    keys.current={...INITIAL_KEYS};
    movingRight.current=false;
    if(mode==='orbit'){
      camera.position.set(7,8.5,10);
      camera.lookAt(interest[0],interest[1],interest[2]);
    }else{
      const start=initialNavigationPose(mode);
      pose.current=start;
      camera.position.set(start.x,start.y,start.z);
      camera.lookAt(start.x+Math.sin(start.yaw),start.y+Math.sin(start.pitch),
        start.z-Math.cos(start.yaw));
      poseCallback.current(start);
    }
  // Mode changes intentionally reset the inspection camera; changes to project
  // geometry or orbit focus must not silently reset the user's viewpoint.
  },[mode,camera]);

  useEffect(()=>{
    if(mode==='orbit')return;
    const canvas=gl.domElement;
    // A WebGL canvas is not consistently keyboard-focusable across engines.
    // The scene (not document-wide shortcuts) owns WASD once explicitly focused.
    const originalTabIndex=canvas.getAttribute('tabindex');
    canvas.setAttribute('tabindex','0');
    const keyDown=(event:KeyboardEvent)=>{
      const field=KEY_FIELD[event.key.toLowerCase()];
      if(!field||document.activeElement!==canvas||event.altKey||event.ctrlKey||event.metaKey)return;
      event.preventDefault();
      keys.current[field]=true;
    };
    const keyUp=(event:KeyboardEvent)=>{
      const field=KEY_FIELD[event.key.toLowerCase()];
      if(field)keys.current[field]=false;
    };
    const blur=()=>{keys.current={...INITIAL_KEYS};movingRight.current=false;};
    const down=(event:PointerEvent)=>{
      canvas.focus();
      if(event.button===2) {
        event.preventDefault();movingRight.current=true;
        canvas.setPointerCapture(event.pointerId);
      }
    };
    const move=(event:PointerEvent)=>{
      if(!movingRight.current)return;
      pose.current={
        ...pose.current,
        yaw:pose.current.yaw-event.movementX*.004,
        pitch:Math.max(-1.3,Math.min(1.3,pose.current.pitch-event.movementY*.004)),
      };
    };
    const up=(event:PointerEvent)=>{
      if(event.button!==2)return;
      movingRight.current=false;
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    };
    const menu=(event:MouseEvent)=>event.preventDefault();
    canvas.addEventListener('keydown',keyDown);
    canvas.addEventListener('keyup',keyUp);
    canvas.addEventListener('blur',blur);
    canvas.addEventListener('pointerdown',down);
    canvas.addEventListener('pointermove',move);
    canvas.addEventListener('pointerup',up);
    canvas.addEventListener('pointercancel',blur);
    canvas.addEventListener('contextmenu',menu);
    return ()=>{
      canvas.removeEventListener('keydown',keyDown);
      canvas.removeEventListener('keyup',keyUp);
      canvas.removeEventListener('blur',blur);
      canvas.removeEventListener('pointerdown',down);
      canvas.removeEventListener('pointermove',move);
      canvas.removeEventListener('pointerup',up);
      canvas.removeEventListener('pointercancel',blur);
      canvas.removeEventListener('contextmenu',menu);
      if(originalTabIndex===null)canvas.removeAttribute('tabindex');
      else canvas.setAttribute('tabindex',originalTabIndex);
    };
  },[mode,gl]);

  useFrame((_,delta)=>{
    if(mode==='orbit')return;
    const next=advanceCamera(pose.current,keys.current,delta,mode,obstacles);
    pose.current=next;
    camera.position.set(next.x,next.y,next.z);
    const dir=new Vector3(Math.cos(next.pitch)*Math.sin(next.yaw),
      Math.sin(next.pitch),-Math.cos(next.pitch)*Math.cos(next.yaw));
    camera.lookAt(camera.position.clone().add(dir));
    if(++frame.current%12===0)poseCallback.current(next);
  });

  return mode==='orbit'
    ? <OrbitControls makeDefault enabled={editableCamera} enablePan enableZoom enableRotate
        minDistance={2.2} maxDistance={24} minPolarAngle={0.05}
        maxPolarAngle={Math.PI/2.03} target={interest} />
    : null;
}
