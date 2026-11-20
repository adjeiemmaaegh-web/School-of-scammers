import { describe,expect,it } from 'vitest';
import { COMPONENTS,componentKinds } from '../src/components/registry';
import { SCENES } from '../src/plant/scenes/catalogue';
import { SCENE_METADATA } from '../src/plant/scenes/metadata';
import { GUIDE_EQUIPMENT_KINDS,GUIDE_SCENES,GUIDE_SCENE_META,GUIDE_EQUIPMENT_NAMES,searchGuideEquipment,guideEquipmentName } from '../src/steady-guide/guide-reference';
import { GUIDE_TOPICS,GUIDE_GROUPS,guideTopicRoute,getGuideTopic,searchGuideTopics } from '../src/steady-guide/guide-data';
describe('Steady Guide source-of-truth parity',()=>{
 it('covers every registered component exactly once, including all its actual terminal names',()=>{
  expect(GUIDE_EQUIPMENT_KINDS.length).toBe(new Set(GUIDE_EQUIPMENT_KINDS).size);
  expect([...GUIDE_EQUIPMENT_KINDS].sort()).toEqual([...componentKinds].sort());
  for(const kind of GUIDE_EQUIPMENT_KINDS){
   expect(COMPONENTS[kind].kind).toBe(kind);
   expect(COMPONENTS[kind].label.length).toBeGreaterThan(0);
   expect(COMPONENTS[kind].terminals.every(t=>t.name&&t.role)).toBe(true);
  }
 });
 it('covers all real factory scenes, their canonical titles and descriptions, without an executable duplicate',()=>{
  expect(GUIDE_SCENES.length).toBe(new Set(GUIDE_SCENES.map(s=>s.id)).size);
  expect(GUIDE_SCENES.map(s=>s.id).sort()).toEqual(SCENES.map(s=>s.id).sort());
  for(const scene of GUIDE_SCENES){
   const real=SCENES.find(s=>s.id===scene.id);
   expect(scene.title).toBe(real?.title);
   expect(scene.description).toBe(real?.description);
   expect(GUIDE_SCENE_META[scene.id]).toEqual(SCENE_METADATA[scene.id]);
  }
 });
 it('never defines broken next topics, duplicate IDs, empty lessons or nonlocal navigation',()=>{
  const ids=new Set(GUIDE_TOPICS.map(t=>t.id));
  expect(ids.size).toBe(GUIDE_TOPICS.length);
  for(const t of GUIDE_TOPICS){
   expect(t.id).toMatch(/^[a-z0-9-]+$/);
   expect(GUIDE_GROUPS.some(g=>g.id===t.group)).toBe(true);
   expect(t.steps.length).toBeGreaterThanOrEqual(3);
   expect(t.steps.every(s=>s.title.length>2&&s.body.length>12)).toBe(true);
   if(t.next)expect(ids.has(t.next)).toBe(true);
   if(t.appRoute)expect(t.appRoute.startsWith('/')&&!t.appRoute.startsWith('//')).toBe(true);
   expect(getGuideTopic(t.id)).toBe(t);
   expect(guideTopicRoute(t.id)).toBe('/guide/topic/'+t.id);
  }
 });
 it('searches learner-facing equipment names from the lightweight index',()=>{
  expect(Object.keys(GUIDE_EQUIPMENT_NAMES).every(k=>GUIDE_EQUIPMENT_KINDS.some(id=>id===k))).toBe(true);
  for(const kind of GUIDE_EQUIPMENT_KINDS)expect(guideEquipmentName(kind).length).toBeGreaterThan(1);
  expect(searchGuideEquipment('pilot lamp')).toContain('lamp');
  expect(searchGuideEquipment('24V supply')).toContain('supply');
  expect(searchGuideEquipment('proximity sensor')).toEqual(expect.arrayContaining(['inductive-prox','capacitive-prox']));
  expect(searchGuideEquipment('plc')).toEqual(expect.arrayContaining(['plc','plc16']));
  expect(searchGuideEquipment('  ')).toEqual([]);
  expect(searchGuideEquipment('zzzx not a device')).toEqual([]);
 });
 it('finds practical beginners terms and never yields unrelated topics',()=>{
  expect(searchGuideTopics('LAMP').some(t=>t.id==='first-lamp')).toBe(true);
  expect(searchGuideTopics('PID').some(t=>t.id==='language-tools')).toBe(true);
  expect(searchGuideTopics('no power').some(t=>t.id==='diagnose')).toBe(true);
  expect(searchGuideTopics('zzzx not a search term')).toEqual([]);
 });
});
