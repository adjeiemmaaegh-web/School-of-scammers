import { describe, expect, it } from 'vitest';
import { LESSONS, starterProject } from '../src/exercises/lessons';
import { buildScenePackage, parseScenePackage } from '../src/platform/scene-package';
import { validateProject } from '../src/sim/orchestrator';

// No Node typings in the tests tsconfig: reach the environment through globalThis (see device-catalog-doc.test.ts).
const nodeProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined>; getBuiltinModule?: (id: string) => { writeFileSync: (p: string, d: string) => void } } }).process;
const committed = import.meta.glob('../public/lessons/*.efo-scene.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const packageText = (i: number) => buildScenePackage({
  title: LESSONS[i].title, description: LESSONS[i].summary, level: LESSONS[i].level,
  objectives: LESSONS[i].objectives, hints: LESSONS[i].hints, project: starterProject(LESSONS[i]),
}, validateProject) + '\n';

describe('lesson starter packages (downloadable from the Learn page)', () => {
  it('are regenerated from the lesson data and are not stale', () => {
    if (nodeProcess?.env?.UPDATE_LESSONS) {
      const fs = nodeProcess.getBuiltinModule!('node:fs');
      LESSONS.forEach((l, i) => fs.writeFileSync(`public/lessons/${l.id}.efo-scene.json`, packageText(i)));
      return;
    }
    LESSONS.forEach((l, i) => {
      const file = committed[`../public/lessons/${l.id}.efo-scene.json`];
      expect(file, `${l.id}: run UPDATE_LESSONS=1 npx vitest run tests/lesson-packages.test.ts`).toBe(packageText(i));
    });
  });
  it('import as data-only scene packages whose project is the unwired starter', () => {
    for (const [i, l] of LESSONS.entries()) {
      const r = parseScenePackage(packageText(i), validateProject);
      expect(r.ok, l.id).toBe(true);
      if (r.ok) { expect((r.pkg.project as { wires: unknown[] }).wires).toEqual([]); expect(r.pkg.objectives).toEqual(l.objectives); }
    }
  });
});
