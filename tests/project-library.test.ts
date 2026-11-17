import { describe, expect, it } from 'vitest';
import { createLibrary, createMemoryStore, MAX_PROJECTS, MAX_SNAPSHOTS, MAX_TITLE, type ProjectStore } from '../src/platform/project-library';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';
import type { ProjectFile } from '../src/sim/signals';

const projectWith = (n: number): ProjectFile => {
  const cmds = Array.from({ length: n }, (_, i) => ({ k: 'place', id: `l${i + 1}`, kind: 'lamp', at: { x: 10 + i * 5, y: 10 } }) as const);
  return tick(createWorld(), cmds).world.project;
};
let clock = 0;
const lib = (store: ProjectStore = createMemoryStore()) => {
  let id = 0;
  return createLibrary({ store, validate: validateProject, now: () => `2026-11-17T00:00:${String(clock++ % 60).padStart(2, '0')}.000Z`, newId: () => `id${++id}-${Math.random().toString(36).slice(2, 6)}` });
};

describe('project library', () => {
  it('creates, lists, opens and round-trips a project', async () => {
    const l = lib();
    const made = await l.create('  Pump   station ', projectWith(2));
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.meta).toMatchObject({ title: 'Pump station', revision: 1, archived: false });
    const open = await l.open(made.meta.id);
    expect(open.status).toBe('ok');
    if (open.status === 'ok') expect((open.project as ProjectFile).components).toHaveLength(2);
    expect((await l.list()).map(m => m.title)).toEqual(['Pump station']);
  });
  it('makes titles unique and bounded, strips control characters', async () => {
    const l = lib();
    const a = await l.create('A', projectWith(0)); const b = await l.create('a', projectWith(0));
    expect(a.ok && b.ok && a.meta.title !== b.meta.title).toBe(true);
    const long = await l.create('x'.repeat(500), projectWith(0));
    expect(long.ok && long.meta.title.length <= MAX_TITLE).toBe(true);
    const odd = await l.create('bad\u0000\u0007name\n', projectWith(0));
    expect(odd.ok && odd.meta.title).toBe('bad name');
  });
  it('rejects invalid and oversized projects without storing anything', async () => {
    const l = lib();
    expect((await l.create('x', { formatVersion: 1, components: 'no' })).ok).toBe(false);
    const huge = projectWith(1); (huge as unknown as { stSource: string }).stSource = 'x'.repeat(1_100_000);
    expect((await l.create('big', huge)).ok).toBe(false);
    expect(await l.list()).toEqual([]);
  });
  it('bumps the revision on save and refuses a stale writer (multi-tab safety) without overwriting', async () => {
    const store = createMemoryStore();
    const tabA = lib(store), tabB = lib(store);
    const made = await tabA.create('shared', projectWith(1));
    if (!made.ok) throw new Error('create');
    const a = await tabA.save(made.meta.id, projectWith(2), 1);
    expect(a).toEqual({ ok: true, revision: 2 });
    const b = await tabB.save(made.meta.id, projectWith(5), 1); // tab B still thinks revision 1
    expect(b).toEqual({ ok: false, reason: 'conflict', currentRevision: 2 });
    const open = await tabA.open(made.meta.id);
    expect(open.status === 'ok' && (open.project as ProjectFile).components.length).toBe(2); // A's data survived
  });
  it('save refuses invalid data and keeps the last good revision', async () => {
    const l = lib();
    const made = await l.create('p', projectWith(1));
    if (!made.ok) throw new Error('create');
    const bad = await l.save(made.meta.id, { nonsense: true }, 1);
    expect(bad.ok).toBe(false);
    const open = await l.open(made.meta.id);
    expect(open.status === 'ok' && open.meta.revision).toBe(1);
  });
  it('keeps a bounded version history and restores a version as a new reversible revision', async () => {
    const l = lib();
    const made = await l.create('hist', projectWith(1));
    if (!made.ok) throw new Error('create');
    const id = made.meta.id;
    let rev = 1;
    for (let i = 0; i < MAX_SNAPSHOTS + 4; i++) {
      await l.snapshot(id, `v${i}`);
      const r = await l.save(id, projectWith(i + 2), rev);
      if (r.ok) rev = r.revision;
    }
    const history = await l.history(id);
    expect(history).toHaveLength(MAX_SNAPSHOTS);
    const oldest = history[history.length - 1];
    const restored = await l.restore(id, oldest.id, rev);
    expect(restored.ok).toBe(true);
    if (restored.ok) rev = restored.revision;
    const after = await l.history(id);
    expect(after.some(s => s.label.startsWith('Before restoring'))).toBe(true); // the replaced state is itself recoverable
    const open = await l.open(id);
    expect(open.status).toBe('ok');
  });
  it('restore with a stale revision is a conflict and changes nothing', async () => {
    const l = lib();
    const made = await l.create('r', projectWith(1));
    if (!made.ok) throw new Error('create');
    const snap = await l.snapshot(made.meta.id, 'keep');
    if (!snap.ok) throw new Error('snap');
    await l.save(made.meta.id, projectWith(3), 1);
    expect(await l.restore(made.meta.id, snap.snapshot.id, 1)).toMatchObject({ ok: false, reason: 'conflict' });
  });
  it('renames, archives, duplicates and permanently deletes (with its history)', async () => {
    const store = createMemoryStore();
    const l = lib(store);
    const made = await l.create('one', projectWith(1));
    if (!made.ok) throw new Error('create');
    expect(await l.rename(made.meta.id, 'two')).toEqual({ ok: true, title: 'two' });
    expect(await l.setArchived(made.meta.id, true)).toBe(true);
    expect(await l.list()).toEqual([]);
    expect((await l.list({ includeArchived: true })).map(m => m.title)).toEqual(['two']);
    const dup = await l.duplicate(made.meta.id);
    expect(dup.ok && dup.meta.title).toBe('two copy');
    await l.snapshot(made.meta.id, 's');
    await l.remove(made.meta.id);
    expect(await store.snapshots(made.meta.id)).toEqual([]);
    expect((await l.open(made.meta.id)).status).toBe('missing');
    expect((await l.list()).length).toBe(1);
  });
  it('searches and sorts', async () => {
    const l = lib();
    await l.create('Boiler', projectWith(0)); await l.create('Conveyor line', projectWith(0)); await l.create('conveyor test', projectWith(0));
    expect((await l.list({ search: 'CONVEYOR' })).length).toBe(2);
    expect((await l.list({ sort: 'name' })).map(m => m.title)).toEqual(['Boiler', 'Conveyor line', 'conveyor test']);
  });
  it('enforces the project count limit', async () => {
    const l = lib();
    for (let i = 0; i < MAX_PROJECTS; i++) expect((await l.create(`p${i}`, projectWith(0))).ok).toBe(true);
    const over = await l.create('one too many', projectWith(0));
    expect(over.ok).toBe(false);
  });
  it('exports and re-imports a project; accepts the bare legacy "Export JSON" file; rejects junk safely', async () => {
    const l = lib();
    const made = await l.create('exp', projectWith(3));
    if (!made.ok) throw new Error('create');
    const text = (await l.exportProject(made.meta.id))!;
    const back = await l.importProject(text);
    expect(back.ok && back.meta.title).toBe('exp (2)');
    const bare = await l.importProject(JSON.stringify(projectWith(2)));
    expect(bare.ok && bare.meta.title).toBe('Imported project');
    for (const junk of ['', '{', '[]', 'null', '{"kind":"efo-project","formatVersion":9,"project":{}}', '{"kind":"efo-project","formatVersion":1,"project":{"x":1}}', 'x'.repeat(2_000_000)])
      expect((await l.importProject(junk)).ok).toBe(false);
  });
  it('refuses an oversized file before parsing and a newer export format even when its project is valid', async () => {
    const l = lib();
    const big = await l.importProject(JSON.stringify(projectWith(1)) + ' '.repeat(1_300_000));
    expect(big).toMatchObject({ ok: false });
    expect(big.ok === false && big.message).toMatch(/larger than/);
    const newer = await l.importProject(JSON.stringify({ kind: 'efo-project', formatVersion: 9, title: 't', project: projectWith(1) }));
    expect(newer.ok === false && newer.message).toMatch(/newer version/);
    expect(await l.list()).toEqual([]);
  });
  it('backs up and restores the whole library as a bundle, skipping bad entries and reporting them', async () => {
    const l = lib();
    await l.create('a', projectWith(1)); const b = await l.create('b', projectWith(2));
    if (b.ok) await l.setArchived(b.meta.id, true);
    const bundle = await l.exportBundle();
    const fresh = lib();
    const result = await fresh.importBundle(bundle);
    expect(result).toEqual({ ok: true, imported: 2, skipped: [] });
    expect((await fresh.list({ includeArchived: true })).length).toBe(2);
    const tampered = JSON.stringify({ ...JSON.parse(bundle), projects: [{ title: 'ok', project: projectWith(1) }, { title: 'bad', project: { x: 1 } }, 7] });
    const partial = await lib().importBundle(tampered);
    expect(partial.ok && partial.imported).toBe(1);
    expect(partial.ok && partial.skipped.length).toBe(2);
    expect((await lib().importBundle('{"kind":"nope"}')).ok).toBe(false);
  });
  it('migrates the legacy single-key project once, never alters the source and tolerates damage', async () => {
    const store = createMemoryStore();
    const l = lib(store);
    const raw = JSON.stringify(projectWith(2));
    const first = await l.migrateLegacy(raw);
    expect(first.status).toBe('migrated');
    expect(await l.migrateLegacy(raw)).toEqual({ status: 'already' });
    expect((await l.list()).map(m => m.title)).toEqual(['My first project']);
    const damaged = lib();
    expect((await damaged.migrateLegacy('{"formatVersion":1,')).status).toBe('unreadable');
    expect(await damaged.list()).toEqual([]);
    // a later good legacy value can still migrate because "unreadable" did not mark it done
    expect((await damaged.migrateLegacy(raw)).status).toBe('migrated');
    expect((await lib().migrateLegacy(null))).toEqual({ status: 'none' });
  });
  it('reports a stored project that no longer validates as damaged, with the raw data preserved for export', async () => {
    const store = createMemoryStore();
    const l = lib(store);
    const made = await l.create('will break', projectWith(1));
    if (!made.ok) throw new Error('create');
    const rec = (await store.get(made.meta.id))!;
    await store.put({ ...rec, revision: 2, project: { formatVersion: 1, components: 7 } }, 1);
    const open = await l.open(made.meta.id);
    expect(open.status).toBe('damaged');
    if (open.status === 'damaged') expect(open.raw).toEqual({ formatVersion: 1, components: 7 });
  });
  it('is deterministic given injected time and ids', async () => {
    const run = async () => {
      const store = createMemoryStore(); let n = 0;
      const l = createLibrary({ store, validate: validateProject, now: () => '2026-01-01T00:00:00.000Z', newId: () => `id${++n}` });
      await l.create('a', projectWith(1)); await l.create('a', projectWith(2));
      return JSON.stringify(await l.list({ sort: 'name' }));
    };
    expect(await run()).toBe(await run());
  });
});
