import { useState } from 'react';
import type { Branch, Contact, LadderDocument, Rung, RungElement, RungOperation } from '../engineering/ladder';
import type { RenderSnapshot } from '../sim/signals';
import { blankProgram, latchProgram } from '../sim/orchestrator';
import { MAX_SANDBOX_RUNGS, MAX_SANDBOX_SYMBOLS } from './p2-contract';

type Props = { document: LadderDocument; snapshot: RenderSnapshot; disabled: boolean; onChange: (doc: LadderDocument) => void };
const BUILT_INS = ['Start', 'StopOK', 'Run', 'Unused'];
const operationFor = (kind: string): RungOperation | undefined => {
  if (kind === 'coil') return undefined;
  if (kind === 'ton' || kind === 'tof' || kind === 'rto' || kind === 'tp') return { kind, presetMs: 250 };
  if (kind === 'ctu') return { kind: 'ctu', preset: 2 };
  if (kind === 'ctd') return { kind: 'ctd', preset: 2, loadTag: 'Unused' };
  if (kind === 'osr' || kind === 'osf') return { kind };
  return undefined;
};
function ContactControl({ value, onChange, onRemove, active, tags }: {
  value: Contact; onChange: (c: Contact) => void; onRemove?: () => void; active: boolean; tags: readonly string[];
}) {
  return <div className={`sandbox-contact ${active ? 'energized' : ''}`}>
    <span className="sandbox-contact-symbol">{value.normallyClosed ? '—|/|—' : '—| |—'}</span>
    <select aria-label="Contact tag" value={value.tag} onChange={e => onChange({ ...value, tag: e.target.value })}>
      {tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
    </select>
    <label className="sandbox-contact-kind"><input type="checkbox" checked={!!value.normallyClosed}
      onChange={e => onChange({ ...value, normallyClosed: e.target.checked })} /> NC</label>
    {onRemove && <button type="button" className="sandbox-remove" onClick={onRemove} aria-label="Remove contact">×</button>}
  </div>;
}
export function LadderEditor({ document, snapshot, disabled, onChange }: Props) {
  const [newTag, setNewTag] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const symbols = Object.keys(document.symbols ?? {});
  const tags = Array.from(new Set([...BUILT_INS, ...symbols, ...document.rungs.map(r => r.coil)]));
  const coils = Array.from(new Set(['Run', 'Unused', ...symbols]));
  const live: Record<string, boolean | number> = { ...snapshot.tagValues, Unused: false };

  const patchRung = (rungId: string, replacement: Rung) => onChange({
    ...document, rungs: document.rungs.map(rung => rung.id === rungId ? replacement : rung),
  });
  const updateElement = (rung: Rung, index: number, element: RungElement) =>
    patchRung(rung.id, { ...rung, elements: rung.elements.map((part, i) => i === index ? element : part) });
  const removeElement = (rung: Rung, index: number) =>
    patchRung(rung.id, { ...rung, elements: rung.elements.filter((_, i) => i !== index) });

  const addTag = () => {
    const name = newTag.trim();
    if (!/^[A-Za-z][A-Za-z0-9_.]{0,39}$/.test(name) ||
      ['constructor', 'prototype', '__proto__'].includes(name.toLowerCase()) ||
      tags.includes(name)) { setTagError('Choose a unique tag name starting with a letter.'); return; }
    if (symbols.length >= MAX_SANDBOX_SYMBOLS) {
      setTagError('Maximum 16 local BOOL tags reached.'); return;
    }
    onChange({ ...document, symbols: { ...document.symbols, [name]: { description: 'Local BOOL / memory tag' } } });
    setNewTag(''); setTagError(null);
  };
  const removeTag = (tag: string) => {
    if (document.rungs.some(rung => rung.coil === tag ||
      (rung.operation && 'resetTag' in rung.operation && rung.operation.resetTag === tag) ||
      (rung.operation?.kind === 'ctd' && rung.operation.loadTag === tag) ||
      rung.elements.some(element => element.type === 'contact' ?
        element.tag === tag : element.alternatives.some(path => path.some(c => c.tag === tag))))) {
      setTagError(`Tag ${tag} is in use. Remove those contacts/coils first.`); return;
    }
    const remaining = { ...document.symbols };
    delete remaining[tag];
    onChange({ ...document, symbols: remaining });
    setTagError(null);
  };
  const addRung = () => {
    if (document.rungs.length >= MAX_SANDBOX_RUNGS) return;
    let number = 1;
    while (tags.includes(`Aux${number}`)) number++;
    const newCoil = `Aux${number}`;
    let suffix = 1;
    while (document.rungs.some(r => r.id === `rung-${suffix}`)) suffix++;
    onChange({
      ...document,
      symbols: { ...document.symbols, [newCoil]: { description: 'Local BOOL rung output' } },
      rungs: [...document.rungs, {
        id: `rung-${suffix}`, elements: [{ type: 'contact', tag: 'Start' }], coil: newCoil,
      }],
    });
  };
  const reset = () => onChange(blankProgram());
  const updateTimerPreset = (rung: Rung, presetMs: number) => {
    const operation = rung.operation;
    if (operation && 'presetMs' in operation)
      patchRung(rung.id, { ...rung, operation: { ...operation, presetMs } });
  };
  const updateCounterPreset = (rung: Rung, preset: number) => {
    const operation = rung.operation;
    if (operation && 'preset' in operation)
      patchRung(rung.id, { ...rung, operation: { ...operation, preset } });
  };
  const updateResetTag = (rung: Rung, resetTag: string) => {
    const operation = rung.operation;
    if (operation?.kind === 'ctu' || operation?.kind === 'rto')
      patchRung(rung.id, { ...rung, operation: { ...operation, resetTag: resetTag || undefined } });
  };

  return <section className="sandbox-editor panel" aria-label="Ladder programming editor">
    <div className="sandbox-section-head">
      <div><span className="eyebrow">PLC program · live monitor</span><h2>Ladder Logic</h2></div>
      <span className="status-pill is-idle">{document.rungs.length} / {MAX_SANDBOX_RUNGS} rungs</span>
    </div>
    <p className="sandbox-help">Real deterministic scan execution. Rungs execute top-to-bottom; upstream coils can feed later contacts. Timers use simulated scan milliseconds, not wall time.</p>
    <fieldset disabled={disabled} className="sandbox-editor-fieldset">
      {document.rungs.map((rung, rungIndex) => {
        const trace = snapshot.ladderSteps.find(t => t.rungId === rung.id);
        const elements = rung.elements;
        const operation = rung.operation?.kind ?? 'coil';
        return <div className="sandbox-rung-wrap" key={rung.id}>
          <div className="sandbox-rung-heading">
            <span><strong>Network {rungIndex + 1}</strong><code>{rung.id}</code></span>
            <div className="sandbox-rung-execution" aria-live="off">{trace ?
              `${trace.result ? 'TRUE' : 'FALSE'} · ${trace.operation.toUpperCase()}${trace.elapsedMs !== undefined ? ` · ${trace.elapsedMs}ms` : ''}${trace.count !== undefined ? ` · CV=${trace.count}` : ''}`
              : 'Not scanned'}</div>
            {document.rungs.length > 1 && <button type="button" className="btn ghost small"
              onClick={() => onChange({ ...document, rungs: document.rungs.filter(r => r.id !== rung.id) })}>Remove rung</button>}
          </div>
          <div className="sandbox-rung" data-rung-id={rung.id}>
            <span className="sandbox-rail" aria-hidden="true">│</span>
            {elements.map((element, index) => {
              if (element.type === 'contact') return <ContactControl key={index} value={element}
                tags={tags} active={Boolean(live[element.tag]) !== !!element.normallyClosed}
                onChange={value => updateElement(rung, index, value)}
                onRemove={elements.length > 1 ? () => removeElement(rung, index) : undefined} />;
              const branch = element as Branch;
              return <div key={index} className="sandbox-branch">
                {branch.alternatives.map((path, pathIndex) => {
                  const current = path[0];
                  return <ContactControl key={pathIndex} value={current} tags={tags}
                    active={Boolean(live[current.tag]) !== !!current.normallyClosed}
                    onChange={v => updateElement(rung, index, { type: 'branch', alternatives:
                      branch.alternatives.map((p, i) => i === pathIndex ? [v] : p) })} />;
                })}
                <button type="button" className="sandbox-remove" onClick={() => removeElement(rung, index)} aria-label="Remove parallel branch">×</button>
              </div>;
            })}
            <span className={`sandbox-coil ${trace?.result ? 'energized' : ''}`}>
              —( )— <select aria-label="Output coil" value={rung.coil} onChange={e => patchRung(rung.id, { ...rung, coil: e.target.value })}>
                {coils.map(tag => <option key={tag}>{tag}</option>)}
              </select>
            </span>
            <span className="sandbox-rail" aria-hidden="true">│</span>
          </div>
          <div className="sandbox-rung-controls">
            <label>Instruction
              <select aria-label={`Instruction for ${rung.id}`} value={operation}
                onChange={e => patchRung(rung.id, { ...rung, operation: operationFor(e.target.value) })}>
                <option value="coil">Coil</option><option value="ton">TON · on-delay timer</option>
                <option value="tof">TOF · off-delay timer</option>
                <option value="rto">RTO · retentive timer</option>
                <option value="tp">TP · pulse timer</option>
                <option value="ctu">CTU · count up</option>
                <option value="ctd">CTD · count down</option>
                <option value="osr">OSR · rising pulse</option><option value="osf">OSF · falling pulse</option>
              </select>
            </label>
            {rung.operation && 'presetMs' in rung.operation && <label>Preset (ms)
              <input type="number" min="1" max="86400000" value={rung.operation.presetMs}
                aria-label={`Timer preset for ${rung.id}`}
                onChange={e => updateTimerPreset(rung, Number(e.target.value))} />
            </label>}
            {(rung.operation?.kind === 'ctu' || rung.operation?.kind === 'ctd') && <label>Count preset
              <input type="number" min="1" max="100000000" value={rung.operation.preset}
                aria-label={`Counter preset for ${rung.id}`}
                onChange={e => updateCounterPreset(rung, Number(e.target.value))} />
            </label>}
            {(rung.operation?.kind === 'ctu' || rung.operation?.kind === 'rto') && <label>Reset condition
              <select aria-label={`Reset condition for ${rung.id}`}
                value={rung.operation.resetTag ?? ''}
                onChange={e => updateResetTag(rung, e.target.value)}>
                <option value="">No reset</option>
                {tags.filter(tag => tag !== rung.coil).map(tag => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>}
            {rung.operation?.kind === 'ctd' && <label>Load preset when
              <select aria-label={`Load condition for ${rung.id}`}
                value={rung.operation.loadTag}
                onChange={e => patchRung(rung.id, { ...rung,
                  operation: { ...rung.operation!, loadTag: e.target.value } as RungOperation })}>
                {tags.filter(tag => tag !== rung.coil).map(tag => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>}
            <button type="button" className="btn ghost small" disabled={rung.elements.length >= 8}
              onClick={() => patchRung(rung.id, { ...rung, elements: [...rung.elements, { type: 'contact', tag: 'StopOK' }] })}>+ Series contact</button>
            <button type="button" className="btn ghost small" disabled={rung.elements.length >= 8}
              onClick={() => patchRung(rung.id, { ...rung, elements: [...rung.elements,
                { type: 'branch', alternatives: [[{ type: 'contact', tag: 'Start' }], [{ type: 'contact', tag: 'Run' }]] }] })}>+ Parallel branch</button>
          </div>
        </div>;
      })}
      <div className="sandbox-actions">
        <button type="button" className="btn ghost small"
          disabled={document.rungs.length >= MAX_SANDBOX_RUNGS || symbols.length >= MAX_SANDBOX_SYMBOLS}
          onClick={addRung}>+ Add rung</button>
        <button type="button" className="btn ghost small" onClick={() => onChange(latchProgram())}>Load editable latch example</button>
        <button type="button" className="btn ghost small" onClick={reset}>Reset to one contact</button>
      </div>
      <div className="sandbox-tag-editor">
        <div><span className="eyebrow">Local tag table</span><h3>BOOL memory tags</h3>
          <p className="sandbox-help">Physical inputs: Start (I0.0), StopOK (I0.1); physical output: Run (Q0.0). Local tags are internal to the simulated PLC.</p></div>
        <div className="sandbox-add-tag">
          <label htmlFor="sandbox-new-tag">Tag name</label>
          <input id="sandbox-new-tag" type="text" value={newTag} maxLength={40}
            onChange={e => setNewTag(e.target.value)} placeholder="e.g. DelayReady" />
          <button type="button" className="btn ghost small" onClick={addTag}>Add tag</button>
        </div>
        {tagError && <p role="alert" className="sandbox-tag-error">{tagError}</p>}
        <div className="sandbox-symbol-list">
          {symbols.length ? symbols.map(tag => <div key={tag}>
            <code>{tag}</code><small>{snapshot.tagValues[tag] === true ? 'TRUE' : 'FALSE'}</small>
            <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove local tag ${tag}`}>×</button>
          </div>) : <p className="sandbox-help">No local memory tags yet. Add one before creating timer/counter networks.</p>}
        </div>
      </div>
    </fieldset>
    <p className="sandbox-help">Supported teaching subset; not a certified PLC IDE. STOP is a normal process pushbutton, not a safety-rated emergency stop.</p>
  </section>;
}
