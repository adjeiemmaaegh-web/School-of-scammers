import { useEffect, useMemo, useState } from 'react';
import { compileSandboxST, DEFAULT_ST_SOURCE } from './p2-contract';
import type { RenderSnapshot } from '../sim/signals';

export function StructuredTextEditor({ source, disabled, snapshot, onActivate }: {
  source: string; disabled: boolean; snapshot: RenderSnapshot; onActivate: (source: string) => void;
}) {
  const [draft, setDraft] = useState(source || DEFAULT_ST_SOURCE);
  useEffect(() => { setDraft(source || DEFAULT_ST_SOURCE); }, [source]);
  const validation = useMemo(() => {
    try {
      const program = compileSandboxST(draft);
      return { message: 'Source compiles in the bounded teaching subset', ok: true,
        outputs: program.assignedOutputs.join(', ') };
    } catch (error) { return { message: error instanceof Error ? error.message : String(error), ok: false, outputs: '' }; }
  }, [draft]);
  return <section className="sandbox-st-editor" aria-label="Structured Text editor">
    <div className="sandbox-section-head">
      <div><span className="eyebrow">PLC programming language</span><h2>Structured Text</h2></div>
      <span className="status-pill is-idle">Bounded IEC-style teaching subset</span>
    </div>
    <p className="sandbox-help">Write and compile real Structured Text. The simulator uses the compiled code on every scan, with persistent variable memory. Output <code>Run : BOOL</code> controls Q0.0.</p>
    <label className="sandbox-st-label" htmlFor="sandbox-st-source">Structured Text program</label>
    <textarea id="sandbox-st-source" value={draft} rows={14} spellCheck={false}
      disabled={disabled} onChange={event => setDraft(event.target.value)}
      aria-describedby="sandbox-st-compile-status" />
    <div className="sandbox-st-status" id="sandbox-st-compile-status" role="status">
      <strong className={validation.ok ? 'is-valid' : 'is-invalid'}>{validation.ok ? 'Compiler OK' : 'Compiler error'}</strong>
      <span>{validation.message}</span>
    </div>
    <div className="sandbox-actions">
      <button type="button" className="btn primary small" disabled={disabled || !validation.ok || draft === source}
        onClick={() => onActivate(draft)}>Compile &amp; activate ST</button>
      <button type="button" className="btn ghost small" disabled={disabled}
        onClick={() => setDraft(DEFAULT_ST_SOURCE)}>Use start/stop sample</button>
      <button type="button" className="btn ghost small" disabled={disabled || draft === source}
        onClick={() => setDraft(source)}>Discard edits</button>
    </div>
    <p className="sandbox-help">Example latch: <code>Run := StopOK AND (Start OR Run);</code>. Unsupported vendor syntax is rejected rather than guessed. ST and Ladder are alternative modes, not concurrent programs.</p>
    <div className="sandbox-st-monitor">
      <h3>Simulated variables · scan {snapshot.tick}</h3>
      <div>{Object.entries(snapshot.tagValues).map(([name,value]) =>
        <span key={name}><code>{name}</code><strong>{typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : value}</strong></span>)}</div>
    </div>
  </section>;
}
