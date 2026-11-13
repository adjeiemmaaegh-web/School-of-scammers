/** P3 Tier 1 training transports; surface acceleration and slip are simplified. */
import type {EquipmentDef} from '../world/equipment';
import {draw,flag,initial,numeric,param,spec} from '../world/equipment';
import {clamp,q,vec,insideFootprint} from '../world/math';
import type {EquipmentState} from '../world/types';

const controllerPoweredForQueue=(commands:Readonly<Record<string,boolean|number>>):boolean=>
 commands.controllerPowered!==false;

export const beltConveyor:EquipmentDef={
 kind:'belt-conveyor',label:'Variable-speed belt conveyor',footprint:vec(600,300,120),
 commands:[{name:'run',kind:'bool'},{name:'reverse',kind:'bool'},
  {name:'resetJam',kind:'bool'},{name:'resetRestart',kind:'bool'},
  {name:'speed',kind:'number',unit:'mm/s'}],
 signals:[{name:'moving',kind:'bool'},{name:'jam',kind:'bool'},
  {name:'restartRequired',kind:'bool'},{name:'obstructionTripped',kind:'bool'},
  {name:'accumulationTripped',kind:'bool'},{name:'queueDwellMs',kind:'number',unit:'ms'},
  // P22 zone telemetry is read from real worker-owned body positions, not
  // inferred from a PLC counter, visual mesh or an assumed feeder pulse.
  {name:'zoneOccupied',kind:'bool'},{name:'zoneFull',kind:'bool'},
  {name:'zoneCount',kind:'number',unit:'bodies'},
  {name:'speed',kind:'number',unit:'mm/s'}],
 params:[spec('lengthMm','Belt length','mm',200,2400,50,600),spec('widthMm','Belt width','mm',150,600,50,300),
 spec('speedMmS','Surface speed','mm/s',50,1000,10,250),
 spec('contactMode','Body collision','0=legacy, 1=swept 3D',0,1,1,0),
  spec('jamResetMode','Jam acknowledgement','0=legacy, 1=PLC reset after repair',0,1,1,0),
  spec('restartHoldMode','Power restoration inhibit','0=legacy, 1=PLC reset after loss',0,1,1,0),
  spec('obstructionTripMode','Physical gate obstruction trip','0=legacy, 1=latched PLC reset',0,1,1,0),
  spec('accumulationTripMode','Body-to-body accumulation trip','0=legacy, 1=latched',0,1,1,0),
  spec('accumulationDwellMs','Required continuous queue dwell','ms',100,4000,50,500),
  spec('zoneSensorMode','Physical belt-zone occupancy','0=off, 1=actual bodies',0,1,1,0),
  spec('zoneCapacity','Observed carton capacity','bodies',1,5,1,2)],
 faults:['belt-slip','belt-jammed','motor-dead'],
 fresh:()=>initial({}),
 step:(state,world,commands,dt,fault,ctx)=>{
  const run=flag(commands,'run')&&fault!=='motor-dead';
  const demanded=numeric(commands,'speed',param(ctx,'speedMmS',250),0,1000);
  const actual=run?(fault==='belt-slip'?demanded*.3:demanded):0;
  const resetRequested=flag(commands,'resetJam');
  const resetEdge=resetRequested&&!state.lastJamResetCommand;
  const obstructionMode=param(ctx,'obstructionTripMode',0)===1;
  const collision=obstructionMode?world.bodies.find(b=>b.supportedBy===ctx.id&&
   b.tags.jammed===true&&typeof b.tags.jammedByGate==='string'&&
   world.model[b.tags.jammedByGate]?.engaged===true):undefined;
  // P20 requires the REAL worker-owned originally moving body, real gate
  // and real physical jam tag, never a teacher-assigned fault or PLC tag.
  const obstructionGateId=state.stalled&&state.obstructionGateId?
   state.obstructionGateId:collision?.tags.jammedByGate as string|undefined;
  const obstructionBodyId=state.stalled&&state.obstructionBodyId?
   state.obstructionBodyId:collision?.id;
  // P21 does NOT infer a jam from a timer, a PLC register, or a rendered
  // parcel. Two distinct original worker bodies must actually collide on
  // this same powered belt. Only their continuous *physical* contact while
  // commanded to run accumulates bounded dwell time. A transient bump does
  // not trip the drive; the source IDs remain private equipment evidence.
  const queueMode=param(ctx,'accumulationTripMode',0)===1;
  const queued=queueMode&&!state.stalled&&run&&controllerPoweredForQueue(commands)?
   world.bodies.find(b=>b.supportedBy===ctx.id&&b.tags.jammed===true&&
    typeof b.tags.jammedByBody==='string'&&b.tags.jammedByBody!==b.id&&
    world.bodies.some(leader=>leader.id===b.tags.jammedByBody&&
     leader.supportedBy===ctx.id)):undefined;
  const samePair=!!queued&&state.queueContactBodyId===queued.id&&
   state.queueContactLeaderId===queued.tags.jammedByBody;
  const dwellRequired=param(ctx,'accumulationDwellMs',500);
  const queueDwellMs=queued?
   Math.min(dwellRequired,(samePair?(state.accumulationContactMs??0):0)+dt):0;
  const queueTrip=!!queued&&queueDwellMs>=dwellRequired;
  const accumulationBodyId=state.stalled&&state.accumulationBodyId?
   state.accumulationBodyId:queueTrip?queued?.id:null;
  const accumulationBlockingBodyId=state.stalled&&state.accumulationBlockingBodyId?
   state.accumulationBlockingBodyId:queueTrip?
   (queued?.tags.jammedByBody as string|undefined):null;
  const queuedBodyExists=!!accumulationBodyId&&world.bodies.some(b=>
   b.id===accumulationBodyId&&b.supportedBy===ctx.id);
  const leader=world.bodies.find(b=>b.id===accumulationBlockingBodyId);
  // The leading carton must still EXIST and be physically displaced out
  // of this source conveyor by the real pusher; deleting it is not a safe
  // recovery, nor is merely dropping a PLC flag or retracting a gate.
  const queueClear=queuedBodyExists&&!!leader&&leader.supportedBy!==ctx.id;
  const originalBodyPresent=!!obstructionBodyId&&world.bodies.some(b=>
   b.id===obstructionBodyId&&b.supportedBy===ctx.id);
  const gateStillBlocking=!!obstructionGateId&&
   world.model[obstructionGateId]?.engaged===true;
  const obstructionCanReset=originalBodyPresent&&!gateStillBlocking;
  const latchedMode=param(ctx,'jamResetMode',0)===1||obstructionMode||queueMode;
  // Faults and worker-observed collisions use the same PLC reset input,
  // but a mechanically EXTENDED gate must be released BEFORE the reset
  // edge. The original blocked body must still exist on its source belt.
  const clear=resetEdge&&fault===null&&
   (!obstructionGateId||obstructionCanReset)&&
   (!accumulationBodyId||queueClear);
  const stalled=latchedMode?
   fault==='belt-jammed'||!!collision||queueTrip||(state.stalled&&!clear):
   fault==='belt-jammed'||state.stalled;
  // Controller power comes from the actual 24V netlist through the
  // worker-owned bridge, NOT a learner PLC tag or synthetic source input.
  const controllerPowered=commands.controllerPowered!==false;
  const restartMode=param(ctx,'restartHoldMode',0)===1;
  const newlyLostController=state.controllerPowerSeen===true&&!controllerPowered;
  const restartReset=flag(commands,'resetRestart');
  const restartEdge=restartReset&&!state.lastRestartCommand;
  let restartPending=restartMode&&(state.restartPending===true||
   newlyLostController||fault==='motor-dead');
  let restartArmed=restartMode&&state.restartArmed===true;
  // A held HIGH reset never clears an outage. Observe LOW while restored,
  // then a fresh energized reset edge. This is a teaching interlock, not
  // certified machine safety or hardware restart supervision.
  if(restartPending){
   if(!controllerPowered||fault!==null)restartArmed=false;
   else if(!restartReset)restartArmed=true;
   if(restartEdge&&state.restartArmed===true&&controllerPowered&&
      fault===null&&!stalled){restartPending=false;restartArmed=false;}
  }else restartArmed=false;
  const engaged=run&&!stalled&&!restartPending&&controllerPowered;
  return {world,state:{...state,engaged,
   speedMmS:q(engaged?(flag(commands,'reverse')?-actual:actual):0),
   lastJamResetCommand:resetRequested,lastRestartCommand:restartReset,
   controllerPowerSeen:state.controllerPowerSeen===true||controllerPowered,
   restartPending,restartArmed,
   obstructionBodyId:stalled?obstructionBodyId:null,
   obstructionGateId:stalled?obstructionGateId:null,
   accumulationBodyId:stalled?accumulationBodyId:null,
   accumulationBlockingBodyId:stalled?accumulationBlockingBodyId:null,
   accumulationContactMs:stalled&&!!accumulationBodyId?dwellRequired:queueDwellMs,
   queueContactBodyId:queued?.id??null,
   queueContactLeaderId:typeof queued?.tags.jammedByBody==='string'?
    queued.tags.jammedByBody:null,
   faulted:!!fault,stalled}};
 },
 read:(s,w,ctx)=>{
  const monitored=param(ctx,'zoneSensorMode',0)===1;
  const length=param(ctx,'lengthMm',600),width=param(ctx,'widthMm',300);
  const rotated=ctx.yawDeg===90||ctx.yawDeg===270;
  const size=vec(rotated?width:length,rotated?length:width,0);
  // Count only distinct, conserved source bodies that are STILL physically
  // on this conveyor and inside its actual rotated footprint. Ejected loads,
  // foreign-belt products, operator sprites and stale tag claims do not count.
  // This is a bounded lane-occupancy teaching sensor, NOT an inferred force
  // or machine-safe collision/overfill device.
  const count=monitored?w.bodies.filter(body=>body.supportedBy===ctx.id&&
   insideFootprint(body.pos,ctx.originMm,size)).length:0;
  return {moving:s.engaged,
   jam:s.stalled||w.bodies.some(b=>b.supportedBy===ctx.id&&b.tags.jammed===true),
   restartRequired:s.restartPending===true,
   obstructionTripped:s.stalled&&!!s.obstructionBodyId,
   accumulationTripped:s.stalled&&!!s.accumulationBodyId,
   queueDwellMs:s.accumulationContactMs??0,
   zoneOccupied:count>0,
   zoneFull:monitored&&count>=param(ctx,'zoneCapacity',2),
   zoneCount:count,
   speed:s.engaged?s.speedMmS:0};
 },
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
 signals:[{name:'home',kind:'bool'},{name:'rotated',kind:'bool'},{name:'busy',kind:'bool'},
  {name:'angleDeg',kind:'number',unit:'deg'}],
 params:[spec('turnMs','Quarter-turn time','ms',100,8000,50,2000),
  spec('rotateCargo','Rotate carried parcels','0=legacy, 1=continuous',0,1,1,0)],
 faults:['turntable-stuck','home-switch-stuck'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const turn=flag(c,'turn')&&f!=='turntable-stuck';
  let elapsed=s.elapsedMs;
  if(turn&&!s.done)elapsed=Math.min(param(ctx,'turnMs',2000),elapsed+dt);
  if(!turn&&s.done)elapsed=0;
  const done=elapsed>=param(ctx,'turnMs',2000);
  // Legacy projects still snap at the end. P8 opt-in moves the worker-owned
  // load's x/y continuously around the actual turntable centre. All steps
  // are quantized and controlled by PLC scan time, not rendered frame time.
  const justDone=done&&!s.done;
  const enhanced=param(ctx,'rotateCargo',0)===1;
  const progress=q(elapsed/param(ctx,'turnMs',2000));
  const delta=enhanced&&turn&&!s.done?Math.max(0,progress-s.progress):0;
  const angle=delta*Math.PI/2,cs=Math.cos(angle),sn=Math.sin(angle);
  const bodies=justDone||delta>0?w.bodies.map(b=>{
   if(b.supportedBy!==ctx.id)return b;
   const offsetX=b.pos.x-ctx.originMm.x,offsetY=b.pos.y-ctx.originMm.y;
   return {...b,
    ...(delta>0?{pos:vec(ctx.originMm.x+offsetX*cs-offsetY*sn,
      ctx.originMm.y+offsetX*sn+offsetY*cs,b.pos.z),
     visualYawDeg:q(((b.visualYawDeg??b.yawDeg)+delta*90)%360)}:{}),
    ...(justDone?{yawDeg:((b.yawDeg+90)%360) as 0|90|180|270}:{}),
   };
  }):w.bodies;
  const phase=enhanced?(justDone?((s.phase??0)+1)%4:(s.phase??0)):s.phase;
  return {state:{...s,elapsedMs:elapsed,progress,phase,
   done,engaged:flag(c,'run'),speedMmS:flag(c,'run')?50:0,faulted:!!f},
   world:bodies===w.bodies?w:{...w,bodies}};
 },
 read:(s,w,ctx)=>({home:s.elapsedMs===0&&(s.phase??0)===0,
  rotated:s.done,busy:s.elapsedMs>0&&!s.done,
  angleDeg:q(((s.phase===undefined?s.progress:
    (s.phase-(s.done?1:0)+s.progress+4)%4)*90)%360)}),
 describe:(s,ctx)=>[draw(ctx,'table','cylinder',vec(380,380,110),55,s.done?'#70a89a':'#66859a')],
};
