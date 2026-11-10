/** P3 3-DOF kinematic teaching robot, NOT a dynamic industrial arm. */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,numeric,param,spec} from '../world/equipment';
import {q,vec} from '../world/math';
export const robotArm:EquipmentDef={
 kind:'robot-arm',label:'Three-axis teaching robot',footprint:vec(900,900,1800),
 commands:[{name:'xTargetMm',kind:'number',unit:'mm'},
  {name:'yTargetMm',kind:'number',unit:'mm'},
  {name:'zTargetMm',kind:'number',unit:'mm'},{name:'grip',kind:'bool'}],
 signals:[{name:'inPosition',kind:'bool'},{name:'partHeld',kind:'bool'},
  {name:'collisionStop',kind:'bool'},{name:'unreachable',kind:'bool'}],
 params:[spec('reachMm','Reach','mm',200,1700,50,900),
  spec('speedMmS','End-effector speed','mm/s',20,900,10,350)],
 faults:['robot-joint-stuck','robot-gripper-leak','position-drift'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const reach=param(ctx,'reachMm',900);
  const x=numeric(c,'xTargetMm',0,-reach,reach),y=numeric(c,'yTargetMm',0,-reach,reach),
   z=numeric(c,'zTargetMm',100,0,reach);
  const beyond=x*x+y*y+z*z>reach*reach;
  const nextX=ctx.originMm.x+x,nextY=ctx.originMm.y+y,nextZ=ctx.originMm.z+z;
  const collision=w.bodies.some(body=>body.id!==s.heldBodyId&&
   Math.abs(body.pos.x-nextX)<body.size.x*.4 &&
   Math.abs(body.pos.y-nextY)<body.size.y*.4&&
   Math.abs(body.pos.z-nextZ)<body.size.z*.4);
  const blocked=beyond||collision||f==='robot-joint-stuck';
  const speed=param(ctx,'speedMmS',350)*dt/1000;
  const toward=(a:number,b:number)=>q(a+Math.max(-speed,Math.min(speed,b-a)));
  const px=blocked?s.positionMm:toward(s.positionMm,x);
  const py=blocked?s.progress:toward(s.progress,y);
  const pz=blocked?s.value:toward(s.value,z);
  let held=flag(c,'grip')&&f!=='robot-gripper-leak'?s.heldBodyId??null:null;
  if(!held&&flag(c,'grip')&&!blocked&&f!=='robot-gripper-leak'){
   held=w.bodies.find(body=>Math.abs(body.pos.x-(ctx.originMm.x+px))<100&&
    Math.abs(body.pos.y-(ctx.originMm.y+py))<100&&
    Math.abs(body.pos.z-(ctx.originMm.z+pz))<150)?.id??null;
  }
  const bodies=w.bodies.map(body=>body.id===held?{...body,pos:vec(ctx.originMm.x+px,
    ctx.originMm.y+py,ctx.originMm.z+pz),supportedBy:ctx.id,vel:vec()}:
    s.heldBodyId===body.id&&!held?{...body,supportedBy:null}:body);
  return {world:{...w,bodies},state:{...s,positionMm:px,progress:py,value:pz,
    heldBodyId:held,engaged:!!held,done:!blocked&&px===x&&py===y&&pz===z,
    stalled:blocked,faulted:!!f}};
 },
 read:(s,w,ctx)=>({inPosition:s.done,partHeld:!!s.heldBodyId,collisionStop:s.stalled,
  unreachable:s.stalled&&!s.done}),
 describe:(s,ctx)=>[draw(ctx,'robot pedestal','cylinder',vec(350,350,450),225,'#56718f'),
  draw({...ctx,originMm:vec(ctx.originMm.x+s.positionMm,ctx.originMm.y+s.progress,
    ctx.originMm.z+s.value)},'end effector','box',vec(120,120,120),60,
    s.stalled?'#d6775c':'#77aa93')],
};
