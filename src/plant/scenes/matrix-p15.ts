/**
 * P15 bounded multi-product process challenge.
 * Real electrical switch -> learner PLC -> Q terminal -> plant Worker -> physical body.
 *
 * This is a repeated, externally commanded educational commissioning trial,
 * not proof of autonomous cell scheduling, calibrated industrial throughput,
 * sorting classification, safe robotic motion, or real PLC interoperability.
 * No renderer, fake coil, injected body, saved score or server is involved.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import type {ProjectFile,Wire,WorldState} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {projectSignature} from './commissioning';
import {advancedPreflight,advancedSpecFor,type AdvancedSpec} from './matrix-p14';

export type BatchCase={id:string;pass:boolean;detail:string;atMs:number};
export type BatchResult={sceneId:string;sourceSignature:string;
 status:'passed'|'failed'|'blocked';cases:readonly BatchCase[];
 expectedProducts:number;verifiedProducts:number;executedScans:number;
 diagnostic:string};
const PLC='scene-plc',PFX='p15-batch-switch-';
const products=(s:AdvancedSpec)=>s.kind==='palletizer'?4:3;
function withButtons(p:ProjectFile,s:AdvancedSpec):ProjectFile{
 const count=s.commands.length;
 const inputPins=Array.from({length:count},(_,i)=>PLC+'.I0.'+i);
 const wires:Wire[]=p.wires.filter(w=>!inputPins.includes(w.from)&&
  !inputPins.includes(w.to));
 for(let i=0;i<count;i++)wires.push(
  {id:'p15-switch-power-'+i,from:'scene-supply.P24',to:PFX+i+'.A'},
  {id:'p15-switch-input-'+i,from:PFX+i+'.B',to:inputPins[i]});
 return {...p,components:[...p.components,...Array.from({length:count},(_,i)=>({
  id:PFX+i,kind:'start' as const,x:880,y:240+i*35,pressed:false}))],wires};
}
function checked(w:WorldState):WorldState{
 if(w.lastError)throw new Error(w.lastError);
 if(!conserved(w.plantWorld.world))throw new Error('Real material conservation failed');
 return w;
}
function scan(w:WorldState,n:number):WorldState{
 if(!Number.isSafeInteger(n)||n<0||n>550)throw new RangeError('Unbounded P15 scan request');
 for(let i=0;i<n;i++)w=checked(tick(w).world);
 return w;
}
function switchInput(w:WorldState,i:number,pressed:boolean):WorldState{
 return checked(tick(w,[{k:'operate',id:PFX+i,pressed}]).world);
}
function pulse(w:WorldState,i:number):WorldState{
 w=switchInput(w,i,true);
 w=scan(w,1);
 return switchInput(w,i,false);
}
function fresh(p:ProjectFile,s:AdvancedSpec):WorldState{
 let w=checked(tick(createWorld(),[{k:'loadProject',project:withButtons(p,s)}]).world);
 return checked(tick(w,[{k:'run'}]).world);
}
const world=(w:WorldState)=>w.plantWorld.world;
const read=(w:WorldState,id:string,key:string)=>w.plantWorld.signals[id]?.[key];
function finished(w:WorldState,s:AdvancedSpec,id:string,slot:number):boolean{
 const b=world(w).bodies.find(x=>x.id===id);
 if(!b||b.tags.origin!=='feeder')return false;
 if(s.kind==='palletizer'){
  return b.tags.palletized===true&&b.tags.palletSlot===slot&&
   b.tags.palletLayer===Math.floor(slot/4)&&
   b.supportedBy==='palletizer';
 }
 if(s.kind==='bottle')return b.shape==='cylinder'&&b.pos.x>300&&
  typeof b.tags.filledMl==='number'&&b.tags.filledMl>=500&&
  b.tags.capped===true;
 return b.shape==='box'&&b.pos.x>500&&
  b.supportedBy!==(s.kind==='gantry'?'gantry':'robot');
}
function physicalCycle(w:WorldState,s:AdvancedSpec):WorldState{
 if(s.kind==='palletizer'){
  w=pulse(w,1);w=scan(w,2);
  w=pulse(w,2);return scan(w,3);
 }
 if(s.kind==='bottle'){
  w=switchInput(w,1,true);
  w=switchInput(w,2,true);
  w=switchInput(w,3,true);
  return scan(w,470);
 }
 w=switchInput(w,1,true);w=scan(w,6);
 w=switchInput(w,2,true);
 w=scan(w,s.kind==='gantry'?43:52);
 w=switchInput(w,1,false);w=scan(w,4);
 return w;
}
function returnHome(w:WorldState,s:AdvancedSpec):WorldState{
 if(s.kind!=='gantry'&&s.kind!=='robot')return w;
 w=switchInput(w,2,false);
 return scan(w,70);
}
function record(id:string,pass:boolean,detail:string,w:WorldState):BatchCase{
 return {id,pass,detail,atMs:world(w).timeMs};
}
export function runP15Batch(p:ProjectFile,sceneId:string):BatchResult{
 const sourceSignature=projectSignature(p);
 const s=advancedSpecFor(sceneId),expectedProducts=s?products(s):0;
 const blocked=advancedPreflight(p,sceneId);
 if(p.components.some(c=>c.id.startsWith(PFX)))
  blocked.push('Reserved P15 private switch identifiers must not exist in learner project');
 if(!s||blocked.length)return {sceneId,sourceSignature,
  status:'blocked',cases:[],expectedProducts,verifiedProducts:0,executedScans:0,
  diagnostic:[...new Set(blocked)].join('; ')};
 const cases:BatchCase[]=[];
 let scans=0,verifiedProducts=0;
 try{
  let w=scan(fresh(p,s),8);
  const idle=world(w).spawnedCount===0&&world(w).bodies.length===0&&
   renderSnapshot(w).plcs[PLC]?.powered===true&&
   s.commands.every((_,i)=>renderSnapshot(w).plcs[PLC]?.outputs['Q0.'+i]===false);
  cases.push(record('idle',idle,'No product or PLC output before a real operator request',w));
  if(!idle)return {sceneId,sourceSignature,status:'failed',cases,expectedProducts,
   verifiedProducts:0,executedScans:8,
   diagnostic:'An energized or uncontrolled PLC failed the real no-demand baseline'};
  const ids:string[]=[];
  for(let index=0;index<expectedProducts;index++){
   const before=world(w).spawnedCount;
   w=pulse(w,0);w=scan(w,2);
   const newly=world(w).bodies.find(b=>Number(b.id.slice(1))===world(w).nextBodyId-1);
   const generated=world(w).spawnedCount===before+1&&!!newly&&
    newly.tags.origin==='feeder'&&!ids.includes(newly.id);
   if(generated)ids.push(newly!.id);
   if(!generated){
    cases.push(record('product-'+(index+1),false,
     'Feeder must produce exactly one new original body per PLC edge',w));
    break;
   }
   w=physicalCycle(w,s);
   const ok=finished(w,s,newly!.id,index)&&ids.every((id,i)=>finished(w,s,id,i))&&
    read(w,s.kind==='palletizer'?'palletizer':'feeder',
     s.kind==='palletizer'?'placedCount':'count')===index+1&&
    conserved(world(w));
   // For non-pallet workcells the feeder count equals the accepted pulse count.
   cases.push(record('product-'+(index+1),ok,
    ok?'Original physical body '+newly!.id+' processed; preceding bodies retained their identities':
       'Body completion, unique placement, PLC-driven feed count or conservation failed',w));
   if(!ok)break;
   verifiedProducts++;
   w=returnHome(w,s);
  }
  if(s.kind==='palletizer'&&verifiedProducts===expectedProducts){
   // Exercise the full 2x2 configured pallet capacity: a fifth real body
   // may still be fed, but MUST NOT be falsely placed or over-counted.
   const prior=world(w).spawnedCount;
   w=pulse(w,0);w=scan(w,2);
   w=pulse(w,1);w=scan(w,2);
   w=pulse(w,2);w=scan(w,3);
   const intact=world(w).spawnedCount===prior+1&&
    read(w,'palletizer','patternDone')===true&&
    read(w,'palletizer','placedCount')===expectedProducts&&
    world(w).bodies.filter(b=>b.tags.palletized===true).length===expectedProducts&&
    world(w).bodies.some(b=>b.tags.palletized!==true)&&conserved(world(w));
   cases.push(record('pattern-capacity',intact,
    intact?'Fifth genuine carton refused by full 2x2 pallet; no false fifth slot':
       'Full pallet accepted an extra position or lost/duplicated a physical body',w));
  }
  const unique=new Set(world(w).bodies.map(b=>b.id)).size===world(w).bodies.length;
  const passed=cases.every(c=>c.pass)&&verifiedProducts===expectedProducts&&
   unique&&conserved(world(w));
  scans=Math.ceil(world(w).timeMs/50);
  return {sceneId,sourceSignature,status:passed?'passed':'failed',
   cases,expectedProducts,verifiedProducts,executedScans:scans,
   diagnostic:passed?
    'Repeatable physical material provenance and bounded multi-product processing passed. Operator-scripted commissioning, not autonomous production or industrial certification.':
    'A worker-measured multi-product outcome, body identity or machine-capacity gate failed'};
 }catch(error){
  cases.push({id:'execution-error',pass:false,detail:error instanceof Error?error.message:String(error),atMs:0});
  return {sceneId,sourceSignature,status:'failed',cases,expectedProducts,
   verifiedProducts,executedScans:scans,
   diagnostic:'The actual PLC/plant Worker could not complete the bounded multi-product trial'};
 }
}
