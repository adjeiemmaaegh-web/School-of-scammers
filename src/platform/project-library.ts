/**
 * Offline project library (roadmap R2): many named projects, bounded version history, safe import/export and a
 * non-destructive one-time migration from the single-key localStorage autosave.
 *
 * Pure and deterministic: time and ids are injected, storage is an interface. The IndexedDB adapter
 * (`project-library-idb.ts`) implements the compare-and-set `put` inside ONE transaction, which is what makes
 * multi-tab saves safe; the in-memory store here is for tests and as a volatile fallback. Nothing in this module
 * is an authentication or tamper-protection mechanism: stored projects are user data, never trusted input.
 */
import { buildScenePackage, parseScenePackage } from './scene-package';

export const LIBRARY_SCHEMA = 1;
export const MAX_PROJECTS = 50;
export const MAX_SNAPSHOTS = 10;
export const MAX_PROJECT_TEXT = 1_000_000;
export const MAX_BUNDLE_TEXT = 12_000_000;
export const MAX_TITLE = 80;

export type ProjectMeta = {
  id: string; title: string; revision: number; createdAt: string; modifiedAt: string;
  schemaVersion: number; archived: boolean; bytes: number;
};
export type StoredProject = ProjectMeta & { project: unknown };
export type Snapshot = { id: string; projectId: string; revision: number; createdAt: string; label: string; project: unknown };
export type PutResult = { ok: true } | { ok: false; current: number };

export interface ProjectStore {
  list(): Promise<ProjectMeta[]>;
  get(id: string): Promise<StoredProject | undefined>;
  /** Atomic compare-and-set on the stored revision (0 = must not exist). */
  put(record: StoredProject, expectedRevision: number): Promise<PutResult>;
  remove(id: string): Promise<void>;
  snapshots(projectId: string): Promise<Snapshot[]>;
  /** Adds a snapshot and prunes the oldest ones beyond `keep`, in the same atomic step. */
  addSnapshot(snapshot: Snapshot, keep: number): Promise<void>;
  removeSnapshots(projectId: string): Promise<void>;
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
}

export type LibraryDeps = {
  store: ProjectStore;
  /** Throws a readable Error for anything that is not a valid project; returns the normalised project. */
  validate: (raw: unknown) => unknown;
  now: () => string;
  newId: () => string;
};

export type SaveResult = { ok: true; revision: number } | { ok: false; reason: 'conflict'; currentRevision: number }
  | { ok: false; reason: 'too-large' | 'invalid' | 'missing'; message: string };
export type OpenResult = { status: 'ok'; meta: ProjectMeta; project: unknown } | { status: 'missing' }
  | { status: 'damaged'; meta: ProjectMeta; message: string; raw: unknown };

const cleanTitle = (title: unknown, fallback: string): string => {
  const t = typeof title === 'string' ? title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return (t || fallback).slice(0, MAX_TITLE);
};
const sizeOf = (value: unknown): number => JSON.stringify(value).length;
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function createLibrary(deps: LibraryDeps) {
  const { store, validate, now, newId } = deps;

  async function uniqueTitle(wanted: string, ignoreId?: string): Promise<string> {
    const taken = new Set((await store.list()).filter(m => m.id !== ignoreId).map(m => m.title.toLowerCase()));
    if (!taken.has(wanted.toLowerCase())) return wanted;
    for (let n = 2; n < 1000; n++) {
      const candidate = `${wanted.slice(0, MAX_TITLE - String(n).length - 3)} (${n})`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${wanted.slice(0, 60)} (${newId().slice(0, 8)})`;
  }
  function checkProject(raw: unknown): { project: unknown } | { error: SaveResult } {
    let project: unknown;
    try { project = validate(raw); }
    catch (e) { return { error: { ok: false, reason: 'invalid', message: e instanceof Error ? e.message : 'Invalid project' } }; }
    if (sizeOf(project) > MAX_PROJECT_TEXT)
      return { error: { ok: false, reason: 'too-large', message: 'Project is larger than the 1 MB browser safety limit.' } };
    return { project };
  }

  return {
    async list(options: { search?: string; sort?: 'recent' | 'name' | 'created'; includeArchived?: boolean } = {}): Promise<ProjectMeta[]> {
      const q = (options.search ?? '').trim().toLowerCase();
      const rows = (await store.list()).filter(m => (options.includeArchived || !m.archived) && (!q || m.title.toLowerCase().includes(q)));
      const sort = options.sort ?? 'recent';
      rows.sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title)
        : sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : b.modifiedAt.localeCompare(a.modifiedAt));
      return rows;
    },

    async create(title: string, project: unknown): Promise<{ ok: true; meta: ProjectMeta } | { ok: false; message: string }> {
      if ((await store.list()).length >= MAX_PROJECTS) return { ok: false, message: `The library holds at most ${MAX_PROJECTS} projects. Delete or export some first.` };
      const checked = checkProject(project);
      if ('error' in checked) return { ok: false, message: (checked.error as { message?: string }).message ?? 'Invalid project' };
      const stamp = now();
      const meta: ProjectMeta = {
        id: newId(), title: await uniqueTitle(cleanTitle(title, 'Untitled project')), revision: 1, createdAt: stamp, modifiedAt: stamp,
        schemaVersion: LIBRARY_SCHEMA, archived: false, bytes: sizeOf(checked.project),
      };
      const result = await store.put({ ...meta, project: checked.project }, 0);
      return result.ok ? { ok: true, meta } : { ok: false, message: 'A project with this id already exists.' };
    },

    async open(id: string): Promise<OpenResult> {
      const rec = await store.get(id);
      if (!rec) return { status: 'missing' };
      const { project: raw, ...meta } = rec;
      try { return { status: 'ok', meta, project: validate(raw) }; }
      catch (e) { return { status: 'damaged', meta, message: e instanceof Error ? e.message : 'Invalid project', raw }; }
    },

    /** Saves a new revision only if nobody saved since `expectedRevision`. A conflict never overwrites anything. */
    async save(id: string, project: unknown, expectedRevision: number): Promise<SaveResult> {
      const current = await store.get(id);
      if (!current) return { ok: false, reason: 'missing', message: 'This project no longer exists in the library.' };
      if (current.revision !== expectedRevision) return { ok: false, reason: 'conflict', currentRevision: current.revision };
      const checked = checkProject(project);
      if ('error' in checked) return checked.error;
      const { project: _old, ...meta } = current;
      const next: StoredProject = { ...meta, revision: current.revision + 1, modifiedAt: now(), bytes: sizeOf(checked.project), project: checked.project };
      const result = await store.put(next, expectedRevision);
      return result.ok ? { ok: true, revision: next.revision } : { ok: false, reason: 'conflict', currentRevision: result.current };
    },

    async snapshot(id: string, label: string): Promise<{ ok: true; snapshot: Snapshot } | { ok: false; message: string }> {
      const rec = await store.get(id);
      if (!rec) return { ok: false, message: 'Unknown project' };
      const snap: Snapshot = { id: newId(), projectId: id, revision: rec.revision, createdAt: now(), label: cleanTitle(label, `Revision ${rec.revision}`), project: rec.project };
      await store.addSnapshot(snap, MAX_SNAPSHOTS);
      return { ok: true, snapshot: snap };
    },

    async history(id: string): Promise<Omit<Snapshot, 'project'>[]> {
      return (await store.snapshots(id)).map(({ project: _p, ...rest }) => rest).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    /** Restores a snapshot as a NEW revision, after snapshotting the state being replaced so a restore is itself reversible. */
    async restore(id: string, snapshotId: string, expectedRevision: number): Promise<SaveResult> {
      const snap = (await store.snapshots(id)).find(s => s.id === snapshotId);
      if (!snap) return { ok: false, reason: 'missing', message: 'Unknown version' };
      const checked = checkProject(snap.project);
      if ('error' in checked) return checked.error;
      const before = await store.get(id);
      if (!before) return { ok: false, reason: 'missing', message: 'Unknown project' };
      if (before.revision !== expectedRevision) return { ok: false, reason: 'conflict', currentRevision: before.revision };
      await store.addSnapshot({ id: newId(), projectId: id, revision: before.revision, createdAt: now(), label: `Before restoring "${snap.label}"`, project: before.project }, MAX_SNAPSHOTS);
      return this.save(id, checked.project, expectedRevision);
    },

    async rename(id: string, title: string): Promise<{ ok: boolean; title?: string }> {
      const rec = await store.get(id);
      if (!rec) return { ok: false };
      const next = { ...rec, title: await uniqueTitle(cleanTitle(title, rec.title), id), modifiedAt: now() };
      // Renaming bumps the revision so a stale tab cannot silently overwrite it with an older copy of the metadata.
      const result = await store.put({ ...next, revision: rec.revision + 1 }, rec.revision);
      return result.ok ? { ok: true, title: next.title } : { ok: false };
    },

    async setArchived(id: string, archived: boolean): Promise<boolean> {
      const rec = await store.get(id);
      if (!rec) return false;
      return (await store.put({ ...rec, archived, revision: rec.revision + 1, modifiedAt: now() }, rec.revision)).ok;
    },

    async duplicate(id: string): Promise<{ ok: true; meta: ProjectMeta } | { ok: false; message: string }> {
      const rec = await store.get(id);
      if (!rec) return { ok: false, message: 'Unknown project' };
      return this.create(`${rec.title} copy`, rec.project);
    },

    /** Permanent. The caller must have confirmed with the user and offered an export first. */
    async remove(id: string): Promise<void> { await store.removeSnapshots(id); await store.remove(id); },

    async exportProject(id: string): Promise<string | undefined> {
      const rec = await store.get(id);
      if (!rec) return undefined;
      return JSON.stringify({ kind: 'efo-project', formatVersion: 1, title: rec.title, exportedAt: now(), project: rec.project }, null, 2);
    },

    /** Accepts a library export OR a bare project JSON (what "Export JSON" has always produced). Never throws on bad input. */
    async importProject(text: string): Promise<{ ok: true; meta: ProjectMeta } | { ok: false; message: string }> {
      if (typeof text !== 'string' || text.length > MAX_PROJECT_TEXT * 1.1) return { ok: false, message: 'The file is larger than the 1 MB project limit.' };
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return { ok: false, message: 'The file is not valid JSON.' }; }
      if (isObject(parsed) && parsed.kind === 'efo-project') {
        if (parsed.formatVersion !== 1) return { ok: false, message: 'This project export was made by a newer version and cannot be read.' };
        return this.create(cleanTitle(parsed.title, 'Imported project'), parsed.project);
      }
      return this.create('Imported project', parsed);
    },

    /** Imports a scene package (data-only file with objectives) as a new project; the objectives are returned for display. */
    async importScenePackage(raw: string): Promise<{ ok: true; meta: ProjectMeta; objectives: string[]; hints: string[]; level: string } | { ok: false; message: string }> {
      const parsed = parseScenePackage(raw, validate);
      if (!parsed.ok) return parsed;
      const made = await this.create(parsed.pkg.title, parsed.pkg.project);
      return made.ok ? { ok: true, meta: made.meta, objectives: parsed.pkg.objectives, hints: parsed.pkg.hints, level: parsed.pkg.level } : made;
    },

    async exportScenePackage(id: string, details: { description: string; level: 'beginner' | 'intermediate' | 'advanced'; objectives: string[]; hints: string[] }): Promise<string | undefined> {
      const rec = await store.get(id);
      return rec ? buildScenePackage({ title: rec.title, project: rec.project, ...details }, validate) : undefined;
    },

    async exportBundle(): Promise<string> {
      const items = [];
      for (const meta of await store.list()) {
        const rec = await store.get(meta.id);
        if (rec) items.push({ title: rec.title, archived: rec.archived, project: rec.project });
      }
      return JSON.stringify({ kind: 'efo-project-bundle', formatVersion: 1, exportedAt: now(), projects: items });
    },

    /** Imports every valid project from a backup bundle as new projects; reports what was skipped. */
    async importBundle(text: string): Promise<{ ok: true; imported: number; skipped: string[] } | { ok: false; message: string }> {
      if (typeof text !== 'string' || text.length > MAX_BUNDLE_TEXT) return { ok: false, message: 'The backup is too large to import.' };
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return { ok: false, message: 'The backup is not valid JSON.' }; }
      if (!isObject(parsed) || parsed.kind !== 'efo-project-bundle' || parsed.formatVersion !== 1 || !Array.isArray(parsed.projects))
        return { ok: false, message: 'This is not a project backup file.' };
      let imported = 0; const skipped: string[] = [];
      for (const raw of parsed.projects.slice(0, MAX_PROJECTS)) {
        const item = isObject(raw) ? raw : {};
        const made = await this.create(cleanTitle(item.title, 'Imported project'), item.project);
        if (made.ok) { imported++; if (item.archived === true) await this.setArchived(made.meta.id, true); }
        else skipped.push(`${cleanTitle(item.title, 'Untitled')}: ${made.message}`);
      }
      if (parsed.projects.length > MAX_PROJECTS) skipped.push(`${parsed.projects.length - MAX_PROJECTS} more projects beyond the ${MAX_PROJECTS} limit`);
      return { ok: true, imported, skipped };
    },

    /**
     * One-time, non-destructive import of the legacy single-key autosave. The caller keeps the original bytes in place
     * (never deleted here), so a failed or partial migration loses nothing. Returns the new project id, or why not.
     */
    async migrateLegacy(rawText: string | null): Promise<{ status: 'migrated'; id: string } | { status: 'none' | 'already' } | { status: 'unreadable'; message: string }> {
      if (await store.getMeta('legacyMigrated')) return { status: 'already' };
      if (typeof rawText !== 'string' || rawText === '') { await store.setMeta('legacyMigrated', 'none'); return { status: 'none' }; }
      if (rawText.length > MAX_PROJECT_TEXT) return { status: 'unreadable', message: 'The saved project is larger than the 1 MB limit; it was left untouched.' };
      let parsed: unknown;
      try { parsed = JSON.parse(rawText); } catch { return { status: 'unreadable', message: 'The saved project is not valid JSON; it was left untouched.' }; }
      const made = await this.create('My first project', parsed);
      if (!made.ok) return { status: 'unreadable', message: `${made.message} The original was left untouched.` };
      await store.setMeta('legacyMigrated', made.meta.id);
      return { status: 'migrated', id: made.meta.id };
    },
  };
}
export type ProjectLibrary = ReturnType<typeof createLibrary>;

/** Volatile in-memory store: tests, and a clearly-labelled fallback when IndexedDB is unavailable. Not durable. */
export function createMemoryStore(): ProjectStore {
  const projects = new Map<string, StoredProject>();
  const snaps = new Map<string, Snapshot[]>();
  const meta = new Map<string, string>();
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  return {
    async list() { return [...projects.values()].map(({ project: _p, ...m }) => clone(m)); },
    async get(id) { const r = projects.get(id); return r ? clone(r) : undefined; },
    async put(record, expected) {
      const current = projects.get(record.id)?.revision ?? 0;
      if (current !== expected) return { ok: false, current };
      projects.set(record.id, clone(record));
      return { ok: true };
    },
    async remove(id) { projects.delete(id); },
    async snapshots(projectId) { return clone(snaps.get(projectId) ?? []); },
    async addSnapshot(snapshot, keep) {
      const list = [...(snaps.get(snapshot.projectId) ?? []), clone(snapshot)];
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      snaps.set(snapshot.projectId, list.slice(-keep));
    },
    async removeSnapshots(projectId) { snaps.delete(projectId); },
    async getMeta(key) { return meta.get(key); },
    async setMeta(key, value) { meta.set(key, value); },
  };
}
