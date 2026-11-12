/**
 * P13 bounded expansion of P12's independent factory challenge bench.
 *
 * These 11 profiles are scoped to one genuine, discrete PLC command and its
 * registered worker-owned response. The other four material-transfer scenes
 * remain explicitly unsupported for a complete independent matrix until
 * physical body preparation, grip/placement and cylinder-bottle feed are
 * representable through an actual learner PLC and sensible original layout.
 *
 * No fake input buffers, direct coil writes, debug forcing, 3D animation
 * guessing or persisted grades. The extra 24 V pushbutton lives ONLY in the
 * private worker-created clone, and is wired through the production netlist.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import {defaultProgramFor,programOf} from '../../sim/plcs';
import {ioOf} from '../../sim/plc-io';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {PLANT_EQUIPMENT} from '../equipment';
import {SCENES} from './catalogue';
import {projectSignature} from './commissioning';
import type {MatrixCaseResult,MatrixResult} from './matrix';

type Kind='gate'|'stopper'|'pusher'|'mixer'|'belt'|'roller'|'table'|'crane';
export type ExpandedSpec={
 sceneId:string;actor:string;command:string;kind:Kind;fault:string;
 /** When specified, the real registered source must already go to I0.0. */
 inputSensor:string|null;
 description:string;
};
export const P13_SPECS:readonly ExpandedSpec[]=[
 {sceneId:'sorting-line',actor:'gate',command:'reject',kind:'gate',
  fault:'gate-jammed',inputSensor:'eye1.OUT_present',
  description:'Reject vane motion and home return; no parcel-routing claim'},
 {sceneId:'gate-accumulation',actor:'stopper',command:'extend',kind:'stopper',
  fault:'stuck-retracted',inputSensor:'queue-eye.OUT_present',
  description:'Positive blocking stopper stroke; no queue-throughput claim'},
 {sceneId:'weigh-reject',actor:'pusher',command:'extend',kind:'pusher',
  fault:'pusher-stuck',inputSensor:null,
  description:'Pusher cylinder stroke on manual dispatch; no mass-classification claim'},
 {sceneId:'mini-warehouse',actor:'crane',command:'store',kind:'crane',
  fault:'crane-motor-fault',inputSensor:null,
  description:'PLC-demanded AS/RS travel to bay 1; no inventory transfer claim'},
 {sceneId:'mixing-tank',actor:'mixer',command:'run',kind:'mixer',
  fault:'motor-stalled',inputSensor:null,
  description:'Mixer motor demand and stall recovery; not a mixed-batch quality claim'},
 {sceneId:'three-way-handoff',actor:'table',command:'turn',kind:'table',
  fault:'turntable-stuck',inputSensor:null,
  description:'Physical quarter-turn indexing and stop; no cargo-transfer claim'},
 {sceneId:'reversible-roller-lane',actor:'rollers',command:'run',kind:'roller',
  fault:'bearing-seized',inputSensor:'eye.OUT_present',
  description:'Powered roller run/stop and bearing fault; reversal deferred'},
 {sceneId:'parallel-sort-cells',actor:'line-a',command:'run',kind:'belt',
  fault:'motor-dead',inputSensor:'metal-a.OUT_present',
  description:'Isolated lane-A motor response; lane-B remains independently stopped'},
 {sceneId:'temperature-batch',actor:'mix',command:'run',kind:'mixer',
  fault:'motor-stalled',inputSensor:null,
  description:'Batch agitator control only; heating/temperature correctness deferred'},
 {sceneId:'flow-valve-diagnostics',actor:'mixer',command:'run',kind:'mixer',
  fault:'motor-stalled',inputSensor:null,
  description:'Diagnostic agitator response only; analog valve position unverified'},
 {sceneId:'robot-warehouse-receiving',actor:'crane',command:'store',kind:'crane',
  fault:'crane-motor-fault',inputSensor:null,
  description:'PLC-driven crane bay position; robot pickup/real storage deferred'},
] as const;

/** Four complex scenes remain visible, not silently considered graded. */
export const P13_UNSUPPORTED:Readonly<Record<string,string>>={
 'gantry-transfer':'Requires actual body positioning and PLC-addressable X/Z gantry targets; direct grip alone cannot prove a transfer',
 'palletizing':'Requires a worker-fed physical body at the palletizer, distinct pick/place commands and measured stack conservation',
 'robot-sort':'Requires reachable material at the robot end effector and physically calibrated 3-axis targets and grip',
 'bottle-line':'Current box feeder emits box bodies, but the filler/capper require a cylinder bottle; cannot claim a real bottle-fill cycle',
};
export const expandedSpecFor=(sceneId:string):ExpandedSpec|undefined=>
 P13_SPECS.find(s=>s.sceneId===sceneId);
const PLC='scene-plc',SUPPLY='scene-supply',BUTTON='p13-trial-switch';
const terminal='scene-plc.I0.0';
const time=(w:WorldState)=>w.plantWorld.world.timeMs;
const val=(w:WorldState,actor:string,signal:string):boolean|number|undefined=>
 w.plantWorld.signals[actor]?.[signal];
const power=(w:WorldState)=>renderSnapshot(w).plcs[PLC]?.powered===true;
const output=(w:WorldState)=>renderSnapshot(w).plcs[PLC]?.outputs['Q0.0']===true;
const hasWire=(p:ProjectFile,a:string,b:string)=>
 p.wires.some(w=>(w.from===a&&w.to===b)||(w.from===b&&w.to===a));
const edited=(p:ProjectFile):boolean=>{
 const plc=p.components.find(c=>c.id===PLC&&c.kind==='plc16');
 if(!plc)return false;
 const current=programOf(p,PLC),baseline=defaultProgramFor('plc16',ioOf(p,plc));
 return current.language!==baseline.language||
  current.language==='ladder'&&JSON.stringify(current.program)!==JSON.stringify(baseline.program)||
  current.language==='st'&&current.stSource!==baseline.stSource||
  current.language==='fbd'&&JSON.stringify(current.fbd)!==JSON.stringify(baseline.fbd);
};
const canonicalSignal=(s:ExpandedSpec):string=>{
 switch(s.kind){
  case 'gate':return 'rejected';case 'stopper':return 'extended';
  case 'pusher':return 'extended';case 'mixer':return 'running';
  case 'belt':case 'roller':return 'moving';
  case 'table':return 'rotated';case 'crane':return 'atBay';
 }
};
const sourceBound=(s:ExpandedSpec):boolean=>{
 const scene=SCENES.find(x=>x.id===s.sceneId);
 const placement=scene?.equipment.find(x=>x.id===s.actor);
 const def=placement&&PLANT_EQUIPMENT[placement.kind];
 const required=canonicalSignal(s);
 return !!def?.commands.some(c=>c.name===s.command&&c.kind==='bool')&&
  !!def.signals.some(c=>c.name===required&&
   c.kind===(s.kind==='crane'?'number':'bool'))&&
  (!s.inputSensor||!!scene?.equipment.some(x=>{
   if(x.id!==s.inputSensor!.split('.')[0])return false;
   return PLANT_EQUIPMENT[x.kind]?.signals.some(ch=>
    ch.name==='present'&&ch.kind==='bool');
  }));
};
export function validateP13Specs():void{
 const unique=new Set<string>();
 for(const s of P13_SPECS){
  if(unique.has(s.sceneId))throw new Error('Duplicate P13 scene '+s.sceneId);
  unique.add(s.sceneId);
  if(!sourceBound(s))throw new Error('Unregistered worker device/signal '+s.sceneId);
  if(!SCENES.some(scene=>scene.id===s.sceneId))
   throw new Error('Unknown original training scene '+s.sceneId);
  const kind=SCENES.find(x=>x.id===s.sceneId)!.equipment.find(x=>x.id===s.actor)!.kind;
  if(!PLANT_EQUIPMENT[kind].faults.includes(s.fault))
   throw new Error('Fault not implemented by the real machine '+s.sceneId);
 }
 const unsupported=Object.keys(P13_UNSUPPORTED);
 if(unique.size!==11||unsupported.length!==4||
   SCENES.filter(scene=>!unique.has(scene.id)&&!(scene.id in P13_UNSUPPORTED))
    .length!==6)
  throw new Error('P13/P12 21-scene coverage no longer matches source register');
}
validateP13Specs();

export function expandedPreflight(p:ProjectFile,id:string):string[]{
 const s=expandedSpecFor(id);
 if(!s)return [P13_UNSUPPORTED[id]??'This scene uses the P12 matrix, not P13'];
 const scene=SCENES.find(x=>x.id===id)!;
 const reasons:string[]=[];
 if(!scene.equipment.every(e=>p.components.some(c=>c.id===e.id&&c.kind===e.kind)))
  reasons.push('Restore all original machine components before assessment');
 if(!p.components.some(c=>c.id===PLC&&c.kind==='plc16')||
  !p.components.some(c=>c.id===SUPPLY&&c.kind==='supply'))
  reasons.push('Requires the original configurable PLC16 and 24 V supply');
 if(p.components.some(c=>c.id===BUTTON))
  reasons.push('Reserved P13 test-switch ID conflicts with an existing component');
 if(!edited(p))reasons.push('Author a PLC program; the unchanged startup program cannot pass');
 if(Object.keys(p.plantFaults??{}).length||(p.faults??[]).length)
  reasons.push('Resolve source project faults before isolated testing');
 const needs:[string,string][]=[
  [SUPPLY+'.P24',PLC+'.L+'],[SUPPLY+'.M0',PLC+'.M'],
  [PLC+'.Q0.0',s.actor+'.CMD_'+s.command+'+'],
  [SUPPLY+'.M0',s.actor+'.M-'],
 ];
 if(s.inputSensor){
  const sensor=s.inputSensor.split('.')[0];
  needs.push([s.inputSensor,terminal],
   [SUPPLY+'.P24',sensor+'.L+'],[SUPPLY+'.M0',sensor+'.M']);
 }
 for(const [a,b] of needs)if(!hasWire(p,a,b))
  reasons.push('Real physical terminal missing: '+a+' ↔ '+b);
 if(p.wires.filter(w=>w.from===PLC+'.Q0.0'||w.to===PLC+'.Q0.0').length!==1)
  reasons.push('This bounded trial requires a dedicated first PLC output Q0.0');
 return [...new Set(reasons)].slice(0,24);
}

function insertFixture(p:ProjectFile):ProjectFile{
 return {...p,
  components:[...p.components,{id:BUTTON,kind:'start',x:880,y:425,pressed:false}],
  wires:[...p.wires.filter(w=>w.from!==terminal&&w.to!==terminal),
   {id:'p13-switch-24v',from:SUPPLY+'.P24',to:BUTTON+'.A'},
   {id:'p13-switch-i0',from:BUTTON+'.B',to:terminal}],
 };
}
const check=(w:WorldState)=>{if(w.lastError)throw new Error(w.lastError);return w;};
const scans=(world:WorldState,n:number):WorldState=>{
 let w=world;for(let i=0;i<n;i++)w=check(tick(w).world);return w;
};
const press=(w:WorldState,on:boolean)=>check(tick(w,[{k:'operate',
 id:BUTTON,pressed:on}]).world);
const fresh=(p:ProjectFile,s:ExpandedSpec,fault=false):WorldState=>{
 let w=check(tick(createWorld(),[{k:'loadProject',project:insertFixture(p)}]).world);
 if(fault)w=check(tick(w,[{k:'setPlantFault',id:s.actor,fault:s.fault}]).world);
 return check(tick(w,[{k:'run'}]).world);
};
const repaired=(w:WorldState,s:ExpandedSpec)=>{
 w=check(tick(w,[{k:'pause'},{k:'setPlantFault',id:s.actor,fault:null}]).world);
 return check(tick(w,[{k:'run'}]).world);
};
const active=(w:WorldState,s:ExpandedSpec):boolean=>
 s.kind==='crane'?val(w,s.actor,'atBay')===1:
 val(w,s.actor,canonicalSignal(s))===true;
const idle=(w:WorldState,s:ExpandedSpec):boolean=>{
 if(s.kind==='crane')return val(w,s.actor,'atBay')===0&&!output(w);
 if(s.kind==='table')return val(w,s.actor,'home')===true&&!output(w);
 if(s.kind==='gate')return val(w,s.actor,'home')===true&&!output(w);
 if(s.kind==='stopper'||s.kind==='pusher')
  return val(w,s.actor,'retracted')===true&&!output(w);
 return val(w,s.actor,canonicalSignal(s))===false&&!output(w);
};
const duration=(s:ExpandedSpec):number=>
 s.kind==='table'?52:s.kind==='pusher'?35:s.kind==='gate'?22:
 s.kind==='stopper'?18:s.kind==='crane'?22:8;
const errorCase=(id:MatrixCaseResult['id'],title:string,e:unknown):MatrixCaseResult=>
 ({id,title,pass:false,detail:e instanceof Error?e.message:String(e),atMs:0});
const makeCase=(id:MatrixCaseResult['id'],title:string,pass:boolean,
 yes:string,no:string,w:WorldState):MatrixCaseResult=>
 ({id,title,pass,detail:pass?yes:no,atMs:time(w)});
/** Re-run independent 24V/PLC/mechanical tests without replacing the live
 * bench or injecting a fake equipment signal. No asynchronous work here;
 * a separate module Worker owns execution and its bounded scan budget.
 */
export function runExpandedMatrix(p:ProjectFile,sceneId:string):MatrixResult{
 const signature=projectSignature(p),s=expandedSpecFor(sceneId);
 const blockers=expandedPreflight(p,sceneId);
 if(!s||blockers.length)return {sceneId,sourceSignature:signature,
  status:'blocked',diagnostic:blockers.join('; '),cases:[],executedScans:0};
 const cases:MatrixCaseResult[]=[];
 let count=0;
 const run=(id:MatrixCaseResult['id'],title:string,
  task:()=>{pass:boolean;reason:string;wrong:string;world:WorldState;scans:number})=>{
  try{
   const t=task();count+=t.scans;
   cases.push(makeCase(id,title,t.pass,t.reason,t.wrong,t.world));
  }catch(e){cases.push(errorCase(id,title,e));}
 };
 const n=duration(s);
 run('idle','Uncommanded controller and physical idle',()=>{
  const w=scans(fresh(p,s),5);
  const pass=power(w)&&idle(w,s);
  return {pass,world:w,scans:5,
   reason:'Powered PLC stays idle with the genuine 24 V test contact open',
   wrong:'Worker reports an uncommanded machine action or energized PLC Q output'};
 });
 run('demand','True wired 24 V demand and registered actuator response',()=>{
  let w=fresh(p,s);w=press(w,true);
  const firstOutput=output(w);
  w=scans(w,n);
  const pass=power(w)&&firstOutput&&active(w,s)&&
   (s.kind!=='crane'||val(w,s.actor,'storedCount')===0)&&
   (s.sceneId!=='parallel-sort-cells'||val(w,'line-b','moving')===false);
  return {pass,world:w,scans:n+1,
   reason:'Real PLC command drives the specified worker machine state, with no invented inventory or second-lane action',
   wrong:'Demand did not energize Q0.0, machine failed to respond, or unrelated material activity was credited'};
 });
 run('release','Remove physical input, verify worker output and return/stop',()=>{
  let w=fresh(p,s);w=press(w,true);
  w=scans(w,s.kind==='crane'?5:s.kind==='table'?6:
   s.kind==='pusher'?8:Math.min(n,10));
  const last=s.kind==='crane'?w.plantWorld.world.model[s.actor]?.progress:
   s.kind==='table'?val(w,s.actor,'angleDeg'):null;
  w=press(w,false);
  w=scans(w,s.kind==='pusher'?35:s.kind==='gate'?24:
   s.kind==='stopper'?22:10);
  let pass=power(w)&&!output(w);
  if(s.kind==='crane')pass=pass&&
  Math.abs((w.plantWorld.world.model[s.actor]?.progress??-2)-(last??-1))<.001&&
  val(w,s.actor,'atBay')===0;
  else if(s.kind==='table')pass=pass&&val(w,s.actor,'rotated')===false&&
   Math.abs((val(w,s.actor,'angleDeg') as number)-(last as number))<1;
  else if(s.kind==='stopper'||s.kind==='pusher')pass=pass&&
   val(w,s.actor,'retracted')===true;
  else if(s.kind==='gate')pass=pass&&val(w,s.actor,'home')===true;
  else pass=pass&&!active(w,s);
  return {pass,world:w,scans:n+10,
   reason:'Actual PLC output drops; the physical device settles, stops or retracts as defined',
   wrong:'Output stayed high or worker device continued moving after the training contact opened'};
 });
 run('fault-recovery','Registered machine failure blocks movement until repair',()=>{
  let w=fresh(p,s,true);w=press(w,true);
  w=scans(w,n);
  const faultBlocked=!active(w,s)&&
   (s.kind!=='crane'||val(w,s.actor,'storedCount')===0);
  w=repaired(w,s);w=scans(w,n+5);
  const pass=power(w)&&faultBlocked&&active(w,s);
  return {pass,world:w,scans:n*2+6,
   reason:'Injected real registered fault suppressed physical action; repair restored PLC-driven response',
   wrong:'Fault incorrectly allowed a physical outcome or restored device did not respond to the PLC'};
 });
 return {sceneId,sourceSignature:signature,cases,
  status:cases.every(c=>c.pass)?'passed':'failed',
  diagnostic:cases.every(c=>c.pass)?
   'All four PLC/worker actuator cases passed. This is not a proof of all material process or safety outcomes: '+s.description:
   'One or more distinct worker trials failed; check PLC demand, device signals and fault behavior',
  executedScans:Math.min(2000,count)};
}
