/**
 * P14 four advanced, original body-conserving factory-workcell tests.
 * Unlike P13's actuator-only tests, every accepted demand must create a
 * PHYSICAL real Worker body using the source's normal powered feeder, then
 * carry/grip, palletize or dose/cap it through genuine PLC-driven devices.
 * No direct creation of bodies in the scorer, no fake PLC coils, no UI mesh.
 *
 * The bench's native 24 V NO buttons exist only in four isolated copies.
 * They drive PLC16 I0.0..3 through the normal electrical netlist.
 * The learner's exact source and output terminal patching are unchanged.
 */
import {createWorld,renderSnapshot,tick} from '../../sim/orchestrator';
import {defaultProgramFor,programOf} from '../../sim/plcs';
import {ioOf} from '../../sim/plc-io';
import type {ProjectFile,WorldState,Wire} from '../../sim/signals';
import {conserved} from '../world/bodies';
import {PLANT_EQUIPMENT} from '../equipment';
import {SCENES} from './catalogue';
import {projectSignature} from './commissioning';
import type {MatrixCaseResult,MatrixResult} from './matrix';

export type AdvancedKind='gantry'|'palletizer'|'robot'|'bottle';
export type AdvancedSpec={sceneId:string;kind:AdvancedKind;
 commands:readonly {actor:string;command:string}[];
 faultActor:string;fault:string;
 details:string};
export const P14_ADVANCED_SPECS:readonly AdvancedSpec[]=[
 {sceneId:'gantry-transfer',kind:'gantry',commands:[
  {actor:'feeder',command:'feed'},{actor:'gantry',command:'grip'},
  {actor:'gantry',command:'dispatch'}],
  faultActor:'gantry',fault:'gripper-leak',
  details:'Physical feeder box, 2-axis gantry grip/650 mm transfer, release onto receiver'},
 {sceneId:'palletizing',kind:'palletizer',commands:[
  {actor:'feeder',command:'feed'},{actor:'palletizer',command:'pick'},
  {actor:'palletizer',command:'place'}],
  faultActor:'palletizer',fault:'gripper-fault',
  details:'Worker body pickup, held package, actual pallet-pattern placement and counted conservation'},
 {sceneId:'robot-sort',kind:'robot',commands:[
  {actor:'feeder',command:'feed'},{actor:'robot',command:'grip'},
  {actor:'robot',command:'dispatch'}],
  faultActor:'robot',fault:'robot-gripper-leak',
  details:'Real box grip and finite-reach robot pickup/transport/release; no material-classification proof'},
 {sceneId:'bottle-line',kind:'bottle',commands:[
  {actor:'feeder',command:'feed'},{actor:'belt',command:'run'},
  {actor:'filler',command:'fill'},{actor:'capper',command:'cap'}],
  faultActor:'filler',fault:'nozzle-blocked',
  details:'Actual cylinder body through moving belt, measured 500 ml fill and cap-after-fill'},
] as const;
export const advancedSpecFor=(id:string):AdvancedSpec|undefined=>
 P14_ADVANCED_SPECS.find(x=>x.sceneId===id);
const PLC='scene-plc',SUPPLY='scene-supply',PFX='p14-trial-';
const channel=(index:number)=>PLC+'.I0.'+index;
const outputPin=(index:number)=>'Q0.'+index;
const localBtn=(index:number)=>PFX+index;
const foundWire=(project:ProjectFile,a:string,b:string):boolean=>
 project.wires.some(w=>(w.from===a&&w.to===b)||(w.from===b&&w.to===a));
const correctProgram=(project:ProjectFile):boolean=>{
 const plc=project.components.find(x=>x.id===PLC&&x.kind==='plc16');
 if(!plc)return false;
 const p=programOf(project,PLC),def=defaultProgramFor('plc16',ioOf(project,plc));
 return p.language!==def.language||
  p.language==='ladder'&&JSON.stringify(p.program)!==JSON.stringify(def.program)||
  p.language==='st'&&p.stSource!==def.stSource||
  p.language==='fbd'&&JSON.stringify(p.fbd)!==JSON.stringify(def.fbd);
};
export function validateP14Specs():void{
 const ids=new Set<string>();
 for(const s of P14_ADVANCED_SPECS){
  if(ids.has(s.sceneId))throw new Error('Repeated advanced scene '+s.sceneId);
  ids.add(s.sceneId);
  const scene=SCENES.find(scene=>scene.id===s.sceneId);
  if(!scene||s.commands.length<3||s.commands.length>4)
   throw new Error('Unsupported advanced physical scene '+s.sceneId);
  for(const cmd of s.commands){
   const part=scene.equipment.find(item=>item.id===cmd.actor);
   if(!part||!PLANT_EQUIPMENT[part.kind].commands.some(c=>
    c.name===cmd.command&&c.kind==='bool'))
    throw new Error('Missing genuine physical PLC command '+cmd.actor+'.'+cmd.command);
  }
  const broken=scene.equipment.find(item=>item.id===s.faultActor);
  if(!broken||!PLANT_EQUIPMENT[broken.kind].faults.includes(s.fault))
   throw new Error('Unimplemented physical machine failure '+s.sceneId);
 }
 if(ids.size!==4)throw new Error('Expected four distinct P14 physical process scenes');
}
validateP14Specs();

export function advancedPreflight(project:ProjectFile,sceneId:string):string[]{
 const s=advancedSpecFor(sceneId);
 if(!s)return ['Not an original P14 advanced factory scene'];
 const scene=SCENES.find(x=>x.id===sceneId)!;
 const problems:string[]=[];
 if(!scene.equipment.every(item=>project.components.some(c=>
  c.id===item.id&&c.kind===item.kind)))
  problems.push('Restore every original factory machine');
 if(!project.components.some(c=>c.id===PLC&&c.kind==='plc16')||
  !project.components.some(c=>c.id===SUPPLY&&c.kind==='supply'))
  problems.push('Provide the original PLC16 and 24 V supply');
 if(!correctProgram(project))problems.push('Author a real learner Ladder/FBD/ST PLC program');
 if((project.faults?.length??0)>0||Object.keys(project.plantFaults??{}).length>0)
  problems.push('Repair existing project faults before a new fault-injection trial');
 if(project.components.some(c=>c.id.startsWith(PFX)))
  problems.push('Reserved physical trial-switch component identifier conflict');
 for(const [a,b] of [[SUPPLY+'.P24',PLC+'.L+'],[SUPPLY+'.M0',PLC+'.M']] as const)
  if(!foundWire(project,a,b))problems.push('Power supply wire missing '+a+' ↔ '+b);
 for(const [i,c] of s.commands.entries()){
  const out=PLC+'.'+outputPin(i);
  const to=c.actor+'.CMD_'+c.command+'+';
  if(!foundWire(project,out,to))
   problems.push('Required actual PLC output '+out+' ↔ '+to+' missing');
  if(!foundWire(project,SUPPLY+'.M0',c.actor+'.M-'))
   problems.push('Equipment return missing: '+c.actor+'.M-');
  if(project.wires.filter(w=>w.from===out||w.to===out).length!==1)
   problems.push('Q output '+out+' must drive exactly one verified device');
 }
 if(s.kind==='bottle'){
  if(project.params?.feeder?.shapeMode!==1||
     project.params?.capper?.requiresFilled!==1)
   problems.push('Bottle line must use an actual cylinder feeder and verified fill-before-cap model');
 }
 return [...new Set(problems)].slice(0,20);
}
function withPhysicalInputs(p:ProjectFile,s:AdvancedSpec):ProjectFile{
 const count=s.commands.length;
 const components=[...p.components,...Array.from({length:count},(_,i)=>({
  id:localBtn(i),kind:'start' as const,x:870,y:300+i*30,pressed:false,
 }))];
 const old=p.wires.filter(w=>!Array.from({length:count},(_,i)=>channel(i))
  .some(ch=>w.from===ch||w.to===ch));
 const fixtures:Wire[]=Array.from({length:count},(_,i)=>[
  {id:'p14-power-'+i,from:SUPPLY+'.P24',to:localBtn(i)+'.A'},
  {id:'p14-input-'+i,from:localBtn(i)+'.B',to:channel(i)},
 ]).flat();
 return {...p,components,wires:[...old,...fixtures]};
}
const verified=(w:WorldState):WorldState=>{
 if(w.lastError)throw new Error(w.lastError);
 if(!conserved(w.plantWorld.world))throw new Error('Physical body conservation failed');
 return w;
};
const scan=(w:WorldState,n:number):WorldState=>{
 if(!Number.isSafeInteger(n)||n<0||n>550)throw new RangeError('Bounded P14 scan count');
 for(let i=0;i<n;i++)w=verified(tick(w).world);
 return w;
};
const press=(w:WorldState,index:number,value:boolean):WorldState=>
 verified(tick(w,[{k:'operate',id:localBtn(index),pressed:value}]).world);
const pulse=(w:WorldState,index:number):WorldState=>{
 w=press(w,index,true);w=scan(w,1);
 return press(w,index,false);
};
const fault=(w:WorldState,s:AdvancedSpec,code:string|null):WorldState=>{
 w=verified(tick(w,[{k:'pause'},{k:'setPlantFault',
  id:s.faultActor,fault:code}]).world);
 return verified(tick(w,[{k:'run'}]).world);
};
const fresh=(p:ProjectFile,s:AdvancedSpec,breakMachine=false):WorldState=>{
 let w=verified(tick(createWorld(),[{k:'loadProject',
  project:withPhysicalInputs(p,s)}]).world);
 if(breakMachine)w=verified(tick(w,[{k:'setPlantFault',
  id:s.faultActor,fault:s.fault}]).world);
 return verified(tick(w,[{k:'run'}]).world);
};
const plcsPowered=(w:WorldState):boolean=>
 renderSnapshot(w).plcs[PLC]?.powered===true;
const isQ=(w:WorldState,index:number):boolean=>
 renderSnapshot(w).plcs[PLC]?.outputs[outputPin(index)]===true;
const bodies=(w:WorldState)=>w.plantWorld.world.bodies;
const body=(w:WorldState)=>bodies(w)[0];
const value=(w:WorldState,id:string,name:string)=>w.plantWorld.signals[id]?.[name];
const count=(w:WorldState)=>w.plantWorld.world.spawnedCount;
const elapsed=(w:WorldState)=>w.plantWorld.world.timeMs;
const oneBody=(w:WorldState)=>count(w)===1&&bodies(w).length===1&&
 w.plantWorld.world.despawnedCount===0;
function requestPart(w:WorldState):WorldState{
 w=pulse(w,0);
 return scan(w,2);
}
function gripping(w:WorldState,s:AdvancedSpec):boolean{
 return value(w,s.kind==='gantry'?'gantry':s.kind==='robot'?'robot':'palletizer',
  'partHeld')===true;
}
function reached(w:WorldState,s:AdvancedSpec):boolean{
 if(s.kind==='gantry'||s.kind==='robot')return oneBody(w)&&
  body(w).pos.x>500&&
  body(w).supportedBy!==(s.kind==='gantry'?'gantry':'robot')&&
  !gripping(w,s);
 if(s.kind==='palletizer')return oneBody(w)&&
  body(w).tags.palletized===true&&
  value(w,'palletizer','placedCount')===1&&!gripping(w,s);
 if(s.kind==='bottle')return oneBody(w)&&body(w).shape==='cylinder'&&
  (body(w).tags.filledMl as number)>=500&&body(w).tags.capped===true&&
  body(w).pos.x>300;
 return false;
}
function transfer(w:WorldState,s:AdvancedSpec):WorldState{
 if(s.kind==='palletizer'){
  w=pulse(w,1);
  w=scan(w,2);
  w=pulse(w,2);
  return scan(w,3);
 }
 if(s.kind==='bottle'){
  w=press(w,1,true);w=press(w,2,true);w=press(w,3,true);
  return scan(w,470);
 }
 w=press(w,1,true);
 w=scan(w,6);
 w=press(w,2,true);
 w=scan(w,s.kind==='gantry'?43:52);
 w=press(w,1,false);
 return scan(w,4);
}
const caseResult=(id:MatrixCaseResult['id'],title:string,pass:boolean,
 success:string,failure:string,w:WorldState):MatrixCaseResult=>({
 id,title,pass,atMs:elapsed(w),detail:pass?success:failure,
});
const failedCase=(id:MatrixCaseResult['id'],title:string,e:unknown):MatrixCaseResult=>({
 id,title,pass:false,atMs:0,detail:e instanceof Error?e.message:String(e),
});
export function runAdvancedProcess(p:ProjectFile,sceneId:string):MatrixResult{
 const signature=projectSignature(p),s=advancedSpecFor(sceneId);
 const preflight=advancedPreflight(p,sceneId);
 if(!s||preflight.length)return {sceneId,sourceSignature:signature,
  status:'blocked',cases:[],diagnostic:preflight.join('; '),executedScans:0};
 const cases:MatrixCaseResult[]=[];
 let total=0;
 const execute=(id:MatrixCaseResult['id'],title:string,
  fn:()=>{world:WorldState;pass:boolean;good:string;bad:string})=>{
  try{
   const {world,pass,good,bad}=fn();
   total+=Math.ceil(elapsed(world)/50);
   cases.push(caseResult(id,title,pass,good,bad,world));
  }catch(error){cases.push(failedCase(id,title,error));}
 };
 execute('idle','No demand means no physical product or unintended output',()=>{
  const w=scan(fresh(p,s!),8);
  const pass=plcsPowered(w)&&count(w)===0&&bodies(w).length===0&&
   s!.commands.every((_,i)=>!isQ(w,i));
  return {world:w,pass,good:'True PLC idle: all four-stage commands OFF; zero manufactured bodies',
   bad:'The PLC actuated equipment or created material before a real demand'};
 });
 execute('demand','Real PLC produces and completes one physically conserved process',()=>{
  let w=requestPart(fresh(p,s!));
  const started=oneBody(w)&&body(w).tags.origin==='feeder';
  w=transfer(w,s!);
  const pass=started&&reached(w,s!)&&plcsPowered(w);
  return {world:w,pass,good:s!.details+'; one real feeder product and zero invented duplicates',
   bad:'Physical material feed, PLC actuation, measured handoff, positioning or body conservation failed'};
 });
 execute('release','Intermediate stop cannot grant a fictitious completed process',()=>{
  let w=requestPart(fresh(p,s!));
  if(s!.kind==='palletizer'){
   w=pulse(w,1);w=scan(w,6);
   const pass=oneBody(w)&&gripping(w,s!)&&
    value(w,'palletizer','placedCount')===0&&
    body(w).tags.palletized!==true&&!isQ(w,2);
   return {world:w,pass,good:'Actual gripped carton is held; no uncommanded placement is scored',
    bad:'Palletizer released/placed a body with no physical PLC place demand'};
  }
  if(s!.kind==='bottle'){
   w=press(w,1,true);w=scan(w,75);
   w=press(w,1,false);w=press(w,2,true);w=press(w,3,true);
   w=scan(w,50);
   const pass=oneBody(w)&&body(w).shape==='cylinder'&&
    (body(w).tags.filledMl as number)===0&&body(w).tags.capped!==true&&
    body(w).pos.x<0&&!isQ(w,1);
   return {world:w,pass,good:'Real bottle stopped outside filler/capper; neither fill nor cap may be fabricated',
    bad:'Stopped body moved into a nonexistent process or acquired false dose/cap tags'};
  }
  w=press(w,1,true);w=scan(w,5);
  const hadGrip=gripping(w,s!);
  w=press(w,1,false);w=scan(w,5);
  const pass=oneBody(w)&&hadGrip&&!gripping(w,s!)&&
   body(w).pos.x<350&&!isQ(w,2);
  return {world:w,pass,good:'Real gripped body is released at source; no uncommanded outbound transfer',
   bad:'PLC released early but model fabricated final delivery'};
 });
 execute('fault-recovery','Real failed machine blocks product; repair restores measured physical outcome',()=>{
  let w=requestPart(fresh(p,s!,true));
  let stopped=false;
  if(s!.kind==='palletizer'){
   w=pulse(w,1);w=scan(w,5);
   stopped=oneBody(w)&&!gripping(w,s!)&&
    value(w,'palletizer','placedCount')===0;
   w=fault(w,s!,null);
   w=pulse(w,1);w=scan(w,3);
   w=pulse(w,2);w=scan(w,4);
  }else if(s!.kind==='bottle'){
   w=press(w,1,true);w=press(w,2,true);w=press(w,3,true);
   w=scan(w,240);
   stopped=oneBody(w)&&body(w).shape==='cylinder'&&
    (body(w).tags.filledMl as number)===0&&
    body(w).tags.capped!==true;
   w=fault(w,s!,null);
   w=scan(w,235);
  }else{
   w=press(w,1,true);w=scan(w,8);
   stopped=oneBody(w)&&!gripping(w,s!);
   w=fault(w,s!,null);
   w=scan(w,7);
   w=press(w,2,true);
   w=scan(w,s!.kind==='gantry'?43:52);
   w=press(w,1,false);w=scan(w,4);
  }
  const pass=stopped&&reached(w,s!)&&plcsPowered(w);
  return {world:w,pass,good:'Registered plant failure prevented real material movement; repair completed worker-owned product cycle',
   bad:'Machine failure did not inhibit a real body or the body failed to recover after repair'};
 });
 return {sceneId,sourceSignature:signature,cases,
  status:cases.every(x=>x.pass)?'passed':'failed',
  diagnostic:cases.every(x=>x.pass)?
   'Four bounded, independent real PLC and body-conserving process cases passed. This is not full industrial certification':
   'At least one independent real body-transfer or fault-recovery scenario did not satisfy its measured outcome',
  executedScans:Math.min(2400,total)};
}
