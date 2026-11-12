/**
 * P15 autonomous feedback-driven gantry, palletizer and bottle processes.
 * A single physical 24 V Start pulse is the only test action after setup.
 * Every feed, grip, placement, transport, fill or cap comes from the exact
 * learner PLC16 program, through mapped Q terminals and the real P3 Worker.
 *
 * This is bounded 3/8-item educational commissioning, not plant safety,
 * hardware PLC parity, production metrology or high-volume certification.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {projectSignature} from './commissioning';
import {advancedPreflight} from './matrix-p14';
export type AutoFactoryKind='gantry-transfer'|'palletizing'|'bottle-line';
export type AutoFactoryResult={
 sceneId:string;sourceSignature:string;status:'passed'|'failed'|'blocked';
 produced:number;completed:number;expected:number;simulatedMs:number;
 throughputPerSimHour:number;jamObservations:number;faultRecovered:boolean;
 cases:readonly {id:string;pass:boolean;detail:string}[];diagnostic:string;
};
const PLC='scene-plc',SUPPLY='scene-supply',BTN='p15-auto-factory-start';
const LIMIT=2600;
type Spec={sceneId:AutoFactoryKind;expected:number;actor:string;fault:string;
 outputs:readonly [number,string,string][];sensors:readonly [string,string,number][]};
export const AUTO_FACTORY_SPECS:readonly Spec[]=[
 {sceneId:'gantry-transfer',expected:3,actor:'gantry',fault:'gripper-leak',
  outputs:[[3,'out','run']],
  sensors:[['pickup','present',1],['gantry','partHeld',2],['gantry','inPosition',3]]},
 {sceneId:'palletizing',expected:8,actor:'palletizer',fault:'gripper-fault',
  outputs:[],
  sensors:[['pickup','present',1],['palletizer','partHeld',2],['palletizer','patternDone',3]]},
 {sceneId:'bottle-line',expected:3,actor:'filler',fault:'nozzle-blocked',
  outputs:[],
  sensors:[['fill-eye','present',1],['filler','filled',2],['cap-eye','present',3],
   ['capper','capped',4],['exit-eye','present',5]]},
];
const specFor=(id:string)=>AUTO_FACTORY_SPECS.find(x=>x.sceneId===id);
const has=(p:ProjectFile,a:string,b:string)=>p.wires.some(w=>
 (w.from===a&&w.to===b)||(w.from===b&&w.to===a));
export function autoFactoryPreflight(p:ProjectFile,sceneId:string):string[]{
 const spec=specFor(sceneId);
 if(!spec)return ['The autonomous factory process trial is not defined for this original scene'];
 const errors=advancedPreflight(p,sceneId);
 const routes: [string,string][]=[];
 for(const [i,id,command] of spec.outputs)
  routes.push([PLC+'.Q0.'+i,id+'.CMD_'+command+'+'],[SUPPLY+'.M0',id+'.M-']);
 for(const [id,signal,i] of spec.sensors)
  routes.push([id+'.OUT_'+signal,PLC+'.I0.'+i],
   [SUPPLY+'.P24',id+'.L+'],[SUPPLY+'.M0',id+'.M']);
 for(const [a,b] of routes)if(!has(p,a,b))
  errors.push('Connect actual 24 V feedback/drive '+a+' ↔ '+b);
 for(const [i] of spec.outputs){
  const pin=PLC+'.Q0.'+i;
  if(p.wires.filter(w=>w.from===pin||w.to===pin).length!==1)
   errors.push('Reserve one dedicated PLC output '+pin);
 }
 if(p.components.some(c=>c.id===BTN))
  errors.push('Reserved private physical Start button identifier already exists');
 if(p.wires.some(w=>w.from===PLC+'.I0.0'||w.to===PLC+'.I0.0'))
  errors.push('Reserve PLC I0.0 for the isolated physical Start switch');
 return [...new Set(errors)];
}
function trialProject(p:ProjectFile):ProjectFile{
 const wires:Wire[]=[...p.wires,
  {id:'p15-factory-button-power',from:SUPPLY+'.P24',to:BTN+'.A'},
  {id:'p15-factory-button-input',from:BTN+'.B',to:PLC+'.I0.0'}];
 return {...p,components:[...p.components,
  {id:BTN,kind:'start',x:878,y:434,pressed:false}],wires};
}
function checked(w:WorldState):WorldState{
 if(w.lastError)throw new Error(w.lastError);
 const world=w.plantWorld.world,ids=world.bodies.map(b=>b.id);
 if(!conserved(world)||new Set(ids).size!==ids.length)
  throw new Error('Physical source-body conservation or identity invariant failed');
 return w;
}
const state=(w:WorldState,id:string,signal:string)=>w.plantWorld.signals[id]?.[signal];
const bodies=(w:WorldState)=>w.plantWorld.world.bodies;
const product=(w:WorldState,id:string)=>bodies(w).find(b=>b.id===id);
function machineFault(w:WorldState,s:Spec,value:string|null):WorldState{
 w=checked(tick(w,[{k:'pause'},{k:'setPlantFault',
  id:s.actor,fault:value}]).world);
 return checked(tick(w,[{k:'run'}]).world);
}
function isComplete(w:WorldState,s:Spec,id:string,index:number):boolean{
 const b=product(w,id);
 if(!b||b.tags.origin!=='feeder')return false;
 if(s.sceneId==='palletizing')
  return b.tags.palletized===true&&b.tags.palletSlot===index&&
   b.tags.palletLayer===Math.floor(index/4)&&
   b.supportedBy==='palletizer';
 if(s.sceneId==='bottle-line')
  return b.shape==='cylinder'&&b.pos.x>=550&&
   typeof b.tags.filledMl==='number'&&b.tags.filledMl>=500&&b.tags.capped===true;
 return b.shape==='box'&&b.pos.x>500&&b.supportedBy!=='gantry'&&
  state(w,'gantry','partHeld')===false;
}
export function runP15AutonomousFactory(p:ProjectFile,sceneId:string):AutoFactoryResult{
 const sourceSignature=projectSignature(p),s=specFor(sceneId),expected=s?.expected??0;
 const base={sceneId,sourceSignature,expected,produced:0,completed:0,
  simulatedMs:0,throughputPerSimHour:0,jamObservations:0,faultRecovered:false,
  cases:[] as {id:string;pass:boolean;detail:string}[]};
 const problems=autoFactoryPreflight(p,sceneId);
 if(!s||problems.length)return {...base,status:'blocked',diagnostic:problems.join('; ')};
 try{
  let w=checked(tick(createWorld(),[{k:'loadProject',project:trialProject(p)}]).world);
  w=checked(tick(w,[{k:'run'}]).world);
  for(let i=0;i<8;i++)w=checked(tick(w).world);
  const snapshot=renderSnapshot(w);
  const activeOutputs=s.sceneId==='gantry-transfer'?4:s.sceneId==='palletizing'?3:4;
  const idle=w.plantWorld.world.spawnedCount===0&&bodies(w).length===0&&
   snapshot.plcs[PLC]?.powered===true&&
   Array.from({length:activeOutputs},(_,i)=>'Q0.'+i).every(q=>snapshot.plcs[PLC]?.outputs[q]===false);
  const cases=[{id:'idle',pass:idle,
   detail:'No feeder or actuator output before real 24 V Start pulse'}];
  if(!idle)return {...base,status:'failed',cases,
   diagnostic:'PLC or equipment activated without genuine operator start'};
  w=checked(tick(w,[{k:'operate',id:BTN,pressed:true}]).world);
  w=checked(tick(w).world);
  w=checked(tick(w,[{k:'operate',id:BTN,pressed:false}]).world);
  const finished=new Set<string>(),jammed=new Set<string>();
  let faultId:string|null=null,blocked=false,repaired=false,overrun=false;
  for(let i=0;i<LIMIT;i++){
   w=checked(tick(w).world);
   const scene=w.plantWorld.world;
   if(scene.spawnedCount>expected){overrun=true;break;}
   if(scene.spawnedCount===2&&faultId===null){
    const item=scene.bodies.find(b=>b.id==='b2');
    if(item){
     faultId=item.id;
     w=machineFault(w,s,s.fault);
     if(s.sceneId==='bottle-line'){
      // The controller is required to STOP the actual belt at the nozzle
      // while volume feedback is missing, not fabricate completion.
      let found=false;
      for(let j=0;j<340;j++){
       w=checked(tick(w).world);
       const b=product(w,faultId);
       if(b&&b.pos.x>=110&&b.pos.x<=280){
        found=true;break;
       }
      }
      if(found){
       const before=product(w,faultId)!.pos.x;
       for(let j=0;j<35;j++)w=checked(tick(w).world);
       const b=product(w,faultId);
       blocked=!!b&&Math.abs(b.pos.x-before)<20&&
        b.tags.filledMl===0&&b.tags.capped!==true&&
        state(w,'filler','filled')===false;
      }
     }else{
      for(let j=0;j<16;j++)w=checked(tick(w).world);
      const b=product(w,faultId);
      blocked=!!b&&b.pos.x<180&&
       state(w,s.actor,'partHeld')===false&&isComplete(w,s,faultId,1)===false;
     }
     w=machineFault(w,s,null);repaired=true;
    }
   }
   for(const b of bodies(w)){
    if(b.tags.jammed===true)jammed.add(b.id);
    if(b.tags.origin!=='feeder')continue;
    const index=Number(b.id.slice(1))-1;
    if(index>=0&&index<expected&&isComplete(w,s,b.id,index))
     finished.add(b.id);
   }
   if(scene.spawnedCount===expected&&finished.size===expected){
    for(let j=0;j<16;j++)w=checked(tick(w).world);
    break;
   }
   if(renderSnapshot(w).plcs[PLC]?.powered!==true)break;
  }
  const scene=w.plantWorld.world;
  const productIds=scene.bodies.filter(b=>b.tags.origin==='feeder').map(b=>b.id);
  const all=productIds.length===expected&&scene.spawnedCount===expected&&
   scene.despawnedCount===0&&new Set(productIds).size===expected&&
   finished.size===expected&&!overrun;
  const recovered=!!faultId&&blocked&&repaired&&finished.has(faultId);
  const quality=productIds.every((id,i)=>isComplete(w,s,id,i));
  const outputCases=[...cases,
   {id:'continuous-process',pass:all&&quality,
    detail:'Distinct original products completed through live PLC sensory feedback, with genuine physical position/process tags'},
   {id:'fault-in-batch',pass:recovered,
    detail:'Registered second-body machine fault withheld output until repair, then the same original material completed'},
   {id:'bounded-flow',pass:!overrun&&scene.bodies.length<=60&&conserved(scene),
    detail:'No excess feed, body loss, duplication or unbounded material accumulation'},
  ];
  const passed=outputCases.every(c=>c.pass);
  const ms=scene.timeMs;
  return {sceneId,sourceSignature,expected,produced:scene.spawnedCount,
   completed:finished.size,simulatedMs:ms,
   throughputPerSimHour:ms>0?Math.round(finished.size*3600000/ms*100)/100:0,
   jamObservations:jammed.size,faultRecovered:recovered,cases:outputCases,
   status:passed?'passed':'failed',diagnostic:passed?
    'A single physical Start launched bounded sensor-feedback-driven autonomous material processing and recovery in the original worker model. Educational simulation only.':
    'The real PLC/source program failed physical process completion, batch recovery or capacity boundaries'};
 }catch(e){
  return {...base,status:'failed',diagnostic:'Private Worker autonomous process failed',
   cases:[{id:'execution-error',pass:false,detail:e instanceof Error?e.message:String(e)}]};
 }
}
