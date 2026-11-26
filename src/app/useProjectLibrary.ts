/**
 * Connects the sandbox page to the offline project library (roadmap R2).
 *
 * The localStorage working copy keeps its existing guarded behaviour and remains what the page loads synchronously;
 * this hook adds the durable layer on top: it commits the active project to IndexedDB after a quiet period using a
 * compare-and-set revision, restores the active project from the library when the working copy is gone, migrates the
 * legacy single-key project once without touching it, and surfaces conflicts instead of overwriting.
 * Scenario routes never use it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createLibrary, type ProjectLibrary } from '../platform/project-library';
import { openIdbStore } from '../platform/project-library-idb';
import { newProject as blankProjectFile, validateProject } from '../sim/project-validation';
import type { ProjectFile } from '../sim/signals';

export const ACTIVE_PROJECT_KEY = 'efo-active-project-v1';
const COMMIT_DELAY_MS = 1500;
const AUTO_SNAPSHOT_MS = 10 * 60 * 1000;

export type LibraryStatus = 'starting' | 'unavailable' | 'ready' | 'saving' | 'saved' | 'conflict' | 'failed';
export type ActiveProject = { id: string; title: string; revision: number };

type Options = {
  enabled: boolean;
  project: ProjectFile | null;
  /** True once the page has a validated, acknowledged project it is allowed to persist. */
  storageReady: boolean;
  /** Whether the synchronous localStorage working copy existed at startup. */
  hadWorkingCopy: () => boolean;
  legacyRaw: () => string | null;
  loadIntoWorker: (project: ProjectFile) => void;
  onNotice: (message: string | null) => void;
};

const readActiveId = (): string | null => {
  try { const v = JSON.parse(localStorage.getItem(ACTIVE_PROJECT_KEY) ?? 'null') as { id?: unknown } | null; return v && typeof v.id === 'string' ? v.id : null; }
  catch { return null; }
};
const writeActiveId = (id: string) => { try { localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify({ id })); } catch { /* the library still holds the project */ } };

export function useProjectLibrary(options: Options) {
  const opts = useRef(options);
  opts.current = options;
  const [lib, setLib] = useState<ProjectLibrary | null>(null);
  const [status, setStatus] = useState<LibraryStatus>(options.enabled ? 'starting' : 'unavailable');
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveProject | null>(null);
  const activeRef = useRef<ActiveProject | null>(null);
  const lastJson = useRef<string | null>(null);
  const awaitingLoad = useRef<string | null>(null); // JSON of a library project we pushed to the worker; do not commit until the page shows it
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotAt = useRef(Date.now());
  const busy = useRef(false);
  const setActiveBoth = (next: ActiveProject | null) => { activeRef.current = next; setActive(next); if (next) writeActiveId(next.id); };

  useEffect(() => {
    if (!options.enabled) return;
    let cancelled = false;
    (async () => {
      let store;
      try { store = await openIdbStore(); }
      catch (e) {
        if (cancelled) return;
        setStatus('unavailable');
        setMessage(`Project library unavailable (${e instanceof Error ? e.message : 'storage blocked'}). Your project is still saved in this browser's working copy; use Download project JSON for a backup.`);
        return;
      }
      const library = createLibrary({ store, validate: raw => validateProject(raw), now: () => new Date().toISOString(), newId: () => crypto.randomUUID() });
      try {
        const migrated = await library.migrateLegacy(opts.current.legacyRaw());
        if (migrated.status === 'unreadable') opts.current.onNotice(migrated.message);
        let id = readActiveId();
        if (migrated.status === 'migrated' && !id) id = migrated.id;
        if (id && (await library.open(id)).status === 'missing') id = null;
        // No pointer means a fresh start in this browser profile: never adopt (and later overwrite) an existing library project.
        if (cancelled) return;
        if (id) {
          const opened = await library.open(id);
          if (opened.status === 'ok') {
            setActiveBoth({ id, title: opened.meta.title, revision: opened.meta.revision });
            // Loading a project must not create a revision: only a real difference from the stored copy is committed.
            lastJson.current = JSON.stringify(opened.project);
            // The working copy is gone (cleared storage, new device profile): restore from the durable library.
            // Only into an untouched blank page: if the user already started editing while the library opened,
            // their work wins and the library project stays available in the dialog.
            const here = opts.current.project;
            const untouched = !here || (here.components.length === 0 && here.wires.length === 0);
            const restoring = opened.project as ProjectFile;
            if (!opts.current.hadWorkingCopy() && untouched && (restoring.components.length > 0 || restoring.wires.length > 0)) {
              awaitingLoad.current = JSON.stringify(opened.project);
              opts.current.loadIntoWorker(restoring);
              opts.current.onNotice(`Restored "${opened.meta.title}" from the project library.`);
            }
          } else if (opened.status === 'damaged') {
            opts.current.onNotice(`Library project "${opened.meta.title}" is damaged (${opened.message}). Open the Project library to export or delete it.`);
          }
        }
        setLib(library);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('failed');
        setMessage(e instanceof Error ? e.message : 'Project library failed to start.');
      }
    })();
    return () => { cancelled = true; };
  }, [options.enabled]);

  const commit = useCallback(async (): Promise<void> => {
    const { project } = opts.current;
    if (!lib || !project || busy.current) return;
    const json = JSON.stringify(project);
    if (json === lastJson.current) return;
    busy.current = true;
    setStatus('saving');
    try {
      let current = activeRef.current;
      if (!current) {
        const made = await lib.create('My project', project);
        if (!made.ok) { setStatus('failed'); setMessage(made.message); return; }
        setActiveBoth({ id: made.meta.id, title: made.meta.title, revision: made.meta.revision });
        lastJson.current = json; setStatus('saved'); setMessage(null);
        return;
      }
      const result = await lib.save(current.id, project, current.revision);
      if (result.ok) {
        current = { ...current, revision: result.revision };
        setActiveBoth(current);
        lastJson.current = json; setStatus('saved'); setMessage(null);
        if (Date.now() - lastSnapshotAt.current > AUTO_SNAPSHOT_MS) { lastSnapshotAt.current = Date.now(); await lib.snapshot(current.id, 'Automatic version'); }
      } else if (result.reason === 'conflict') {
        setStatus('conflict');
        setMessage('This project was saved from another tab. Library saving is paused so nothing is overwritten.');
      } else {
        setStatus('failed'); setMessage(result.message);
      }
    } catch (e) {
      setStatus('failed');
      setMessage(`Could not save to the project library (${e instanceof Error ? e.message : 'storage error'}). Your working copy is still in this browser; download a JSON backup.`);
    } finally { busy.current = false; }
  }, [lib]);

  // Debounced commit whenever the page's project changes.
  useEffect(() => {
    if (!options.enabled || !lib || !options.project || !options.storageReady) return;
    if (status === 'conflict' || status === 'unavailable') return;
    const json = JSON.stringify(options.project);
    if (awaitingLoad.current !== null) {
      if (json !== awaitingLoad.current) return; // still showing the pre-restore state
      awaitingLoad.current = null; lastJson.current = json; setStatus('saved'); return;
    }
    if (json === lastJson.current) return;
    // A pristine blank page with no library project yet is not worth a library entry; the first real edit creates it.
    if (!activeRef.current && options.project.components.length === 0 && options.project.wires.length === 0) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void commit(); }, COMMIT_DELAY_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [options.enabled, options.project, options.storageReady, lib, status, commit]);

  // Best-effort flush when the tab is hidden; the localStorage working copy is the safety net for the rest.
  useEffect(() => {
    if (!options.enabled) return;
    const flush = () => { if (document.visibilityState === 'hidden') void commit(); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush as EventListener);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush as EventListener); };
  }, [options.enabled, commit]);

  const openProject = useCallback(async (id: string): Promise<boolean> => {
    if (!lib) return false;
    await commit();
    const opened = await lib.open(id);
    if (opened.status !== 'ok') { opts.current.onNotice(opened.status === 'damaged' ? `That project is damaged: ${opened.message}` : 'That project no longer exists.'); return false; }
    awaitingLoad.current = JSON.stringify(opened.project);
    lastJson.current = null;
    setActiveBoth({ id, title: opened.meta.title, revision: opened.meta.revision });
    setStatus('ready'); setMessage(null);
    opts.current.loadIntoWorker(opened.project as ProjectFile);
    return true;
  }, [lib, commit]);

  const newProject = useCallback(async (title: string): Promise<boolean> => {
    if (!lib) return false;
    await commit();
    const made = await lib.create(title, blankProjectFile());
    if (!made.ok) { opts.current.onNotice(made.message); return false; }
    return openProject(made.meta.id);
  }, [lib, commit, openProject]);

  /** Creates a new library project from a ready-made project (a lesson starter) and opens it. */
  const createFrom = useCallback(async (title: string, project: ProjectFile): Promise<boolean> => {
    if (!lib) return false;
    await commit();
    const made = await lib.create(title, project);
    if (!made.ok) { opts.current.onNotice(made.message); return false; }
    return openProject(made.meta.id);
  }, [lib, commit, openProject]);

  const resolveConflict = useCallback(async (choice: 'reload' | 'copy' | 'overwrite') => {
    if (!lib || !activeRef.current) return;
    const project = opts.current.project;
    if (choice === 'copy' && project) {
      const made = await lib.create(`${activeRef.current.title} (this tab)`, project);
      if (made.ok) { setActiveBoth({ id: made.meta.id, title: made.meta.title, revision: made.meta.revision }); lastJson.current = JSON.stringify(project); setStatus('saved'); setMessage(null); }
      return;
    }
    const latest = await lib.open(activeRef.current.id);
    if (latest.status !== 'ok') return;
    if (choice === 'reload') {
      awaitingLoad.current = JSON.stringify(latest.project); lastJson.current = null;
      setActiveBoth({ ...activeRef.current, revision: latest.meta.revision });
      setStatus('ready'); setMessage(null);
      opts.current.loadIntoWorker(latest.project as ProjectFile);
    } else if (project) {
      // The other tab's version is kept as a recoverable snapshot before this tab's version replaces it.
      await lib.snapshot(activeRef.current.id, 'Other tab version (kept before overwrite)');
      setActiveBoth({ ...activeRef.current, revision: latest.meta.revision });
      lastJson.current = null; setStatus('ready'); setMessage(null);
    }
  }, [lib]);

  const restoreVersion = useCallback(async (snapshotId: string): Promise<void> => {
    if (!lib) return;
    await commit();
    const current = activeRef.current;
    if (!current) return;
    const result = await lib.restore(current.id, snapshotId, current.revision);
    if (!result.ok) { opts.current.onNotice(result.reason === 'conflict' ? 'The project changed in another tab; reload it before restoring.' : result.message); return; }
    const opened = await lib.open(current.id);
    if (opened.status !== 'ok') return;
    awaitingLoad.current = JSON.stringify(opened.project); lastJson.current = null;
    setActiveBoth({ ...current, revision: opened.meta.revision });
    setStatus('ready');
    opts.current.loadIntoWorker(opened.project as ProjectFile);
    opts.current.onNotice('Version restored. The state it replaced was kept as a version.');
  }, [lib, commit]);

  const refreshActive = useCallback(async () => {
    if (!lib || !activeRef.current) return;
    const opened = await lib.open(activeRef.current.id);
    if (opened.status === 'ok') setActiveBoth({ id: activeRef.current.id, title: opened.meta.title, revision: opened.meta.revision });
    else if (opened.status === 'missing') { activeRef.current = null; setActive(null); }
  }, [lib]);

  return { lib, status, message, active, openProject, newProject, createFrom, resolveConflict, refreshActive, restoreVersion, commitNow: commit,
    saveVersion: async (label: string) => { if (!lib || !activeRef.current) return false; await commit(); const r = await lib.snapshot(activeRef.current.id, label); return r.ok; } };
}
