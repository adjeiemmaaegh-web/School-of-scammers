import {describe,it,expect} from 'vitest';
import {GUIDE_TARGETS,guideTarget,safeGuideSelector} from '../src/steady-guide/tour-targets';
describe('Steady Guide target allowlist',()=>{
 it('uses eight static, unique, non-mutating selectors',()=>{
  expect(GUIDE_TARGETS.length).toBe(8);
  expect(new Set(GUIDE_TARGETS.map(t=>t.id)).size).toBe(8);
  for(const t of GUIDE_TARGETS){
   expect(t.selector.startsWith('.')||t.selector.startsWith('[')).toBe(true);
   expect(t.selector).not.toMatch(/:has\(|:contains\(/);
   expect(t.title.length).toBeGreaterThan(3);
   expect(t.description.length).toBeGreaterThan(12);
   expect(safeGuideSelector(t.id)).toBe(t.selector);
  }
 });
 it('never interpolates caller input into a CSS selector',()=>{
  expect(guideTarget('[onload]')).toBeUndefined();
  expect(safeGuideSelector('div,body')).toBeNull();
  expect(guideTarget('__proto__')).toBeUndefined();
 });
});
