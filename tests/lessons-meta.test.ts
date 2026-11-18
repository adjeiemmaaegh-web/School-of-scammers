import { describe, expect, it } from 'vitest';
import lessonsSource from '../src/exercises/lessons-meta.ts?raw';
import { LESSONS } from '../src/exercises/lessons';
import { LESSON_META } from '../src/exercises/lessons-meta';

describe('lesson metadata stays in step with the lessons', () => {
  it('matches the full lesson definitions field for field', () => {
    expect(LESSON_META.map(m => m.id)).toEqual(LESSONS.map(l => l.id));
    for (const [i, l] of LESSONS.entries()) expect(LESSON_META[i]).toEqual({ id: l.id, title: l.title, level: l.level, summary: l.summary, objectives: l.objectives, hints: l.hints });
  });
  it('imports nothing, so listing lessons never pulls the simulator into the entry bundle', () => {
    expect(lessonsSource).not.toMatch(/^\s*import\s/m);
  });
});
