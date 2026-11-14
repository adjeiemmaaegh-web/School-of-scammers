/**
 * P11 chronological worker-verified factory learning trials.
 *
 * The 21 ORIGINAL scene trials each require two or three equipment-specific
 * observations IN ORDER, on separately advancing deterministic worker scans.
 * They do not execute the sample ST, toggle PLC coils, use renderer geometry,
 * infer camera events, mark a button "passed" or pretend industrial safety.
 *
 * Observations are evidence of the explicitly listed teaching goals, not
 * validation of all solutions, hard-wired safety, arbitrary shop hardware,
 * or an external machine. The source program may be any Ladder, FBD or ST.
 */
import {isPlcKind} from '../../components/registry';
import type {ProjectFile,RenderSnapshot} from '../../sim/signals';
import {PLANT_EQUIPMENT} from '../equipment';
import {SCENES,type PlantScene} from './catalogue';
import {projectSignature,type CommissioningCheck} from './commissioning';

export type TrialGoal={
 id:string;label:string;part:string;signal:string;
 condition:'rise'|'fall'|'above';threshold?:number;
 /** For a driven action, a REAL PLC Q must have energized this wired
  * command on a recorded scan. A non-PLC manual actuation earns no credit.
  */
 command?:string;
};
const rise=(id:string,label:string,part:string,signal:string,command?:string):TrialGoal=>
 ({id,label,part,signal,condition:'rise',...(command?{command}:{})});
const fall=(id:string,label:string,part:string,signal:string,command?:string):TrialGoal=>
 ({id,label,part,signal,condition:'fall',...(command?{command}:{})});
const above=(id:string,label:string,part:string,signal:string,
 threshold:number,command?:string):TrialGoal=>
 ({id,label,part,signal,condition:'above',threshold,...(command?{command}:{})});

/** Individual scene-specific objectives. They are not manufacturer-provided
 * reference scenes or guaranteed full physical process certification.
 * Unimplemented PLC analog outputs are NOT incorrectly claimed as verified.
 */
export const SCENE_TRIALS:Readonly<Record<string,readonly TrialGoal[]>>={
 'sorting-line':[
  rise('inspect','Photoeye detects a real parcel','eye1','present'),
  rise('divert','PLC-operated gate reaches reject position','gate','rejected','reject'),
 ],
 'gate-accumulation':[
  rise('queue','Queue eye detects arriving material','queue-eye','present'),
  rise('block','PLC extends the physical stopper','stopper','extended','extend'),
 ],
 'weigh-reject':[
  above('weigh','Mass sensor observes a load greater than 3 kg','weight','weightKg',3),
  rise('reject','PLC extends the pusher to reject','pusher','extended','extend'),
 ],
 'two-level-lift':[
  rise('raise','PLC starts vertical lift travel','lift','moving','up'),
  rise('top','Lift physically reaches its upper limit','lift','top'),
 ],
 'gantry-transfer':[
  rise('pick','PLC gripper successfully picks a physical body','gantry','partHeld','grip'),
  fall('release','Gripper releases its previously held body','gantry','partHeld'),
 ],
 'palletizing':[
  rise('pick','Palletizer picks an available workpiece','palletizer','partHeld','pick'),
  above('place','Placed-body counter advances from zero','palletizer','placedCount',0,'place'),
 ],
 'mini-warehouse':[
  rise('travel','PLC starts a crane storage operation','crane','busy','store'),
  above('stored','Crane completes a physical storage transfer','crane','storedCount',0,'store'),
 ],
 'robot-sort':[
  rise('sense','Inductive detector finds metallic material','eye','present'),
  rise('grasp','PLC-controlled robot takes hold of material','robot','partHeld','grip'),
 ],
 'mixing-tank':[
  above('level','Measured tank level crosses 250 ml','tank','levelMl',250),
  rise('mix','PLC-driven agitator starts rotating','mixer','running','run'),
 ],
 'bottle-line':[
  rise('arrive','Bottle is detected at the optical eye','eye','present'),
  rise('dose','PLC-controlled filler completes a genuine dose','filler','filled','fill'),
  rise('cap','PLC-controlled capper completes a cap','capper','capped','cap'),
 ],
 'material-inspection':[
  rise('material','Capacitive detector recognizes material','material','present'),
  rise('reject','PLC moves nonmetal reject gate','gate','rejected','reject'),
 ],
 'height-guard':[
  rise('tall','Real light-curtain measurement classifies a tall body','curtain','tall'),
  rise('stop','PLC raises stopper for tall material','stop','extended','extend'),
 ],
 'three-way-handoff':[
  rise('index','PLC moves the physical turntable','table','busy','turn'),
  rise('complete','Turntable finishes its indexed quarter-turn','table','rotated'),
 ],
 'reversible-roller-lane':[
  rise('moving','PLC starts powered roller movement','rollers','moving','run'),
  rise('hold','PLC raises accumulation stopper','stop','extended','extend'),
 ],
 'parallel-sort-cells':[
  rise('lane','PLC runs first independent inspection lane','line-a','moving','run'),
  rise('metal','Inductive sensor detects an actual metal target','metal-a','present'),
 ],
 'scissor-lift-station':[
  rise('lift','PLC starts scissor platform travel','lift','moving','up'),
  rise('upper','Scissor platform reaches upper sensor','lift','top'),
 ],
 'rotary-inspection':[
  rise('turn','PLC starts rotary index movement','index','busy','turn'),
  rise('indexed','Rotary fixture reaches indexed position','index','indexed'),
 ],
 'guarded-conveyor':[
  rise('obstruct','Light curtain detects a body','curtain','blocked'),
  rise('stop','PLC extends physical workcell stopper','stop','extended','extend'),
 ],
 'temperature-batch':[
  above('fill','Process vessel rises above 250 ml','tank','levelMl',250),
  rise('agitate','PLC starts batch agitator','mix','running','run'),
 ],
 'flow-valve-diagnostics':[
  above('liquid','Tank has actual rising fluid level above 250 ml','tank','levelMl',250),
  rise('agitator','PLC turns on the mixing actuator','mixer','running','run'),
 ],
 'robot-warehouse-receiving':[
  rise('store','PLC starts warehouse crane movement','crane','busy','store'),
  above('stored','Crane successfully stores a received item','crane','storedCount',0,'store'),
 ],
};
export type TrialWitness={id:string;label:string;atMs:number;value:boolean|number};
export type TrialEvidence={
 sceneId:string;signature:string;lastTimeMs:number;
 lastReadings:Readonly<Record<string,boolean|number>>;
 /** One finished observation per worker scan; no simultaneous auto-passing. */
 witnesses:readonly TrialWitness[];
 /** Real wired energized PLC commands observed after this trial began. */
 poweredCommands:readonly string[];
 state:'setup'|'running'|'observed';
 hint:string;
};
const keyOf=(g:TrialGoal)=>g.part+'.'+g.signal;
const observation=(snapshot:RenderSnapshot,g:TrialGoal):boolean|number|undefined=>{
 const value=snapshot.plantWorld.signals[g.part]?.[g.signal];
 return typeof value==='boolean'?value:
  typeof value==='number'&&Number.isFinite(value)?value:undefined;
};
const crossing=(goal:TrialGoal,old:unknown,now:unknown):boolean=>{
 if(goal.condition==='rise')return old===false&&now===true;
 if(goal.condition==='fall')return old===true&&now===false;
 return typeof old==='number'&&Number.isFinite(old)&&
  typeof now==='number'&&Number.isFinite(now)&&
  old<=(goal.threshold??0)&&now>(goal.threshold??0);
};
/** A model signal plus a wired PLC output actively ON at some worker scan.
 * Both the Q output and electrical patch belong to real worker-backed state;
 * this does not assert 24V safety rating, current measurement, or causality
 * for unrelated material movement.
 */
export function energizedPhysicalCommands(
 project:ProjectFile,snapshot:RenderSnapshot,
):string[]{
 const plcs=project.components.filter(c=>isPlcKind(c.kind));
 const energized=new Set<string>();
 for(const wire of project.wires){
  for(const [from,to] of [[wire.from,wire.to],[wire.to,wire.from]]){
   const ix=to.indexOf('.CMD_');
   if(ix<1||!to.endsWith('+'))continue;
   const id=to.slice(0,ix),command=to.slice(ix+5,-1);
   const equipment=project.components.find(c=>c.id===id);
   if(!equipment||!PLANT_EQUIPMENT[equipment.kind]?.commands.some(c=>
      c.name===command&&c.kind==='bool'))continue;
   for(const plc of plcs){
    const prefix=plc.id+'.';
    if(!from.startsWith(prefix))continue;
    const port=from.slice(prefix.length);
    if(!/^Q[01]\.[0-7]$/.test(port))continue;
    if(snapshot.plcs[plc.id]?.powered&&snapshot.plcs[plc.id].outputs[port]===true)
     energized.add(id+'.'+command);
   }
  }
 }
 return [...energized].sort().slice(0,60);
}
const validPreflight=(checks:readonly CommissioningCheck[],snap:RenderSnapshot)=>
 ['equipment','plc-power','io-patches','program','faults'].every(k=>
   checks.some(c=>c.id===k&&c.pass))&&
 !snap.lastError&&
 Object.keys(snap.debugForces??{}).length===0&&
 Object.values(snap.plcs).every(plc=>Object.keys(plc.debugForces??{}).length===0);
const initial=(scene:PlantScene,project:ProjectFile,snap:RenderSnapshot,
 hint:string):TrialEvidence=>({
 sceneId:scene.id,signature:projectSignature(project),
 lastTimeMs:snap.plantWorld.world.timeMs,lastReadings:Object.fromEntries(
  SCENE_TRIALS[scene.id].map(g=>[keyOf(g),observation(snap,g)])
   .filter((e):e is [string,boolean|number]=>e[1]!==undefined)),
 witnesses:[],poweredCommands:[],state:'setup',hint,
});
/** Important: the initial snapshot is a BASELINE, never a passed event.
 * P10 electrical/PLC preflight is independent and must stay satisfied.
 * A following real scan may satisfy only the NEXT ordered milestone.
 */
export function advanceSceneTrial(
 scene:PlantScene,project:ProjectFile,snapshot:RenderSnapshot,
 checks:readonly CommissioningCheck[],previous:TrialEvidence|null,
):TrialEvidence{
 const goals=SCENE_TRIALS[scene.id];
 if(!goals)throw new Error('Unknown original assessment scene');
 const sig=projectSignature(project),time=snapshot.plantWorld.world.timeMs;
 const okay=validPreflight(checks,snapshot);
 if(!Number.isSafeInteger(time)||time<0||
  previous?.sceneId!==scene.id||previous?.signature!==sig||
  time<(previous?.lastTimeMs??0))
  return initial(scene,project,snapshot,'A fresh project or simulation requires new evidence');
 const baseline=previous??initial(scene,project,snapshot,'Collecting first worker reading');
 if(!okay){
  return initial(scene,project,snapshot,
   'Finish actual PLC power, I/O patches, authored logic and fault preflight first');
 }
 if(time<=baseline.lastTimeMs)return {
  ...baseline,state:baseline.witnesses.length===goals.length?'observed':
   baseline.witnesses.length?'running':'setup',
  hint:baseline.hint,
 };
 const samples=Object.fromEntries(goals.map(g=>[keyOf(g),observation(snapshot,g)])
  .filter((e):e is [string,boolean|number]=>e[1]!==undefined));
 const activeOutputs=energizedPhysicalCommands(project,snapshot);
 const outputs=new Set([...baseline.poweredCommands,...activeOutputs]);
 const witnesses=[...baseline.witnesses];
 const goal=goals[witnesses.length];
 if(goal&&crossing(goal,baseline.lastReadings[keyOf(goal)],samples[keyOf(goal)])&&
  (!goal.command||outputs.has(goal.part+'.'+goal.command))){
  witnesses.push({id:goal.id,label:goal.label,atMs:time,
   value:samples[keyOf(goal)]});
 }
 const done=witnesses.length===goals.length;
 const hint=done?
  'All listed chronological worker observations witnessed; not a safety or complete functional certification':
  goal?.command&&!outputs.has(goal.part+'.'+goal.command)?
   'Await a real energized PLC output wired to '+goal.part+'.CMD_'+goal.command+'+':
   'Observe the next worker-simulated milestone on a subsequent PLC scan';
 return {sceneId:scene.id,signature:sig,lastTimeMs:time,
  lastReadings:samples,witnesses,
  poweredCommands:[...outputs].slice(0,60),
  state:done?'observed':'running',hint};
}
export const trialProgress=(scene:PlantScene,entry:TrialEvidence)=>
 ({done:entry.witnesses.length,total:SCENE_TRIALS[scene.id].length});
export function validateSceneTrials():void{
 const known=SCENES.map(s=>s.id);
 if(known.length!==Object.keys(SCENE_TRIALS).length||
  known.some(id=>!SCENE_TRIALS[id]))throw new Error('Missing scene assessment specification');
 for(const scene of SCENES){
  const goals=SCENE_TRIALS[scene.id],ids=new Set<string>();
  if(goals.length<2||goals.length>3)throw new Error('Invalid trial length '+scene.id);
  for(const goal of goals){
   if(ids.has(goal.id))throw new Error('Duplicate trial objective '+scene.id+'.'+goal.id);
   ids.add(goal.id);
   const placement=scene.equipment.find(p=>p.id===goal.part);
   if(!placement)throw new Error('Trial references unknown equipment '+goal.part);
   const def=PLANT_EQUIPMENT[placement.kind];
   const signal=def.signals.find(s=>s.name===goal.signal);
   if(!signal||signal.kind!==(goal.condition==='above'?'number':'bool'))
    throw new Error('Unknown/mismatched trial worker signal '+goal.part+'.'+goal.signal);
   if(goal.condition==='above'&&(!Number.isFinite(goal.threshold)||
      (goal.threshold??0)<0))throw new Error('Invalid trial threshold');
   if(goal.command&&!def.commands.some(c=>c.name===goal.command&&c.kind==='bool'))
    throw new Error('Unknown/mismatched trial physical command');
  }
 }
}
validateSceneTrials();
