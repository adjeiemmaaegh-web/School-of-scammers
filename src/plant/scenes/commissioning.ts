/**
 * P10 bounded training-commissioning evidence. Every input is a real,
 * serializable ProjectFile + Web Worker RenderSnapshot. NO 3D mesh positions,
 * fake scoring, timers, wall-clock data or automatic PLC command output.
 *
 * This is a live diagnostic checklist, NOT an assessed industrial acceptance
 * procedure; an observed motion/transition does not prove a correct sequence.
 */
import {COMPONENTS,isPlcKind} from '../../components/registry';
import {defaultProgramFor,programOf} from '../../sim/plcs';
import {ioOf} from '../../sim/plc-io';
import type {PlacedComponent,ProjectFile,RenderSnapshot} from '../../sim/signals';
import {PLANT_EQUIPMENT} from '../equipment';
import {SCENES,type PlantScene,type SceneLink} from './catalogue';

export type CommissioningCheck={
 id:'equipment'|'plc-power'|'io-patches'|'program'|'scan'|'response'|'faults';
 label:string;
 pass:boolean;
 detail:string;
 /** Distinguishes equipment/electrical evidence from optional instructional guidance. */
 category:'preflight'|'observed';
};
export type CommissioningEvidence={
 sceneId:string;signature:string;
 lastWorldTimeMs:number;
 lastSignals:Readonly<Record<string,boolean|number>>;
 lastBodies:Readonly<Record<string,{x:number;y:number;z:number}>>;
 lastEquipment:Readonly<Record<string,{positionMm:number;progress:number;levelMl:number}>>;
 observedTransitions:readonly string[];
 bodyMovement:boolean;
 actuatorMovement:boolean;
 observedScans:number;
};
/** The world is deterministic, but editing/wiring/rewriting the project must
 * immediately invalidate evidence collected against an older revision. */
export const projectSignature=(p:ProjectFile):string=>JSON.stringify([
 p.components,p.wires,p.program,p.language,p.stSource,p.fbd,
 p.plcPrograms,p.plcIo,p.params,p.faults,p.plantFaults,
]);
export function sceneFromProject(project:ProjectFile|null):PlantScene|undefined{
 if(!project)return;
 return SCENES.find(scene=>scene.equipment.every(item=>
  project.components.some(c=>c.id===item.id&&c.kind===item.kind)));
}
const component=(project:ProjectFile,id:string):PlacedComponent|undefined=>
 project.components.find(c=>c.id===id);
const wired=(project:ProjectFile,a:string,b:string):boolean=>
 project.wires.some(w=>(w.from===a&&w.to===b)||(w.to===a&&w.from===b));

/** A valid direct physical terminal mapping, not a claim that this machine's
 * electrical circuit/24V sensor supply is complete or its signal is active.
 * Numerical outputs use the distinct AI terminals, not digital Ix.y.
 */
export function directSceneLinkPatched(
 link:SceneLink,project:ProjectFile,plcId:string,
):boolean{
 const plc=component(project,plcId);
 if(!plc||!isPlcKind(plc.kind))return false;
 const terminal=link.source.startsWith('PLC.')?link.target:link.source;
 const sep=terminal.indexOf('.');
 if(sep<1)return false;
 const part=component(project,terminal.slice(0,sep));
 if(!part)return false;
 const channel=terminal.slice(sep+1);
 const def=PLANT_EQUIPMENT[part.kind];
 if(!def)return false;
 const fromPlc=link.source.startsWith('PLC.');
 const match=(fromPlc?def.commands:def.signals)
  .find(ch=>ch.name===channel&&ch.kind===link.kind);
 if(!match)return false;
 const pin=part.id+'.'+(fromPlc?match.kind==='bool'?
  'CMD_'+channel+'+':'SET_'+channel:
  match.kind==='bool'?'OUT_'+channel:'AN_'+channel);
 const names=COMPONENTS[plc.kind].terminals
  .filter(t=>t.role===(fromPlc?match.kind==='bool'?'output':'analog-output':
   match.kind==='bool'?'input':'analog-input'))
  .map(t=>plcId+'.'+t.name);
 return names.some(other=>wired(project,pin,other));
}
const rawSignals=(scene:PlantScene,snapshot:RenderSnapshot)=>
 Object.fromEntries(scene.equipment.flatMap(item=>{
  const def=PLANT_EQUIPMENT[item.kind];
  return def.signals.map(ch=>[item.id+'.'+ch.name,
   snapshot.plantWorld.signals[item.id]?.[ch.name]] as const);
 }).filter((entry):entry is readonly [string,boolean|number]=>
  typeof entry[1]==='boolean'||
  typeof entry[1]==='number'&&Number.isFinite(entry[1])));
const near=(a:number,b:number)=>Math.abs(a-b)<1e-6;
const changed=(a:boolean|number,b:boolean|number)=>typeof a!==typeof b||
 typeof a==='boolean'?a!==b:!near(a as number,b as number);

/** Return a fresh, bounded evidence snapshot, never mutate the world.
 * No credit is granted for the first sample or for simulated time going
 * backwards; avoiding stale/previous-project successes is essential.
 */
export function accumulateCommissioning(
 scene:PlantScene,project:ProjectFile,snapshot:RenderSnapshot,
 previous:CommissioningEvidence|null,
):CommissioningEvidence{
 const signature=projectSignature(project);
 const time=snapshot.plantWorld.world.timeMs;
 const same=!!previous&&previous.sceneId===scene.id&&
  previous.signature===signature&&time>=previous.lastWorldTimeMs;
 const signals=rawSignals(scene,snapshot);
 const bodies=Object.fromEntries(snapshot.plantWorld.world.bodies.map(b=>
  [b.id,{...b.pos}]));
 const equipment=Object.fromEntries(scene.equipment.map(item=>{
  const state=snapshot.plantWorld.world.model[item.id];
  return [item.id,{positionMm:state?.positionMm??0,
   progress:state?.progress??0,levelMl:state?.levelMl??0}];
 }));
 const transitions=same?new Set(previous.observedTransitions):new Set<string>();
 let bodyMovement=same?previous.bodyMovement:false;
 let actuatorMovement=same?previous.actuatorMovement:false;
 const advanced=same&&time>previous.lastWorldTimeMs;
 if(advanced){
  for(const [key,value] of Object.entries(signals)){
   const past=previous.lastSignals[key];
   if(past!==undefined&&changed(past,value))transitions.add(key);
  }
  for(const [id,now] of Object.entries(bodies)){
   const then=previous.lastBodies[id];
   if(then&&(!near(then.x,now.x)||!near(then.y,now.y)||!near(then.z,now.z)))
    bodyMovement=true;
  }
  for(const [id,now] of Object.entries(equipment)){
   const then=previous.lastEquipment[id];
   if(then&&(!near(then.positionMm,now.positionMm)||
    !near(then.progress,now.progress)||!near(then.levelMl,now.levelMl)))
    actuatorMovement=true;
  }
 }
 return {sceneId:scene.id,signature,lastWorldTimeMs:time,
  lastSignals:signals,lastBodies:bodies,lastEquipment:equipment,
  observedTransitions:[...transitions].slice(0,128),
  bodyMovement,actuatorMovement,
  observedScans:(same?previous.observedScans:0)+(advanced?1:0),
 };
}

/** A preflight with real worker evidence. Never label this as a successful
 * functional sequence, accepted industry certification or physical safety. */
export function sceneCommissioningChecks(
 scene:PlantScene,project:ProjectFile,snapshot:RenderSnapshot,
 evidence:CommissioningEvidence,
):CommissioningCheck[]{
 const actual=scene.equipment.filter(item=>
  project.components.some(c=>c.id===item.id&&c.kind===item.kind));
 const missing=scene.equipment.filter(item=>
  !actual.some(c=>c.id===item.id));
 const plc=project.components.find(c=>isPlcKind(c.kind));
 const plcId=plc?.id??'';
 const powered=!!snapshot.plcs[plcId]?.powered;
 const linked=scene.recommendedLinks.filter(link=>
  directSceneLinkPatched(link,project,plcId));
 const cfg=plc?programOf(project,plcId):null;
 const placeholder=plc?defaultProgramFor(plc.kind,ioOf(project,plc)):null;
 const programAuthored=!!cfg&&!!placeholder&&(
  cfg.language!==placeholder.language||
  cfg.language==='st'&&cfg.stSource!==placeholder.stSource||
  cfg.language==='ladder'&&JSON.stringify(cfg.program)!==JSON.stringify(placeholder.program)||
  cfg.language==='fbd'&&JSON.stringify(cfg.fbd)!==JSON.stringify(placeholder.fbd));
 const responsive=evidence.bodyMovement||evidence.actuatorMovement||
  evidence.observedTransitions.length>0;
 const faults=Object.keys(project.plantFaults??{}).length+
  (project.faults?.length??0);
 const check=(id:CommissioningCheck['id'],label:string,pass:boolean,
  detail:string,category:CommissioningCheck['category']='preflight'):CommissioningCheck=>
   ({id,label,pass,detail,category});
 return [
  check('equipment','Required workcell equipment',
   missing.length===0,
   missing.length?('Missing: '+missing.map(x=>x.id).join(', ')):
    `All ${actual.length} original station devices are still present`),
  check('plc-power','24 V PLC actually powered',
   powered,powered?'The worker reports a powered controller':
    'Connect supply P24/M0 to PLC L+/M and resolve electrical faults'),
  check('io-patches','Suggested direct I/O patches',
   linked.length===scene.recommendedLinks.length,
   `${linked.length}/${scene.recommendedLinks.length} mapped; also wire device L+/M or CMD return as needed`),
  check('program','Learner-authored PLC logic',
   programAuthored,programAuthored?
    'PLC source differs from its shipped placeholder; correctness still needs testing':
    'Edit Ladder, FBD or Structured Text rather than leaving the starter passthrough'),
  check('scan','Real world clock advancing',
   evidence.observedScans>=1,
   `${evidence.observedScans} observed worker updates after starting this checklist`,'observed'),
  check('response','Physical or signal response observed',
   responsive,responsive?
    `${evidence.observedTransitions.length} signal transitions; body moved: ${evidence.bodyMovement}; machine changed: ${evidence.actuatorMovement}`:
    'Run a powered PLC-controlled cycle and observe worker-owned motion or signal changes','observed'),
  check('faults','No unresolved simulation faults',
   !faults&&!snapshot.lastError,
   faults?`${faults} injected faults present`:
    snapshot.lastError??'No current worker errors or injected faults','observed'),
 ];
}
