/**
 * P22 opt-in ORIGINAL belt occupancy → real 24V PLC full-zone input →
 * learner-controlled feeder inhibit. The source-only audit runs actual
 * feeder-created bodies in the same physics/electrical worker as the sandbox.
 * No phantom cartons, forced output coils or teacher-provided PLC solution.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {projectSignature} from './commissioning';
import {p21AccumulationPreflight} from './matrix-p21';

const SCENE='gate-accumulation',PLC='scene-plc',SUPPLY='scene-supply',
 START='p22-start',ACK='p22-maint',REQUEST='p22-more',LIMIT=480;
export type P22Case={id:string;pass:boolean;detail:string};
export type P22Lot={
 seed:number;pass:boolean;produced:number;initialZoneCount:number;
 zoneFullBeforeTrip:boolean;plcSensedFull:boolean;thirdFeedInhibited:boolean;
 pairTripped:boolean;leaderCleared:boolean;postClearanceCount:number;
 resetFromPlc:boolean;followerRecovered:boolean;thirdFedAfterRestart:boolean;
 originalIds:readonly string[];materials:readonly string[];
 cases:readonly P22Case[];diagnostic:string;
};
export type P22Campaign={
 sceneId:string;sourceSignature:string;status:'passed'|'failed'|'blocked';
 lots:readonly P22Lot[];deterministicReplay:boolean;totalOriginals:number;
 diagnostic:string;
};
const wired=(p:ProjectFile,a:string,b:string)=>
 p.wires.some(w=>(w.from===a&&w.to===b)||(w.from===b&&w.to===a));
export function p22ZonePreflight(p:ProjectFile,sceneId:string):string[]{
 const errors=p21AccumulationPreflight(p,sceneId);
 if(sceneId!==SCENE)return errors;
 // Canonical project loading strips default-valued settings; an omitted
 // zoneCapacity is the genuine registry default 2, NOT an invalid value.
 if(p.params?.belt?.zoneSensorMode!==1||(p.params?.belt?.zoneCapacity??2)!==2)
  errors.push('Enable the original belt zoneSensorMode=1 and zoneCapacity=2');
 if(!wired(p,'belt.OUT_zoneFull',PLC+'.I0.5'))
  errors.push('Wire the actual belt.OUT_zoneFull to PLC I0.5');
 if(p.wires.some(w=>w.from===PLC+'.I0.6'||w.to===PLC+'.I0.6'))
  errors.push('Reserve original PLC I0.6 for the private powered next-carton request');
 if(p.components.some(c=>[START,ACK,REQUEST].includes(c.id)))
  errors.push('Remove conflicting P22 private button identifier');
 return [...new Set(errors)];
}
function privateProject(p:ProjectFile):ProjectFile{
 const wires:Wire[]=[...p.wires,
  {id:'p22-start-power',from:SUPPLY+'.P24',to:START+'.A'},
  {id:'p22-start-in',from:START+'.B',to:PLC+'.I0.0'},
  {id:'p22-ack-power',from:SUPPLY+'.P24',to:ACK+'.A'},
  {id:'p22-ack-in',from:ACK+'.B',to:PLC+'.I0.4'},
  {id:'p22-request-power',from:SUPPLY+'.P24',to:REQUEST+'.A'},
  {id:'p22-request-in',from:REQUEST+'.B',to:PLC+'.I0.6'}];
 return {...p,components:[...p.components,
  {id:START,kind:'start',x:870,y:383,pressed:false},
  {id:ACK,kind:'start',x:870,y:426,pressed:false},
  {id:REQUEST,kind:'start',x:870,y:469,pressed:false}],wires};
}
const signal=(w:WorldState,id:string,key:string)=>
 w.plantWorld.signals[id]?.[key]===true;
const count=(w:WorldState):number=>{
 const n=w.plantWorld.signals.belt?.zoneCount;
 return typeof n==='number'?n:-1;
};
const body=(w:WorldState,id:string)=>w.plantWorld.world.bodies.find(b=>b.id===id);
const plc=(w:WorldState)=>renderSnapshot(w).plcs[PLC];
function checked(w:WorldState):WorldState{
 const world=w.plantWorld.world,ids=world.bodies.map(b=>b.id);
 if(w.lastError||!conserved(world)||new Set(ids).size!==ids.length)
  throw new Error('P22 original physics, controller or material conservation failed: '+w.lastError);
 return w;
}
const scan=(w:WorldState,n=1):WorldState=>{
 for(let i=0;i<n;i++)w=checked(tick(w).world);
 return w;
};
const operate=(w:WorldState,id:string,pressed:boolean):WorldState=>
 checked(tick(w,[{k:'operate',id,pressed}]).world);
function one(p:ProjectFile,seed:number):P22Lot{
 const before=projectSignature(p);
 const cases:P22Case[]=[];
 const check=(id:string,pass:boolean,detail:string)=>{
  cases.push({id,pass,detail});return pass;
 };
 const base={seed,pass:false,produced:0,initialZoneCount:0,
  zoneFullBeforeTrip:false,plcSensedFull:false,thirdFeedInhibited:false,
  pairTripped:false,leaderCleared:false,postClearanceCount:-1,
  resetFromPlc:false,followerRecovered:false,thirdFedAfterRestart:false,
  originalIds:[] as string[],materials:[] as string[],cases,diagnostic:''};
 try{
  let w=checked(tick(createWorld(),[{k:'loadProject',project:privateProject(p)}]).world);
  w={...w,plantWorld:{...w.plantWorld,world:{...w.plantWorld.world,rngState:seed}}};
  w=checked(tick(w,[{k:'run'}]).world);
  w=scan(w,8);
  const idle=plc(w)?.powered===true&&w.plantWorld.world.spawnedCount===0&&
   Array.from({length:5},(_,i)=>plc(w)?.outputs['Q0.'+i]===false).every(Boolean);
  if(!check('safe-original-idle',idle,
   'Powered PLC is idle without any feeder, belt, gate, pusher or reset output'))
   return {...base,diagnostic:'Unsafe original idle'};
  w=operate(w,START,true);w=scan(w,2);w=operate(w,START,false);
  // Observe occupancy before P21's sustained body-to-body dwell completes:
  // a controller using only accumulationTripped, rather than the genuine
  // zone-full input, will feed an unauthorized third carton here.
  let fullBeforeTrip=false,plcFull=false;
  for(let k=0;k<LIMIT;k++){
   w=scan(w);
   if(w.plantWorld.world.spawnedCount>2)break;
   if(w.plantWorld.world.spawnedCount===2&&count(w)===2&&
    signal(w,'belt','zoneFull')&&!signal(w,'belt','accumulationTripped')){
    fullBeforeTrip=true;
    plcFull=plc(w)?.io.inputs.some(i=>i.terminal==='I0.5'&&i.on)===true;
    break;
   }
  }
  const initialZoneCount=count(w);
  if(!check('pre-trip-physical-zone',fullBeforeTrip&&plcFull,
   'Two genuinely feeder-created bodies occupied the 600×150 mm belt before a dwell trip; actual OUT_zoneFull powered PLC I0.5'))
   return {...base,produced:w.plantWorld.world.spawnedCount,initialZoneCount,
    zoneFullBeforeTrip:fullBeforeTrip,plcSensedFull:plcFull,
    diagnostic:'No real pre-trip zone-full signal reached PLC'};
  // Instructor presses only a real temporary 24V REQUEST input. The
  // learner's Q0.0 MUST stay off. No instructor output forcing is permitted.
  w=operate(w,REQUEST,true);
  let dangerousCoil=plc(w)?.outputs['Q0.0']===true;
  for(let i=0;i<2;i++){w=scan(w);dangerousCoil ||= plc(w)?.outputs['Q0.0']===true;}
  const inhibited=!dangerousCoil&&w.plantWorld.world.spawnedCount===2;
  check('early-third-feed-inhibited',inhibited,
   'Powered next-carton request during true full occupancy did not energize Q0.0 or create b3, even BEFORE the queue dwell trips');
  w=operate(w,REQUEST,false);
  let tripped=false;
  for(let k=0;k<LIMIT;k++){
   w=scan(w);
   if(w.plantWorld.world.spawnedCount!==2)break;
   const model=w.plantWorld.world.model.belt;
   if(model?.accumulationBodyId==='b2'&&model.accumulationBlockingBodyId==='b1'&&
    body(w,'b2')?.tags.jammedByBody==='b1'&&
    signal(w,'belt','accumulationTripped')&&!signal(w,'belt','moving')){
    tripped=true;break;
   }
  }
  check('real-queue-trip',tripped,
   'Same genuine b2 collided with b1 continuously; P21 latched the belt rather than inventing a trip');
  if(!tripped)return {...base,produced:w.plantWorld.world.spawnedCount,
   initialZoneCount,zoneFullBeforeTrip:fullBeforeTrip,plcSensedFull:plcFull,
   thirdFeedInhibited:inhibited,diagnostic:'Real original pair did not trip'};
  let cleared=false;
  for(let k=0;k<130;k++){
   w=scan(w);
   const b1=body(w,'b1');
   if(b1&&b1.supportedBy!=='belt'&&b1.pos.y>75&&
    signal(w,'stopper','retracted')&&signal(w,'pusher','extended')){
    cleared=true;break;
   }
  }
  const after=count(w);
  check('physical-clearance-zone-decrements',cleared&&after===1&&!signal(w,'belt','zoneFull')&&
   signal(w,'belt','accumulationTripped'),
   'Actual Q-driven pusher displaced conserved leader b1; zoneCount fell 2→1 while the original queue latch stayed set');
  const position=body(w,'b2')?.pos.x??NaN;
  w=scan(w,8);
  const latchRemains=signal(w,'belt','accumulationTripped')&&
   !signal(w,'belt','moving')&&Math.abs((body(w,'b2')?.pos.x??NaN)-position)<5;
  check('post-clearance-reset-required',latchRemains,
   'Reduced zone occupancy alone does not bypass genuine fresh PLC reset requirement');
  w=operate(w,ACK,true);
  let reset=plc(w)?.outputs['Q0.3']===true;
  for(let i=0;i<3;i++){w=scan(w);reset ||= plc(w)?.outputs['Q0.3']===true;}
  w=operate(w,ACK,false);
  w=scan(w,8);
  const restarted=reset&&signal(w,'belt','moving')&&
   !signal(w,'belt','accumulationTripped')&&
   (body(w,'b2')?.pos.x??-Infinity)>position+2;
  check('fresh-24v-reset',restarted,
   'Only powered Q0.3 reset after actual original b1 clearance resumed the same b2');
  for(let k=0;k<180&&(body(w,'b2')?.pos.x??-Infinity)<=330;k++)w=scan(w);
  const followerReceived=!!body(w,'b2')&&
   (body(w,'b2')?.pos.x??-Infinity)>330&&w.plantWorld.world.spawnedCount===2;
  check('original-follower-received',followerReceived,
   'Conserved original b2 crossed beyond the actual stopper before next feeder request');
  w=operate(w,REQUEST,true);
  let thirdCoil=plc(w)?.outputs['Q0.0']===true;
  for(let k=0;k<3;k++){w=scan(w);thirdCoil ||= plc(w)?.outputs['Q0.0']===true;}
  w=operate(w,REQUEST,false);
  const final=w.plantWorld.world,b3=body(w,'b3');
  const third=thirdCoil&&final.spawnedCount===3&&final.despawnedCount===0&&
   final.bodies.length===3&&!!b3&&b3.tags.origin==='feeder'&&conserved(final);
  check('fresh-third-after-release',third,
   'New genuine powered PLC Q0.0 feed edge created original b3 only after b2 recovered; b1/b2 remain conserved');
  const originalIds=final.bodies.map(b=>b.id);
  const materials=final.bodies.map(b=>String(b.tags.material??''));
  const pass=cases.every(c=>c.pass)&&projectSignature(p)===before&&
   originalIds.join(',')==='b1,b2,b3'&&materials.every(Boolean);
  return {...base,pass,produced:final.spawnedCount,initialZoneCount,
   zoneFullBeforeTrip:fullBeforeTrip,plcSensedFull:plcFull,
   thirdFeedInhibited:inhibited,pairTripped:tripped,leaderCleared:cleared,
   postClearanceCount:after,resetFromPlc:reset,
   followerRecovered:followerReceived,thirdFedAfterRestart:third,
   originalIds,materials,
   diagnostic:pass?'Original three-body PLC zone-control sequence passed':
    'One or more original physical occupancy, early feeder inhibit, post-reset source feeding or conservation checks failed'};
 }catch(error){
  return {...base,diagnostic:'P22 real worker trial aborted: '+
   (error instanceof Error?error.message:String(error))};
 }
}
export function runP22ZoneCampaign(p:ProjectFile,sceneId:string):P22Campaign{
 const sourceSignature=projectSignature(p);
 const base={sceneId,sourceSignature,lots:[] as P22Lot[],
  deterministicReplay:false,totalOriginals:0};
 const blockers=p22ZonePreflight(p,sceneId);
 if(blockers.length)return {...base,status:'blocked',diagnostic:blockers.join('; ')};
 const lots=[1,42,65535,42].map(seed=>one(p,seed));
 const deterministicReplay=JSON.stringify(lots[1])===JSON.stringify(lots[3]);
 const totalOriginals=lots.slice(0,3).reduce((n,l)=>n+l.produced,0);
 const materials=new Set(lots.slice(0,3).flatMap(l=>l.materials));
 const passed=lots.every(l=>l.pass)&&deterministicReplay&&totalOriginals===9&&
  materials.has('metal')&&materials.has('cardboard')&&
  projectSignature(p)===sourceSignature;
 return {...base,status:passed?'passed':'failed',lots,
  deterministicReplay,totalOriginals,
  diagnostic:passed?
   'Three independently seeded genuine three-carton lots: actual belt-zone fullness reached the PLC before jam, the learner inhibited an early third feed, physically recovered b1/b2 and produced b3 only after reset. Exact replay passed. Educational model only.':
   'Real zone-full signal, pre-trip feeder inhibition, physical clearance, PLC reset, independent lots or deterministic replay failed'};
}
