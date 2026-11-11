import {describe,it,expect} from 'vitest';
import {SCENES} from '../src/plant/scenes/catalogue';
import {accumulateCommissioning,directSceneLinkPatched,projectSignature,
 sceneCommissioningChecks,sceneFromProject} from '../src/plant/scenes/commissioning';
import {createWorld,renderSnapshot,tick} from '../src/sim/orchestrator';
import {makePlantSceneProject} from '../src/sim/p3-scene-import';
import {plantPlacements} from '../src/sim/p3-plant-bridge';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {stepScene} from '../src/plant/world/runner';
import type {ProjectFile,RenderSnapshot,Command} from '../src/sim/signals';

const scene=SCENES.find(s=>s.id==='sorting-line')!;
const src=()=>makePlantSceneProject(scene.id);
const get=(id:string,project:ProjectFile=makePlantSceneProject(id))=>{
 const world=tick(createWorld(),[{k:'loadProject',project}]).world;
 expect(world.lastError).toBeNull();
 return {project:world.project,snapshot:renderSnapshot(world)};
};
const checks=(p:ProjectFile,s:RenderSnapshot)=>{
 const e=accumulateCommissioning(scene,p,s,null);
 return sceneCommissioningChecks(scene,p,s,e);
};
const find=(c:ReturnType<typeof checks>,id:string)=>c.find(x=>x.id===id)!;
const connected=(p:ProjectFile):ProjectFile=>({...p,wires:[
 {id:'w1',from:'scene-supply.P24',to:'scene-plc.L+'},
 {id:'w2',from:'scene-supply.M0',to:'scene-plc.M'},
 {id:'w3',from:'eye1.OUT_present',to:'scene-plc.I0.0'},
 {id:'w4',from:'scene-plc.Q0.0',to:'belt.CMD_run+'},
 {id:'w5',from:'scene-plc.Q0.1',to:'gate.CMD_reject+'},
]});
describe('P10 scene commissioning — worker read-only diagnostics',()=>{
 it('recognizes complete original scenes while never claiming a blank project matches',()=>{
  expect(sceneFromProject(src())?.id).toBe('sorting-line');
  expect(sceneFromProject(makePlantSceneProject('three-way-handoff'))?.id)
   .toBe('three-way-handoff');
  expect(sceneFromProject({...src(),components:src().components
   .filter(c=>c.id!=='eye1')})).toBeUndefined();
  expect(sceneFromProject(null)).toBeUndefined();
 });
 it('unsolved original scene never passes power, IO, program or real response',()=>{
  const {project,snapshot}=get('sorting-line');
  const rows=checks(project,snapshot);
  expect(find(rows,'equipment').pass).toBe(true);
  for(const id of ['plc-power','io-patches','program','scan','response'])
   expect(find(rows,id).pass).toBe(false);
  expect(find(rows,'faults').pass).toBe(true);
 });
 it('physically validates recommended terminal patches, digital and typed numeric',()=>{
  const p=connected(src());
  expect(scene.recommendedLinks.every(link=>
    directSceneLinkPatched(link,p,'scene-plc'))).toBe(true);
  expect(directSceneLinkPatched(scene.recommendedLinks[0],src(),'scene-plc'))
   .toBe(false);
  expect(directSceneLinkPatched(scene.recommendedLinks[0],p,'not-a-plc')).toBe(false);
  const mass=SCENES.find(s=>s.id==='weigh-reject')!.recommendedLinks[0];
  const weight=makePlantSceneProject('weigh-reject');
  expect(mass.kind).toBe('number');
  expect(directSceneLinkPatched(mass,{...weight,wires:[{
   id:'weight-numeric',from:'weight.AN_weightKg',to:'scene-plc.AI0',
  }]},'scene-plc')).toBe(true);
  expect(directSceneLinkPatched(mass,{...weight,wires:[{
   id:'invalid-digital',from:'weight.AN_weightKg',to:'scene-plc.I0.0',
  }]},'scene-plc')).toBe(false);
 });
 it('real energized PLC and authored ST are independent preflight evidence',()=>{
  let w=tick(createWorld(),[{k:'loadProject',project:connected(src())}]).world;
  expect(w.lastError).toBeNull();
  let rows=checks(w.project,renderSnapshot(w));
  expect(find(rows,'io-patches').pass).toBe(true);
  // Real power resolution is from the worker, not from checking wire counts.
  w=tick(w,[{k:'run'}]).world;
  for(let i=0;i<3;i++)w=tick(w).world;
  expect(w.lastError).toBeNull();
  rows=checks(w.project,renderSnapshot(w));
  expect(find(rows,'plc-power').pass).toBe(true);
  expect(find(rows,'program').pass).toBe(false);
  const source=['VAR_INPUT',' In0 : BOOL;','END_VAR','VAR_OUTPUT',
    ' Out0 : BOOL;','END_VAR','Out0 := In0;'].join('\n');
  w=tick(w,[{k:'pause'},{k:'loadST',source}]).world;
  expect(w.lastError).toBeNull();
  expect(find(checks(w.project,renderSnapshot(w)),'program').pass).toBe(true);
 });
 it('worker-only scan samples are monotonic, bounded and reset after project edit',()=>{
  let w=tick(createWorld(),[{k:'loadPlantScene',id:scene.id}]).world;
  let e=accumulateCommissioning(scene,w.project,renderSnapshot(w),null);
  expect(e.observedScans).toBe(0);
  w=tick(w,[{k:'run'}]).world;
  for(let i=0;i<4;i++){
   w=tick(w).world;
   e=accumulateCommissioning(scene,w.project,renderSnapshot(w),e);
  }
  expect(e.observedScans).toBeGreaterThanOrEqual(1);
  expect(sceneCommissioningChecks(scene,w.project,renderSnapshot(w),e)
   .find(x=>x.id==='scan')?.pass).toBe(true);
  const reset=tick(w,[{k:'reset'}]).world;
  const e2=accumulateCommissioning(scene,reset.project,renderSnapshot(reset),e);
  expect(e2.observedScans).toBe(0);
  const before=projectSignature(w.project);
  const change={...w.project,params:{...w.project.params,
   belt:{speedMmS:350}}};
  expect(projectSignature(change)).not.toBe(before);
  expect(accumulateCommissioning(scene,change,renderSnapshot(w),e)
   .observedScans).toBe(0);
 });
 it('a stationary simulated worker never receives fabricated movement credit',()=>{
  const {project,snapshot}=get('sorting-line');
  const a=accumulateCommissioning(scene,project,snapshot,null);
  const b=accumulateCommissioning(scene,project,snapshot,a);
  expect(b.observedScans).toBe(0);
  expect(b.bodyMovement).toBe(false);
  expect(b.actuatorMovement).toBe(false);
  expect(b.observedTransitions).toEqual([]);
  expect(find(sceneCommissioningChecks(scene,project,snapshot,b),'response').pass)
   .toBe(false);
 });
 it('actual worker process dynamics, not a fabricated render flag, produce commissioning evidence',()=>{
  const tankScene=SCENES.find(s=>s.id==='mixing-tank')!;
  const {project,snapshot}=get(tankScene.id);
  const base=accumulateCommissioning(tankScene,project,snapshot,null);
  // Step the genuine P3 registered tank through the authoritative 50ms
  // deterministic plant runner and observe its independently calculated level.
  const next=stepScene(snapshot.plantWorld,plantPlacements(project),
   PLANT_EQUIPMENT,{tank:{fill:true,inletPct:100}});
  expect(next.world.timeMs).toBe(50);
  expect(next.signals.tank.levelMl).toBeGreaterThan(0);
  const advanced={...snapshot,plantWorld:next};
  const e=accumulateCommissioning(tankScene,project,advanced,base);
  expect(e.actuatorMovement).toBe(true);
  expect(sceneCommissioningChecks(tankScene,project,advanced,e)
   .find(x=>x.id==='response')?.pass).toBe(true);
 });
 it('injected faults and rejected worker commands keep the diagnostic unresolved',()=>{
  const {project,snapshot}=get('sorting-line');
  const faulty={...project,plantFaults:{eye1:'sensor-stuck-off'}};
  const rows=checks(faulty,{...snapshot,lastError:'Worker rejected a malformed command'});
  expect(find(rows,'faults').pass).toBe(false);
 });
});
