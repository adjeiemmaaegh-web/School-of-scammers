import { useState } from 'react';
import type { ProjectFile } from '../../sim/signals';
import { MAX_AUTHORED_CHECKS, MAX_CHECK_MS, type AuthoredCheck, type CheckResult } from '../../exercises/authored-checks-schema';

const BUTTON_KINDS = new Set(['start', 'stop', 'pushbutton', 'reversebutton', 'estop', 'selector']);

/**
 * R10.2 authoring of measurable checks: an instructor composes data-only checks (optionally hold a button, run for a model
 * time, compare one published value). "Run checks" evaluates them on the current project through the real tick(), loaded on
 * demand, so authors can prove a check passes on a working design and fails on a broken one before exporting.
 */
export function AuthoredChecksEditor({ project, checks, onChange }: { project: ProjectFile | null; checks: AuthoredCheck[]; onChange: (c: AuthoredCheck[]) => void }) {
  const devices = project?.components ?? [];
  const buttons = devices.filter(c => BUTTON_KINDS.has(c.kind));
  const [label, setLabel] = useState('');
  const [press, setPress] = useState('');
  const [pressS, setPressS] = useState('0.5');
  const [afterS, setAfterS] = useState('5');
  const [kind, setKind] = useState<'device-on' | 'signal'>('signal');
  const [device, setDevice] = useState('');
  const [signal, setSignal] = useState('count');
  const [op, setOp] = useState<'>=' | '<=' | '==' | 'on' | 'off'>('>=');
  const [value, setValue] = useState('1');
  const [expectOn, setExpectOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const add = () => {
    const afterMs = Math.round(Number(afterS) * 1000), pressMs = Math.round(Number(pressS) * 1000);
    if (!label.trim()) return setError('Give the check a short label the learner will see.');
    if (!device) return setError('Choose the device to check.');
    if (!Number.isFinite(afterMs) || afterMs < 50 || afterMs > MAX_CHECK_MS) return setError(`Run time is 0.05 to ${MAX_CHECK_MS / 1000} s.`);
    if (press && (!Number.isFinite(pressMs) || pressMs < 50 || pressMs > MAX_CHECK_MS)) return setError('Press time is at least 0.05 s.');
    if (kind === 'signal' && !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(signal)) return setError('Signal names are letters, digits and _ (for example count, level, extended).');
    if (kind === 'signal' && op !== 'on' && op !== 'off' && !Number.isFinite(Number(value))) return setError('Enter a number to compare with.');
    const check: AuthoredCheck = { label: label.trim().slice(0, 120), ...(press ? { press, pressMs } : {}), afterMs,
      target: kind === 'device-on' ? { kind, device, expect: expectOn }
        : { kind, device, signal, op, ...(op === 'on' || op === 'off' ? {} : { value: Number(value) }) } };
    onChange([...checks, check].slice(0, MAX_AUTHORED_CHECKS)); setLabel(''); setError(null); setResults(null);
  };
  const runAll = async () => {
    if (!project) return;
    setRunning(true);
    try { const { runAuthoredChecks } = await import('../../exercises/authored-checks'); setResults(runAuthoredChecks(project, checks)); }
    finally { setRunning(false); }
  };
  return <div className="ux6-authored-checks" data-authored-checks>
    <h4>Measurable checks <small>({checks.length}/{MAX_AUTHORED_CHECKS}, run on the learner's own project)</small></h4>
    {checks.length > 0 && <ol className="ux6-check-list">
      {checks.map((c, i) => <li key={i} data-authored-check={i}>
        <span>{c.label}</span>
        <small>{c.press ? `press ${c.press} ${(c.pressMs! / 1000).toFixed(2)} s, ` : ''}after {(c.afterMs / 1000).toFixed(2)} s: {c.target.kind === 'device-on' ? `${c.target.device} ${c.target.expect ? 'on' : 'off'}` : `${c.target.device}.${c.target.signal} ${c.target.op}${c.target.value !== undefined ? ' ' + c.target.value : ''}`}</small>
        {results?.[i] && <strong className={results[i].pass ? 'is-pass' : 'is-fail'} data-check-result={results[i].pass ? 'pass' : 'fail'}>{results[i].pass ? 'PASS' : 'FAIL'} · {results[i].reason}</strong>}
        <button type="button" className="btn ghost small" aria-label={`Remove check ${c.label}`} onClick={() => { onChange(checks.filter((_, j) => j !== i)); setResults(null); }}>×</button>
      </li>)}
    </ol>}
    {checks.length > 0 && <button type="button" className="btn small" data-run-checks disabled={!project || running} onClick={runAll}>{running ? 'Running…' : 'Run checks on this project'}</button>}
    {checks.length < MAX_AUTHORED_CHECKS && <fieldset className="ux6-check-form">
      <legend>Add a check</legend>
      <label>Label<input data-check-label value={label} maxLength={120} onChange={e => setLabel(e.target.value)} placeholder="e.g. Three cartons reach the good bin" /></label>
      <label>Hold button (optional)<select data-check-press value={press} onChange={e => setPress(e.target.value)}>
        <option value="">No button</option>{buttons.map(b => <option key={b.id} value={b.id}>{b.id}</option>)}</select></label>
      {press && <label>Hold for (s)<input data-check-press-s type="number" min={0.05} step={0.05} value={pressS} onChange={e => setPressS(e.target.value)} /></label>}
      <label>Check after (s of model time)<input data-check-after-s type="number" min={0.05} max={MAX_CHECK_MS / 1000} step={0.5} value={afterS} onChange={e => setAfterS(e.target.value)} /></label>
      <label>Check<select data-check-kind value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
        <option value="signal">A plant signal</option><option value="device-on">A device on or off</option></select></label>
      <label>Device<select data-check-device value={device} onChange={e => setDevice(e.target.value)}>
        <option value="">Choose…</option>{devices.map(d => <option key={d.id} value={d.id}>{d.id} ({d.kind})</option>)}</select></label>
      {kind === 'signal' ? <>
        <label>Signal<input data-check-signal value={signal} maxLength={40} onChange={e => setSignal(e.target.value)} /></label>
        <label>Is<select data-check-op value={op} onChange={e => setOp(e.target.value as typeof op)}>
          <option value=">=">at least</option><option value="<=">at most</option><option value="==">exactly</option><option value="on">ON</option><option value="off">OFF</option></select></label>
        {op !== 'on' && op !== 'off' && <label>Value<input data-check-value type="number" value={value} onChange={e => setValue(e.target.value)} /></label>}
      </> : <label>Expect<select data-check-expect value={expectOn ? 'on' : 'off'} onChange={e => setExpectOn(e.target.value === 'on')}>
        <option value="on">on</option><option value="off">off</option></select></label>}
      <button type="button" className="btn ghost small" data-check-add onClick={add}>Add check</button>
      {error && <p role="alert" className="sandbox-tag-error">{error}</p>}
    </fieldset>}
  </div>;
}
