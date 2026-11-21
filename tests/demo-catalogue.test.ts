import { describe, expect, it } from 'vitest';
import { DEMOS } from '../src/plant/demos';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';

describe('demonstration catalogue', () => {
  it('lists six demonstrations A-F with unique ids', () => {
    expect(DEMOS.map(d => d.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(new Set(DEMOS.map(d => d.id)).size).toBe(6);
  });
  for (const demo of DEMOS) {
    it(`${demo.letter}. ${demo.title}: validates, loads without error, round-trips as plain JSON and powers its PLCs`, () => {
      const project = demo.build();
      expect(() => validateProject(project)).not.toThrow();
      const reloaded = JSON.parse(JSON.stringify(project));
      let w = tick(createWorld(), [{ k: 'loadProject', project: reloaded }, { k: 'run' }]).world;
      expect(w.lastError).toBeNull();
      for (let i = 0; i < 6; i++) w = tick(w).world;
      expect(w.lastError).toBeNull();
      expect(Object.values(w.plcs).every(p => p.powered)).toBe(true);
    });
  }
});
