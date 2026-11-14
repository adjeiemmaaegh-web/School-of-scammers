import {describe,it,expect} from 'vitest';
import {createWorld,renderSnapshot,tick} from '../src/sim/orchestrator';
import {makePlantSceneProject} from '../src/sim/p3-scene-import';
import {accumulateCommissioning,sceneCommissioningChecks}
 from '../src/plant/scenes/commissioning';
import {advanceSceneTrial,energizedPhysicalCommands,SCENE_TRIALS,
 trialProgress,validateSceneTrials,type TrialEvidence}
 from '../src/plant/scenes/assessment';
import {SCENES} from '../src/plant/scenes/catalogue';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {plantPlacements} from '../src/sim/p3-plant-bridge';
import {stepScene} from '../src/plant/world/runner';
import type {Command,ProjectFile,RenderSnapshot,WorldState}
 from '../src/sim/signals';

const rotary=SCENES.find(s=>s.id==='rotary-inspection')!;
const source=['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;','END_VAR','Out0 := NOT In1;'].join('\n');
const links=[
 ['scene-supply.P24','scene-plc.L+'],['scene-supply.M0','scene-plc.M'],
 ['scene-supply.P24','index.L+'],['scene-supply.M0','index.M'],
 ['scene-supply.M0','index.M-'],
 ['scene-supply.P24','eye.L+'],['scene-supply.M0','eye.M'],
 ['eye.OUT_present','scene-plc.I0.0'],
 ['index.OUT_indexed','scene-plc.I0.1'],
 ['scene-plc.Q0.0','index.CMD_turn+'],
] as const;
const build=():WorldState=>{
 const base=makePlantSceneProject(rotary.id);
 const wired:ProjectFile={...base,
  wires:links.map(([from,to],i)=>({id:'w'+(i+1),from,to}))};
 const initial=tick(createWorld(),[{k:'loadProject',project:wired},
  {k:'loadST',source}]).world;
 expect(initial.lastError).toBeNull();
 return initial;
};
const sample=(state:WorldState,previous:TrialEvidence|null)=>{
 const snap=renderSnapshot(state);
 const scene=rotary;
 const e=accumulateCommissioning(scene,state.project,snap,null);
 const checks=sceneCommissioningChecks(scene,state.project,snap,e);
 return advanceSceneTrial(scene,state.project,snap,checks,previous);
};
const tickTrial=(state:WorldState,steps:number)=>{
 let world=state;
 let trial=sample(world,null);
 const history:TrialEvidence[]=[trial];
 world=tick(world,[{k:'run'}]).world;
 for(let i=0;i<steps;i++){
  world=tick(world).world;
  expect(world.lastError).toBeNull();
  trial=sample(world,trial);
  history.push(trial);
 }
 return {world,trial,history};
};
describe('P11 21 original, chronological, worker-observed factory learning trials',()=>{
 it('covers exactly 21 scene IDs with valid real registered signals and controller commands',()=>{
  expect(()=>validateSceneTrials()).not.toThrow();
  expect(Object.keys(SCENE_TRIALS).sort()).toEqual(SCENES.map(s=>s.id).sort());
  for(const scene of SCENES){
   const goals=SCENE_TRIALS[scene.id];
   expect(goals.length).toBeGreaterThanOrEqual(2);
   expect(goals.length).toBeLessThanOrEqual(3);
   for(const goal of goals){
    const part=scene.equipment.find(p=>p.id===goal.part)!;
    const def=PLANT_EQUIPMENT[part.kind];
    expect(def.signals.some(ch=>ch.name===goal.signal)).toBe(true);
    if(goal.command)
     expect(def.commands.some(ch=>ch.name===goal.command)).toBe(true);
   }
  }
 });
 it('does not award any trial evidence to an unpowered, unprogrammed factory',()=>{
  const p=makePlantSceneProject(rotary.id);
  let w=tick(createWorld(),[{k:'loadProject',project:p}]).world;
  let a=sample(w,null);
  expect(a.state).toBe('setup');
  w=tick(w,[{k:'run'}]).world;
  for(let i=0;i<35;i++){w=tick(w).world;a=sample(w,a);}
  expect(w.plantWorld.world.timeMs).toBeGreaterThan(1000);
  expect(a.witnesses).toHaveLength(0);
  expect(a.state).toBe('setup');
 });
 it('accepts a real powered PLC16 ST -> wired rotary actuator -> two distinct world-state observations',()=>{
  const start=build();
  const {world,trial,history}=tickTrial(start,35);
  expect(world.plantWorld.signals.index.indexed).toBe(true);
  expect(trial.state).toBe('observed');
  expect(trialProgress(rotary,trial)).toEqual({done:2,total:2});
  expect(trial.witnesses.map(w=>w.id)).toEqual(['turn','indexed']);
  expect(trial.witnesses[1].atMs).toBeGreaterThan(trial.witnesses[0].atMs);
  expect(trial.poweredCommands).toContain('index.turn');
  const atMostOne=history.every((e,i)=>i===0||
    e.witnesses.length-history[i-1].witnesses.length<=1);
  expect(atMostOne).toBe(true);
  expect(world.plcs['scene-plc'].powered).toBe(true);
  expect(world.plantWorld.world.model.index.progress).toBe(1);
 });
 it('does not grant credit from a static high signal, repeated timestamps, or a mere world clock',()=>{
  const w=build(),snap=renderSnapshot(w);
  const baseline=sample(w,null);
  expect(baseline.witnesses).toHaveLength(0);
  const repeated=sample(w,baseline);
  expect(repeated.witnesses).toHaveLength(0);
  // A forged visually "busy" indicator with no simulation-clock advance is ignored.
  const fake:RenderSnapshot={...snap,plantWorld:{...snap.plantWorld,
   signals:{...snap.plantWorld.signals,index:{...snap.plantWorld.signals.index,busy:true}}}};
  const e=accumulateCommissioning(rotary,w.project,fake,null);
  const checked=sceneCommissioningChecks(rotary,w.project,fake,e);
  expect(advanceSceneTrial(rotary,w.project,fake,checked,baseline).witnesses)
   .toHaveLength(0);
 });
 it('keeps source wiring and PLC output types separate from any manual simulator actuation',()=>{
  const w=build();
  const snap=renderSnapshot(w);
  expect(energizedPhysicalCommands(w.project,snap)).toEqual([]);
  // The Q0.0 wire exists but no energized Q was actually observed yet.
  expect(w.project.wires.some(x=>x.to==='index.CMD_turn+')).toBe(true);
  const running=tickTrial(w,3);
  expect(energizedPhysicalCommands(running.world.project,
   renderSnapshot(running.world))).toContain('index.turn');
  const disconnected={...running.world.project,wires:[]};
  expect(energizedPhysicalCommands(disconnected,
   renderSnapshot(running.world))).toEqual([]);
 });
 it('clears earned evidence after project revision, fault injection or manual PLC forcing',()=>{
  const {world,trial}=tickTrial(build(),35);
  expect(trial.state).toBe('observed');
  const changed={...world.project,params:{...world.project.params,
   index:{turnMs:1600}}};
  const snap=renderSnapshot(world);
  const checks=sceneCommissioningChecks(rotary,changed,snap,
   accumulateCommissioning(rotary,changed,snap,null));
  const stale=advanceSceneTrial(rotary,changed,snap,checks,trial);
  expect(stale.witnesses).toHaveLength(0);
  const forcing:RenderSnapshot={...snap,plcs:{...snap.plcs,
   'scene-plc':{...snap.plcs['scene-plc'],debugForces:{Out0:true}}}};
  const c=sceneCommissioningChecks(rotary,world.project,forcing,
   accumulateCommissioning(rotary,world.project,forcing,null));
  const blocked=advanceSceneTrial(rotary,world.project,forcing,c,trial);
  expect(blocked.witnesses).toHaveLength(0);
  const faulty={...world.project,plantFaults:{index:'actuator-stuck'}};
  const bad=sceneCommissioningChecks(rotary,faulty,snap,
   accumulateCommissioning(rotary,faulty,snap,null));
  expect(advanceSceneTrial(rotary,faulty,snap,bad,trial).state).toBe('setup');
 });
 it('rejects old evidence after a genuine simulation reset and never writes assessment into project',()=>{
  const {world,trial}=tickTrial(build(),35);
  expect(trial.witnesses).toHaveLength(2);
  const p=JSON.stringify(world.project);
  const reset=tick(world,[{k:'reset'}]).world;
  const after=sample(reset,trial);
  expect(after.witnesses).toHaveLength(0);
  expect(JSON.stringify(reset.project)).toBe(p);
  expect(p).not.toContain('trial');
  expect(p).not.toContain('observed');
 });
 it('real numeric tank levels cross only after a new physics step, not at initial >threshold',()=>{
  const scene=SCENES.find(s=>s.id==='mixing-tank')!;
  const w=tick(createWorld(),[{k:'loadPlantScene',id:scene.id}]).world;
  const first=renderSnapshot(w);
  let worker=first.plantWorld;
  let crossed=false;
  let previous=worker.signals.tank.levelMl as number;
  for(let i=0;i<120;i++){
   worker=stepScene(worker,plantPlacements(w.project),PLANT_EQUIPMENT,{
    tank:{fill:true,inletPct:100},
   });
   const now=worker.signals.tank.levelMl as number;
   if(previous<=250&&now>250){crossed=true;break;}
   previous=now;
  }
  expect(crossed).toBe(true);
  expect(worker.world.timeMs).toBeGreaterThan(0);
  expect(SCENE_TRIALS[scene.id][0].condition).toBe('above');
 });
});
