import { describe, expect, it } from 'vitest';
import { buildScenePackage, parseScenePackage, MAX_PACKAGE_TEXT } from '../src/platform/scene-package';
import { createLibrary, createMemoryStore } from '../src/platform/project-library';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';

const project = () => tick(createWorld(), [{ k: 'place', id: 's', kind: 'supply', at: { x: 10, y: 10 } }, { k: 'place', id: 'l', kind: 'lamp', at: { x: 200, y: 10 } }]).world.project;
const base = () => ({ kind: 'efo-scene-package', formatVersion: 1, title: 'Lamp circuit', description: 'Light a lamp.', level: 'beginner', objectives: ['Wire the lamp to the supply'], hints: ['Use P24 and M0'], project: project() });
const parse = (o: unknown) => parseScenePackage(typeof o === 'string' ? o : JSON.stringify(o), validateProject);

describe('R10.1 scene package', () => {
  it('round-trips a valid package', () => {
    const text = buildScenePackage({ title: 'Lamp circuit', description: 'Light a lamp.', level: 'beginner', objectives: ['Wire it'], hints: [], project: project() }, validateProject);
    const r = parse(text);
    expect(r.ok && r.pkg.title).toBe('Lamp circuit');
    expect(r.ok && (r.pkg.project as { components: unknown[] }).components.length).toBe(2);
  });
  it('rejects wrong kind, newer version, unknown fields (data only) and bad shapes', () => {
    expect(parse({ ...base(), kind: 'other' }).ok).toBe(false);
    expect(parse({ ...base(), formatVersion: 2 })).toMatchObject({ ok: false, message: expect.stringMatching(/newer version/) });
    expect(parse({ ...base(), script: 'alert(1)' })).toMatchObject({ ok: false, message: expect.stringMatching(/data only/) });
    expect(parse({ ...base(), onload: 'x' }).ok).toBe(false);
    for (const bad of [{ title: '' }, { title: 'x'.repeat(81) }, { description: 5 }, { level: 'expert' }, { objectives: 'x' }, { objectives: Array(13).fill('a') }, { objectives: [''] }, { hints: ['a'.repeat(301)] }, { title: 'bad\u0000name' }])
      expect(parse({ ...base(), ...bad }).ok, JSON.stringify(bad)).toBe(false);
  });
  it('rejects non-JSON, arrays, null, oversize text and an invalid project', () => {
    for (const junk of ['', '{', '[]', 'null', '"x"', 'x'.repeat(MAX_PACKAGE_TEXT + 1)]) expect(parse(junk).ok).toBe(false);
    expect(parse({ ...base(), project: { formatVersion: 1, components: 'no' } })).toMatchObject({ ok: false, message: expect.stringMatching(/project is not valid/) });
  });
  it('prototype-pollution keys are inert', () => {
    const r = parse('{"kind":"efo-package","__proto__":{"polluted":true}}');
    expect(r.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const withProto = parse(JSON.stringify(base()).replace('{', '{"__proto__":{"polluted":1},'));
    expect(withProto.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('imports into the library as a new project and exports back to a valid package', async () => {
    let n = 0;
    const lib = createLibrary({ store: createMemoryStore(), validate: validateProject, now: () => '2026-11-17T00:00:00.000Z', newId: () => `id${++n}` });
    const made = await lib.importScenePackage(JSON.stringify(base()));
    expect(made.ok && made.objectives).toEqual(['Wire the lamp to the supply']);
    if (!made.ok) return;
    expect((await lib.list()).map(m => m.title)).toEqual(['Lamp circuit']);
    const out = await lib.exportScenePackage(made.meta.id, { description: 'd', level: 'intermediate', objectives: ['o'], hints: [] });
    expect(parse(out!).ok).toBe(true);
    expect((await lib.importScenePackage('{"kind":"nope"}')).ok).toBe(false);
    expect((await lib.list()).length).toBe(1);
  });
});
