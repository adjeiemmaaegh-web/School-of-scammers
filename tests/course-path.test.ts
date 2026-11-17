import { describe, expect, it } from 'vitest';
import { COURSE } from '../src/exercises/course';
import { SCENARIO_META } from '../src/exercises/meta';
import { LEGACY_LABS } from '../src/app/labs-index';

describe('R9.2 course path', () => {
  it('has eleven uniquely identified stages in order', () => {
    expect(COURSE).toHaveLength(11);
    expect(new Set(COURSE.map(c => c.id)).size).toBe(11);
    expect(COURSE.map(c => Number(c.title.split('.')[0]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it('every link resolves to a real scenario, lab or the simulator', () => {
    for (const c of COURSE) {
      if (c.to === '/sandbox') continue;
      const scenario = /^\/scenario\/(.+)$/.exec(c.to);
      const lab = /^\/labs\/(.+)$/.exec(c.to);
      if (scenario) expect(SCENARIO_META.some(s => s.id === scenario[1]), c.to).toBe(true);
      else if (lab) expect(LEGACY_LABS.some(l => l.path === lab[1]), c.to).toBe(true);
      else throw new Error(`Unrecognised course link ${c.to}`);
    }
  });
  it('is honest: an open-practice stage always states what is missing, and kinds match their links', () => {
    for (const c of COURSE) {
      if (c.kind === 'open') { expect(c.to).toBe('/sandbox'); expect(c.gap, c.id).toBeTruthy(); }
      if (c.kind === 'scenario') expect(c.to.startsWith('/scenario/')).toBe(true);
      if (c.kind === 'lab') expect(c.to.startsWith('/labs/')).toBe(true);
    }
  });
});
