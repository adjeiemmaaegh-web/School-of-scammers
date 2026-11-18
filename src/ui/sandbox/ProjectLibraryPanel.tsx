import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { ProjectLibrary, ProjectMeta, Snapshot } from '../../platform/project-library';
import type { ActiveProject, LibraryStatus } from '../../app/useProjectLibrary';

type Props = {
  lib: ProjectLibrary;
  active: ActiveProject | null;
  status: LibraryStatus;
  editable: boolean;
  onOpen: (id: string) => Promise<boolean>;
  onNew: (title: string) => Promise<boolean>;
  onChanged: () => void;
  onSaveVersion: (label: string) => Promise<boolean>;
  onRestoreVersion: (snapshotId: string) => Promise<void>;
  onClose: () => void;
  onNotice: (message: string | null) => void;
};

const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const safeName = (s: string) => s.replace(/[^\w.-]+/g, '-').slice(0, 60) || 'project';

/** Project library dialog: open, create, rename, duplicate, archive, delete (confirmed), export/import, backup, version history. */
export function ProjectLibraryPanel({ lib, active, status, editable, onOpen, onNew, onChanged, onSaveVersion, onRestoreVersion, onClose, onNotice }: Props) {
  const [rows, setRows] = useState<ProjectMeta[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'name' | 'created'>('recent');
  const [showArchived, setShowArchived] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [versions, setVersions] = useState<Omit<Snapshot, 'project'>[]>([]);
  const [versionLabel, setVersionLabel] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setRows(await lib.list({ search: query, sort, includeArchived: showArchived }));
    if (active) setVersions(await lib.history(active.id));
  }, [lib, query, sort, showArchived, active]);
  useEffect(() => { void refresh(); }, [refresh, status]);
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('input,button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const run = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { onNotice(e instanceof Error ? e.message : 'Project library action failed'); } await refresh(); onChanged(); };
  const importFile = (kind: 'project' | 'bundle') => async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]; ev.target.value = '';
    if (!file) return;
    await run(async () => {
      if (file.size > (kind === 'bundle' ? 12_000_000 : 1_100_000)) { onNotice('That file is too large to import.'); return; }
      const text = await file.text();
      if (kind === 'project') {
        const r = await lib.importProject(text);
        onNotice(r.ok ? `Imported "${r.meta.title}" into the library (not opened).` : r.message);
      } else {
        const r = await lib.importBundle(text);
        onNotice(r.ok ? `Restored ${r.imported} project(s)${r.skipped.length ? `; skipped: ${r.skipped.join('; ')}` : ''}.` : r.message);
      }
    });
  };

  return <div className="ux6-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="ux6-modal" role="dialog" aria-modal="true" aria-label="Project library" data-project-library ref={root}>
      <div className="ux6-modal-head">
        <h2>Project library</h2>
        <span className="ux6-lib-status" data-library-status={status}>{status === 'saved' ? 'All changes saved' : status === 'saving' ? 'Saving…' : status === 'conflict' ? 'Conflict — saving paused' : status === 'failed' ? 'Save failed' : status}</span>
        <button type="button" className="btn ghost small" data-library-close onClick={onClose}>Close</button>
      </div>
      <div className="ux6-lib-tools">
        <input type="search" placeholder="Search projects" aria-label="Search projects" data-library-search value={query} onChange={e => setQuery(e.target.value)} />
        <select aria-label="Sort projects" value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
          <option value="recent">Recently modified</option><option value="name">Name</option><option value="created">Newest created</option>
        </select>
        <label><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived</label>
      </div>
      <div className="ux6-lib-new">
        <input type="text" maxLength={80} placeholder="New project name" aria-label="New project name" data-library-new-title value={newTitle} onChange={e => setNewTitle(e.target.value)} />
        <button type="button" className="btn primary small" data-library-new disabled={!editable}
          title={editable ? undefined : 'Pause the simulation to switch projects.'}
          onClick={() => run(async () => { if (await onNew(newTitle || 'Untitled project')) { setNewTitle(''); onClose(); } })}>New project</button>
        <button type="button" className="btn ghost small" onClick={() => importRef.current?.click()}>Import project JSON</button>
        <button type="button" className="btn ghost small" data-library-backup onClick={() => run(async () => download('efo-projects-backup.json', await lib.exportBundle()))}>Back up all</button>
        <button type="button" className="btn ghost small" onClick={() => restoreRef.current?.click()}>Restore backup</button>
        <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={importFile('project')} />
        <input ref={restoreRef} type="file" accept=".json,application/json" hidden onChange={importFile('bundle')} />
      </div>
      <ul className="ux6-lib-list" aria-label="Projects">
        {rows.length === 0 && <li className="ux6-lib-empty">No projects match.</li>}
        {rows.map(m => <li key={m.id} data-library-item={m.id} data-library-active={active?.id === m.id ? 'true' : 'false'} className={active?.id === m.id ? 'is-active' : ''}>
          <div className="ux6-lib-row-main">
            {renaming?.id === m.id
              ? <input type="text" maxLength={80} aria-label="Rename project" data-library-rename-input value={renaming.title} autoFocus
                  onChange={e => setRenaming({ id: m.id, title: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') run(async () => { await lib.rename(m.id, renaming.title); setRenaming(null); }); if (e.key === 'Escape') setRenaming(null); }} />
              : <strong>{m.title}{m.archived ? ' (archived)' : ''}{active?.id === m.id ? ' · open' : ''}</strong>}
            <small>Modified {new Date(m.modifiedAt).toLocaleString()} · rev {m.revision} · {(m.bytes / 1024).toFixed(1)} KB</small>
          </div>
          <div className="ux6-lib-row-actions">
            <button type="button" className="btn ghost small" data-library-open disabled={!editable || active?.id === m.id}
              title={editable ? undefined : 'Pause the simulation to switch projects.'}
              onClick={() => run(async () => { if (await onOpen(m.id)) onClose(); })}>Open</button>
            <button type="button" className="btn ghost small" data-library-rename onClick={() => setRenaming({ id: m.id, title: m.title })}>Rename</button>
            <button type="button" className="btn ghost small" data-library-duplicate onClick={() => run(async () => { const r = await lib.duplicate(m.id); if (!r.ok) onNotice(r.message); })}>Duplicate</button>
            <button type="button" className="btn ghost small" onClick={() => run(async () => { const t = await lib.exportProject(m.id); if (t) download(`${safeName(m.title)}.efo-project.json`, t); })}>Export</button>
            <button type="button" className="btn ghost small" disabled={active?.id === m.id} title={active?.id === m.id ? 'Open another project first.' : undefined}
              onClick={() => run(() => lib.setArchived(m.id, !m.archived))}>{m.archived ? 'Unarchive' : 'Archive'}</button>
            {confirmDelete === m.id
              ? <><button type="button" className="btn danger small" data-library-delete-confirm onClick={() => run(async () => { await lib.remove(m.id); setConfirmDelete(null); })}>Delete permanently</button>
                  <button type="button" className="btn ghost small" onClick={() => setConfirmDelete(null)}>Keep</button></>
              : <button type="button" className="btn ghost small" data-library-delete disabled={active?.id === m.id}
                  title={active?.id === m.id ? 'Open another project before deleting this one.' : 'Export first if you may need it.'}
                  onClick={() => setConfirmDelete(m.id)}>Delete…</button>}
          </div>
        </li>)}
      </ul>
      {active && <section className="ux6-lib-versions" aria-label="Version history of the open project">
        <h3>Versions of “{active.title}”</h3>
        <div className="ux6-lib-new">
          <input type="text" maxLength={80} placeholder="Version label (optional)" aria-label="Version label" data-library-version-label value={versionLabel} onChange={e => setVersionLabel(e.target.value)} />
          <button type="button" className="btn ghost small" data-library-save-version onClick={() => run(async () => { await onSaveVersion(versionLabel || `Version ${new Date().toLocaleTimeString()}`); setVersionLabel(''); })}>Save version</button>
        </div>
        <ul className="ux6-lib-list" aria-label="Saved versions">
          {versions.length === 0 && <li className="ux6-lib-empty">No saved versions yet. Up to 10 are kept.</li>}
          {versions.map(v => <li key={v.id} data-library-version={v.id}>
            <div className="ux6-lib-row-main"><strong>{v.label}</strong><small>{new Date(v.createdAt).toLocaleString()} · rev {v.revision}</small></div>
            <div className="ux6-lib-row-actions">
              <button type="button" className="btn ghost small" data-library-restore disabled={!editable} title={editable ? 'Restores as a new revision; the current state is kept as a version first.' : 'Pause the simulation to restore.'}
                onClick={() => run(async () => { await onRestoreVersion(v.id); onClose(); })}>Restore</button>
            </div>
          </li>)}
        </ul>
      </section>}
      <p className="ux6-lib-note">Projects are stored in this browser only (IndexedDB). Clearing site data deletes them: use Back up all to keep a file copy. Export/import never leaves your device.</p>
    </div>
  </div>;
}
