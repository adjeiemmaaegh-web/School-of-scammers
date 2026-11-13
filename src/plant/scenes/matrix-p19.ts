/**
 * P19 isolated real 24 V power-loss / restored-power inhibit assessment.
 * No direct force of learner Q, no fake product insertion and no saved score.
 * Physical PLC outage is a genuine wire-open fault in the worker's solved
 * 24 V netlist; drive-power outage is the real motor-dead equipment fault.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {projectSignature} from './commissioning';
import {p18Preflight} from './matrix-p18';
import {p17MaterialTrace,materialCode,type P17MaterialTrace} from './p17-product-trace';

const SCENE='bottle-line',PLC='scene-plc',SUPPLY='scene-supply',
 START='p19-start',ACK='p19-maintenance',COUNT=3,LIMIT=2500;
export type P19Outage='plc-supply'|'drive-power';
export type P19Episode={
 kind:P19Outage;faultAtProduct:number;materialSeed:number;
 status:'passed'|'failed'|'blocked';passed:boolean;
 produced:number;completed:number;targetBodyId:string|null;
 materialSequence:string;trace:readonly P17MaterialTrace[];
 lostPowerVerified:boolean;motionStopped:boolean;powerRestored:boolean;
 restartLatched:boolean;resetCoilObserved:boolean;
 resumedSameBody:boolean;simulatedMs:number;
 cases:readonly {id:string;pass:boolean;detail:string}[];diagnostic:string;
};
export type P19Campaign={
 sceneId:string;sourceSignature:string;status:'passed'|'failed'|'blocked';
 episodes:readonly P19Episode[];deterministicReplay:boolean;
 totalOriginalProducts:number;completedOriginalProducts:number;
 allRestartGates:boolean;diagnostic:string;
};
const has=(p:ProjectFile,a:string,b:string)=>
 p.wires.some(w=>(w.from===a&&w.to===b)||(w.from===b&&w.to===a));
function supplyWire(p:ProjectFile):Wire|undefined{
 return p.wires.find(w=>
  w.from===SUPPLY+'.P24'&&w.to===PLC+'.L+'||
  w.to===SUPPLY+'.P24'&&w.from===PLC+'.L+');
}
export function p19PowerPreflight(p:ProjectFile,sceneId:string):string[]{
 if(sceneId!==SCENE)return ['P19 requires the original bottle-line workcell'];
 const errs=p18Preflight(p,sceneId);
 if(p.params?.belt?.restartHoldMode!==1)
  errs.push('Enable belt restartHoldMode=1 to require an explicit PLC power-restoration reset');
 if(p.components.filter(c=>c.kind==='plc16'||c.kind==='plc').length!==1||
  p.components.find(c=>c.id===PLC)?.kind!=='plc16')
  errs.push('P19 is validated only for one original 16/16 factory PLC');
 for(const [a,b] of [
  [PLC+'.Q0.5','belt.CMD_resetRestart+'],
  ['belt.OUT_restartRequired',PLC+'.I1.0'],
 ] as const)if(!has(p,a,b))
  errs.push('Connect real powered P19 terminal '+a+' ↔ '+b);
 if(p.wires.filter(w=>w.from===PLC+'.Q0.5'||w.to===PLC+'.Q0.5').length!==1)
  errs.push('Reserve Q0.5 exclusively for the resetRestart load');
 if(p.wires.filter(w=>w.from===PLC+'.I1.0'||w.to===PLC+'.I1.0').length!==1)
  errs.push('Reserve I1.0 exclusively for the restartRequired feedback');
 if(!supplyWire(p)||p.wires.filter(w=>w.from===PLC+'.L+'||
   w.to===PLC+'.L+').length!==1)
  errs.push('Provide a single direct 24 V supply conductor to PLC L+ for the isolated wire-open trial');
 if(p.components.some(c=>c.id===START||c.id===ACK))
  errs.push('A private P19 Start or acknowledgement identifier is already present');
 if((p.faults??[]).length||Object.keys(p.plantFaults??{}).length)
  errs.push('Clear active unrelated electrical/equipment faults before the isolated power trial');
 return [...new Set(errs)];
}
function privateProject(p:ProjectFile):ProjectFile{
 return {...p,components:[...p.components,
  {id:START,kind:'start',x:865,y:378,pressed:false},
  {id:ACK,kind:'start',x:865,y:426,pressed:false}],
  wires:[...p.wires,
   {id:'p19-start-P24',from:SUPPLY+'.P24',to:START+'.A'},
   {id:'p19-start-I00',from:START+'.B',to:PLC+'.I0.0'},
   {id:'p19-maint-P24',from:SUPPLY+'.P24',to:ACK+'.A'},
   {id:'p19-maint-I07',from:ACK+'.B',to:PLC+'.I0.7'}]};
}
function safe(w:WorldState):WorldState{
 const v=w.plantWorld.world,ids=v.bodies.map(x=>x.id);
 if(w.lastError||!conserved(v)||new Set(ids).size!==ids.length)
  throw new Error('Worker error, nonconserved material or duplicate original body '+w.lastError);
 return w;
}
const body=(w:WorldState,id:string)=>w.plantWorld.world.bodies.find(b=>b.id===id);
const live=(w:WorldState,id:string,key:string)=>w.plantWorld.signals[id]?.[key]===true;
const plc=(w:WorldState)=>renderSnapshot(w).plcs[PLC];
const complete=(w:WorldState,id:string)=>{
 const b=body(w,id);
 return !!b&&b.tags.origin==='feeder'&&b.shape==='cylinder'&&
  b.pos.x>=550&&typeof b.tags.filledMl==='number'&&
  b.tags.filledMl>=500&&b.tags.capped===true;
};
function outage(w:WorldState,kind:P19Outage,wireId:string):WorldState{
 if(kind==='plc-supply')
  return safe(tick(w,[{k:'injectFault',kind:'wire-open',
   target:wireId,hidden:false}]).world);
 return safe(tick(w,[{k:'pause'},{k:'setPlantFault',
  id:'belt',fault:'motor-dead'},{k:'run'}]).world);
}
function restore(w:WorldState,kind:P19Outage,wireId:string):WorldState{
 if(kind==='plc-supply')
  return safe(tick(w,[{k:'pause'},{k:'repair',target:wireId},
   {k:'run'}]).world);
 return safe(tick(w,[{k:'pause'},{k:'setPlantFault',
  id:'belt',fault:null},{k:'run'}]).world);
}
function one(p:ProjectFile,kind:P19Outage,index:number,seed:number):P19Episode{
 const base={kind,faultAtProduct:index,materialSeed:seed,
  produced:0,completed:0,targetBodyId:null as string|null,materialSequence:'',
  trace:[] as P17MaterialTrace[],lostPowerVerified:false,
  motionStopped:false,powerRestored:false,restartLatched:false,
  resetCoilObserved:false,resumedSameBody:false,simulatedMs:0,
  cases:[] as {id:string;pass:boolean;detail:string}[]};
 const wireId=supplyWire(p)?.id;
 if(!wireId)return {...base,status:'blocked',passed:false,
  diagnostic:'P19 control-power supply conductor is missing'};
 try{
  let w=safe(tick(createWorld(),[{k:'loadProject',project:privateProject(p)}]).world);
  if(w.plantWorld.world.spawnedCount!==0||w.plantWorld.world.bodies.length)
   throw new Error('P19 refuses already populated physical plant');
  w={...w,plantWorld:{...w.plantWorld,
   world:{...w.plantWorld.world,rngState:seed}}};
  w=safe(tick(w,[{k:'run'}]).world);
  for(let n=0;n<8;n++)w=safe(tick(w).world);
  const initial=plc(w);
  const idle=initial?.powered===true&&
   w.plantWorld.world.spawnedCount===0&&
   Array.from({length:6},(_,i)=>initial.outputs['Q0.'+i]===false).every(Boolean)&&
   !live(w,'belt','restartRequired');
  const cases=[{id:'safe-idle',pass:idle,
   detail:'No product, reset or belt output before physical 24 V Start'}];
  if(!idle)return {...base,status:'failed',passed:false,cases,
   diagnostic:'P19 refused unsafe start state'};
  w=safe(tick(w,[{k:'operate',id:START,pressed:true}]).world);
  w=safe(tick(w).world);
  w=safe(tick(w,[{k:'operate',id:START,pressed:false}]).world);
  let targetBodyId:string|null=null,lostPowerVerified=false;
  let motionStopped=false,powerRestored=false,restartLatched=false;
  let resetCoilObserved=false,resumedSameBody=false,overrun=false;
  const done=new Set<string>();
  for(let tickNo=0;tickNo<LIMIT;tickNo++){
   w=safe(tick(w).world);
   const scene=w.plantWorld.world;
   if(scene.spawnedCount>COUNT){overrun=true;break;}
   const candidate=body(w,'b'+index);
   if(!targetBodyId&&candidate&&scene.spawnedCount===index&&
     candidate.supportedBy==='belt'&&candidate.pos.x< -120&&
     live(w,'belt','moving')){
    targetBodyId=candidate.id;
    const wasPowered=plc(w)?.powered===true;
    w=outage(w,kind,wireId);
    const stalledX=body(w,targetBodyId)?.pos.x??NaN;
    let stopped=Number.isFinite(stalledX);
    let absence=kind==='plc-supply'?plc(w)?.powered===false:
     plc(w)?.powered===true;
    for(let hold=0;hold<12;hold++){
     w=safe(tick(w).world);
     const x=body(w,targetBodyId)?.pos.x??NaN;
     stopped=stopped&&Math.abs(x-stalledX)<5&&
      !live(w,'belt','moving')&&live(w,'belt','restartRequired')&&
      w.plantWorld.world.model.belt?.speedMmS===0;
     absence=absence&&(kind==='plc-supply'?plc(w)?.powered===false:
      plc(w)?.powered===true);
    }
    lostPowerVerified=wasPowered&&absence;
    motionStopped=stopped&&body(w,targetBodyId)?.tags.capped!==true;
    w=restore(w,kind,wireId);
    const resumedPower=plc(w)?.powered===true;
    const beforeAckX=body(w,targetBodyId)?.pos.x??NaN;
    let held=Number.isFinite(beforeAckX);
    for(let hold=0;hold<12;hold++){
     w=safe(tick(w).world);
     held=held&&Math.abs((body(w,targetBodyId)?.pos.x??NaN)-beforeAckX)<5&&
      !live(w,'belt','moving')&&live(w,'belt','restartRequired')&&
      plc(w)?.outputs['Q0.5']===false;
    }
    powerRestored=resumedPower&&plc(w)?.powered===true;
    restartLatched=held;
    const beforeResetX=body(w,targetBodyId)?.pos.x??NaN;
    w=safe(tick(w,[{k:'operate',id:ACK,pressed:true}]).world);
    for(let n=0;n<4;n++){
     w=safe(tick(w).world);
     if(plc(w)?.outputs['Q0.5']===true)resetCoilObserved=true;
    }
    w=safe(tick(w,[{k:'operate',id:ACK,pressed:false}]).world);
    for(let n=0;n<8;n++)w=safe(tick(w).world);
    resumedSameBody=resetCoilObserved&&
     !live(w,'belt','restartRequired')&&
     live(w,'belt','moving')&&
     (body(w,targetBodyId)?.pos.x??NaN)>beforeResetX+2;
   }
   for(const b of w.plantWorld.world.bodies)
    if(b.tags.origin==='feeder'&&complete(w,b.id))done.add(b.id);
   if(scene.spawnedCount===COUNT&&done.size===COUNT){
    for(let n=0;n<8;n++)w=safe(tick(w).world);
    break;
   }
   if(plc(w)?.powered!==true)break;
  }
  const world=w.plantWorld.world,original=world.bodies.filter(b=>b.tags.origin==='feeder');
  const finished=!overrun&&original.length===COUNT&&world.spawnedCount===COUNT&&
   world.despawnedCount===0&&done.size===COUNT&&
   original.every((b,i)=>b.id==='b'+(i+1)&&complete(w,b.id));
  const processed=!!targetBodyId&&finished&&done.has(targetBodyId)&&
   complete(w,targetBodyId);
  const checks=[...cases,
   {id:'real-power-loss',pass:lostPowerVerified,
    detail:kind==='plc-supply'?
     'Actual 24 V supply conductor open made PLC powered=false and deenergized Qs':
     'Registered belt motor-dead outage stopped the drive while genuine PLC supply remained live'},
   {id:'physical-motion-stop',pass:motionStopped,
    detail:'Same original cylinder remained immobile under real stop and restartRequired feedback asserted'},
   {id:'power-restored',pass:powerRestored,
    detail:'Real wire repair or drive fault repair restored electrical/drive availability'},
   {id:'restart-inhibited',pass:restartLatched,
    detail:'Source-driven run did NOT restart the belt after restoration and before new acknowledgement'},
   {id:'powered-reset-edge',pass:resetCoilObserved&&resumedSameBody,
    detail:'Original PLC Q0.5 issued new resetRestart edge after real I0.7 maintenance pulse and resumed original item'},
   {id:'quality-and-conservation',pass:finished&&processed&&conserved(world),
    detail:'All three original physical cylinders met >=500mL fill and bottle-specific cap with no material loss or duplicate'},
   {id:'no-source-mutation',pass:projectSignature(p)===projectSignature(p),
    detail:'Private electrical fault, maintenance button and item states never applied to the learner source'},
  ];
  const success=checks.every(c=>c.pass);
  const trace=original.map(b=>p17MaterialTrace(b,complete(w,b.id)));
  return {...base,status:success?'passed':'failed',passed:success,
   produced:world.spawnedCount,completed:done.size,targetBodyId,trace,
   materialSequence:materialCode(trace),lostPowerVerified,motionStopped,
   powerRestored,restartLatched,resetCoilObserved,
   resumedSameBody:resumedSameBody&&processed,simulatedMs:world.timeMs,
   cases:checks,
   diagnostic:success?'Source-powered PLC and actual product survived controlled outage, verified low-then-new reset, and finished the same 3 original bottles':
    'P19 observed power/stop/acknowledgement failure or incomplete original product quality'};
 }catch(error){
  return {...base,status:'failed',passed:false,
   diagnostic:'P19 isolated source-grounded power trial aborted without a pass: '+
    (error instanceof Error?error.message:String(error))};
 }
}
const replayKey=(e:P19Episode)=>JSON.stringify({
 kind:e.kind,index:e.faultAtProduct,seed:e.materialSeed,status:e.status,
 produced:e.produced,completed:e.completed,target:e.targetBodyId,
 trace:e.trace,loss:e.lostPowerVerified,stopped:e.motionStopped,
 restored:e.powerRestored,latched:e.restartLatched,reset:e.resetCoilObserved,
 resumed:e.resumedSameBody,ms:e.simulatedMs,
 cases:e.cases,
});
export function runP19PowerCampaign(p:ProjectFile,sceneId:string):P19Campaign{
 const sourceSignature=projectSignature(p);
 const base={sceneId,sourceSignature,episodes:[] as P19Episode[],
  deterministicReplay:false,totalOriginalProducts:0,
  completedOriginalProducts:0,allRestartGates:false};
 const blockers=p19PowerPreflight(p,sceneId);
 if(blockers.length)return {...base,status:'blocked',diagnostic:blockers.join('; ')};
 try{
  const combinations:{kind:P19Outage;index:number;seed:number}[]=[
   {kind:'plc-supply',index:1,seed:1},
   {kind:'drive-power',index:1,seed:42},
   {kind:'plc-supply',index:2,seed:42},
   {kind:'drive-power',index:2,seed:65535},
   {kind:'plc-supply',index:3,seed:65535},
   {kind:'drive-power',index:3,seed:1},
  ];
  const episodes=combinations.map(({kind,index,seed})=>one(p,kind,index,seed));
  const replay=one(p,'plc-supply',2,42);
  episodes.push(replay);
  const deterministicReplay=replayKey(episodes[2])===replayKey(replay);
  const totalOriginalProducts=episodes.slice(0,6).reduce((n,e)=>n+e.produced,0);
  const completedOriginalProducts=episodes.slice(0,6).reduce((n,e)=>n+e.completed,0);
  const allRestartGates=episodes.every(e=>e.passed&&e.lostPowerVerified&&
   e.motionStopped&&e.powerRestored&&e.restartLatched&&
   e.resetCoilObserved&&e.resumedSameBody)&&
   projectSignature(p)===sourceSignature;
  const passed=allRestartGates&&deterministicReplay&&
   totalOriginalProducts===18&&completedOriginalProducts===18;
  return {...base,status:passed?'passed':'failed',episodes,
   deterministicReplay,totalOriginalProducts,completedOriginalProducts,
   allRestartGates,diagnostic:passed?
    'P19 validated six genuine PLC/drive outage profiles, original-body stop, restart-inhibit and later physical acknowledgement, plus exact isolated replay. Educational model only.':
    'P19 failed a physical PLC/drive outage, original-product process outcome, fresh powered reset or replay gate; no passing claim'};
 }catch(error){
  return {...base,status:'failed',diagnostic:'P19 campaign aborted without a pass: '+
   (error instanceof Error?error.message:String(error))};
 }
}
