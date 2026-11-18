import { useEffect, useState } from 'react';
import { evaluateFat, fatComplete, MANUAL_ITEMS, MAX_NOTE, normaliseManual, type ManualState } from '../../diagnostics/fat-checklist';
import type { ProjectFile, RenderSnapshot } from '../../sim/signals';

const key = (id: string) => `efo-fat-v1:${id}`;
const load = (id: string): ManualState => { try { return normaliseManual(JSON.parse(localStorage.getItem(key(id)) ?? 'null')); } catch { return {}; } };

/** Interactive acceptance checklist: automatic checks from the live snapshot, manual observations saved per project in this browser. */
export function FatChecklist({ project, snapshot, projectKey }: { project: ProjectFile; snapshot: RenderSnapshot; projectKey: string }) {
  const [manual, setManual] = useState<ManualState>(() => load(projectKey));
  useEffect(() => { setManual(load(projectKey)); }, [projectKey]);
  const update = (id: string, patch: Partial<{ done: boolean; note: string }>) => {
    const next = normaliseManual({ ...manual, [id]: { done: manual[id]?.done ?? false, note: manual[id]?.note ?? '', ...patch } });
    setManual(next);
    try { localStorage.setItem(key(projectKey), JSON.stringify(next)); } catch { /* the checklist still works in memory */ }
  };
  const items = evaluateFat(project, snapshot, manual);
  return <section className="ux6-fat" aria-label="Acceptance checklist" data-fat-checklist data-fat-complete={fatComplete(items) ? 'true' : 'false'}>
    <h4>Acceptance checklist</h4>
    <ul>
      {items.map(i => <li key={i.id} data-fat-item={i.id} data-fat-status={i.status}>
        <span className="ux6-fat-mark" aria-hidden="true">{i.status === 'pass' ? '✓' : i.status === 'fail' ? '✗' : '○'}</span>
        <div>
          {i.kind === 'manual'
            ? <label><input type="checkbox" data-fat-manual={i.id} checked={manual[i.id]?.done ?? false} onChange={e => update(i.id, { done: e.target.checked })} /> {i.title}</label>
            : <span>{i.title}</span>}
          {i.kind === 'manual' && MANUAL_ITEMS.some(m => m.id === i.id)
            ? <input type="text" className="ux6-fat-note" aria-label={`Note for: ${i.title}`} maxLength={MAX_NOTE} placeholder="Note (what you saw)" data-fat-note={i.id}
                value={manual[i.id]?.note ?? ''} onChange={e => update(i.id, { note: e.target.value })} />
            : <small>{i.detail}</small>}
        </div>
      </li>)}
    </ul>
    <small>{fatComplete(items) ? 'All items pass.' : 'Not complete.'} Your notes stay in this browser; they appear in the commissioning report. A learning record, not a certified acceptance test.</small>
  </section>;
}
