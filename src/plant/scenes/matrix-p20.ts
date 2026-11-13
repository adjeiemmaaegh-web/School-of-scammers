/**
 * P20 authentic original-body gate-obstruction commissioning.
 * A real powered feeder creates one carton. A real PLC extends an actual
 * stopper in front of a real moving belt, causing the PHYSICS ENGINE to
 * register the specific body's obstruction. No synthetic fault/body, no
 * teacher-coil override, no AI grader shortcut or persistent score.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {projectSignature} from './commissioning';

const SCENE='gate-accumulation',PLC='scene-plc',SUPPLY='scene-supply',
 START='p20-start',ACK='p20-ack',LIMIT=280;
export type P20ObstructionLot={
 seed:number;status:'passed'|'failed'|'blocked';pass:boolean;
 bodyId:string|null;material:string;produced:number;received:number;
 contactXmm:number|null;finalXmm:number|null;
 sensedOriginalGate:boolean;stoppedWhileBlocked:boolean;
 actualGateRetracted:boolean;stayedStoppedAfterClearance:boolean;
 plcResetEdge:boolean;recoveredSameBody:boolean;
 cases:readonly {id:string;pass:boolean;detail:string}[];
 diagnostic:string;
};
export type P20ObstructionResult={
 sceneId:string;sourceSignature:string;status:'passed'|'failed'|'blocked';
 lots:readonly P20ObstructionLot[];deterministicReplay:boolean;
 originalProducts:number;recoveredProducts:number;
 diagnostic:string;
};
const wired=(p:ProjectFile,a:string,b:string):boolean=>
 p.wires.some(w=>(w.from===a&&w.to===b)||(w.from===b&&w.to===a));
export function p20ObstructionPreflight(p:ProjectFile,sceneId:string):string[]{
 if(sceneId!==SCENE)return [
  'P20 physical obstruction requires the original gate-accumulation scene'];
 const errors:string[]=[];
 const devices:ReadonlyArray<[string,string]>=[
  [PLC,'plc16'],[SUPPLY,'supply'],['feeder','box-feeder'],
  ['belt','belt-conveyor'],['stopper','stopper']];
 for(const [id,kind] of devices){
  if(p.components.find(c=>c.id===id)?.kind!==kind)
   errors.push('Missing original '+kind+' named '+id);
 }
 if(p.components.filter(c=>c.kind==='plc'||c.kind==='plc16').length!==1)
  errors.push('P20 accepts the original single 16/16 PLC only');
 if(p.params?.belt?.obstructionTripMode!==1)
  errors.push('Enable physical belt obstructionTripMode=1');
 if(p.params?.belt?.jamResetMode!==1)
  errors.push('Enable physical belt jamResetMode=1 for post-gate PLC acknowledgement');
 const feeder=p.components.find(c=>c.id==='feeder');
 const belt=p.components.find(c=>c.id==='belt');
 const gate=p.components.find(c=>c.id==='stopper');
 if(feeder&&belt&&(feeder.x>=belt.x-10||feeder.x<belt.x-28||
  Math.abs(feeder.y-belt.y)>4))
  errors.push('Place original feeder 10–28 editor units before the belt center on the same transport lane');
 if(gate&&belt&&(gate.x<=belt.x+16||gate.x>belt.x+29||
  Math.abs(gate.y-belt.y)>4))
  errors.push('Keep the genuine stopper 16–29 editor units beyond the belt center');
 const links:ReadonlyArray<[string,string]>=[
  [SUPPLY+'.P24',PLC+'.L+'],[SUPPLY+'.M0',PLC+'.M'],
  [PLC+'.Q0.0','feeder.CMD_feed+'],[SUPPLY+'.M0','feeder.M-'],
  [PLC+'.Q0.1','belt.CMD_run+'],[SUPPLY+'.M0','belt.M-'],
  [PLC+'.Q0.2','stopper.CMD_extend+'],[SUPPLY+'.M0','stopper.M-'],
  [PLC+'.Q0.3','belt.CMD_resetJam+'],
  [SUPPLY+'.P24','belt.L+'],[SUPPLY+'.M0','belt.M'],
  [SUPPLY+'.P24','stopper.L+'],[SUPPLY+'.M0','stopper.M'],
  ['belt.OUT_obstructionTripped',PLC+'.I0.1'],
  ['stopper.OUT_retracted',PLC+'.I0.2'],
 ];
 for(const [from,to] of links)if(!wired(p,from,to))
  errors.push('Connect true 24 V terminal '+from+' → '+to);
 for(let n=0;n<4;n++){
  const terminal=PLC+'.Q0.'+n;
  if(p.wires.filter(w=>w.from===terminal||w.to===terminal).length!==1)
   errors.push('PLC '+terminal+' must drive exactly one genuine machine load');
 }
 if(p.wires.some(w=>w.from===PLC+'.I0.0'||w.to===PLC+'.I0.0'||
  w.from===PLC+'.I0.3'||w.to===PLC+'.I0.3'))
  errors.push('Reserve PLC I0.0 and I0.3 for temporary powered test buttons');
 if(p.components.some(c=>c.id===START||c.id===ACK))
  errors.push('P20 temporary button identifier is already used');
 if((p.faults??[]).length||Object.keys(p.plantFaults??{}).length)
  errors.push('Clear other equipment/electrical faults before the P20 isolated test');
 return [...new Set(errors)];
}
function privateProject(p:ProjectFile):ProjectFile{
 const wires:Wire[]=[...p.wires,
  {id:'p20-start-supply',from:SUPPLY+'.P24',to:START+'.A'},
  {id:'p20-start-plc',from:START+'.B',to:PLC+'.I0.0'},
  {id:'p20-maint-supply',from:SUPPLY+'.P24',to:ACK+'.A'},
  {id:'p20-maint-plc',from:ACK+'.B',to:PLC+'.I0.3'}];
 return {...p,components:[...p.components,
  {id:START,kind:'start',x:870,y:390,pressed:false},
  {id:ACK,kind:'start',x:870,y:435,pressed:false}],wires};
}
const body=(w:WorldState,id:string)=>w.plantWorld.world.bodies.find(b=>b.id===id);
const signal=(w:WorldState,id:string,channel:string)=>w.plantWorld.signals[id]?.[channel]===true;
const plc=(w:WorldState)=>renderSnapshot(w).plcs[PLC];
function checked(w:WorldState):WorldState{
 const v=w.plantWorld.world,ids=v.bodies.map(x=>x.id);
 if(w.lastError||!conserved(v)||new Set(ids).size!==ids.length)
  throw new Error('P20 genuine worker/PLC fault or physical conservation failure: '+w.lastError);
 return w;
}
const scan=(w:WorldState,n=1):WorldState=>{
 for(let i=0;i<n;i++)w=checked(tick(w).world);
 return w;
};
function one(p:ProjectFile,seed:number):P20ObstructionLot{
 const before=projectSignature(p);
 const base={seed,bodyId:null as string|null,material:'',produced:0,received:0,
  contactXmm:null as number|null,finalXmm:null as number|null,
  sensedOriginalGate:false,stoppedWhileBlocked:false,
  actualGateRetracted:false,stayedStoppedAfterClearance:false,
  plcResetEdge:false,recoveredSameBody:false,
  cases:[] as {id:string;pass:boolean;detail:string}[]};
 try{
  let w=checked(tick(createWorld(),[{k:'loadProject',project:privateProject(p)}]).world);
  if(w.plantWorld.world.spawnedCount||w.plantWorld.world.bodies.length)
   throw new Error('P20 refuses to inject a seed into a nonempty material lot');
  w={...w,plantWorld:{...w.plantWorld,world:{
   ...w.plantWorld.world,rngState:seed}}};
  w=checked(tick(w,[{k:'run'}]).world);
  w=scan(w,8);
  const startSafe=plc(w)?.powered===true&&w.plantWorld.world.spawnedCount===0&&
   Array.from({length:4},(_,i)=>plc(w)?.outputs['Q0.'+i]===false).every(Boolean);
  const cases=[{id:'powered-safe-idle',pass:startSafe,
   detail:'All actual PLC production and reset coils OFF before powered Start'}];
  if(!startSafe)return {...base,status:'failed',pass:false,cases,
   diagnostic:'Unsafe idle in original PLC source'};
  w=checked(tick(w,[{k:'operate',id:START,pressed:true}]).world);
  w=scan(w,2);
  w=checked(tick(w,[{k:'operate',id:START,pressed:false}]).world);
  let actualContact=false,firstContactX:number|null=null;
  for(let k=0;k<LIMIT;k++){
   w=scan(w);
   const current=w.plantWorld.world;
   const b=body(w,'b1'),machine=current.model.belt;
   if(current.spawnedCount>1)break;
   if(b&&machine?.obstructionBodyId==='b1'&&
      machine.obstructionGateId==='stopper'&&
      b.tags.jammedByGate==='stopper'&&
      signal(w,'belt','obstructionTripped')&&
      !signal(w,'belt','moving')&&
      w.plantWorld.world.model.stopper?.engaged){
    actualContact=true;firstContactX=b.pos.x;
    break;
   }
  }
  const contactBody=body(w,'b1'),rawPhysicalContact=
   actualContact&&!!contactBody&&contactBody.supportedBy==='belt'&&
   w.plantWorld.world.spawnedCount===1;
  cases.push({id:'actual-gate-contact',pass:rawPhysicalContact,
   detail:'Original body b1 collided with truly extended powered stopper; the worker latched the source belt and published actual obstruction feedback'});
  if(!rawPhysicalContact)return {...base,cases,status:'failed',pass:false,
   produced:w.plantWorld.world.spawnedCount,contactXmm:firstContactX,
   diagnostic:'No real original product/gate mechanical contact witnessed'};
  const originalX=contactBody!.pos.x;
  // An EARLY acknowledgement while the physical gate is extended must
  // NEVER clear the belt, even with a faulty controller output.
  w=checked(tick(w,[{k:'operate',id:ACK,pressed:true}]).world);
  let firstAckCoil=false;
  for(let k=0;k<3;k++){
   w=scan(w);
   if(plc(w)?.outputs['Q0.3']===true)firstAckCoil=true;
  }
  w=checked(tick(w,[{k:'operate',id:ACK,pressed:false}]).world);
  const earlyStopped=signal(w,'belt','obstructionTripped')&&
   !signal(w,'belt','moving')&&
   Math.abs((body(w,'b1')?.pos.x??NaN)-originalX)<5;
  cases.push({id:'early-reset-refusal',pass:earlyStopped&&!firstAckCoil,
   detail:'Early powered acknowledgement neither energizes an unsafe reset output nor moves the original carton while gate remains extended'});
  // The learner PLC must retract the actual stopper when it senses the
  // worker-owned belt obstruction. No assessor Q or machine-state forcing.
  let retracted=false;
  for(let k=0;k<100;k++){
   w=scan(w);
   if(signal(w,'stopper','retracted')){retracted=true;break;}
  }
  const stopperCleared=retracted&&
   w.plantWorld.world.model.stopper?.engaged===false&&
   !signal(w,'stopper','extended');
  cases.push({id:'physical-clearance',pass:stopperCleared,
   detail:'PLC deenergized real stopper coil and waited for genuine retracted sensor'});
  const stalledX=body(w,'b1')?.pos.x??NaN;
  let latched=stopperCleared&&signal(w,'belt','obstructionTripped');
  for(let k=0;k<12;k++){
   w=scan(w);
   latched=latched&&signal(w,'belt','obstructionTripped')&&
    !signal(w,'belt','moving')&&
    Math.abs((body(w,'b1')?.pos.x??NaN)-stalledX)<5;
  }
  cases.push({id:'gate-clearance-not-reset',pass:latched,
   detail:'Releasing the real mechanical gate alone did not restart the tripped conveyor or shift its original workpiece'});
  // Only the learner's PLC, reading actual retraction/obstruction, can
  // issue a new powered reset from this TRUE physical acknowledgement.
  w=checked(tick(w,[{k:'operate',id:ACK,pressed:true}]).world);
  let plcReset=false;
  for(let k=0;k<4;k++){
   w=scan(w);
   if(plc(w)?.outputs['Q0.3']===true)plcReset=true;
  }
  w=checked(tick(w,[{k:'operate',id:ACK,pressed:false}]).world);
  w=scan(w,10);
  const moved=plcReset&&
   !signal(w,'belt','obstructionTripped')&&
   signal(w,'belt','moving')&&
   (body(w,'b1')?.pos.x??NaN)>stalledX+2;
  cases.push({id:'fresh-plc-reset',pass:moved,
   detail:'Fresh post-clearance 24V I0.3 operator pulse drove genuine PLC Q0.3 resetJam and original carton resumed transport'});
  for(let k=0;k<140;k++){
   if((body(w,'b1')?.pos.x??-Infinity)>330)break;
   w=scan(w);
  }
  const finish=body(w,'b1'),finalX=finish?.pos.x??null;
  const recovered=moved&&!!finish&&finalX!==null&&finalX>330&&
   w.plantWorld.world.spawnedCount===1&&
   w.plantWorld.world.despawnedCount===0&&
   w.plantWorld.world.bodies.length===1&&
   !finish.tags.jammed&&
   projectSignature(p)===before&&conserved(w.plantWorld.world);
  cases.push({id:'same-product-and-source',pass:recovered,
   detail:'Same original b1 crosses beyond gate, queue clears, conservation and saved source remain unchanged'});
  const passed=cases.every(x=>x.pass);
  return {...base,seed,bodyId:finish?.id??null,
   material:typeof finish?.tags.material==='string'?finish.tags.material:'',
   status:passed?'passed':'failed',pass:passed,
   produced:w.plantWorld.world.spawnedCount,received:recovered?1:0,
   contactXmm:firstContactX,finalXmm:finalX,
   sensedOriginalGate:rawPhysicalContact,
   stoppedWhileBlocked:earlyStopped,
   actualGateRetracted:stopperCleared,
   stayedStoppedAfterClearance:latched,
   plcResetEdge:plcReset,recoveredSameBody:recovered,cases,
   diagnostic:passed?
    'True original gate collision stopped real belt; PLC retracted gate, held stop through clearance, reset on new 24V acknowledgement and recovered same material':
    'Physical contact, gate release, new PLC reset, body recovery or source integrity did not pass'};
 }catch(error){
  return {...base,status:'failed',pass:false,diagnostic:'P20 real gate/body test aborted: '+
   (error instanceof Error?error.message:String(error))};
 }
}
export function runP20Obstruction(p:ProjectFile,sceneId:string):P20ObstructionResult{
 const sourceSignature=projectSignature(p);
 const base={sceneId,sourceSignature,lots:[] as P20ObstructionLot[],
  deterministicReplay:false,originalProducts:0,recoveredProducts:0};
 const blockers=p20ObstructionPreflight(p,sceneId);
 if(blockers.length)return {...base,status:'blocked',diagnostic:blockers.join('; ')};
 const lots=[1,42,65535,42].map(seed=>one(p,seed));
 const comparable=(l:P20ObstructionLot)=>JSON.stringify(l);
 const deterministicReplay=comparable(lots[1])===comparable(lots[3]);
 const originalProducts=lots.slice(0,3).reduce((n,l)=>n+l.produced,0);
 const recoveredProducts=lots.slice(0,3).reduce((n,l)=>n+l.received,0);
 const pass=lots.every(l=>l.pass)&&deterministicReplay&&
  originalProducts===3&&recoveredProducts===3&&
  projectSignature(p)===sourceSignature&&
  new Set(lots.slice(0,3).map(l=>l.material)).size===2;
 return {...base,lots,deterministicReplay,originalProducts,recoveredProducts,
  status:pass?'passed':'failed',diagnostic:pass?
   'Three genuine feeder-lot material classes suffered an actual gate collision and completed only after real PLC-controlled gate retraction and fresh reset, with exact replay. Educational teaching model.':
   'Physical gate trip, powered PLC clearance, conserved body recovery, material diversity or independent replay failed'};
}
