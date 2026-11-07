import { useState } from 'react';
import {
  describeFault, FAULT_KINDS, FAULT_LABEL, faultsOf, faultTargetOptions, repairTargetOptions,
} from '../../sim/faults';
import type { Command, FaultKind, ProjectFile, RenderSnapshot } from '../../sim/signals';

type Props = {
  project: ProjectFile;
  snapshot: RenderSnapshot;
  /** True while the simulation is paused (isolated). Parts can only be replaced then. */
  editable: boolean;
  send: (commands: Command[]) => void;
  /** Show the instructor controls (inject / reveal / clear). Off in graded scenarios. */
  instructor?: boolean;
};

/**
 * P5 troubleshooting: the instructor injects a fault, the learner diagnoses it with the multimeter,
 * I/O lamps and scan trace, then replaces the faulty part. Every action is a Command; nothing here
 * decides what a fault does. Alarms are read from the worker snapshot.
 */
export function TroubleshootingPanel({ project, snapshot, editable, send, instructor = true }: Props) {
  const [kind, setKind] = useState<FaultKind>('contactor-coil-open');
  const [target, setTarget] = useState('');
  const [stuckPressed, setStuckPressed] = useState(true);
  const [stuckActive, setStuckActive] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [seed, setSeed] = useState(1);
  const [repairTarget, setRepairTarget] = useState('');
  const faults = faultsOf(project);
  const targets = faultTargetOptions(project, kind);
  const chosen = targets.some(t => t.id === target) ? target : targets[0]?.id ?? '';
  const parts = repairTargetOptions(project);
  const part = parts.some(p => p.id === repairTarget) ? repairTarget : parts[0]?.id ?? '';
  const alarms = [...snapshot.alarms].reverse();
  const hasParts = project.components.length > 0;

  return <section className="sandbox-troubleshoot" aria-label="Troubleshooting">
    <span className="eyebrow">P5 · troubleshooting</span>
    <h3>Faults &amp; alarms</h3>
    <p className="sandbox-help">An instructor injects a fault; you find it with the multimeter, the I/O
      lamps and the scan trace, then replace the faulty part. Faults are educational abstractions of
      idealised 24 V parts.</p>

    {instructor && <details className="sandbox-fault-instructor" open>
      <summary>Instructor: inject or clear a fault</summary>
      <div className="sandbox-fault-form stack">
        <label>Fault type
          <select data-fault-kind value={kind} onChange={e => setKind(e.target.value as FaultKind)}>
            {FAULT_KINDS.map(k => <option key={k} value={k}>{FAULT_LABEL[k]}</option>)}
          </select></label>
        <label>Part
          <select data-fault-target value={chosen} disabled={!targets.length}
            onChange={e => setTarget(e.target.value)}>
            {targets.length ? targets.map(t => <option key={t.id} value={t.id}>{t.label}</option>)
              : <option value="">No matching part placed</option>}
          </select></label>
        {kind === 'button-stuck' && <label>Stuck as if
          <select data-fault-stuck value={stuckPressed ? 'pressed' : 'released'}
            onChange={e => setStuckPressed(e.target.value === 'pressed')}>
            <option value="pressed">pressed</option><option value="released">released</option>
          </select></label>}
        {kind === 'sensor-stuck' && <label>Output stuck
          <select data-fault-stuck-active value={stuckActive ? 'on' : 'off'}
            onChange={e => setStuckActive(e.target.value === 'on')}>
            <option value="on">ON (always reports detected)</option>
            <option value="off">OFF (never reports detected)</option>
          </select></label>}
        <label className="sandbox-fault-check">
          <input type="checkbox" data-fault-hidden checked={hidden}
            onChange={e => setHidden(e.target.checked)} /> Hide the cause until revealed</label>
        <button type="button" className="btn ghost small" data-fault-inject disabled={!chosen}
          onClick={() => send([{ k: 'injectFault', kind, target: chosen, hidden,
            ...(kind === 'button-stuck' ? { stuckPressed } : {}),
            ...(kind === 'sensor-stuck' ? { stuckActive } : {}) }])}>Inject fault</button>
      </div>
      <div className="sandbox-fault-form">
        <label>Mystery fault seed
          <input type="number" min={0} step={1} data-fault-seed value={seed}
            onChange={e => setSeed(Number.parseInt(e.target.value, 10) || 0)} /></label>
        <button type="button" className="btn ghost small" data-fault-mystery disabled={!hasParts}
          onClick={() => send([{ k: 'injectSeededFault', seed, hidden: true }])}>
          Inject mystery fault (hidden)</button>
      </div>
      <p className="sandbox-help">The same seed always injects the same fault into the same circuit.
        Hiding is a practice convenience, not security: exported project JSON still contains the fault.</p>
      <ul className="sandbox-fault-list" aria-label="Active faults">
        {faults.length === 0 && <li className="sandbox-help">No faults injected.</li>}
        {faults.map((f, i) => <li key={f.id} data-fault-item data-fault-state={f.hidden ? 'hidden' : 'visible'}>
          <span>{f.hidden ? `Hidden fault ${i + 1}` : describeFault(f)}</span>
          <span className="sandbox-fault-actions">
            {f.hidden && <button type="button" className="btn ghost small" data-fault-reveal
              onClick={() => send([{ k: 'revealFault', id: f.id }])}>Reveal</button>}
            <button type="button" className="btn ghost small" data-fault-clear
              aria-label={`Clear ${f.hidden ? `hidden fault ${i + 1}` : describeFault(f)}`}
              onClick={() => send([{ k: 'clearFault', id: f.id }])}>Clear</button>
          </span>
        </li>)}
      </ul>
    </details>}

    <div className="sandbox-repair">
      <label>Replace a part
        <select data-repair-target value={part} disabled={!parts.length}
          onChange={e => setRepairTarget(e.target.value)}>
          {parts.length ? parts.map(p => <option key={p.id} value={p.id}>{p.label}</option>)
            : <option value="">Nothing placed</option>}
        </select></label>
      <button type="button" className="btn primary small" data-repair-button
        disabled={!editable || !part} onClick={() => send([{ k: 'repair', target: part }])}>
        Replace part</button>
      {!editable && <p className="sandbox-help">Pause the simulation first. A part is only replaced
        with the plant isolated, and replacing a healthy part does not tell you anything.</p>}
    </div>

    <h4>Alarm history</h4>
    <ol className="sandbox-alarm-list" aria-live="polite" aria-label="Alarm history">
      {alarms.length === 0 && <li className="sandbox-help">No alarms. An alarm appears when a
        commanded action does not produce the expected result.</li>}
      {alarms.map(a => <li key={a.id} data-alarm-item data-alarm-code={a.code}
        data-alarm-active={a.clearedAtScan === null} className={`sandbox-alarm ${a.severity}`}>
        <div><strong>{a.severity.toUpperCase()}</strong> <code>{a.code}</code></div>
        <p>{a.message}</p>
        <small>Raised at scan {a.raisedAtScan} · {a.clearedAtScan === null
          ? 'ACTIVE' : `cleared at scan ${a.clearedAtScan}`}</small>
      </li>)}
    </ol>
  </section>;
}
