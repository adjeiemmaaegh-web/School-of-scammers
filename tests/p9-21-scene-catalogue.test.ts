import {describe,expect,it} from 'vitest';
import {SCENES} from '../src/plant/scenes/catalogue';
import {SCENE_CATEGORIES,SCENE_METADATA,searchSceneIds}
 from '../src/plant/scenes/metadata';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {makePlantSceneProject} from '../src/sim/p3-scene-import';
import {plantPlacements} from '../src/sim/p3-plant-bridge';
import {createWorld,tick,validateProject} from '../src/sim/orchestrator';
import {freshWorld,conserved} from '../src/plant/world/bodies';
import {freshRuntime,stepScene,validatePlacements}
 from '../src/plant/world/runner';

const expectedLegacy=[
 'sorting-line','gate-accumulation','weigh-reject','two-level-lift',
 'gantry-transfer','palletizing','mini-warehouse','robot-sort',
 'mixing-tank','bottle-line',
];
describe('P9 21 original editable factory scenes — source and worker truth',()=>{
 it('keeps all ten original scene IDs and adds eleven uniquely authored workcells',()=>{
  expect(SCENES).toHaveLength(21);
  expect(SCENES.slice(0,10).map(s=>s.id)).toEqual(expectedLegacy);
  expect(new Set(SCENES.map(s=>s.id)).size).toBe(21);
  expect(new Set(SCENES.map(s=>s.seed)).size).toBe(21);
  expect(SCENES.every(scene=>scene.description&&scene.acceptance&&
    scene.referenceST.includes('VAR_INPUT')&&scene.referenceST.includes('VAR_OUTPUT')))
    .toBe(true);
 });
 it('has exactly one validated skill/difficulty/category description for each scene',()=>{
  expect(Object.keys(SCENE_METADATA).sort()).toEqual(SCENES.map(s=>s.id).sort());
  expect(new Set(SCENE_CATEGORIES).size).toBe(5);
  for(const scene of SCENES){
   const meta=SCENE_METADATA[scene.id];
   expect(SCENE_CATEGORIES).toContain(meta.category);
   expect(['Foundation','Intermediate','Advanced']).toContain(meta.difficulty);
   expect(meta.skills.length).toBeGreaterThanOrEqual(2);
   expect(new Set(meta.skills).size).toBe(meta.skills.length);
  }
 });
 it('search and category focus return original canonical IDs with stable ordering',()=>{
  expect(searchSceneIds('', 'All', SCENES)).toEqual(SCENES.map(s=>s.id));
  expect(searchSceneIds('WAREHOUSE','All',SCENES)).toEqual([
   'mini-warehouse','robot-warehouse-receiving',
  ]);
  expect(searchSceneIds('', 'Safety & inspection',SCENES)).toEqual([
   'material-inspection','height-guard','guarded-conveyor',
  ]);
  expect(searchSceneIds('nonexistent-operator', 'All',SCENES)).toEqual([]);
  expect(searchSceneIds('valve','Process & fluids',SCENES))
   .toEqual(['flow-valve-diagnostics']);
 });
 it.each(SCENES.map(scene=>[scene.id,scene] as const))(
  '%s creates an unsolved, valid, deterministic 24V/PLC workcell on the real worker',
  (_id,scene)=>{
   validatePlacements(scene.equipment,PLANT_EQUIPMENT);
   const a=makePlantSceneProject(scene.id);
   expect(a.components).toHaveLength(scene.equipment.length+2);
   expect(a.components.slice(0,2).map(c=>c.kind)).toEqual(['plc16','supply']);
   expect(a.wires).toEqual([]);
   expect(a.language).toBe('ladder');
   expect(a.program).toBeDefined();
   expect(validateProject(a)).toEqual(a);
   expect(makePlantSceneProject(scene.id)).toEqual(a);
   const loaded=tick(createWorld(),[{k:'loadPlantScene',id:scene.id}]).world;
   expect(loaded.lastError).toBeNull();
   expect(loaded.project).toEqual(a);
   expect(loaded.project.wires).toHaveLength(0);
   expect(loaded.plantWorld.world.bodies).toHaveLength(0);
   const stepped=stepScene(freshRuntime(freshWorld(scene.seed),
     scene.equipment,PLANT_EQUIPMENT),scene.equipment,PLANT_EQUIPMENT);
   expect(stepped.world.timeMs).toBe(50);
   expect(conserved(stepped.world)).toBe(true);
   const started=tick(loaded,[{k:'run'}]).world;
   expect(started.lastError).toBeNull();
   expect(started.project.wires).toHaveLength(0);
  },
 );
 it('preserves yaw and non-zero vertical mounting when converting scene to saved worker project',()=>{
  const side=makePlantSceneProject('three-way-handoff');
  expect(side.components.find(c=>c.id==='side')?.yawDeg).toBe(90);
  const lift=makePlantSceneProject('scissor-lift-station');
  const elevated=lift.components.find(c=>c.id==='out');
  expect(elevated?.elevationMm).toBe(1200);
  const oldLift=makePlantSceneProject('two-level-lift');
  expect(oldLift.components.find(c=>c.id==='out')?.elevationMm).toBe(1000);
  for(const project of [side,lift,oldLift]){
   const saved=validateProject(JSON.parse(JSON.stringify(project)));
   expect(saved).toEqual(project);
   const placements=plantPlacements(saved);
   for(const part of project.components.filter(c=>PLANT_EQUIPMENT[c.kind])){
    const placement=placements.find(p=>p.id===part.id)!;
    expect(placement.yawDeg).toBe(part.yawDeg??0);
    expect(placement.originMm.z).toBe(part.elevationMm??0);
   }
  }
 });
 it('rejects malformed or forged elevations while old 2D projects remain valid',()=>{
  const project=makePlantSceneProject('two-level-lift');
  const old={...project,components:project.components.map(c=>{
   const {elevationMm,...rest}=c;return rest;
  })};
  expect(validateProject(old).components.every(c=>c.elevationMm===undefined))
   .toBe(true);
  for(const n of [-1,2501,Number.NaN,1.2,Infinity]){
   const forged={...project,components:project.components.map(c=>c.id==='out'?
    {...c,elevationMm:n}:c)};
   expect(()=>validateProject(forged)).toThrow(/elevation/);
  }
  const forged={...project,components:project.components.map(c=>c.id==='scene-plc'?
   {...c,elevationMm:100}:c)};
  expect(()=>validateProject(forged)).toThrow(/elevation/);
 });
 it('published wiring suggestions reference real registered worker channels and types',()=>{
  for(const scene of SCENES){
   expect(scene.recommendedLinks.length).toBeGreaterThanOrEqual(2);
   for(const link of scene.recommendedLinks){
    expect(['bool','number']).toContain(link.kind);
    const source=link.source.split('.');
    const dest=link.target.split('.');
    if(source[0]!=='PLC'){
     const kind=scene.equipment.find(p=>p.id===source[0])?.kind;
     expect(kind).toBeDefined();
     const point=PLANT_EQUIPMENT[kind!].signals.find(p=>p.name===source[1]);
     expect(point).toBeDefined();
     expect(point?.kind).toBe(link.kind);
     expect(dest[0]).toBe('PLC');
    }else{
     const kind=scene.equipment.find(p=>p.id===dest[0])?.kind;
     expect(kind).toBeDefined();
     const point=PLANT_EQUIPMENT[kind!].commands.find(p=>p.name===dest[1]);
     expect(point).toBeDefined();
     expect(point?.kind).toBe(link.kind);
    }
   }
  }
 });
 it('fails closed on a nonexistent identifier without replacing the current project',()=>{
  const w=tick(createWorld(),[{k:'loadPlantScene',id:'sorting-line'}]).world;
  const prior=JSON.stringify(w.project);
  const wrong=tick(w,[{k:'loadPlantScene',id:'not-a-real-scene'}]).world;
  expect(wrong.lastError).toMatch(/Unknown original plant scene/);
  expect(JSON.stringify(wrong.project)).toBe(prior);
 });
});
