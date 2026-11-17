/**
 * IndexedDB adapter for the project library. The compare-and-set in `put` and the prune in `addSnapshot` each run in a
 * single readwrite transaction, so two tabs cannot both succeed against the same revision. If IndexedDB is missing or
 * blocked (private mode, policy), `openIdbStore` rejects and the caller must say so: never pretend a project is saved.
 */
import type { ProjectMeta, ProjectStore, PutResult, Snapshot, StoredProject } from './project-library';

export const IDB_NAME = 'efo-project-library';
const DB_VERSION = 1;

const wrap = <T,>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed')); });
const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted (storage full or blocked?)'));
  });

export function openIdbStore(factory: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB): Promise<ProjectStore> {
  if (!factory) return Promise.reject(new Error('IndexedDB is not available in this browser or mode.'));
  return new Promise((resolveStore, rejectStore) => {
    let request: IDBOpenDBRequest;
    try { request = factory.open(IDB_NAME, DB_VERSION); } catch (e) { rejectStore(e); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' }).createIndex('projectId', 'projectId');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onblocked = () => rejectStore(new Error('The project database is blocked by another tab running an older version.'));
    request.onerror = () => rejectStore(request.error ?? new Error('Could not open the project database.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolveStore({
        async list() {
          const rows = await wrap(db.transaction('projects').objectStore('projects').getAll()) as StoredProject[];
          return rows.map(({ project: _p, ...meta }) => meta as ProjectMeta);
        },
        async get(id) { return await wrap(db.transaction('projects').objectStore('projects').get(id)) as StoredProject | undefined; },
        async put(record, expectedRevision): Promise<PutResult> {
          const tx = db.transaction('projects', 'readwrite');
          const store = tx.objectStore('projects');
          const existing = await wrap(store.get(record.id)) as StoredProject | undefined;
          const current = existing?.revision ?? 0;
          if (current !== expectedRevision) { tx.abort(); await done(tx).catch(() => undefined); return { ok: false, current }; }
          store.put(record);
          await done(tx);
          return { ok: true };
        },
        async remove(id) { const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').delete(id); await done(tx); },
        async snapshots(projectId) { return await wrap(db.transaction('snapshots').objectStore('snapshots').index('projectId').getAll(projectId)) as Snapshot[]; },
        async addSnapshot(snapshot, keep) {
          const tx = db.transaction('snapshots', 'readwrite');
          const store = tx.objectStore('snapshots');
          store.put(snapshot);
          const all = (await wrap(store.index('projectId').getAll(snapshot.projectId)) as Snapshot[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          for (const old of all.slice(0, Math.max(0, all.length - keep))) store.delete(old.id);
          await done(tx);
        },
        async removeSnapshots(projectId) {
          const tx = db.transaction('snapshots', 'readwrite');
          const store = tx.objectStore('snapshots');
          const keys = await wrap(store.index('projectId').getAllKeys(projectId));
          for (const key of keys) store.delete(key);
          await done(tx);
        },
        async getMeta(key) { return (await wrap(db.transaction('meta').objectStore('meta').get(key)) as { value: string } | undefined)?.value; },
        async setMeta(key, value) { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ key, value }); await done(tx); },
      });
    };
  });
}
