/** P3 Tier 2 sensor geometry, response time and seeded load-cell noise. */
import type {EquipmentDef,EquipmentContext} from '../world/equipment';
import {draw,flag,initial,param,spec} from '../world/equipment';
import type {Body,World} from '../world/types';
import {insideFootprint,q,vec} from '../world/math';
import {nextSeed} from '../world/seed';
import {opticalZoneContains,opticalZoneIntersectsBody,opticalZoneOf} from './sensor-zone';
import {hasUnobstructedSightline,sightlineClearOfBodies,opticallyOpaque} from './line-of-sight';
const bodiesNear=(world:World,ctx:EquipmentContext,range:number):Body[]=>
 world.bodies.filter(b=>insideFootprint(b.pos,ctx.originMm,vec(range,range,0))&&
 Math.abs(b.pos.z-ctx.originMm.z)<=600);
const optical=(kind:string,label:string,predicate:(b:Body)=>boolean):EquipmentDef=>({
 kind,label,footprint:vec(100,100,150),commands:[],
 signals:[{name:'present',kind:'bool'}],
 params:[spec('rangeMm','Sensing range','mm',50,800,10,200),
  spec('responseMs','Response delay','ms',0,500,10,40),
  // 0 preserves old saved-project area sensing; 1 enables a forward zone.
  spec('beamMode','Detection mode','0=area, 1=forward',0,1,1,0),
  spec('beamWidthMm','Forward beam width','mm',20,400,10,100),
  // R21: continuous aim of a forward beam, independent of the quarter-turn placement yaw; 0 keeps every saved project unchanged.
  spec('aimDeg','Beam aim (forward mode)','degrees',-180,180,5,0),
  // Legacy forward detection stays unchanged. Explicit opt-in enables a
  // bounded LOS check against shelves and process tanks in the worker.
  spec('occlusionMode','Line of sight','0=off, 1=fixed, 2=fixed+bodies, 3=material',0,3,1,0),
  spec('targetMode','Target geometry','0=centre, 1=body volume',0,1,1,0),
  spec('detectOperator','Virtual person sensing','0=off, 1=on',0,1,1,0),
  spec('materialMode','Transparent optical targets','0=legacy, 1=ignore glass',0,1,1,0)],
 faults:['sensor-stuck-on','sensor-stuck-off','dirty-lens',
  'sensor-misaligned','sensor-intermittent'], 
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const zone=opticalZoneOf(kind,ctx,f);
  // The explicit classroom actor is worker data, never camera geometry.
  // Every historical sensor and project remains unaffected by default.
  const candidates=ctx.params.detectOperator===1&&w.trainingOperator?
   [...w.bodies,w.trainingOperator]:w.bodies;
  const seen=candidates.some(body=>predicate(body)&&
   !(kind==='geometry-photoeye'&&ctx.params.materialMode===1&&
     !opticallyOpaque(body))&&
   (zone.shape==='forward'&&ctx.params.targetMode===1?
    opticalZoneIntersectsBody(body,ctx,zone):opticalZoneContains(body.pos,ctx,zone))&&
   (zone.shape!=='forward'||(ctx.params.occlusionMode??0)===0||
    (hasUnobstructedSightline(ctx.originMm,body.pos,ctx.occluders??[],ctx.id)&&
     ((ctx.params.occlusionMode??0)<2||
      sightlineClearOfBodies(ctx.originMm,body,candidates,
       ctx.params.occlusionMode===3)))));
  const response=param(ctx,'responseMs',40);
  const elapsedMs=seen?s.elapsedMs+dt:0;
  // Fault pulses follow simulated worker time, never wall clock or an
  // unseeded browser random generator. PLC observability is reproducible.
  const intermittent=f==='sensor-intermittent'&&Math.floor(w.timeMs/150)%2===1;
  const on=f==='sensor-stuck-on'?true:f==='sensor-stuck-off'||intermittent?
   false:seen&&elapsedMs>=response;
  return {world:w,state:{...s,elapsedMs:q(elapsedMs),engaged:on,faulted:!!f}};
 },
 read:(s)=>({present:s.engaged}),
 describe:(s,ctx)=>[draw(ctx,'sensor','box',vec(95,85,135),75,s.engaged?'#50b7d1':'#416678')],
});
export const photoeye=optical('geometry-photoeye','Geometry photoeye',()=>true);
export const inductiveProx=optical('inductive-prox','Inductive proximity sensor',
 b=>b.tags.material==='metal'||b.tags.metal===true);
export const capacitiveProx=optical('capacitive-prox','Capacitive proximity sensor',()=>true);
/**
 * Light curtain with MUTING (R20). `mute` (command) deliberately ignores the curtain so material can pass, as a muting
 * arrangement does while a pallet is on its way through, but only for `maxMuteMs`: a mute held longer expires, the curtain is live
 * again and `muteTimeout` is raised until the mute is released (a stuck mute must never leave the opening unprotected).
 * Educational model of the principle; not a rated safety function and not a two-sensor muting sequence.
 */
export const lightCurtain:EquipmentDef={
 kind:'light-curtain',label:'Height-classifying light curtain',footprint:vec(100,450,1100),
 commands:[{name:'mute',kind:'bool'}],
 signals:[{name:'blocked',kind:'bool'},{name:'tall',kind:'bool'},{name:'muted',kind:'bool'},{name:'muteTimeout',kind:'bool'}],
 params:[spec('heightMm','Threshold height','mm',100,1500,50,500),
  spec('maxMuteMs','Maximum mute time','ms',500,60000,500,10000)],
 faults:['beam-broken','alignment-error'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const visible=bodiesNear(w,ctx,500);
  // elapsedMs counts how long the mute has been held; a released mute resets it and clears the timeout.
  const asked=flag(c,'mute');
  const heldMs=asked?s.elapsedMs+dt:0;
  const expired=asked&&heldMs>param(ctx,'maxMuteMs',10000);
  const muted=asked&&!expired;
  const blocked=!muted&&visible.length>0&&f!=='beam-broken';
  const tall=blocked&&visible.some(b=>b.size.z>=param(ctx,'heightMm',500))&&f!=='alignment-error';
  return {world:w,state:{...s,elapsedMs:q(heldMs),engaged:blocked,done:tall,stalled:expired,lastCommand:muted,faulted:!!f}};
 },
 read:s=>({blocked:s.engaged,tall:s.done,muted:s.lastCommand,muteTimeout:s.stalled}),
 describe:(s,ctx)=>[draw(ctx,'curtain','box',vec(80,430,1000),500,s.lastCommand?'#c9b45a':s.engaged?'#8fbad6':'#577f98')],
};
export const weighCell:EquipmentDef={
 kind:'weigh-cell',label:'Numeric weighing platform',footprint:vec(350,350,100),
 commands:[],signals:[{name:'present',kind:'bool'},{name:'weightKg',kind:'number',unit:'kg'}],
 params:[spec('capacityKg','Cell capacity','kg',1,500,1,100),
  spec('noiseGram','Seeded noise amplitude','g',0,50,1,3)],
 faults:['load-cell-drift','load-cell-dead'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const mass=bodiesNear(w,ctx,350).reduce((sum,b)=>sum+b.massKg,0);
  const rng=nextSeed(w.rngState);
  const noise=(rng.unit*2-1)*param(ctx,'noiseGram',3)/1000;
  const value=f==='load-cell-dead'?0:Math.max(0,Math.min(param(ctx,'capacityKg',100),
   mass+noise+(f==='load-cell-drift'?1.5:0)));
  return {world:{...w,rngState:rng.state},state:{...s,value:q(value),
   engaged:mass>0,faulted:!!f}};
 },
 read:s=>({present:s.engaged,weightKg:s.value}),
 describe:(s,ctx)=>[draw(ctx,'load cell','box',vec(340,340,90),45,s.engaged?'#8dbcae':'#607680')],
};
