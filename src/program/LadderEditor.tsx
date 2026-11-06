import type { Branch, Contact, LadderDocument, Rung, RungElement } from '../engineering/ladder';
import type { RenderSnapshot } from '../sim/signals';
import { blankProgram, latchProgram } from '../sim/orchestrator';

const TAGS = ['Start', 'StopOK', 'Run', 'Unused'] as const;
type Props = { document: LadderDocument; snapshot: RenderSnapshot; disabled: boolean; onChange: (doc: LadderDocument) => void };

function ContactControl({ value, onChange, onRemove, active }: {
  value: Contact; onChange: (c: Contact) => void; onRemove?: () => void; active: boolean;
}) {
  return <div className={`sandbox-contact ${active ? 'energized' : ''}`}>
    <span className="sandbox-contact-symbol">{value.normallyClosed ? '—|/|—' : '—| |—'}</span>
    <select aria-label="Contact tag" value={value.tag} onChange={e => onChange({ ...value, tag: e.target.value })}>
      {TAGS.map(t => <option key={t}>{t}</option>)}
    </select>
    <label className="sandbox-contact-kind"><input type="checkbox" checked={!!value.normallyClosed}
      onChange={e => onChange({ ...value, normallyClosed: e.target.checked })} /> NC</label>
    {onRemove && <button className="sandbox-remove" onClick={onRemove} aria-label="Remove contact">×</button>}
  </div>;
}
export function LadderEditor({ document, snapshot, disabled, onChange }: Props) {
  const rung = document.rungs[0];
  if (!rung) return null;
  const patch = (r: Rung) => onChange({ ...document, rungs: [r] });
  const setElement = (index: number, element: RungElement) =>
    patch({ ...rung, elements: rung.elements.map((e, i) => i === index ? element : e) });
  const removeElement = (index: number) =>
    patch({ ...rung, elements: rung.elements.filter((_, i) => i !== index) });
  const live: Record<string, boolean> = { ...snapshot.io, Unused: false };
  return <section className="sandbox-editor panel" aria-label="Ladder programming editor">
    <div className="sandbox-section-head">
      <div><span className="eyebrow">PLC program</span><h2>Ladder Logic</h2></div>
      <span className="status-pill is-idle">P1 · supported subset</span>
    </div>
    <p className="sandbox-help">Build your rung from contacts and parallel paths. The exact edited document executes through the existing Ladder scan engine; changing it resets the runtime.</p>
    <fieldset disabled={disabled} className="sandbox-editor-fieldset">
      <div className="sandbox-rung">
        <span className="sandbox-rail" aria-hidden="true">│</span>
        {rung.elements.map((element, index) => {
          if (element.type === 'contact') return <ContactControl key={index} value={element}
            active={live[element.tag] === !element.normallyClosed}
            onChange={v => setElement(index, v)}
            onRemove={rung.elements.length > 1 ? () => removeElement(index) : undefined} />;
          const branch = element as Branch;
          return <div key={index} className="sandbox-branch">
            {branch.alternatives.map((path, pathIndex) => {
              const current = path[0];
              return <ContactControl key={pathIndex} value={current}
                active={live[current.tag] === !current.normallyClosed}
                onChange={v => setElement(index, { type: 'branch', alternatives:
                  branch.alternatives.map((p, i) => i === pathIndex ? [v] : p) })} />;
            })}
            <button className="sandbox-remove" onClick={() => removeElement(index)} aria-label="Remove parallel branch">×</button>
          </div>;
        })}
        <span className={`sandbox-coil ${live[rung.coil] ? 'energized' : ''}`}>
          —( )— <select aria-label="Output coil" value={rung.coil} onChange={e => patch({ ...rung, coil: e.target.value })}>
            <option>Run</option><option>Unused</option>
          </select>
        </span>
        <span className="sandbox-rail" aria-hidden="true">│</span>
      </div>
      <div className="sandbox-actions">
        <button className="btn ghost small" onClick={() => patch({ ...rung, elements: [
          ...rung.elements, { type: 'contact', tag: 'StopOK' }] })}>+ Series contact</button>
        <button className="btn ghost small" onClick={() => patch({ ...rung, elements: [
          ...rung.elements, { type: 'branch', alternatives: [
            [{ type: 'contact', tag: 'Start' }], [{ type: 'contact', tag: 'Run' }],
          ] }] })}>+ Parallel branch</button>
        <button className="btn ghost small" onClick={() => onChange(latchProgram())}>Load editable latch example</button>
        <button className="btn ghost small" onClick={() => onChange(blankProgram())}>Reset to one contact</button>
      </div>
    </fieldset>
    <p className="sandbox-help">For the seal-in circuit: StopOK in series, Start in parallel with Run, coil Run. An ordinary STOP button is not an emergency-stop safety circuit.</p>
  </section>;
}
