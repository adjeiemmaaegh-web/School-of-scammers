import {describe,it,expect} from 'vitest';
import {plcModule} from '../src/trades/plc';
import {cctvModule} from '../src/trades/cctv';
import {getExercise,getTrade} from '../src/trades/registry';
import {SCENARIO_META,getScenarioMeta} from '../src/exercises/meta';

const modules=[plcModule,cctvModule] as const;
describe('QA end-to-end cross-trade module and assessment contract inventory',()=>{
 it('registers exactly two functioning trades, two full 10-rank ladders, unique IDs and versions',()=>{
  expect(modules.map(m=>m.meta.id)).toEqual(['plc','cctv']);
  const ids=new Set<string>();
  for(const module of modules){
   expect(getTrade(module.meta.id)).toBe(module);
   expect(module.exercises).toHaveLength(10);
   expect(module.exercises.map(e=>e.rank)).toEqual([1,2,3,4,5,6,7,8,9,10]);
   for(const e of module.exercises){
    expect(e.trade).toBe(module.meta.id);
    expect(e.version.length).toBeGreaterThan(0);
    expect(e.title.trim().length).toBeGreaterThan(0);
    expect(e.scenario.trim().length).toBeGreaterThan(0);
    expect(ids.has(e.id)).toBe(false);
    ids.add(e.id);
    expect(getExercise(e.id)).toBe(e);
   }
  }
  for(const scenario of SCENARIO_META){
   expect(getScenarioMeta(scenario.id)).toEqual(scenario);
   expect(scenario.version).toMatch(/^\d+\.\d+/);
   expect(ids.has(scenario.id)).toBe(false);
   ids.add(scenario.id);
  }
 });
 for(const module of modules)for(const def of module.exercises){
  it(`real ${module.meta.id} rank ${def.rank}: deterministic init, objectives, grade constraints — ${def.id}`,()=>{
   const x=def.init(42),y=def.init(42);
   expect(JSON.stringify(x)).toBe(JSON.stringify(y));
   const objectiveIds=def.objectives.map(o=>o.id);
   expect(new Set(objectiveIds).size).toBe(objectiveIds.length);
   const status=def.objectiveStatus(x);
   for(const id of objectiveIds)expect(typeof status[id]).toBe('boolean');
   const rubric=def.evaluate(x);
   expect(typeof rubric.passed).toBe('boolean');
   expect(typeof rubric.safetyHold).toBe('boolean');
   expect(Number.isFinite(rubric.score)).toBe(true);
   expect(Number.isFinite(rubric.max)).toBe(true);
   expect(rubric.score).toBeGreaterThanOrEqual(0);
   expect(rubric.score).toBeLessThanOrEqual(rubric.max);
   expect(rubric.criteria.length).toBeGreaterThan(0);
   const idSet=new Set<string>();
   for(const c of rubric.criteria){
    expect(idSet.has(c.id)).toBe(false);idSet.add(c.id);
    expect(c.label.trim().length).toBeGreaterThan(0);
    expect(Number.isFinite(c.max)).toBe(true);
    expect(Number.isFinite(c.earned)).toBe(true);
    expect(c.earned).toBeGreaterThanOrEqual(0);
    expect(c.earned).toBeLessThanOrEqual(c.max);
   }
   expect(rubric.max).toBeCloseTo(rubric.criteria.reduce((n,c)=>n+c.max,0),6);
   expect(rubric.score).toBeCloseTo(rubric.criteria.reduce((n,c)=>n+c.earned,0),6);
   if(rubric.safetyHold)expect(rubric.passed).toBe(false);
  });
 }
});
