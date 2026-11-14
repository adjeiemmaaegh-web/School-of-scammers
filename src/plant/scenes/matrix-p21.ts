/**
 * P21 real body-to-body accumulation assessment. Exactly two genuine Q0.0
 * feeder pulses place original b1 and b2 on the source belt. A real extended
 * gate blocks leader b1; body b2 then COLLIDES WITH b1 for the PLC-configured
 * dwell before its own conveyor trips. The learner's PLC must deenergize the
 * gate, extend a REAL motor/air-powered pusher to move b1 out of the source
 * lane, then accept a new 24V maintenance acknowledgement and pulse Q0.3.
 *
 * All worlds are private, offline, source-preserving, timer-free and owned
 * by the same genuine worker physics / electrical solver as the learner lab.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {projectSignature} from './commissioning';

const SCENE='gate-accumulation',PLC='scene-plc',SUPPLY='scene-supply',
 START='p21-start',ACK='p21-maintenance',LIMIT=480;
export type P21Lot={
 seed:number;status:'passed'|'failed'|'blocked';pass:boolean;
 originals:number;diverted:number;received:number;
 leaderId:string|null;queuedBodyId:string|null;
 leaderMaterial:string;queuedMaterial:string;
 contactDwellMs:number;contactXmm:number|null;receivedXmm:number|null;
 genuinePair:boolean;stoppedUnderLoad:boolean;gateRetracted:boolean;
 leaderPhysicallyDiverted:boolean;stopHeldAfterClearance:boolean;
 resetFromPlc:boolean;sameQueuedBodyRecovered:boolean;
 cases:readonly {id:string;pass:boolean;detail:string}[];diagnostic:string;
};
export type P21Campaign={
 sceneId:string;sourceSignature:string;status:'passed'|'failed'|'blocked';
 lots:readonly P21Lot[];deterministicReplay:boolean;
 originalBodies:number;receivedBodies:number;divertedBodies:number;
 diagnostic:string;
};
const wired=(p:ProjectFile,a:string,b:string):boolean=>
 p.wires.some(w=>(w.from===a&&w.to===b)||(w.from===b&&w.to===a));
export function p21AccumulationPreflight(p:ProjectFile,sceneId:string):string[]{
 if(sceneId!==SCENE)return ['P21 needs the original gate-accumulation factory scene'];
 const problems:string[]=[];
 const parts:ReadonlyArray<[string,string]>=[
  [SUPPLY,'supply'],[PLC,'plc16'],['feeder','box-feeder'],
  ['belt','belt-conveyor'],['stopper','stopper'],['pusher','pusher']];
 for(const [id,kind] of parts)if(p.components.find(c=>c.id===id)?.kind!==kind)
  problems.push('Provide original powered '+kind+' device named '+id);
 if(p.components.filter(c=>c.kind==='plc'||c.kind==='plc16').length!==1)
  problems.push('P21 is scoped to one real original 16/16 PLC, not multiple controllers');
 if(p.params?.belt?.accumulationTripMode!==1)
  problems.push('Set belt accumulationTripMode=1 to enable physical queued-carton trip');
 if(p.params?.belt?.jamResetMode!==1||p.params?.belt?.obstructionTripMode===1)
  problems.push('Enable jamResetMode=1 and leave obstructionTripMode=0 (body-to-body accumulation, not P20 gate trip)');
 if((p.params?.belt?.widthMm??300)!==150||
   (p.params?.belt?.lengthMm??600)!==600)
  problems.push('Set original belt physical lengthMm=600 and widthMm=150 for this isolated two-carton lane');
 if(p.params?.belt?.accumulationDwellMs!==200)
  problems.push('Set accumulationDwellMs=200 to distinguish brief contacts from sustained queue');
 const placement=(id:string)=>p.components.find(c=>c.id===id);
 for(const [id,x] of [['feeder',430],['belt',455],['stopper',481],['pusher',479]] as const){
  const c=placement(id);
  if(!c||c.x!==x||c.y!==225)
   problems.push('Place '+id+' at training coordinates x='+x+', y=225 on the original lane');
 }
 if((p.params?.pusher?.speedMmS??220)!==250||
   (p.params?.pusher?.strokeMm??260)!==260||
  (p.params?.pusher?.maxMassKg??20)<8)
  problems.push('Configure real pusher speedMmS=250 and strokeMm=260 with at least 8 kg capacity');
 const links:ReadonlyArray<[string,string]>=[
  [SUPPLY+'.P24',PLC+'.L+'],[SUPPLY+'.M0',PLC+'.M'],
  [PLC+'.Q0.0','feeder.CMD_feed+'],[SUPPLY+'.M0','feeder.M-'],
  [PLC+'.Q0.1','belt.CMD_run+'],[SUPPLY+'.M0','belt.M-'],
  [PLC+'.Q0.2','stopper.CMD_extend+'],[SUPPLY+'.M0','stopper.M-'],
  [PLC+'.Q0.3','belt.CMD_resetJam+'],
  [PLC+'.Q0.4','pusher.CMD_extend+'],[SUPPLY+'.M0','pusher.M-'],
  [SUPPLY+'.P24','belt.L+'],[SUPPLY+'.M0','belt.M'],
  [SUPPLY+'.P24','stopper.L+'],[SUPPLY+'.M0','stopper.M'],
  [SUPPLY+'.P24','pusher.L+'],[SUPPLY+'.M0','pusher.M'],
  ['belt.OUT_accumulationTripped',PLC+'.I0.1'],
  ['stopper.OUT_retracted',PLC+'.I0.2'],
  ['pusher.OUT_extended',PLC+'.I0.3'],
 ];
 for(const [a,b] of links)if(!wired(p,a,b))
  problems.push('Connect physical powered terminal '+a+' to '+b);
 for(let i=0;i<5;i++){
  const q=PLC+'.Q0.'+i;
  if(p.wires.filter(w=>w.from===q||w.to===q).length!==1)
   problems.push('PLC '+q+' must drive exactly one actual electrical actuator');
 }
 for(const i of ['I0.0','I0.4']){
  const pin=PLC+'.'+i;
  if(p.wires.some(w=>w.from===pin||w.to===pin))
   problems.push('Reserve '+pin+' for the temporary powered operator switch');
 }
 if(p.components.some(c=>c.id===START||c.id===ACK))
  problems.push('P21 private operator ID already exists in learner project');
 if((p.faults??[]).length||Object.keys(p.plantFaults??{}).length)
  problems.push('Remove pre-existing electrical/equipment faults for this isolated contact trial');
 return [...new Set(problems)];
}
function privateProject(p:ProjectFile):ProjectFile{
 const wires:Wire[]=[...p.wires,
  {id:'p21-start-power',from:SUPPLY+'.P24',to:START+'.A'},
  {id:'p21-start-plc',from:START+'.B',to:PLC+'.I0.0'},
  {id:'p21-ack-power',from:SUPPLY+'.P24',to:ACK+'.A'},
  {id:'p21-ack-plc',from:ACK+'.B',to:PLC+'.I0.4'}];
 return {...p,components:[...p.components,
  {id:START,kind:'start',x:870,y:383,pressed:false},
  {id:ACK,kind:'start',x:870,y:426,pressed:false}],wires};
}
const body=(w:WorldState,id:string)=>w.plantWorld.world.bodies.find(b=>b.id===id);
const signal=(w:WorldState,id:string,key:string)=>w.plantWorld.signals[id]?.[key]===true;
const plc=(w:WorldState)=>renderSnapshot(w).plcs[PLC];
function checked(w:WorldState):WorldState{
 const v=w.plantWorld.world,ids=v.bodies.map(b=>b.id);
 if(w.lastError||!conserved(v)||new Set(ids).size!==ids.length)
  throw new Error('Worker/electrical or original carton conservation failure: '+w.lastError);
 return w;
}
function scan(w:WorldState,n=1):WorldState{
 for(let i=0;i<n;i++)w=checked(tick(w).world);
 return w;
}
function one(p:ProjectFile,seed:number):P21Lot{
 const source=projectSignature(p);
 const base={seed,originals:0,diverted:0,received:0,
  leaderId:null as string|null,queuedBodyId:null as string|null,
  leaderMaterial:'',queuedMaterial:'',contactDwellMs:0,
  contactXmm:null as number|null,receivedXmm:null as number|null,
  genuinePair:false,stoppedUnderLoad:false,gateRetracted:false,
  leaderPhysicallyDiverted:false,stopHeldAfterClearance:false,
  resetFromPlc:false,sameQueuedBodyRecovered:false,
  cases:[] as {id:string;pass:boolean;detail:string}[]};
 try{
  let w=checked(tick(createWorld(),[{k:'loadProject',project:privateProject(p)}]).world);
  if(w.plantWorld.world.spawnedCount||w.plantWorld.world.bodies.length)
   throw new Error('P21 cannot seed a populated factory');
  w={...w,plantWorld:{...w.plantWorld,world:{
   ...w.plantWorld.world,rngState:seed}}};
  w=checked(tick(w,[{k:'run'}]).world);
  w=scan(w,8);
  const safeIdle=plc(w)?.powered===true&&w.plantWorld.world.spawnedCount===0&&
   Array.from({length:5},(_,i)=>plc(w)?.outputs['Q0.'+i]===false).every(Boolean);
  const cases=[{id:'safe-24v-idle',pass:safeIdle,
   detail:'Original PLC powered but all five feeder, belt, gate, pusher and reset coils OFF until Start'}];
  if(!safeIdle)return {...base,status:'failed',pass:false,cases,
   diagnostic:'P21 refuses a controller that is already driving the plant before Start'};
  w=checked(tick(w,[{k:'operate',id:START,pressed:true}]).world);
  w=scan(w,2);
  w=checked(tick(w,[{k:'operate',id:START,pressed:false}]).world);
  let seen=false,contactX:number|null=null,contactDwellMs=0;
  for(let k=0;k<LIMIT;k++){
   w=scan(w);
   const v=w.plantWorld.world;
   if(v.spawnedCount>2)break;
   const belt=v.model.belt;
   const tail=body(w,'b2'),lead=body(w,'b1');
   if(tail&&lead&&v.spawnedCount===2&&
    belt?.accumulationBodyId==='b2'&&
    belt?.accumulationBlockingBodyId==='b1'&&
    tail.tags.jammedByBody==='b1'&&
    tail.supportedBy==='belt'&&lead.supportedBy==='belt'&&
    signal(w,'belt','accumulationTripped')&&
    !signal(w,'belt','moving')&&
    !signal(w,'belt','obstructionTripped')){
    seen=true;contactX=tail.pos.x;
    contactDwellMs=typeof belt.accumulationContactMs==='number'?
     belt.accumulationContactMs:0;
    break;
   }
  }
  const actualPair=seen&&contactDwellMs>=200&&
   body(w,'b1')?.tags.jammedByGate==='stopper'&&
   w.plantWorld.world.spawnedCount===2&&
   w.plantWorld.world.despawnedCount===0;
  cases.push({id:'physical-pair-dwell',pass:actualPair,
   detail:'Only real b2-to-b1 continuous physical collision for >=200ms trips the original source conveyor; b1 is genuinely blocked at the stopper'});
  if(!actualPair)return {...base,status:'failed',pass:false,cases,
   originals:w.plantWorld.world.spawnedCount,contactXmm:contactX,
   contactDwellMs,diagnostic:'No original body-to-body dwell trip or real PLC program did not produce two correctly spaced cartons'};
  const x=body(w,'b2')!.pos.x;
  // Intentionally premature operator acknowledgement while the leading
  // original carton remains on the belt must not energize resetJam.
  w=checked(tick(w,[{k:'operate',id:ACK,pressed:true}]).world);
  // The PLC may issue a forbidden one-scan Q on the SAME scan the powered
  // button is pressed. Observe that exact scan, not only later snapshots;
  // otherwise a malicious/transient early reset can evade the assessor.
  let earlyCoil=plc(w)?.outputs['Q0.3']===true;
  for(let k=0;k<3;k++){
   w=scan(w);
   earlyCoil=earlyCoil||plc(w)?.outputs['Q0.3']===true;
  }
  w=checked(tick(w,[{k:'operate',id:ACK,pressed:false}]).world);
  const held=signal(w,'belt','accumulationTripped')&&
   !signal(w,'belt','moving')&&
   Math.abs((body(w,'b2')?.pos.x??NaN)-x)<5;
  cases.push({id:'early-reset-blocked',pass:held&&!earlyCoil,
   detail:'Premature 24V operator acknowledgement cannot energize Q0.3 or move original b2 while b1 still obstructs the lane'});
  let cleared=false,leaderOutside=false;
  for(let k=0;k<95;k++){
   w=scan(w);
   const b1=body(w,'b1');
   const retracted=signal(w,'stopper','retracted')&&
    w.plantWorld.world.model.stopper?.engaged===false;
   const pusherReached=signal(w,'pusher','extended');
   const offLane=!!b1&&b1.supportedBy!=='belt'&&b1.pos.y>75;
   if(retracted&&pusherReached&&offLane){cleared=true;leaderOutside=true;break;}
  }
  cases.push({id:'genuine-physical-clearance',pass:cleared&&leaderOutside,
   detail:'Learner PLC dropped gate Q0.2, extended real pusher Q0.4 and physically displaced original leading b1 off the 150mm lane; no body was deleted'});
  const before=body(w,'b2')?.pos.x??NaN;
  let stillStopped=cleared&&signal(w,'belt','accumulationTripped');
  for(let k=0;k<12;k++){
   w=scan(w);
   stillStopped=stillStopped&&
    signal(w,'belt','accumulationTripped')&&
    !signal(w,'belt','moving')&&
    Math.abs((body(w,'b2')?.pos.x??NaN)-before)<5&&
    plc(w)?.outputs['Q0.3']===false;
  }
  cases.push({id:'clearance-not-reset',pass:stillStopped,
   detail:'Removing b1 from the source lane and retracting gate does NOT auto-release b2; the original machine stays latched through twelve further PLC scans'});
  const preAckPhase=plc(w)?.tagValues.Phase;
  w=checked(tick(w,[{k:'operate',id:ACK,pressed:true}]).world);
  let realReset=plc(w)?.outputs['Q0.3']===true;
  let ackInputSeen=plc(w)?.io.inputs.some(i=>i.terminal==='I0.4'&&i.on)===true;
  let duringAckPhase=plc(w)?.tagValues.Phase;
  for(let k=0;k<4;k++){
   w=scan(w);
   realReset=realReset||plc(w)?.outputs['Q0.3']===true;
   ackInputSeen=ackInputSeen||plc(w)?.io.inputs.some(i=>i.terminal==='I0.4'&&i.on)===true;
   duringAckPhase=plc(w)?.tagValues.Phase;
  }
  w=checked(tick(w,[{k:'operate',id:ACK,pressed:false}]).world);
  w=scan(w,8);
  const restarted=realReset&&!signal(w,'belt','accumulationTripped')&&
   signal(w,'belt','moving')&&
   (body(w,'b2')?.pos.x??NaN)>before+2;
  cases.push({id:'new-powered-reset',pass:restarted,
   detail:'A NEW operator 24V acknowledgement drove the actual learner PLC Q0.3 output AFTER physical clearance, and original b2 resumed movement'});
  for(let k=0;k<170;k++){
   if((body(w,'b2')?.pos.x??-Infinity)>330)break;
   w=scan(w);
  }
  const v=w.plantWorld.world,b1=body(w,'b1'),b2=body(w,'b2');
  const finalX=b2?.pos.x??null;
  const recovered=restarted&&!!b1&&!!b2&&
   finalX!==null&&finalX>330&&b1.supportedBy!=='belt'&&
   b1.pos.y>75&&v.spawnedCount===2&&v.despawnedCount===0&&
   v.bodies.length===2&&new Set(v.bodies.map(b=>b.id)).size===2&&
   !b2.tags.jammed&&conserved(v)&&projectSignature(p)===source;
  cases.push({id:'two-originals-conserved',pass:recovered,
   detail:'Exactly original b1 is diverted by actual pusher and b2 is received beyond gate; neither body was manufactured, deleted, replaced or bypassed'});
  const passed=cases.every(x=>x.pass);
  return {...base,status:passed?'passed':'failed',pass:passed,
   originals:v.spawnedCount,diverted:b1?.pos.y&&b1.pos.y>75?1:0,
   received:recovered?1:0,leaderId:b1?.id??null,queuedBodyId:b2?.id??null,
   leaderMaterial:typeof b1?.tags.material==='string'?b1.tags.material:'',
   queuedMaterial:typeof b2?.tags.material==='string'?b2.tags.material:'',
   contactDwellMs,contactXmm:contactX,receivedXmm:finalX,
   genuinePair:actualPair,stoppedUnderLoad:held,
   gateRetracted:signal(w,'stopper','retracted'),
   leaderPhysicallyDiverted:leaderOutside,
   stopHeldAfterClearance:stillStopped,resetFromPlc:realReset,
   sameQueuedBodyRecovered:recovered,cases,
   diagnostic:passed?
    'True pairwise queue load stopped the belt; original b1 was physically diverted and original b2 resumed only after a fresh powered PLC acknowledgement':
    'One or more real collision, PLC release, same-body conservation or acknowledgement gates failed: '+
    JSON.stringify({preAckPhase,duringAckPhase,ackInputSeen,realReset,
     belt:w.plantWorld.world.model.belt,
     leaderSupport:b1?.supportedBy,leaderY:b1?.pos.y,
     followerSupport:b2?.supportedBy,followerX:b2?.pos.x})};
 }catch(error){
  return {...base,status:'failed',pass:false,
   diagnostic:'P21 original pairwise physical trial aborted without a pass: '+
    (error instanceof Error?error.message:String(error))};
 }
}
export function runP21Accumulation(p:ProjectFile,sceneId:string):P21Campaign{
 const sourceSignature=projectSignature(p);
 const base={sceneId,sourceSignature,lots:[] as P21Lot[],
  deterministicReplay:false,originalBodies:0,receivedBodies:0,divertedBodies:0};
 const blockers=p21AccumulationPreflight(p,sceneId);
 if(blockers.length)return {...base,status:'blocked',diagnostic:blockers.join('; ')};
 const lots=[1,42,65535,42].map(seed=>one(p,seed));
 const deterministicReplay=JSON.stringify(lots[1])===JSON.stringify(lots[3]);
 const originalBodies=lots.slice(0,3).reduce((n,l)=>n+l.originals,0);
 const receivedBodies=lots.slice(0,3).reduce((n,l)=>n+l.received,0);
 const divertedBodies=lots.slice(0,3).reduce((n,l)=>n+l.diverted,0);
 const materials=new Set(lots.slice(0,3).flatMap(l=>[l.leaderMaterial,l.queuedMaterial]));
 const pass=lots.every(l=>l.pass)&&deterministicReplay&&
  originalBodies===6&&receivedBodies===3&&divertedBodies===3&&
  materials.has('cardboard')&&materials.has('metal')&&
  projectSignature(p)===sourceSignature;
 return {...base,status:pass?'passed':'failed',lots,
  deterministicReplay,originalBodies,receivedBodies,divertedBodies,
  diagnostic:pass?
   'Three independently seeded two-carton original physical queues tripped after real body-to-body dwell, then required genuine gate/pusher clearance and powered PLC reset with exact replay. Educational model only.':
   'Physical queue contact, genuine original body diversion, PLC clearing, production conservation, material diversity or independent replay failed'};
}
