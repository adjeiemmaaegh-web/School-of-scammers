import { useEffect, useRef, useState } from 'react';
import { defaultIo } from '../../sim/plc-io';
import type { Command, PlcView } from '../../sim/signals';

type Props = {
  plcId: string;
  view: PlcView;
  /** True while the simulation is paused. Names can only change then (the worker enforces it too). */
  editable: boolean;
  send: (commands: Command[]) => void;
};

/** One tag name: edits a draft and commits on Enter or blur, so typing is not overwritten by a stale snapshot. */
function TagField({ terminal, tag, on, disabled, kind, onCommit }: {
  terminal: string; tag: string; on: boolean; disabled: boolean; kind: 'input' | 'output'; onCommit: (name: string) => void;
}) {
  const [draft, setDraft] = useState(tag);
  const latest = useRef(tag);
  latest.current = tag;
  useEffect(() => { setDraft(tag); }, [tag]);
  const commit = () => {
    const name = draft.trim();
    if (name === tag) return;
    onCommit(name);
    // If the worker refused the name, the tag never changes: show the real name again instead of a name that was not applied.
    window.setTimeout(() => setDraft(latest.current), 700);
  };
  return <label className={`sandbox-io-row ${on ? 'lit' : ''}`}>
    <i aria-hidden="true" /><code>{terminal}</code>
    <input type="text" value={draft} disabled={disabled} maxLength={24} spellCheck={false}
      aria-label={`Tag name for ${kind} ${terminal}`} {...{ [`data-io-${kind}`]: terminal }}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') setDraft(tag); }} />
  </label>;
}

/**
 * Name the inputs and outputs of a configurable (16/16) PLC. Each field is one terminal; its name is what the program
 * uses. The worker refuses a rename that would break the program that is active on this PLC and says why.
 */
export function IoMappingPanel({ plcId, view, editable, send }: Props) {
  const current = {
    inputs: Object.fromEntries(view.io.inputs.map(p => [p.terminal, p.tag])),
    outputs: Object.fromEntries(view.io.outputs.map(p => [p.terminal, p.tag])),
  };
  const rename = (side: 'inputs' | 'outputs', terminal: string, name: string) => send([{ k: 'configureIo', plc: plcId,
    io: { ...current, [side]: { ...current[side], [terminal]: name } } }]);
  return <section className="sandbox-io-map panel" aria-label={`I/O tags for ${plcId}`} data-io-map={plcId}>
    <div className="sandbox-section-head"><div><span className="eyebrow">Configurable I/O</span><h2>I/O tags · {plcId}</h2></div>
      <button type="button" className="btn ghost small" data-io-reset disabled={!editable}
        onClick={() => send([{ k: 'configureIo', plc: plcId, io: defaultIo('plc16') }])}>Restore default names</button></div>
    <p className="sandbox-help">Each terminal has a tag, the name your program uses. Type a new name and press Enter. A name must start with a letter, use letters, digits and _, and be unique on this PLC. A rename that would break the active program is refused. {editable ? '' : 'Pause the simulation to rename.'}</p>
    <div className="sandbox-io-grid">
      <div><h3>Inputs</h3>{view.io.inputs.map(p => <TagField key={p.terminal} kind="input" terminal={p.terminal} tag={p.tag} on={p.on}
        disabled={!editable} onCommit={name => rename('inputs', p.terminal, name)} />)}</div>
      <div><h3>Outputs</h3>{view.io.outputs.map(p => <TagField key={p.terminal} kind="output" terminal={p.terminal} tag={p.tag} on={p.on}
        disabled={!editable} onCommit={name => rename('outputs', p.terminal, name)} />)}</div>
    </div>
  </section>;
}
