/**
 * P15 opt-in autonomous robot/material-sort integration challenge.
 * One 24 V Start pulse launches a genuine user-authored PLC16 controller.
 * From then on, ALL commands come from that PLC's scan outputs. Its inputs
 * are wired physical pickup, inductive material, gripper and position sensors.
 * The private worker never directly drives Qs, creates bodies or changes tags.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {projectSignature} from './commissioning';
import {advancedPreflight} from './matrix-p14';
import {p17MaterialTrace,materialCode,type P17MaterialTrace} from './p17-product-trace';

export type AutonomousTrial={
 sceneId:string;sourceSignature:string;status:'blocked'|'passed'|'failed';
 produced:number;sorted:number;metal:number;plain:number;
 simulatedMs:number;throughputPerSimHour:number;jamObservations:number;
 faultRecovered:boolean;cases:readonly {id:string;pass:boolean;detail:string}[];
 materialSeed:number;productTrace:readonly P17MaterialTrace[];materialSequence:string;
 diagnostic:string;
};
const SCENE='robot-sort',PLC='scene-plc',SUPPLY='scene-supply';
const START='p15-auto-start',TARGET=3,LIMIT=1100;
const WIRES:readonly [string,string][]=[
 ['pickup.OUT_present',PLC+'.I0.1'],
 ['eye.OUT_present',PLC+'.I0.2'],
 ['robot.OUT_partHeld',PLC+'.I0.3'],
 ['robot.OUT_inPosition',PLC+'.I0.4'],
 [PLC+'.Q0.3','robot.CMD_routeMetal+'],
 [PLC+'.Q0.4','metal-out.CMD_run+'],
 [PLC+'.Q0.5','plain-out.CMD_run+'],
 [SUPPLY+'.P24','pickup.L+'],[SUPPLY+'.M0','pickup.M'],
 [SUPPLY+'.P24','eye.L+'],[SUPPLY+'.M0','eye.M'],
 [SUPPLY+'.P24','robot.L+'],[SUPPLY+'.M0','robot.M'],
 [SUPPLY+'.M0','metal-out.M-'],[SUPPLY+'.M0','plain-out.M-'],
];
const has=(p:ProjectFile,a:string,b:string)=>p.wires.some(w=>
 (w.from===a&&w.to===b)||(w.from===b&&w.to===a));
export function autonomousSortPreflight(p:ProjectFile,sceneId:string):string[]{
 if(sceneId!==SCENE)return ['Autonomous material sort trial is currently available for the robot-sort workcell only'];
 const issues=advancedPreflight(p,sceneId);
 if(p.params?.robot?.sortMode!==1)
  issues.push('Enable the robot physical two-lane material sort setting (sortMode=1)');
 if((p.params?.eye?.rangeMm??200)<300)
  issues.push('Set the real inductive pickup material sensor range to at least 300 mm');
 for(const [a,b] of WIRES)if(!has(p,a,b))
  issues.push('Connect actual physical signal '+a+' ↔ '+b);
 for(const i of [3,4,5]){
  const q=PLC+'.Q0.'+i;
  if(p.wires.filter(w=>w.from===q||w.to===q).length!==1)
   issues.push('Dedicate one physical output terminal '+q);
 }
 if(p.components.some(c=>c.id===START))
  issues.push('Reserved private start button must not exist in the saved project');
 if(p.wires.some(w=>w.from===PLC+'.I0.0'||w.to===PLC+'.I0.0'))
  issues.push('Reserve I0.0 for the isolated physical Start switch');
 return [...new Set(issues)];
}
function fixture(p:ProjectFile):ProjectFile{
 const wires:Wire[]=[...p.wires,
  {id:'p15-autonomous-button-power',from:SUPPLY+'.P24',to:START+'.A'},
  {id:'p15-autonomous-button-signal',from:START+'.B',to:PLC+'.I0.0'}];
 return {...p,components:[...p.components,{id:START,kind:'start',x:880,y:435,pressed:false}],wires};
}
function safe(w:WorldState):WorldState{
 if(w.lastError)throw new Error(w.lastError);
 if(!conserved(w.plantWorld.world))throw new Error('Unconserved original physical bodies');
 const ids=w.plantWorld.world.bodies.map(b=>b.id);
 if(new Set(ids).size!==ids.length)throw new Error('Duplicated physical body identifiers');
 return w;
}
const signal=(w:WorldState,id:string,key:string)=>w.plantWorld.signals[id]?.[key];
function fault(w:WorldState,code:string|null):WorldState{
 w=safe(tick(w,[{k:'pause'},{k:'setPlantFault',id:'robot',fault:code}]).world);
 return safe(tick(w,[{k:'run'}]).world);
}
export function runP15AutonomousSort(p:ProjectFile,sceneId:string,
 options:Readonly<{faultAtProduct?:number;materialSeed?:number}>={}):AutonomousTrial{
 const sourceSignature=projectSignature(p),blockers=autonomousSortPreflight(p,sceneId);
 const faultAtProduct=options.faultAtProduct??2;
 const materialSeed=options.materialSeed??1;
 if(!Number.isSafeInteger(materialSeed)||materialSeed<1||
  materialSeed>0xffffffff)blockers.push('P17 material-lot seed must be an unsigned nonzero 32-bit integer');
 if(!Number.isSafeInteger(faultAtProduct)||faultAtProduct<1||faultAtProduct>TARGET)
  blockers.push('P16 fault product must be an integer from 1 to '+TARGET);
 const base={sceneId,sourceSignature,produced:0,sorted:0,metal:0,
  plain:0,simulatedMs:0,throughputPerSimHour:0,jamObservations:0,
  faultRecovered:false,cases:[] as {id:string;pass:boolean;detail:string}[],
  materialSeed,productTrace:[] as P17MaterialTrace[],materialSequence:''};
 if(blockers.length)return {...base,status:'blocked',
  diagnostic:blockers.join('; ')};
 try{
  let w=safe(tick(createWorld(),[{k:'loadProject',project:fixture(p)}]).world);
  // P17: select the SOURCE feeder's PRNG before any PLC scan or product.
  // This touches only an empty private world, not the learner project, Q
  // terminals, existing bodies, process quality, or saved source.
  if(w.plantWorld.world.spawnedCount!==0||w.plantWorld.world.bodies.length!==0)
   throw new Error('P17 refuses to seed an already-populated plant');
  w={...w,plantWorld:{...w.plantWorld,
   world:{...w.plantWorld.world,rngState:materialSeed}}};
  w=safe(tick(w,[{k:'run'}]).world);
  for(let i=0;i<8;i++)w=safe(tick(w).world);
  const powered=renderSnapshot(w).plcs[PLC]?.powered===true;
  const idle=powered&&w.plantWorld.world.spawnedCount===0&&
   w.plantWorld.world.bodies.length===0&&
   [0,1,2,3,4,5].every(i=>
    renderSnapshot(w).plcs[PLC]?.outputs['Q0.'+i]===false);
  const cases=[{id:'idle',pass:idle,
   detail:'Before the sole physical Start pulse: powered PLC, no output or phantom product'}];
  if(!idle)return {...base,cases,status:'failed',
   diagnostic:'Unsafe idle or fabricated material without start'};
  w=safe(tick(w,[{k:'operate',id:START,pressed:true}]).world);
  w=safe(tick(w).world);
  w=safe(tick(w,[{k:'operate',id:START,pressed:false}]).world);
  let faultInjected=false,blocked=false,repairDone=false;
  let faultBodyId:string|null=null,detectedMetal=false,detectedPlain=false;
  const received=new Set<string>(),jammed=new Set<string>();
  const receiptEvidence=new Map<string,{receivedBy:string;receivedAtMs:number}>();
  let finished=false,excess=false;
  for(let i=0;i<LIMIT;i++){
   w=safe(tick(w).world);
   const world=w.plantWorld.world,ss=renderSnapshot(w);
   if(world.spawnedCount>TARGET){excess=true;break;}
   // A machine fault starts after the genuine second product is fed and
   // *before* the gripper can pick it. Measure the blocked physical state.
   if(world.spawnedCount===faultAtProduct&&!faultInjected&&
      !world.model.robot?.heldBodyId){
    // Rotate the actual robot gripper leak across a physical batch. No
    // fixture is allowed to manipulate the robot Q or inject source bodies.
    faultBodyId=world.bodies.find(b=>b.id==='b'+faultAtProduct)?.id??null;
    w=fault(w,'robot-gripper-leak');faultInjected=true;
    for(let hold=0;hold<12;hold++)w=safe(tick(w).world);
    blocked=!!faultBodyId&&
     signal(w,'robot','partHeld')===false&&
     w.plantWorld.world.bodies.some(b=>b.id===faultBodyId&&b.pos.x<100);
    w=fault(w,null);repairDone=true;
   }
   for(const body of w.plantWorld.world.bodies){
    if(body.tags.jammed===true)jammed.add(body.id);
    if(body.tags.origin!=='feeder')continue;
    if(body.tags.material==='metal')detectedMetal=true;
    if(body.tags.material==='cardboard')detectedPlain=true;
    const expected=body.tags.material==='metal'?'metal-out':'plain-out';
    const rightLane=body.tags.material==='metal'?body.pos.y>180:body.pos.y< -180;
    if(body.pos.x>530&&rightLane&&body.supportedBy===expected){
     received.add(body.id);
     if(!receiptEvidence.has(body.id))receiptEvidence.set(body.id,{
      receivedBy:expected,receivedAtMs:w.plantWorld.world.timeMs});
    }
   }
   if(world.spawnedCount===TARGET&&received.size===TARGET){
    // Require a final physical settling interval with no extra body.
    for(let settle=0;settle<16;settle++)w=safe(tick(w).world);
    finished=true;break;
   }
   if(ss.plcs[PLC]?.powered!==true)break;
  }
  const world=w.plantWorld.world,original=world.bodies;
  const all=original.filter(b=>b.tags.origin==='feeder');
  const unique=new Set(all.map(b=>b.id)).size===all.length;
  const complete=finished&&!excess&&all.length===TARGET&&
   world.spawnedCount===TARGET&&world.despawnedCount===0&&unique&&
   received.size===TARGET&&detectedMetal&&detectedPlain;
  const recovered=faultInjected&&repairDone&&blocked&&!!faultBodyId&&
   received.has(faultBodyId);
  const noMaterialConfusion=all.every(b=>{
   if(!received.has(b.id))return false;
   const expected=b.tags.material==='metal'?1:-1;
   return expected*b.pos.y>180;
  });
  // A transferred body can legitimately leave the conveyor before the
  // final batch snapshot. Its REAL receipt is proven by prior Worker scans
  // that witnessed support on the matching physical output conveyor.
  // Never infer delivery merely from an unclamped final x/y position.
  const productTrace=all.map(b=>{
   const evidence=receiptEvidence.get(b.id);
   const destination=b.tags.material==='metal'?'metal-out':'plain-out';
   const laneOK=b.tags.material==='metal'?b.pos.y>180:b.pos.y< -180;
   return p17MaterialTrace(b,received.has(b.id)&&!!evidence&&
    evidence.receivedBy===destination&&laneOK,{
     receivedBy:evidence?.receivedBy??null,
     receivedAtMs:evidence?.receivedAtMs??null});
  });
  const materialSequence=materialCode(productTrace);
  const resultCases=[...cases,
   {id:'classification',pass:complete&&noMaterialConfusion,
    detail:'Original seeded metal and cardboard bodies reached separate physical output belt lanes'},
   {id:'three-products',pass:complete,
    detail:'Three unique bodies and no excess feeder pulses, duplication, deletion or phantom completion'},
   {id:'fault-repair',pass:recovered,
    detail:'Carton '+faultAtProduct+' was physically blocked by a robot gripper leak, then the same ID was sorted after repair'},
   {id:'capacity-and-flow',pass:!excess&&world.bodies.length<=60,
    detail:'Bounded original material count and deterministic simulation time; no artificial throughput scores'},
  ];
  const passed=resultCases.every(c=>c.pass);
  const ms=world.timeMs;
  const metal=all.filter(b=>b.tags.material==='metal'&&received.has(b.id)).length;
  const plain=all.filter(b=>b.tags.material==='cardboard'&&received.has(b.id)).length;
  return {sceneId,sourceSignature,status:passed?'passed':'failed',
   cases:resultCases,produced:world.spawnedCount,sorted:received.size,metal,plain,
   materialSeed,productTrace,materialSequence,
   simulatedMs:ms,throughputPerSimHour:ms>0?
    Math.round(received.size*3600000/ms*100)/100:0,
   jamObservations:jammed.size,faultRecovered:recovered,
   diagnostic:passed?
    'Genuine autonomous PLC feedback routed both seeded material types into distinct moving carriers, repaired second-product fault and conserved all three source bodies. Educational simulation only.':
    'Autonomous PLC source failed physical material-classification, full cycle, fault recovery or conservation evidence'};
 }catch(e){
  return {...base,status:'failed',cases:[{id:'execution-error',pass:false,
   detail:e instanceof Error?e.message:String(e)}],
   diagnostic:'Autonomous real-engine process could not complete with this PLC program'};
 }
}
