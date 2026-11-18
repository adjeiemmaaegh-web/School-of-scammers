import { describe, expect, it } from 'vitest';
import { exportableDetails, normaliseDetails } from '../src/platform/scene-details';
import { buildScenePackage, parseScenePackage } from '../src/platform/scene-package';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';

const project = tick(createWorld(), [{ k: 'place', id: 'l', kind: 'lamp', at: { x: 10, y: 10 } }]).world.project;
describe('R10.2 authoring details', () => {
  it('normalises hostile saved values and bounds them', () => {
    expect(normaliseDetails(null)).toEqual({ description: '', level: 'beginner', objectives: '', hints: '' });
    const n = normaliseDetails({ description: 'a\u0000b'.repeat(500), level: 'expert', objectives: 7, hints: 'h'.repeat(9999) });
    expect(n.description.length).toBe(600); expect(n.description).not.toContain('\u0000'); expect(n.level).toBe('beginner'); expect(n.objectives).toBe(''); expect(n.hints.length).toBeLessThanOrEqual(12 * 301);
    expect(normaliseDetails({ level: 'advanced' }).level).toBe('advanced');
  });
  it('always exports to a package that parses, even from empty or oversized details', () => {
    for (const raw of [{}, { objectives: '\n\n  \n' }, { objectives: Array(40).fill('x'.repeat(500)).join('\n'), hints: Array(40).fill('y'.repeat(900)).join('\n'), description: 'd'.repeat(5000) }]) {
      const d = exportableDetails(normaliseDetails(raw), 'T'.repeat(200));
      expect(d.objectives.length).toBeGreaterThanOrEqual(1); expect(d.objectives.length).toBeLessThanOrEqual(12);
      expect(d.hints.length).toBeLessThanOrEqual(12);
      const text = buildScenePackage({ title: 'T', project, ...d }, validateProject);
      expect(parseScenePackage(text, validateProject).ok).toBe(true);
    }
  });
  it('keeps the author’s lines, trimmed and in order', () => {
    const d = exportableDetails(normaliseDetails({ objectives: '  one \n\n two ', hints: 'h1\nh2', description: ' desc ', level: 'intermediate' }), 'T');
    expect(d).toEqual({ description: 'desc', level: 'intermediate', objectives: ['one', 'two'], hints: ['h1', 'h2'] });
  });
});
