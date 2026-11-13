/**
 * P24 opt-in ORIGINAL belt occupancy → real 24V PLC full-zone input →
 * learner-controlled feeder inhibit. The source-only audit runs actual
 * feeder-created bodies in the same physics/electrical worker as the sandbox.
 * No phantom cartons, forced output coils or teacher-provided PLC solution.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {projectSignature} from './commissioning';
import {p23HandoffPreflight} from './matrix-p23';

const SCENE='gate-accumulation',PLC='scene-plc',SUPPLY='scene-supply',
 START='p24-start',ACK='p24-maint',REQUEST='p24-more',RELEASE='p24-release',LIMIT=480;
export type P24Case={id:string;pass:boolean;detail:string};
export type P24Lot={
 stopExtended:boolean;prematureReleaseBlocked:boolean;genuineOutfeedContact:boolean;
 stopContactDwellMs:number;plcHeldLoad:boolean;heldCartonStationary:boolean;
 poweredRelease:boolean;stopRetracted:boolean;physicalOutfeedClear:boolean;
 downstreamReceived:boolean;downstreamInputHigh:boolean;
 downstreamPowered:boolean;downstreamInhibited:boolean;
 downstreamCleared:boolean;receiverMotionMm:number;
 seed:number;pass:boolean;produced:number;initialZoneCount:number;
 zoneFullBeforeTrip:boolean;plcSensedFull:boolean;thirdFeedInhibited:boolean;
 pairTripped:boolean;leaderCleared:boolean;postClearanceCount:number;
 resetFromPlc:boolean;followerRecovered:boolean;thirdFedAfterRestart:boolean;
 originalIds:readonly string[];materials:readonly string[];
 cases:readonly P24Case[];diagnostic:string;
};
export type P24Campaign={
 sceneId:string;sourceSignature:string;status:'passed'|'failed'|'blocked';
 lots:readonly P24Lot[];deterministicReplay:boolean;totalOriginals:number;
 diagnostic:string;
};
const wired=(p:ProjectFile,a:string,b:string)=>
 p.wires.some(w=>(w.from===a&&w.to===b)||(w.from===b&&w.to===a));
export function p24HoldPreflight(p:ProjectFile,sceneId:string):string[]{
 const errors=p23HandoffPreflight(p,sceneId);
 if(sceneId!==SCENE)return errors;
 // Additional genuine downstream stopper, with 200ms same-original-body
 // physically sustained contact. Do not infer a hold from a PLC timer.
 const gate=p.components.find(c=>c.id==='outstop');
 if(gate?.kind!=='stopper'||gate.x!==535||gate.y!==225||
    p.components.filter(c=>c.id==='outstop').length!==1)
  errors.push('Place one real downstream stopper outstop at (535,225)');
 const settings=p.params?.outstop;
 if((settings?.travelMs??500)!==100||settings?.holdSensorMode!==1||
    (settings?.holdDwellMs??200)!==200)
  errors.push('Set outstop travelMs=100, holdSensorMode=1 and holdDwellMs=200');
 for(const [a,b] of [
  [PLC+'.Q0.6','outstop.CMD_extend+'],
  [SUPPLY+'.M0','outstop.M-'],
  [SUPPLY+'.P24','outstop.L+'],
  [SUPPLY+'.M0','outstop.M'],
  ['outstop.OUT_extended',PLC+'.I0.9'],
  ['outstop.OUT_retracted',PLC+'.I0.10'],
  ['outstop.OUT_heldLoad',PLC+'.I0.11'],
 ] as const)if(!wired(p,a,b))
  errors.push('Connect genuine powered downstream stopper '+a+' to '+b);
 for(const pin of ['Q0.6','I0.9','I0.10','I0.11']){
  const terminal=PLC+'.'+pin;
  if(p.wires.filter(w=>w.from===terminal||w.to===terminal).length!==1)
   errors.push('PLC '+pin+' must be exclusive to genuine downstream hardware');
 }
 if(p.wires.some(w=>w.from===PLC+'.I0.8'||w.to===PLC+'.I0.8'))
  errors.push('Reserve PLC I0.8 for the private powered release operator');
 if(p.components.some(c=>[START,ACK,REQUEST,RELEASE].includes(c.id)))
  errors.push('Remove conflicting P24 test-only switch IDs');
 return [...new Set(errors)];
}
function privateProject(p:ProjectFile):ProjectFile{
 const wires:Wire[]=[...p.wires,
  {id:'p24-start-power',from:SUPPLY+'.P24',to:START+'.A'},
  {id:'p24-start-in',from:START+'.B',to:PLC+'.I0.0'},
  {id:'p24-ack-power',from:SUPPLY+'.P24',to:ACK+'.A'},
  {id:'p24-ack-in',from:ACK+'.B',to:PLC+'.I0.4'},
  {id:'p24-request-power',from:SUPPLY+'.P24',to:REQUEST+'.A'},
  {id:'p24-request-in',from:REQUEST+'.B',to:PLC+'.I0.6'},
  {id:'p24-release-power',from:SUPPLY+'.P24',to:RELEASE+'.A'},
  {id:'p24-release-in',from:RELEASE+'.B',to:PLC+'.I0.8'}];
 return {...p,components:[...p.components,
  {id:START,kind:'start',x:870,y:383,pressed:false},
  {id:ACK,kind:'start',x:870,y:426,pressed:false},
  {id:REQUEST,kind:'start',x:870,y:469,pressed:false},
  {id:RELEASE,kind:'start',x:870,y:512,pressed:false}],wires};
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
  throw new Error('P24 original physics, controller or material conservation failed: '+w.lastError);
 return w;
}
const scan=(w:WorldState,n=1):WorldState=>{
 for(let i=0;i<n;i++)w=checked(tick(w).world);
 return w;
};
const operate=(w:WorldState,id:string,pressed:boolean):WorldState=>
 checked(tick(w,[{k:'operate',id,pressed}]).world);
function one(p:ProjectFile,seed:number):P24Lot{
 const before=projectSignature(p);
 const cases:P24Case[]=[];
 const check=(id:string,pass:boolean,detail:string)=>{
  cases.push({id,pass,detail});return pass;
 };
 const base={seed,pass:false,produced:0,initialZoneCount:0,
  zoneFullBeforeTrip:false,plcSensedFull:false,thirdFeedInhibited:false,
  pairTripped:false,leaderCleared:false,postClearanceCount:-1,
  resetFromPlc:false,followerRecovered:false,thirdFedAfterRestart:false,
  originalIds:[] as string[],materials:[] as string[],cases,diagnostic:'',
  downstreamReceived:false,downstreamInputHigh:false,downstreamPowered:false,
  downstreamInhibited:false,downstreamCleared:false,receiverMotionMm:0,
  stopExtended:false,prematureReleaseBlocked:false,genuineOutfeedContact:false,
  stopContactDwellMs:0,plcHeldLoad:false,heldCartonStationary:false,
  poweredRelease:false,stopRetracted:false,physicalOutfeedClear:false};
 try{
  let w=checked(tick(createWorld(),[{k:'loadProject',project:privateProject(p)}]).world);
  w={...w,plantWorld:{...w.plantWorld,world:{...w.plantWorld.world,rngState:seed}}};
  w=checked(tick(w,[{k:'run'}]).world);
  w=scan(w,8);
  const idle=plc(w)?.powered===true&&w.plantWorld.world.spawnedCount===0&&
   Array.from({length:7},(_,i)=>plc(w)?.outputs['Q0.'+i]===false).every(Boolean);
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
    // The plant publishes its output after the current 50ms scan; the
    // authentic PLC input image receives that signal on the NEXT scan.
    // Require both true physical occupation and actual electrically
    // received I0.5 before proceeding, while still BEFORE the P21 trip.
    plcFull=plc(w)?.io.inputs.some(i=>i.terminal==='I0.5'&&i.on)===true;
    if(plcFull)break;
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
  // Unlike P22, actual b2 must CHANGE carrier onto a physically adjacent
  // independently powered receiver. Neither source-zone count nor an assumed
  // elapsed time is acceptable evidence of downstream handoff.
  let received=false,rxInput=false,rxDrive=false;
  for(let k=0;k<240;k++){
   w=scan(w);
   const b2=body(w,'b2');
   if(b2?.supportedBy==='receiver'&&
      signal(w,'receiver','zoneFull')&&
      w.plantWorld.signals.receiver?.zoneCount===1){
    received=true;
    rxInput=plc(w)?.io.inputs.some(i=>i.terminal==='I0.7'&&i.on)===true;
    rxDrive=plc(w)?.outputs['Q0.5']===true&&signal(w,'receiver','moving');
    if(rxInput)break;
   }
  }
  check('original-receiver-handoff',received&&rxInput&&rxDrive,
   'Same original b2 moved from source onto adjacent powered receiver; actual occupied receiver energizes real PLC I0.7, PLC Q0.5 powers motor');
  const rxStart=body(w,'b2')?.pos.x??NaN;
  w=scan(w,8);
  const travelled=(body(w,'b2')?.pos.x??-Infinity)-rxStart;
  check('powered-receiver-transport',received&&rxDrive&&travelled>35&&
   body(w,'b2')?.supportedBy==='receiver'&&conserved(w.plantWorld.world),
   'Original b2 physically advances at least 35 mm on actual PLC-driven receiver, not inertial edge crossing');
  // FIRST attempt a premature release with b2 only at the receiver entrance.
  // A PLC that reacts to I0.8 alone, or only receiver I0.7, is unsafe.
  const plcOn=(state:WorldState,pin:string):boolean=>
   plc(state)?.io.inputs.some(i=>i.terminal===pin&&i.on)===true;
  const stopExtended=signal(w,'outstop','extended')&&
   plcOn(w,'I0.9')&&plc(w)?.outputs['Q0.6']===true&&
   !signal(w,'outstop','heldLoad');
  w=operate(w,RELEASE,true);
  let earlyDrop=plc(w)?.outputs['Q0.6']===false;
  for(let k=0;k<2;k++){w=scan(w);earlyDrop ||= plc(w)?.outputs['Q0.6']===false;}
  w=operate(w,RELEASE,false);
  w=scan(w,2);
  const prematureBlocked=stopExtended&&!earlyDrop&&
   signal(w,'outstop','extended')&&!signal(w,'outstop','heldLoad')&&
   body(w,'b2')?.supportedBy==='receiver';
  check('early-release-held-until-real-contact',prematureBlocked,
   'Powered I0.8 while original b2 is entering destination must NOT release gate Q0.6 before 200ms jam contact');
  // No synthetic extra body: existing b2 must physically reach an extended
  // downstream gate and continuously JAM it for 200ms. The same worker model
  // provides heldLoad, wired through the real 24V bridge into PLC I0.11.
  let held=false,heldSignal=false,holdMs=0;
  for(let k=0;k<240;k++){
   w=scan(w);
   const b2=body(w,'b2');
   const measured=w.plantWorld.signals.outstop?.heldDwellMs;
   holdMs=typeof measured==='number'?measured:0;
   if(b2?.supportedBy==='receiver'&&b2.tags.jammed===true&&
      b2.tags.jammedByGate==='outstop'&&
      signal(w,'outstop','extended')&&signal(w,'outstop','heldLoad')&&
      holdMs>=200&&signal(w,'receiver','zoneFull')){
    held=true;
    heldSignal=plcOn(w,'I0.11');
    if(heldSignal)break;
   }
  }
  check('200ms-original-outstop-contact',held&&heldSignal&&
   plc(w)?.outputs['Q0.6']===true&&holdMs>=200,
   'Same genuine b2 blocks Q0.6-actuated outstop for >=200ms continuous physical jam; actual heldLoad energizes PLC I0.11');
  const lockedX=body(w,'b2')?.pos.x??NaN;
  w=scan(w,10);
  const stationary=held&&signal(w,'receiver','moving')&&
   signal(w,'outstop','heldLoad')&&
   Math.abs((body(w,'b2')?.pos.x??NaN)-lockedX)<1&&
   body(w,'b2')?.supportedBy==='receiver'&&conserved(w.plantWorld.world);
  check('original-carton-stationary-under-powered-drive',stationary,
   'Original jammed b2 remains physically stationary on driven receiver until permitted release');
  // Source is empty; a separate authentic 24V demand cannot pulse feeder
  // while the held original b2 physically occupies the receiving belt.
  const trulyFull=signal(w,'receiver','zoneFull')&&
   count(w)===0&&plcOn(w,'I0.7')&&plcOn(w,'I0.11');
  w=operate(w,REQUEST,true);
  let earlyThirdCoil=plc(w)?.outputs['Q0.0']===true;
  for(let i=0;i<2;i++){w=scan(w);earlyThirdCoil ||= plc(w)?.outputs['Q0.0']===true;}
  const receiverInhibited=trulyFull&&!earlyThirdCoil&&
   w.plantWorld.world.spawnedCount===2;
  check('held-receiver-inhibits-new-feed',receiverInhibited,
   'Source empty but downstream real I0.7/I0.11 HIGH: PLC must inhibit Q0.0 and b3');
  w=operate(w,REQUEST,false);
  // A FRESH powered release I0.8 now follows real same-body contact+dwell.
  // The learner must drop Q0.6 and wait for actual retract limit I0.10.
  w=operate(w,RELEASE,true);
  let releaseInput=plcOn(w,'I0.8');
  let releasedCoil=plc(w)?.outputs['Q0.6']===false;
  for(let k=0;k<4;k++){
   w=scan(w);releaseInput ||= plcOn(w,'I0.8');
   releasedCoil ||= plc(w)?.outputs['Q0.6']===false;
  }
  w=operate(w,RELEASE,false);
  let retracted=false;
  for(let k=0;k<40;k++){
   w=scan(w);
   if(signal(w,'outstop','retracted')&&plcOn(w,'I0.10')&&
      !signal(w,'outstop','heldLoad')&&
      (body(w,'b2')?.pos.x??-Infinity)>lockedX+10){
    retracted=true;break;
   }
  }
  const genuineRelease=held&&releaseInput&&releasedCoil&&retracted;
  check('24v-release-physical-stop-and-original-b2',genuineRelease,
   'PLC receives powered I0.8 after I0.11 contact, Q0.6 drops, I0.10 confirms retracted gate, original b2 moves again');
  let clearedReceiver=false;
  for(let k=0;k<240;k++){
   w=scan(w);
   const b2=body(w,'b2');
   if(b2&&b2.pos.x>900&&b2.supportedBy!=='receiver'&&
      !signal(w,'receiver','zoneFull')&&
      plc(w)?.io.inputs.some(i=>i.terminal==='I0.7'&&!i.on)===true){
    clearedReceiver=true;break;
   }
  }
  check('original-b2-outfeed-after-release',clearedReceiver&&retracted,
   'Same conserved b2 exits real receiving belt only after powered gate retracts and true I0.7 becomes LOW');
  w=operate(w,REQUEST,true);
  let thirdCoil=plc(w)?.outputs['Q0.0']===true;
  for(let k=0;k<3;k++){w=scan(w);thirdCoil ||= plc(w)?.outputs['Q0.0']===true;}
  w=operate(w,REQUEST,false);
  const final=w.plantWorld.world,b3=body(w,'b3');
  const third=thirdCoil&&final.spawnedCount===3&&final.despawnedCount===0&&
   final.bodies.length===3&&!!b3&&b3.tags.origin==='feeder'&&conserved(final);
  check('fresh-third-after-physical-outfeed',third&&clearedReceiver&&genuineRelease,
   'New genuine powered PLC Q0.0 feed edge created original b3 only after b2 recovered; b1/b2 remain conserved');
  const originalIds=final.bodies.map(b=>b.id);
  const materials=final.bodies.map(b=>String(b.tags.material??''));
  const pass=cases.every(c=>c.pass)&&projectSignature(p)===before&&
   originalIds.join(',')==='b1,b2,b3'&&materials.every(Boolean);
  return {...base,pass,produced:final.spawnedCount,initialZoneCount,
   zoneFullBeforeTrip:fullBeforeTrip,plcSensedFull:plcFull,
   thirdFeedInhibited:inhibited,pairTripped:tripped,leaderCleared:cleared,
   downstreamReceived:received,downstreamInputHigh:rxInput,
   downstreamPowered:rxDrive,downstreamInhibited:receiverInhibited,
   downstreamCleared:clearedReceiver,receiverMotionMm:travelled,
   stopExtended,prematureReleaseBlocked:prematureBlocked,
   genuineOutfeedContact:held,stopContactDwellMs:holdMs,plcHeldLoad:heldSignal,
   heldCartonStationary:stationary,poweredRelease:genuineRelease,
   stopRetracted:retracted,physicalOutfeedClear:clearedReceiver,
   postClearanceCount:after,resetFromPlc:reset,
   followerRecovered:received,thirdFedAfterRestart:third,
   originalIds,materials,
   diagnostic:pass?'Original b2 physical downstream gate hold/dwell, fresh powered release and b3 passed':
    'One or more original physical occupancy, early feeder inhibit, post-reset source feeding or conservation checks failed'};
 }catch(error){
  return {...base,diagnostic:'P24 real worker trial aborted: '+
   (error instanceof Error?error.message:String(error))};
 }
}
export function runP24HoldCampaign(p:ProjectFile,sceneId:string):P24Campaign{
 const sourceSignature=projectSignature(p);
 const base={sceneId,sourceSignature,lots:[] as P24Lot[],
  deterministicReplay:false,totalOriginals:0};
 const blockers=p24HoldPreflight(p,sceneId);
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
   'Three seeded original-body lots: source recovery, receiver handoff, Q0.6 stopper 200ms same-body physical hold/I0.11, premature release rejection, true I0.8 request, I0.10 retraction and fresh b3 after exit. Exact replay. Model only.':
   'Physical same-carton stopper dwell, premature release, powered hold feedback, actual release, receiver backpressure or replay failed'};
}
