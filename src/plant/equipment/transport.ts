/** P3 Tier 1 training transports; surface acceleration and slip are simplified. */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,numeric,param,spec} from '../world/equipment';
import {clamp,q,vec,insideFootprint} from '../world/math';
import type {EquipmentState} from '../world/types';

export const beltConveyor:EquipmentDef={
 kind:'belt-conveyor',label:'Variable-speed belt conveyor',footprint:vec(600,300,120),
 commands:[{name:'run',kind:'bool'},{name:'reverse',kind:'bool'},{name:'speed',kind:'number',unit:'mm/s'}],
 signals:[{name:'moving',kind:'bool'},{name:'jam',kind:'bool'},{name:'speed',kind:'number',unit:'mm/s'}],
 params:[spec('lengthMm','Belt length','mm',200,2400,50,600),spec('widthMm','Belt width','mm',150,600,50,300),
 spec('speedMmS','Surface speed','mm/s',50,1000,10,250),
 spec('contactMode','Body collision','0=legacy, 1=swept 3D',0,1,1,0)],
 faults:['belt-slip','belt-jammed','motor-dead'],
 fresh:()=>initial({}),
 step:(state,world,commands,dt,fault,ctx)=>{
  const run=flag(commands,'run')&&fault!=='motor-dead';
  const demanded=numeric(commands,'speed',param(ctx,'speedMmS',250),0,1000);
  const actual=run?(fault==='belt-slip'?demanded*.3:demanded):0;
  return {world,state:{...state,engaged:run&&!state.stalled&&fault!=='belt-jammed',
   speedMmS:q(flag(commands,'reverse')?-actual:actual),
   faulted:!!fault,stalled:fault==='belt-jammed'||state.stalled}};
 },
 read:(s,w,ctx)=>({moving:s.engaged,jam:s.stalled||w.bodies.some(b=>b.supportedBy===ctx.id&&b.tags.jammed===true),
  speed:s.engaged?s.speedMmS:0}),
 describe:(s,ctx)=>[draw(ctx,'frame','box',vec(param(ctx,'lengthMm',600),param(ctx,'widthMm',300),120),60,
  s.engaged?'#397fa0':'#5f7380')],
};
export const rollerConveyor:EquipmentDef={
 kind:'roller-conveyor',label:'Powered/gravity rollers',footprint:vec(600,300,120),
 commands:[{name:'run',kind:'bool'},{name:'reverse',kind:'bool'}],
 signals:[{name:'moving',kind:'bool'},{name:'jam',kind:'bool'}],
 params:[spec('lengthMm','Roller length','mm',200,2400,50,600),
 spec('widthMm','Roller width','mm',150,600,50,300),
 spec('speedMmS','Roller speed','mm/s',20,800,10,180),
 spec('gravityMode','Gravity feed','bool',0,1,1,0),
 spec('contactMode','Body collision','0=legacy, 1=swept 3D',0,1,1,0)],
 faults:['bearing-seized','roller-slip'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const engaged=(flag(c,'run')||param(ctx,'gravityMode',0)===1)&&f!=='bearing-seized';
  const speed=param(ctx,'speedMmS',180)*(f==='roller-slip'?.3:1);
  return {state:{...s,engaged,speedMmS:q(engaged?(flag(c,'reverse')?-speed:speed):0),
   stalled:f==='bearing-seized',faulted:!!f},world:w};
 },
 read:(s,w,ctx)=>({moving:s.engaged,jam:s.stalled||w.bodies.some(b=>b.supportedBy===ctx.id&&b.tags.jammed===true)}),
 describe:(s,ctx)=>[draw(ctx,'rollers','box',vec(param(ctx,'lengthMm',600),param(ctx,'widthMm',300),120),60,
   s.engaged?'#577eac':'#657586')],
};
export const turntable:EquipmentDef={
 kind:'turntable',label:'90-degree turntable',footprint:vec(400,400,150),
 commands:[{name:'turn',kind:'bool'},{name:'run',kind:'bool'}],
 signals:[{name:'home',kind:'bool'},{name:'rotated',kind:'bool'},{name:'busy',kind:'bool'}],
 params:[spec('turnMs','Quarter-turn time','ms',100,8000,50,2000)],
 faults:['turntable-stuck','home-switch-stuck'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const turn=flag(c,'turn')&&f!=='turntable-stuck';
  let elapsed=s.elapsedMs;
  if(turn&&!s.done)elapsed=Math.min(param(ctx,'turnMs',2000),elapsed+dt);
  if(!turn&&s.done)elapsed=0;
  const done=elapsed>=param(ctx,'turnMs',2000);
  // Rotate supported part exactly once at the end of a discrete quarter-turn.
  const justDone=done&&!s.done;
  const bodies=justDone?w.bodies.map(b=>b.supportedBy===ctx.id?{
    ...b,yawDeg:((b.yawDeg+90)%360) as 0|90|180|270}:b):w.bodies;
  return {state:{...s,elapsedMs:elapsed,progress:q(elapsed/param(ctx,'turnMs',2000)),
   done,engaged:flag(c,'run'),speedMmS:flag(c,'run')?50:0,faulted:!!f},
   world:justDone?{...w,bodies}:w};
 },
 read:(s,w,ctx)=>({home:s.elapsedMs===0,rotated:s.done,busy:s.elapsedMs>0&&!s.done}),
 describe:(s,ctx)=>[draw(ctx,'table','cylinder',vec(380,380,110),55,s.done?'#70a89a':'#66859a')],
};
