/** P3 Tier 1/2 lifts, rotary actuator and 2-axis gantry; simplified kinematics. */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,numeric,param,spec} from '../world/equipment';
import {insideFootprint,q,vec} from '../world/math';
import type {World,EquipmentState} from '../world/types';
const approach=(current:number,target:number,maxDelta:number):number=>
 q(current+Math.max(-maxDelta,Math.min(maxDelta,target-current)));
const liftBase=(kind:string):EquipmentDef=>({
 kind,label:kind==='lift'?'Two-level elevator':'Scissor lift',footprint:vec(500,500,200),
 commands:[{name:'up',kind:'bool'},{name:'down',kind:'bool'},
   {name:'height',kind:'number',unit:'mm'}],
 signals:[{name:'bottom',kind:'bool'},{name:'top',kind:'bool'},
   {name:'positionMm',kind:'number',unit:'mm'},{name:'moving',kind:'bool'}],
 params:[spec('heightMm','Travel height','mm',200,2500,50,1000),
  spec('speedMmS','Travel speed','mm/s',30,450,10,180)],
 faults:['lift-stuck','limit-switch-dead','lift-slow'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const height=param(ctx,'heightMm',1000);
  const demand=typeof c.height==='number'?numeric(c,'height',0,0,height):
    flag(c,'up')&&!flag(c,'down')?height:
    flag(c,'down')&&!flag(c,'up')?0:s.positionMm;
  const speed=param(ctx,'speedMmS',180)*(f==='lift-slow'?.35:1);
  const next=f==='lift-stuck'?s.positionMm:approach(s.positionMm,demand,speed*dt/1000);
  return {world:w,state:{...s,positionMm:next,engaged:next!==s.positionMm,
    speedMmS:q(speed),faulted:!!f,stalled:f==='lift-stuck'}};
 },
 read:(s,w,ctx)=>({bottom:s.positionMm<=0&& !s.faulted,top:s.positionMm>=param(ctx,'heightMm',1000)&& !s.faulted,
  positionMm:s.positionMm,moving:s.engaged}),
 describe:(s,ctx)=>[draw(ctx,'platform','box',vec(470,470,90),s.positionMm+45,
  s.engaged?'#6ea5a7':'#668b91')],
});
export const lift=liftBase('lift');
export const scissorLift=liftBase('scissor-lift');
export const rotaryActuator:EquipmentDef={
 kind:'rotary-actuator',label:'Indexed 90-degree rotary actuator',footprint:vec(300,300,180),
 commands:[{name:'turn',kind:'bool'},{name:'home',kind:'bool'}],
 signals:[{name:'home',kind:'bool'},{name:'indexed',kind:'bool'},{name:'busy',kind:'bool'}],
 params:[spec('turnMs','Index time','ms',100,8000,50,1200)],
 faults:['actuator-stuck','index-switch-dead'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const demanded=flag(c,'turn')?1:flag(c,'home')?0:s.progress;
  const progress=f==='actuator-stuck'?s.progress:approach(s.progress,demanded,dt/param(ctx,'turnMs',1200));
  return {world:w,state:{...s,progress,engaged:progress>0,done:progress>=1,
    faulted:!!f,stalled:f==='actuator-stuck'}};
 },
 read:(s,w,ctx)=>({home:s.progress===0,indexed:s.done,busy:s.progress>0&&s.progress<1}),
 describe:(s,ctx)=>[draw(ctx,'rotary table','cylinder',vec(260,260,130),70,s.done?'#84ada2':'#687a94')],
};
export const pickAndPlace:EquipmentDef={
 kind:'pick-and-place',label:'Two-axis pick and place',footprint:vec(1400,500,1900),
 commands:[{name:'xTargetMm',kind:'number',unit:'mm'},{name:'zTargetMm',kind:'number',unit:'mm'},
  {name:'grip',kind:'bool'},{name:'dispatch',kind:'bool'}],
 signals:[{name:'inPosition',kind:'bool'},{name:'partHeld',kind:'bool'},
  {name:'xMm',kind:'number',unit:'mm'},{name:'zMm',kind:'number',unit:'mm'}],
 params:[spec('travelMm','X travel','mm',300,3000,50,1200),
  spec('riseMm','Z travel','mm',200,2000,50,1000),
  spec('speedMmS','Servo speed','mm/s',20,1000,10,400),
  spec('dispatchMm','Discrete outbound position','mm',100,2500,50,650)],
 faults:['servo-stuck','gripper-leak','axis-slip'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const xTarget=flag(c,'dispatch')?
   Math.min(param(ctx,'dispatchMm',650),param(ctx,'travelMm',1200)):
   numeric(c,'xTargetMm',0,0,param(ctx,'travelMm',1200));
  const zTarget=numeric(c,'zTargetMm',0,0,param(ctx,'riseMm',1000));
  const speed=param(ctx,'speedMmS',400)*(f==='axis-slip'?.35:1);
  const x=f==='servo-stuck'?s.positionMm:approach(s.positionMm,xTarget,speed*dt/1000);
  const z=f==='servo-stuck'?s.value:approach(s.value,zTarget,speed*dt/1000);
  let held=flag(c,'grip')&&f!=='gripper-leak'?s.heldBodyId??null:null;
  if(flag(c,'grip')&&!held&&f!=='gripper-leak'){
   const body=w.bodies.find(b=>Math.abs(b.pos.x-(ctx.originMm.x+x))<100&&
     Math.abs(b.pos.y-ctx.originMm.y)<130&&Math.abs(b.pos.z-(ctx.originMm.z+z))<200);
   held=body?.id??null;
  }
  const bodies=w.bodies.map(b=>b.id===held?{...b,
   pos:vec(ctx.originMm.x+x,ctx.originMm.y,ctx.originMm.z+z),
   vel:vec(),supportedBy:ctx.id}:s.heldBodyId===b.id&&!held?
     {...b,supportedBy:null}:b);
  return {world:{...w,bodies},state:{...s,positionMm:x,value:z,
    heldBodyId:held,engaged:!!held,done:x===xTarget&&z===zTarget,
    faulted:!!f,stalled:f==='servo-stuck'}};
 },
 read:s=>({inPosition:s.done,partHeld:!!s.heldBodyId,xMm:s.positionMm,zMm:s.value}),
 describe:(s,ctx)=>[draw(ctx,'gantry','box',vec(1300,280,100),1400,'#658baa'),
   draw({...ctx,originMm:vec(ctx.originMm.x+s.positionMm,ctx.originMm.y,ctx.originMm.z+s.value)},
     'gripper','box',vec(110,90,140),50,s.heldBodyId?'#56aa92':'#c5a869')],
};
export const palletizer:EquipmentDef={
 kind:'palletizer',label:'Pattern palletizer',footprint:vec(1300,1000,1750),
 commands:[{name:'pick',kind:'bool'},{name:'place',kind:'bool'}],
 signals:[{name:'partHeld',kind:'bool'},{name:'patternDone',kind:'bool'},
  {name:'placedCount',kind:'number',unit:'bodies'}],
 params:[spec('columns','Columns','count',1,5,1,2),spec('rows','Rows','count',1,5,1,2),
  spec('layers','Layers','count',1,8,1,2)],
 faults:['gripper-fault','pattern-jam'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  let held=s.heldBodyId??null,count=s.count;
  const picking=flag(c,'pick')&&!s.lastCommand;
  if(picking&&!held&&f!=='gripper-fault'){
   const body=w.bodies.find(b=>insideFootprint(b.pos,ctx.originMm,vec(600,900,0))&&!b.tags.palletized);
   held=body?.id??null;
  }
  const placing=flag(c,'place')&&held&&f!=='pattern-jam';
  const columns=param(ctx,'columns',2),rows=param(ctx,'rows',2);
  // A held package must have a genuine equipment support and a modelled
  // pickup pose. Otherwise ordinary gravity will drop a supposedly gripped
  // body before the PLC's separate place command arrives.
  let bodies=held?w.bodies.map(b=>b.id===held?{...b,
   pos:vec(ctx.originMm.x,ctx.originMm.y,ctx.originMm.z+250),
   supportedBy:ctx.id,vel:vec()}:b):w.bodies;
  if(placing){
   const col=count%columns,row=Math.floor(count/columns)%rows,layer=Math.floor(count/(rows*columns));
   bodies=w.bodies.map(b=>b.id===held?{...b,pos:vec(ctx.originMm.x+col*200,
    ctx.originMm.y+row*200,ctx.originMm.z+160+layer*b.size.z),
    supportedBy:ctx.id,vel:vec(),tags:{...b.tags,palletized:true}}:b);
   count++;held=null;
  }
  const pattern=columns*rows*param(ctx,'layers',2);
  return {world:bodies===w.bodies?w:{...w,bodies},state:{...s,heldBodyId:held,
    count,done:count>=pattern,engaged:!!held,lastCommand:flag(c,'pick'),faulted:!!f}};
 },
 read:s=>({partHeld:!!s.heldBodyId,patternDone:s.done,placedCount:s.count}),
 describe:(s,ctx)=>[draw(ctx,'palletizer frame','box',vec(1250,900,140),1500,'#718aa8')],
};
