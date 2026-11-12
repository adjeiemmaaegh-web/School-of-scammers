/**
 * P18 conveyor jam and deliberate PLC reset — genuine offline plant Worker.
 * Runs the user's exact PLC source, not reference logic, with a temporary
 * real 24V Start and a separate post-repair maintenance acknowledgement.
 * Assessor injects/repairs a registered fault, never creates bodies or
 * energizes PLC coils, and checks original workpiece identities.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {projectSignature} from './commissioning';
import {autoFactoryPreflight} from './matrix-p15-autonomous-factory';
import {p17MaterialTrace,materialCode,type P17MaterialTrace} from './p17-product-trace';

const SCENE='bottle-line',PLC='scene-plc',SUPPLY='scene-supply',
 START='p18-start',ACK='p18-maintenance-ack',COUNT=3,LIMIT=2400;
export type P18Result={
 sceneId:string;sourceSignature:string;status:'blocked'|'passed'|'failed';
 faultAtProduct:number;materialSeed:number;produced:number;completed:number;
 materialSequence:string;productTrace:readonly P17MaterialTrace[];
 jammedBodyId:string|null;jamMeasured:boolean;latchedAfterRepair:boolean;
 resetFromPlc:boolean;recoveredSameBody:boolean;simulatedMs:number;
 modelThroughputPerHour:number;
 cases:readonly {id:string;pass:boolean;detail:string}[];diagnostic:string;
};
const wired=(p:ProjectFile,a:string,b:string)=>p.wires.some(w=>
 (w.from===a&&w.to===b)||(w.from===b&&w.to===a));
export function p18Preflight(p:ProjectFile,sceneId:string):string[]{
 if(sceneId!==SCENE)return ['P18 simulated jam/maintenance recovery is available for original bottle-line only'];
 const errors=autoFactoryPreflight(p,sceneId);
 if(p.params?.belt?.jamResetMode!==1)
  errors.push('Enable physical belt jamResetMode=1 in machine settings');
 for(const [a,b] of [
  [PLC+'.Q0.4','belt.CMD_resetJam+'],
  ['belt.OUT_jam',PLC+'.I0.6'],
  [SUPPLY+'.P24','belt.L+'],
  [SUPPLY+'.M0','belt.M'],
 ] as const)if(!wired(p,a,b))errors.push('Connect actual 24V terminal '+a+' ↔ '+b);
 if(p.wires.filter(w=>w.from===PLC+'.Q0.4'||w.to===PLC+'.Q0.4').length!==1)
  errors.push('PLC Q0.4 must exclusively drive belt.CMD_resetJam+');
 if(p.wires.some(w=>w.from===PLC+'.I0.7'||w.to===PLC+'.I0.7'))
  errors.push('Reserve PLC I0.7 for the isolated 24V acknowledgement button');
 if(p.components.some(c=>c.id===START||c.id===ACK))
  errors.push('Reserved P18 temporary operator switch already exists in project');
 return [...new Set(errors)];
}
function privateProject(p:ProjectFile):ProjectFile{
 const wires:Wire[]=[...p.wires,
  {id:'p18-start-power',from:SUPPLY+'.P24',to:START+'.A'},
  {id:'p18-start-input',from:START+'.B',to:PLC+'.I0.0'},
  {id:'p18-ack-power',from:SUPPLY+'.P24',to:ACK+'.A'},
  {id:'p18-ack-input',from:ACK+'.B',to:PLC+'.I0.7'},
 ];
 return {...p,components:[...p.components,
  {id:START,kind:'start',x:870,y:390,pressed:false},
  {id:ACK,kind:'start',x:870,y:438,pressed:false}],wires};
}
function checked(w:WorldState):WorldState{
 const v=w.plantWorld.world,ids=v.bodies.map(x=>x.id);
 if(w.lastError||!conserved(v)||new Set(ids).size!==ids.length)
  throw new Error('Plant electrical error, duplicate body or physical conservation failure: '+w.lastError);
 return w;
}
const item=(w:WorldState,id:string)=>w.plantWorld.world.bodies.find(b=>b.id===id);
const signal=(w:WorldState,id:string,key:string)=>w.plantWorld.signals[id]?.[key]===true;
function setFault(w:WorldState,value:string|null):WorldState{
 w=checked(tick(w,[{k:'pause'},{k:'setPlantFault',id:'belt',fault:value}]).world);
 return checked(tick(w,[{k:'run'}]).world);
}
function finalQuality(w:WorldState,id:string):boolean{
 const b=item(w,id);
 return !!b&&b.tags.origin==='feeder'&&b.shape==='cylinder'&&
  b.pos.x>=550&&typeof b.tags.filledMl==='number'&&
  b.tags.filledMl>=500&&b.tags.capped===true;
}
export function runP18JamRecovery(p:ProjectFile,sceneId:string,
 options:Readonly<{faultAtProduct?:number;materialSeed?:number}>={}):P18Result{
 const sourceSignature=projectSignature(p);
 const faultAtProduct=options.faultAtProduct??2,materialSeed=options.materialSeed??1;
 const base={sceneId,sourceSignature,faultAtProduct,materialSeed,
  produced:0,completed:0,materialSequence:'',
  productTrace:[] as P17MaterialTrace[],jammedBodyId:null as string|null,
  jamMeasured:false,latchedAfterRepair:false,resetFromPlc:false,
  recoveredSameBody:false,simulatedMs:0,modelThroughputPerHour:0,
  cases:[] as {id:string;pass:boolean;detail:string}[]};
 const problems=p18Preflight(p,sceneId);
 if(!Number.isSafeInteger(faultAtProduct)||faultAtProduct<1||faultAtProduct>COUNT)
  problems.push('Jam body must be 1, 2 or 3');
 if(!Number.isSafeInteger(materialSeed)||materialSeed<1||materialSeed>0xffffffff)
  problems.push('Feeder lot seed must be an unsigned nonzero 32-bit integer');
 if(problems.length)return {...base,status:'blocked',diagnostic:problems.join('; ')};
 try{
  let w=checked(tick(createWorld(),[{k:'loadProject',project:privateProject(p)}]).world);
  if(w.plantWorld.world.spawnedCount!==0||w.plantWorld.world.bodies.length)
   throw new Error('P18 refuses to seed a nonempty original plant');
  w={...w,plantWorld:{...w.plantWorld,world:{...w.plantWorld.world,rngState:materialSeed}}};
  w=checked(tick(w,[{k:'run'}]).world);
  for(let k=0;k<8;k++)w=checked(tick(w).world);
  const idlePLC=renderSnapshot(w).plcs[PLC];
  const idle=idlePLC?.powered===true&&w.plantWorld.world.spawnedCount===0&&
   Array.from({length:5},(_,i)=>idlePLC.outputs['Q0.'+i]===false).every(Boolean);
  const cases=[{id:'safe-idle',pass:idle,
   detail:'Powered PLC has all production and reset coils OFF before Start'}];
  if(!idle)return {...base,status:'failed',cases,diagnostic:'Unsafe idle / permanently held reset coil'};
  w=checked(tick(w,[{k:'operate',id:START,pressed:true}]).world);
  w=checked(tick(w).world);
  w=checked(tick(w,[{k:'operate',id:START,pressed:false}]).world);
  let jammedBodyId:string|null=null,measured=false,latched=false;
  let poweredReset=false,recovered=false,moved=false,overrun=false;
  const completed=new Set<string>();
  for(let k=0;k<LIMIT;k++){
   w=checked(tick(w).world);
   const world=w.plantWorld.world;
   if(world.spawnedCount>COUNT){overrun=true;break;}
   const b=item(w,'b'+faultAtProduct);
   if(!jammedBodyId&&b&&world.spawnedCount===faultAtProduct&&
     b.supportedBy==='belt'&&b.pos.x< -120&&signal(w,'belt','moving')){
    jammedBodyId=b.id;
    w=setFault(w,'belt-jammed');
    const jamX=item(w,jammedBodyId)?.pos.x??NaN;
    let immobile=Number.isFinite(jamX)&&signal(w,'belt','jam')&&
     !signal(w,'belt','moving');
    for(let n=0;n<12;n++){
     w=checked(tick(w).world);
     immobile=immobile&&Math.abs((item(w,jammedBodyId)?.pos.x??NaN)-jamX)<5&&
      signal(w,'belt','jam')&&!signal(w,'belt','moving');
    }
    measured=immobile&&item(w,jammedBodyId)?.tags.capped!==true;
    w=setFault(w,null);
    const afterRepairX=item(w,jammedBodyId)?.pos.x??NaN;
    let held=Number.isFinite(afterRepairX)&&signal(w,'belt','jam');
    for(let n=0;n<10;n++){
     w=checked(tick(w).world);
     held=held&&Math.abs((item(w,jammedBodyId)?.pos.x??NaN)-afterRepairX)<5&&
      signal(w,'belt','jam')&&!signal(w,'belt','moving');
    }
    latched=held;
    const resetX=item(w,jammedBodyId)?.pos.x??NaN;
    // Actual operator acknowledgment is an energized physical input.
    w=checked(tick(w,[{k:'operate',id:ACK,pressed:true}]).world);
    for(let n=0;n<3;n++){
     w=checked(tick(w).world);
     if(renderSnapshot(w).plcs[PLC]?.outputs['Q0.4']===true)
      poweredReset=true;
    }
    w=checked(tick(w,[{k:'operate',id:ACK,pressed:false}]).world);
    for(let n=0;n<8;n++)w=checked(tick(w).world);
    moved=!signal(w,'belt','jam')&&signal(w,'belt','moving')&&
     (item(w,jammedBodyId)?.pos.x??NaN)>resetX+2;
   }
   for(const body of w.plantWorld.world.bodies)
    if(body.tags.origin==='feeder'&&finalQuality(w,body.id))
     completed.add(body.id);
   if(world.spawnedCount===COUNT&&completed.size===COUNT){
    for(let settle=0;settle<8;settle++)w=checked(tick(w).world);
    break;
   }
   if(renderSnapshot(w).plcs[PLC]?.powered!==true)break;
  }
  const world=w.plantWorld.world;
  const original=world.bodies.filter(b=>b.tags.origin==='feeder');
  recovered=!!jammedBodyId&&moved&&completed.has(jammedBodyId)&&
   finalQuality(w,jammedBodyId);
  const all=!overrun&&original.length===COUNT&&world.spawnedCount===COUNT&&
   world.despawnedCount===0&&completed.size===COUNT&&
   original.every((b,i)=>b.id==='b'+(i+1)&&finalQuality(w,b.id));
  const productTrace=original.map(b=>p17MaterialTrace(b,finalQuality(w,b.id)));
  const checks=[...cases,
   {id:'stopped-product',pass:measured,
    detail:'Registered belt fault actually stopped moving original bottle and asserted live jam sensor'},
   {id:'latched-repair',pass:latched,
    detail:'Mechanical repair did not auto-clear the jam or permit unacknowledged movement'},
   {id:'plc-reset',pass:poweredReset&&moved,
    detail:'New physical post-repair acknowledgement drove genuine PLC Q0.4 rising edge and restarted belt'},
   {id:'same-product',pass:recovered,
    detail:'The identical jammed cylinder resumed, filled 500+ mL, and earned its own cap'},
   {id:'entire-batch',pass:all&&conserved(world),
    detail:'Exactly three original physical bottles finished, without loss, duplication or bypass'},
   {id:'project-immutable',pass:projectSignature(p)===sourceSignature,
    detail:'No operator switches, jam states, scores or test artifacts persisted to original source'},
  ];
  const passed=checks.every(c=>c.pass),ms=world.timeMs;
  return {...base,status:passed?'passed':'failed',
   produced:world.spawnedCount,completed:completed.size,
   productTrace,materialSequence:materialCode(productTrace),
   jammedBodyId,jamMeasured:measured,latchedAfterRepair:latched,
   resetFromPlc:poweredReset,recoveredSameBody:recovered,
   cases:checks,simulatedMs:ms,
   modelThroughputPerHour:ms>0?Math.round(completed.size*3600000/ms*100)/100:0,
   diagnostic:passed?
    'Real 24 V PLC, original conveyor and three bottles passed registered jam, latched repair, deliberate energized reset, same-body movement and full physical processing. Educational model only.':
    'Real conveyor stopped/repaired/reset sequence, original-body recovery or complete process integrity did not pass'};
 }catch(error){
  return {...base,status:'failed',diagnostic:'P18 source-grounded assessment aborted: '+
   (error instanceof Error?error.message:String(error))};
 }
}
