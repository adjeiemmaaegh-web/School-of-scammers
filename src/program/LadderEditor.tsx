import { useState, type KeyboardEvent } from 'react';
import { clipboardRung, copyRung, duplicateRung, emptyLadderHistory, insertRungCopy, moveRung, recordEdit, redoEdit, undoEdit, type LadderHistory } from './ladder-edit';
import type { Branch, Contact, LadderDocument, NumericRungOperation, NumericTagType, Rung, RungElement, RungOperation } from '../engineering/ladder';
import { NumericInstructionControls } from './NumericInstructionControls';
import type { RenderSnapshot } from '../sim/signals';
import { blankProgram, latchProgram, sortingProgram, tankProgram, reversingProgram } from '../sim/orchestrator';
import { MAX_SANDBOX_RUNGS, MAX_SANDBOX_SYMBOLS } from './p2-contract';

type Props = {
  document: LadderDocument; snapshot: RenderSnapshot; disabled: boolean; onChange: (doc: LadderDocument) => void;
  /** One-click solved example programs. Off in graded scenarios, where they would be the answer. */
  showExamples?: boolean;
  /** The selected PLC's inputs and outputs with their tag names. Omitted means the classic controller. */
  io?: { inputs: { terminal: string; tag: string }[]; outputs: { terminal: string; tag: string }[] };
};
const CLASSIC_INPUTS = ['Start', 'StopOK', 'Photoeye', 'TankHigh', 'ReverseRequest'];
const CLASSIC_OUTPUTS = ['Run', 'Sort', 'Fill', 'Drain', 'Forward', 'Reverse'];
const operationFor = (kind: string, target: string): RungOperation | undefined => {
  if (kind === 'coil') return undefined;
  if (kind === 'ton' || kind === 'tof' || kind === 'rto' || kind === 'tp') return { kind, presetMs: 250 };
  if (kind === 'ctu') return { kind: 'ctu', preset: 2 };
  if (kind === 'ctd') return { kind: 'ctd', preset: 2, loadTag: 'Unused' };
  if (kind === 'osr' || kind === 'osf' || kind === 'set' || kind === 'reset') return { kind };
  if (kind === 'compare') return {kind:'compare',left:{kind:'literal',value:0},
    comparator:'ge',right:{kind:'literal',value:1}};
  if (kind === 'move') return {kind:'move',target,left:{kind:'literal',value:0}};
  if (kind === 'add' || kind === 'sub' || kind === 'mul' || kind === 'div')
    return {kind,target,left:{kind:'tag',name:target},right:{kind:'literal',value:1}};
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
export function LadderEditor({ document, snapshot, disabled, onChange, showExamples = true, io }: Props) {
  // Tag names come from the selected PLC's I/O map; without one this is the classic controller.
  const inputNames = io ? io.inputs.map(p => p.tag) : CLASSIC_INPUTS;
  const outputNames = io ? io.outputs.map(p => p.tag) : CLASSIC_OUTPUTS;
  const classic = !io || io.inputs[0]?.tag === 'Start';
  const [newTag, setNewTag] = useState('');
  const [newTagType, setNewTagType] = useState<'BOOL' | NumericTagType>('BOOL');
  const [newInitial, setNewInitial] = useState('0');
  const [tagError, setTagError] = useState<string | null>(null);
  const symbols = Object.keys(document.symbols ?? {});
  const numericTags = symbols.filter(tag => ['INT','DINT','REAL'].includes(document.symbols![tag].type ?? 'BOOL'));
  const boolSymbols = symbols.filter(tag => !numericTags.includes(tag));
  const tags = Array.from(new Set([...inputNames, ...outputNames, 'Unused', ...boolSymbols, ...document.rungs.map(r => r.coil)]));
  const coils = Array.from(new Set([...outputNames, 'Unused', ...boolSymbols]));
  const live: Record<string, boolean | number> = { ...snapshot.tagValues, Unused: false };

  // R4.1: every change goes through edit(), which records the document it replaces for undo (bounded history).
  const [history, setHistory] = useState<LadderHistory>(emptyLadderHistory);
  const [copied, setCopied] = useState<string | null>(null);
  const edit = (next: LadderDocument) => { if (next === document) return; setHistory(h => recordEdit(h, document)); onChange(next); };
  const undo = () => { const r = undoEdit(history, document); if (r) { setHistory(r.history); onChange(r.doc); } };
  const redo = () => { const r = redoEdit(history, document); if (r) { setHistory(r.history); onChange(r.doc); } };
  const paste = (afterId?: string) => { const rung = clipboardRung(); if (rung) edit(insertRungCopy(document, rung, afterId)); };
  const onKeys = (e: KeyboardEvent<HTMLElement>) => {
    if (disabled || !(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).matches('input[type="text"], input[type="number"], textarea')) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  };
  const patchRung = (rungId: string, replacement: Rung) => edit({
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
      tags.includes(name) || numericTags.includes(name)) { setTagError('Choose a unique tag name starting with a letter.'); return; }
    if (symbols.length >= MAX_SANDBOX_SYMBOLS) {
      setTagError('Maximum 16 local tags reached.'); return;
    }
    const value = Number(newInitial);
    if (newTagType !== 'BOOL' && (newInitial.trim() === '' || !Number.isFinite(value) ||
      Math.abs(value) > 1_000_000_000 || (newTagType !== 'REAL' && !Number.isSafeInteger(value)) ||
      (newTagType === 'INT' && (value < -32768 || value > 32767)))) {
      setTagError('Enter a valid number (INT: -32768..32767; other numeric values bounded to ±1 billion).'); return;
    }
    const definition = newTagType === 'BOOL' ?
      { description: 'Local BOOL / memory tag' } :
      { description: `Local ${newTagType} register`, type: newTagType, initial: value };
    edit({ ...document, symbols: { ...document.symbols, [name]: definition } });
    setNewTag(''); setNewInitial('0'); setTagError(null);
  };
  const removeTag = (tag: string) => {
    if (document.rungs.some(rung => rung.coil === tag ||
      (rung.operation && 'resetTag' in rung.operation && rung.operation.resetTag === tag) ||
      (rung.operation?.kind === 'ctd' && rung.operation.loadTag === tag) ||
      (rung.operation && 'target' in rung.operation && rung.operation.target === tag) ||
      (rung.operation && 'left' in rung.operation && rung.operation.left.kind === 'tag' &&
        rung.operation.left.name === tag) ||
      (rung.operation && 'right' in rung.operation && rung.operation.right.kind === 'tag' &&
        rung.operation.right.name === tag) ||
      rung.elements.some(element => element.type === 'contact' ?
        element.tag === tag : element.alternatives.some(path => path.some(c => c.tag === tag))))) {
      setTagError(`Tag ${tag} is in use. Remove those contacts/coils first.`); return;
    }
    const remaining = { ...document.symbols };
    delete remaining[tag];
    edit({ ...document, symbols: remaining });
    setTagError(null);
  };
  const addRung = () => {
    if (document.rungs.length >= MAX_SANDBOX_RUNGS) return;
    let number = 1;
    while (tags.includes(`Aux${number}`) || numericTags.includes(`Aux${number}`)) number++;
    const newCoil = `Aux${number}`;
    let suffix = 1;
    while (document.rungs.some(r => r.id === `rung-${suffix}`)) suffix++;
    edit({
      ...document,
      symbols: { ...document.symbols, [newCoil]: { description: 'Local BOOL rung output' } },
      rungs: [...document.rungs, {
        id: `rung-${suffix}`, elements: [{ type: 'contact', tag: inputNames[0] }], coil: newCoil,
      }],
    });
  };
  const reset = () => edit(classic ? blankProgram() : { id: 'sandbox-program', version: '1.0', rungs: [{ id: 'rung-1', elements: [{ type: 'contact', tag: inputNames[0] }], coil: outputNames[0] }] });
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

  return <section className="sandbox-editor panel" aria-label="Ladder programming editor" onKeyDown={onKeys}>
    <div className="sandbox-section-head">
      <div><span className="eyebrow">PLC program · live monitor</span><h2>Ladder Logic</h2></div>
      <span className="status-pill is-idle">{document.rungs.length} / {MAX_SANDBOX_RUNGS} rungs</span>
    </div>
    <div className="sandbox-ladder-tools" role="toolbar" aria-label="Ladder editing">
      <button type="button" className="btn ghost small" data-ladder-undo disabled={disabled || !history.past.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
      <button type="button" className="btn ghost small" data-ladder-redo disabled={disabled || !history.future.length} onClick={redo} title="Redo (Ctrl+Y)">Redo</button>
      <button type="button" className="btn ghost small" data-ladder-paste disabled={disabled || !copied || document.rungs.length >= MAX_SANDBOX_RUNGS} onClick={() => paste()}
        title="Paste the copied rung at the end">Paste rung{copied ? ` (${copied})` : ''}</button>
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
              `${trace.result ? 'TRUE' : 'FALSE'} · ${trace.operation.toUpperCase()}${trace.elapsedMs !== undefined ? ` · ${trace.elapsedMs}ms` : ''}${trace.count !== undefined ? ` · CV=${trace.count}` : ''}${trace.numericResult !== undefined ? ` · VALUE=${trace.numericResult}` : ''}`
              : 'Not scanned'}</div>
            <span className="sandbox-rung-actions">
              <button type="button" className="btn ghost small" data-rung-up={rung.id} disabled={rungIndex === 0} aria-label={`Move network ${rungIndex + 1} up`}
                onClick={() => edit(moveRung(document, rung.id, -1))}>↑</button>
              <button type="button" className="btn ghost small" data-rung-down={rung.id} disabled={rungIndex === document.rungs.length - 1} aria-label={`Move network ${rungIndex + 1} down`}
                onClick={() => edit(moveRung(document, rung.id, 1))}>↓</button>
              <button type="button" className="btn ghost small" data-rung-duplicate={rung.id} disabled={document.rungs.length >= MAX_SANDBOX_RUNGS}
                onClick={() => edit(duplicateRung(document, rung.id))}>Duplicate</button>
              <button type="button" className="btn ghost small" data-rung-copy={rung.id}
                onClick={() => { if (copyRung(document, rung.id)) setCopied(`network ${rungIndex + 1}`); }}>Copy</button>
              {copied && <button type="button" className="btn ghost small" data-rung-paste-after={rung.id} disabled={document.rungs.length >= MAX_SANDBOX_RUNGS}
                onClick={() => paste(rung.id)}>Paste below</button>}
              {document.rungs.length > 1 && <button type="button" className="btn ghost small"
                onClick={() => edit({ ...document, rungs: document.rungs.filter(r => r.id !== rung.id) })}>Remove rung</button>}
            </span>
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
                onChange={e => patchRung(rung.id, { ...rung, operation: operationFor(e.target.value,numericTags[0] ?? '') })}>
                <option value="coil">Coil</option><option value="ton">TON · on-delay timer</option>
                <option value="tof">TOF · off-delay timer</option>
                <option value="rto">RTO · retentive timer</option>
                <option value="tp">TP · pulse timer</option>
                <option value="ctu">CTU · count up</option>
                <option value="ctd">CTD · count down</option>
                <option value="osr">OSR · rising pulse</option><option value="osf">OSF · falling pulse</option>
                <option value="set">SET · retain coil ON</option><option value="reset">RESET · retain coil OFF</option>
                <option value="compare">Compare numeric values</option>
                <option value="move" disabled={!numericTags.length}>MOV · assign numeric</option>
                <option value="add" disabled={!numericTags.length}>ADD · arithmetic</option>
                <option value="sub" disabled={!numericTags.length}>SUB · arithmetic</option>
                <option value="mul" disabled={!numericTags.length}>MUL · arithmetic</option>
                <option value="div" disabled={!numericTags.length}>DIV · arithmetic</option>
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
            {rung.operation && ['compare','move','add','sub','mul','div'].includes(rung.operation.kind) &&
              <NumericInstructionControls operation={rung.operation as NumericRungOperation}
                numbers={numericTags} onChange={operation => patchRung(rung.id,{...rung,operation})} />}
            <button type="button" className="btn ghost small" disabled={rung.elements.length >= 8}
              onClick={() => patchRung(rung.id, { ...rung, elements: [...rung.elements, { type: 'contact', tag: 'StopOK' }] })}>+ Series contact</button>
            <button type="button" className="btn ghost small" disabled={rung.elements.length >= 8}
              onClick={() => patchRung(rung.id, { ...rung, elements: [...rung.elements,
                { type: 'branch', alternatives: [[{ type: 'contact', tag: inputNames[0] }], [{ type: 'contact', tag: outputNames[0] }]] }] })}>+ Parallel branch</button>
          </div>
        </div>;
      })}
      <div className="sandbox-actions">
        <button type="button" className="btn ghost small"
          disabled={document.rungs.length >= MAX_SANDBOX_RUNGS || symbols.length >= MAX_SANDBOX_SYMBOLS}
          onClick={addRung}>+ Add rung</button>
        {showExamples && <>
          <button type="button" className="btn ghost small" onClick={() => edit(latchProgram())}>Load editable latch example</button>
          <button type="button" className="btn ghost small" onClick={() => edit(sortingProgram())}>Load sorting program example</button>
          <button type="button" className="btn ghost small" onClick={() => edit(tankProgram())}>Load tank control example</button>
          <button type="button" className="btn ghost small" onClick={() => edit(reversingProgram())}>Load forward/reverse example</button>
        </>}
        <button type="button" className="btn ghost small" onClick={reset}>Reset to one contact</button>
      </div>
      <div className="sandbox-tag-editor">
        <div><span className="eyebrow">Local tag table</span><h3>BOOL and numeric registers</h3>
          <p className="sandbox-help">{io ? <>Physical inputs: {io.inputs.map(p => `${p.tag} (${p.terminal})`).join(', ')}; outputs: {io.outputs.map(p => `${p.tag} (${p.terminal})`).join(', ')}. </>
            : 'Physical inputs: Start (I0.0), StopOK (I0.1), Photoeye (I0.2), TankHigh (I0.3), ReverseRequest (I0.4); outputs: Run (Q0.0), Sort (Q0.1), Fill (Q0.2), Drain (Q0.3), Forward (Q0.4), Reverse (Q0.5). '}Local tags are internal to the simulated PLC.</p></div>
        <div className="sandbox-add-tag">
          <label htmlFor="sandbox-new-tag">Tag name</label>
          <input id="sandbox-new-tag" type="text" value={newTag} maxLength={40}
            onChange={e => setNewTag(e.target.value)} placeholder="e.g. DelayReady" />
          <label>Variable type
            <select aria-label="New PLC tag type" value={newTagType}
              onChange={e => setNewTagType(e.target.value as typeof newTagType)}>
              <option value="BOOL">BOOL</option><option value="INT">INT</option>
              <option value="DINT">DINT</option><option value="REAL">REAL</option>
            </select>
          </label>
          {newTagType !== 'BOOL' && <label>Initial value
            <input type="number" step={newTagType === 'REAL' ? 'any' : '1'}
              aria-label="New numeric tag initial value" value={newInitial}
              onChange={e => setNewInitial(e.target.value)} />
          </label>}
          <button type="button" className="btn ghost small" onClick={addTag}>Add tag</button>
        </div>
        {tagError && <p role="alert" className="sandbox-tag-error">{tagError}</p>}
        <div className="sandbox-symbol-list">
          {symbols.length ? symbols.map(tag => <div key={tag}>
            <code>{tag}</code><small>{document.symbols?.[tag].type ?? 'BOOL'}</small>
            <small>{(() => {
              const value = snapshot.tagValues[tag] ?? document.symbols?.[tag].initial ??
                (numericTags.includes(tag) ? 0 : false);
              return typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
            })()}</small>
            <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove local tag ${tag}`}>×</button>
          </div>) : <p className="sandbox-help">No local memory tags yet. Add one before creating timer/counter networks.</p>}
        </div>
      </div>
    </fieldset>
    <p className="sandbox-help">Supported teaching subset; not a certified PLC IDE. STOP is a normal process pushbutton, not a safety-rated emergency stop.</p>
  </section>;
}
