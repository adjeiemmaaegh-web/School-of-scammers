import {describe,it,expect} from 'vitest';
import {GUIDE_BUILDS,findGuideBuild} from '../src/steady-guide/guide-builds-data';
import {GUIDE_EQUIPMENT_KINDS,GUIDE_SCENES} from '../src/steady-guide/guide-reference';
import {getGuideTopic} from '../src/steady-guide/guide-data';
describe('Steady Guide task-based equipment selection',()=>{
 it('only refers to real registered equipment, scenes and internal practice routes',()=>{
  const known=new Set(GUIDE_EQUIPMENT_KINDS);
  const scenes=new Set(GUIDE_SCENES.map(s=>s.id));
  expect(GUIDE_BUILDS.length).toBeGreaterThanOrEqual(5);
  expect(new Set(GUIDE_BUILDS.map(p=>p.id)).size).toBe(GUIDE_BUILDS.length);
  for(const p of GUIDE_BUILDS){
   expect(p.devices.length).toBeGreaterThan(0);
   expect(p.devices.every(k=>known.has(k))).toBe(true);
   expect((p.optional||[]).every(k=>known.has(k))).toBe(true);
   expect(p.whatToDo.length).toBeGreaterThanOrEqual(3);
   expect(p.whatToDo.every(s=>s.length>20)).toBe(true);
   expect(p.practiceRoute).toMatch(/^\/(?:sandbox|scenario\/[a-z0-9-]+|labs\/[a-z0-9-]+)$/);
   expect(getGuideTopic(p.topicId)).toBeTruthy();
   if(p.sceneId)expect(scenes.has(p.sceneId)).toBe(true);
   expect(findGuideBuild(p.id)).toBe(p);
  }
 });
 it('the first lamp describes the exact three-wire engine-tested circuit',()=>{
  const p=findGuideBuild('first-lamp');
  expect(p?.devices).toEqual(['supply','start','lamp']);
  expect(p?.whatToDo.join(' ')).toContain('P24');
  expect(p?.whatToDo.join(' ')).toContain('M0');
 });
 it('diagnostics stays symptom-first without spoiling a mystery fault',()=>{
  const p=findGuideBuild('diagnostic-mission');
  expect(p?.practiceRoute).toBe('/scenario/plc-sbx-find-fault');
  expect(p?.whatToDo.join(' ')).not.toMatch(/broken (?:wire|coil|sensor) is/i);
 });
});
