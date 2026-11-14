/**
 * P25 opt-in ORIGINAL belt occupancy → real 24V PLC full-zone input →
 * learner-controlled feeder inhibit. The source-only audit runs actual
 * feeder-created bodies in the same physics/electrical worker as the sandbox.
 * No phantom cartons, forced output coils or teacher-provided PLC solution.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {projectSignature} from './commissioning';
import {p24HoldPreflight} from './matrix-p24';

const SCENE='gate-accumulation',PLC='scene-plc',SUPPLY='scene-supply',
 START='p25-start',ACK='p25-maint',REQUEST='p25-more',RELEASE='p25-release',
 RETRY='p25-retry',ALARM='outfeed-alarm',LIMIT=480;
export type P25Case={id:string;pass:boolean;detail:string};
export type P25Lot={
 injectedFault:boolean;driveOffButGateStuck:boolean;faultTimedOut:boolean;
 realLampPowered:boolean;faultFeedInhibited:boolean;repairNoAutorestart:boolean;
 maintenanceRetryPowered:boolean;retryOpenedOriginalGate:boolean;
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
 cases:readonly P25Case[];diagnostic:string;
};
export type P25Campaign={
 sceneId:string;sourceSignature:string;status:'passed'|'failed'|'blocked';
 lots:readonly P25Lot[];deterministicReplay:boolean;totalOriginals:number;
 diagnostic:string;
};
const wired=(p:ProjectFile,a:string,b:string)=>
 p.wires.some(w=>(w.from===a&&w.to===b)||(w.from===b&&w.to===a));
export function p25FaultRetryPreflight(p:ProjectFile,sceneId:string):string[]{
 const errors=p24HoldPreflight(p,sceneId);
 if(sceneId!==SCENE)return errors;
 // P24's real powered Q0.6 stopper and I1.1/I1.2/I1.3 sensors
 // must remain intact; only an actual independent fault warning lamp and
 // a fresh private 24V maintenance input are new.
 const alarm=p.components.filter(c=>c.id===ALARM);
 if(alarm.length!==1||alarm[0]?.kind!=='lamp'||alarm[0]?.x!==710||
    alarm[0]?.y!==480)
  errors.push('Install original 24 V pilot fault lamp outfeed-alarm at (710,480)');
 for(const [a,b] of [
  [PLC+'.Q0.7',ALARM+'.L+'],
  [SUPPLY+'.M0',ALARM+'.M-'],
 ] as const)if(!wired(p,a,b))
  errors.push('Wire PLC fault alarm through actual 24 V load '+a+' to '+b);
 if(p.wires.filter(w=>w.from===PLC+'.Q0.7'||w.to===PLC+'.Q0.7').length!==1)
  errors.push('Q0.7 may drive only the actual fault pilot lamp');
 if(p.wires.some(w=>w.from===PLC+'.I1.4'||w.to===PLC+'.I1.4'))
  errors.push('Reserve PLC I1.4 for a private independently powered maintenance retry');
 if(p.components.some(c=>[START,ACK,REQUEST,RELEASE,RETRY].includes(c.id)))
  errors.push('Remove conflicting P25 private test operator IDs');
 return [...new Set(errors)];
}
function privateProject(p:ProjectFile):ProjectFile{
 const wires:Wire[]=[...p.wires,
  {id:'p25-start-power',from:SUPPLY+'.P24',to:START+'.A'},
  {id:'p25-start-in',from:START+'.B',to:PLC+'.I0.0'},
  {id:'p25-ack-power',from:SUPPLY+'.P24',to:ACK+'.A'},
  {id:'p25-ack-in',from:ACK+'.B',to:PLC+'.I0.4'},
  {id:'p25-request-power',from:SUPPLY+'.P24',to:REQUEST+'.A'},
  {id:'p25-request-in',from:REQUEST+'.B',to:PLC+'.I0.6'},
  {id:'p25-release-power',from:SUPPLY+'.P24',to:RELEASE+'.A'},
  {id:'p25-release-in',from:RELEASE+'.B',to:PLC+'.I1.0'},
  {id:'p25-retry-power',from:SUPPLY+'.P24',to:RETRY+'.A'},
  {id:'p25-retry-in',from:RETRY+'.B',to:PLC+'.I1.4'}];
 return {...p,components:[...p.components,
  {id:START,kind:'start',x:870,y:383,pressed:false},
  {id:ACK,kind:'start',x:870,y:426,pressed:false},
  {id:REQUEST,kind:'start',x:870,y:469,pressed:false},
  {id:RELEASE,kind:'start',x:870,y:512,pressed:false},
  {id:RETRY,kind:'start',x:870,y:555,pressed:false}],wires};
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
  throw new Error('P25 original physics, controller or material conservation failed: '+w.lastError);
 return w;
}
const scan=(w:WorldState,n=1):WorldState=>{
 for(let i=0;i<n;i++)w=checked(tick(w).world);
 return w;
};
const operate=(w:WorldState,id:string,pressed:boolean):WorldState=>
 checked(tick(w,[{k:'operate',id,pressed}]).world);
function one(p:ProjectFile,seed:number):P25Lot{
 const before=projectSignature(p);
 const cases:P25Case[]=[];
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
  poweredRelease:false,stopRetracted:false,physicalOutfeedClear:false,
  injectedFault:false,driveOffButGateStuck:false,faultTimedOut:false,
  realLampPowered:false,faultFeedInhibited:false,repairNoAutorestart:false,
  maintenanceRetryPowered:false,retryOpenedOriginalGate:false};
 try{
  let w=checked(tick(createWorld(),[{k:'loadProject',project:privateProject(p)}]).world);
  w={...w,plantWorld:{...w.plantWorld,world:{...w.plantWorld.world,rngState:seed}}};
  w=checked(tick(w,[{k:'run'}]).world);
  w=scan(w,8);
  const idle=plc(w)?.powered===true&&w.plantWorld.world.spawnedCount===0&&
   Array.from({length:8},(_,i)=>plc(w)?.outputs['Q0.'+i]===false).every(Boolean);
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
  // A PLC that reacts to I1.0 alone, or only receiver I0.7, is unsafe.
  const plcOn=(state:WorldState,pin:string):boolean=>
   plc(state)?.io.inputs.some(i=>i.terminal===pin&&i.on)===true;
  const stopExtended=signal(w,'outstop','extended')&&
   plcOn(w,'I1.1')&&plc(w)?.outputs['Q0.6']===true&&
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
   'Powered I1.0 while original b2 is entering destination must NOT release gate Q0.6 before 200ms jam contact');
  // No synthetic extra body: existing b2 must physically reach an extended
  // downstream gate and continuously JAM it for 200ms. The same worker model
  // provides heldLoad, wired through the real 24V bridge into PLC I1.3.
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
    heldSignal=plcOn(w,'I1.3');
    if(heldSignal)break;
   }
  }
  check('200ms-original-outstop-contact',held&&heldSignal&&
   plc(w)?.outputs['Q0.6']===true&&holdMs>=200,
   'Same genuine b2 blocks Q0.6-actuated outstop for >=200ms continuous physical jam; actual heldLoad energizes PLC I1.3');
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
   count(w)===0&&plcOn(w,'I0.7')&&plcOn(w,'I1.3');
  w=operate(w,REQUEST,true);
  let earlyThirdCoil=plc(w)?.outputs['Q0.0']===true;
  for(let i=0;i<2;i++){w=scan(w);earlyThirdCoil ||= plc(w)?.outputs['Q0.0']===true;}
  const receiverInhibited=trulyFull&&!earlyThirdCoil&&
   w.plantWorld.world.spawnedCount===2;
  check('held-receiver-inhibits-new-feed',receiverInhibited,
   'Source empty but downstream real I0.7/I1.3 HIGH: PLC must inhibit Q0.0 and b3');
  w=operate(w,REQUEST,false);
  // P25 does NOT merely inject a PLC status bit. Pause the true worker,
  // install its registered stuck-extended equipment fault and resume.
  // P24 physical same-b2 hold and actual 24V I1.3 already established.
  w=checked(tick(w,[{k:'pause'},{k:'setPlantFault',
   id:'outstop',fault:'stuck-extended'},{k:'run'}]).world);
  const injectedFault=w.project.plantFaults?.outstop==='stuck-extended'&&
   w.plantWorld.world.model.outstop?.faulted===true&&
   signal(w,'outstop','extended')&&
   body(w,'b2')?.supportedBy==='receiver';
  check('actual-registered-stuck-extended-fault',injectedFault,
   'Registered real outstop.stuck-extended fault while original b2 physically held on the live receiving lane');
  // A fresh 24V I1.0 request makes the learner drop Q0.6. The model must
  // refuse mechanical retraction because an actual equipment fault exists;
  // infer timeout ONLY from not receiving actual powered I1.2.
  w=operate(w,RELEASE,true);
  let releaseInput=plcOn(w,'I1.0');
  let firstDriveOff=plc(w)?.outputs['Q0.6']===false;
  for(let k=0;k<4;k++){
   w=scan(w);
   releaseInput ||= plcOn(w,'I1.0');
   firstDriveOff ||= plc(w)?.outputs['Q0.6']===false;
  }
  w=operate(w,RELEASE,false);
  let stuckConfirmed=false;
  for(let k=0;k<14;k++){
   w=scan(w);
   const b2=body(w,'b2');
   if(firstDriveOff&&signal(w,'outstop','extended')&&
      !signal(w,'outstop','retracted')&&!plcOn(w,'I1.2')&&
      b2?.supportedBy==='receiver'&&
      Math.abs(b2.pos.x-lockedX)<1&&conserved(w.plantWorld.world))
    stuckConfirmed=true;
  }
  check('commanded-release-but-actual-gate-stuck',releaseInput&&stuckConfirmed,
   'Real powered I1.0 triggered PLC Q0.6 OFF; registered mechanical outstop stayed extended and original b2 never advanced');
  // The learner's independently authored timer must escalate the absent
  // physical retracted-limit within a finite number of 50ms PLC scans,
  // reassert outstop Q0.6, energize Q0.7 and an ACTUAL DC lamp load.
  const faultTimedOut=stuckConfirmed&&
   plc(w)?.tagValues.Phase===11&&
   plc(w)?.outputs['Q0.6']===true&&!plcOn(w,'I1.2')&&
   plc(w)?.outputs['Q0.7']===true;
  const realLampPowered=plc(w)?.outputs['Q0.7']===true&&
   w.deviceOn[ALARM]===true;
  check('physical-limit-timeout-and-latched-24v-fault-lamp',
   faultTimedOut&&realLampPowered,
   'Only absent genuine I1.2 after an attempted Q0.6 release leads to a latched PLC fault, powered Q0.7 and electrically energised real pilot lamp');
  // A fault must stay latched across repeated scans and new feeder requests.
  // No unsafe Q0.0 pulse, no silent retraction, no deletion of original b2.
  let faultStable=true;
  for(let k=0;k<10;k++){
   w=scan(w);
   faultStable &&= plc(w)?.outputs['Q0.6']===true&&
    plc(w)?.outputs['Q0.7']===true&&w.deviceOn[ALARM]===true&&
    signal(w,'outstop','extended')&&!plcOn(w,'I1.2')&&
    Math.abs((body(w,'b2')?.pos.x??NaN)-lockedX)<1;
  }
  w=operate(w,REQUEST,true);
  let unsafeFeed=plc(w)?.outputs['Q0.0']===true;
  for(let k=0;k<3;k++){w=scan(w);unsafeFeed ||= plc(w)?.outputs['Q0.0']===true;}
  w=operate(w,REQUEST,false);
  const faultFeedInhibited=faultStable&&!unsafeFeed&&
   w.plantWorld.world.spawnedCount===2&&
   body(w,'b2')?.supportedBy==='receiver';
  check('fault-latch-holds-original-and-rejects-demand',faultFeedInhibited,
   'A new powered demand cannot pulse original feeder Q0.0 while actual b2 remains against a physically stuck outstop, and alarm remains latched');
  // Physical repair is a separate actual worker action, never a fabricated
  // PLC tag. The machine must remain held after repair UNTIL an independent,
  // fresh, powered I1.4 maintenance retry. Auto-restart fails this test.
  w=checked(tick(w,[{k:'pause'},{k:'setPlantFault',
   id:'outstop',fault:null},{k:'run'}]).world);
  let repairNoAutorestart=!w.project.plantFaults?.outstop;
  for(let k=0;k<12;k++){
   w=scan(w);
   repairNoAutorestart &&= w.plantWorld.world.model.outstop?.faulted===false&&
    plc(w)?.outputs['Q0.6']===true&&
    plc(w)?.outputs['Q0.7']===true&&
    w.deviceOn[ALARM]===true&&
    signal(w,'outstop','extended')&&!plcOn(w,'I1.2')&&
    Math.abs((body(w,'b2')?.pos.x??NaN)-lockedX)<1;
  }
  w=operate(w,REQUEST,true);
  let unauthorizedAfterRepair=plc(w)?.outputs['Q0.0']===true;
  for(let k=0;k<2;k++){
   w=scan(w);unauthorizedAfterRepair ||= plc(w)?.outputs['Q0.0']===true;
  }
  w=operate(w,REQUEST,false);
  repairNoAutorestart &&= !unauthorizedAfterRepair&&
   w.plantWorld.world.spawnedCount===2;
  check('repair-alone-never-auto-restarts',repairNoAutorestart,
   'Worker physically repairs stuck gate; alarm stays on, original b2 remains held, no Q0.0 third feed or auto gate retraction before a new maintenance acknowledgement');
  // Operator now presses ONLY the independently 24V powered fresh retry
  // switch I1.4; PLC state must transition to a new Q0.6 release attempt,
  // actual I1.2 gate-retracted proof and original b2 physical motion.
  w=operate(w,RETRY,true);
  let retryInput=plcOn(w,'I1.4');
  let secondDriveOff=plc(w)?.outputs['Q0.6']===false;
  for(let k=0;k<5;k++){
   w=scan(w);retryInput ||= plcOn(w,'I1.4');
   secondDriveOff ||= plc(w)?.outputs['Q0.6']===false;
  }
  w=operate(w,RETRY,false);
  let retracted=false,realAlarmCleared=false;
  for(let k=0;k<40;k++){
   w=scan(w);
   realAlarmCleared ||= plc(w)?.outputs['Q0.7']===false&&
    w.deviceOn[ALARM]===false;
   if(signal(w,'outstop','retracted')&&plcOn(w,'I1.2')&&
      !signal(w,'outstop','heldLoad')&&
      (body(w,'b2')?.pos.x??-Infinity)>lockedX+10){
    retracted=true;break;
   }
  }
  const maintenanceRetryPowered=retryInput&&secondDriveOff&&realAlarmCleared;
  const retryOpenedOriginalGate=maintenanceRetryPowered&&retracted;
  check('fresh-powered-retry-retracts-repaired-gate',retryOpenedOriginalGate,
   'A NEW 24V I1.4 maintenance pulse after registered physical repair reissues Q0.6 OFF, real I1.2 confirms retraction, fault lamp extinguishes and original b2 moves');
  const genuineRelease=retryOpenedOriginalGate&&faultFeedInhibited&&
   repairNoAutorestart;
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
  check('original-b2-received-only-after-real-fault-repair',
   clearedReceiver&&genuineRelease,
   'Conserved original b2 exits real receiver only after authentic failure timeout, physical fault repair and fresh PLC-controlled retry');
  w=operate(w,REQUEST,true);
  let thirdCoil=plc(w)?.outputs['Q0.0']===true;
  for(let k=0;k<3;k++){w=scan(w);thirdCoil ||= plc(w)?.outputs['Q0.0']===true;}
  w=operate(w,REQUEST,false);
  const final=w.plantWorld.world,b3=body(w,'b3');
  const third=thirdCoil&&final.spawnedCount===3&&final.despawnedCount===0&&
   final.bodies.length===3&&!!b3&&b3.tags.origin==='feeder'&&conserved(final);
  check('fresh-third-only-after-latched-fault-recovery',third&&clearedReceiver&&genuineRelease,
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
   injectedFault,driveOffButGateStuck:stuckConfirmed,
   faultTimedOut,realLampPowered,faultFeedInhibited,
   repairNoAutorestart,maintenanceRetryPowered,retryOpenedOriginalGate,
   postClearanceCount:after,resetFromPlc:reset,
   followerRecovered:received,thirdFedAfterRestart:third,
   originalIds,materials,
   diagnostic:pass?'Original b2 genuine downstream stopper fault timeout, powered alarm, repair and fresh retry passed':
    'One or more original physical occupancy, early feeder inhibit, post-reset source feeding or conservation checks failed'};
 }catch(error){
  return {...base,diagnostic:'P25 real worker trial aborted: '+
   (error instanceof Error?error.message:String(error))};
 }
}
export function runP25FaultRetryCampaign(p:ProjectFile,sceneId:string):P25Campaign{
 const sourceSignature=projectSignature(p);
 const base={sceneId,sourceSignature,lots:[] as P25Lot[],
  deterministicReplay:false,totalOriginals:0};
 const blockers=p25FaultRetryPreflight(p,sceneId);
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
   'Three independently seeded original-body lots: b2 same-body downstream hold and 24V release request, registered stuck-extended fault, false I1.2 timeout, actual powered alarm Q0.7 lamp, fault-latched inhibit, verified physical repair without auto-restart, fresh I1.4 retry, authentic b2 exit and b3 feed. Exact replay. Educational model only.':
   'P25 real stuck gate, fault timeout, powered alarm, feeder inhibit, repair-latch, independent 24V retry, original-b2 conservation or replay failed'};
}
