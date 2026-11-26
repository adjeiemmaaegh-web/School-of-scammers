import { useMemo, useState } from 'react';
import type { RenderSnapshot } from '../../sim/signals';
import { COMPONENTS } from '../../components/registry';
import './trend.css';
import { PROBE_HIGH_MIN_V, PROBE_LOW_MAX_V, PROBE_TEXT, probeTerminal } from '../../electrical/logic-probe';

/** R5.5 logic probe: touch one terminal and read HIGH / LOW / UNDEFINED / FLOATING from the solver's own potential. */
export function LogicProbe({ snapshot }: { snapshot: RenderSnapshot }) {
  const [terminal, setTerminal] = useState('');
  // Every electrical terminal of every placed device (from its definition), whether or not it is wired.
  const terminals = useMemo(() => snapshot.components.flatMap(c => (COMPONENTS[c.kind]?.terminals ?? [])
    // 24 V DC terminals only: analog, three-phase and air ports are not logic levels.
    .filter(t => ['supply', 'return', 'passive', 'input', 'output', 'load'].includes(t.role))
    .map(t => `${c.id}.${t.name}`)), [snapshot.components]);
  const reading = probeTerminal(snapshot.voltages, snapshot.diagnostics, terminal || null);
  return <details className="sandbox-logic-probe" data-logic-probe>
    <summary>Logic probe <small>{terminal ? PROBE_TEXT[reading.state].split(' (')[0] : 'one terminal'}</small></summary>
    <p className="sandbox-help">Reads the simulated potential against the 0 V of the supply driving that net. ON at {PROBE_HIGH_MIN_V} V or more, OFF at {PROBE_LOW_MAX_V} V or less (educational type 1 input thresholds).</p>
    <label>Terminal
      <select data-logic-probe-terminal value={terminal} onChange={e => setTerminal(e.target.value)} aria-label="Logic probe terminal">
        <option value="">Choose a terminal…</option>
        {terminals.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </label>
    <p className={`sandbox-probe-reading is-${reading.state}`} role="status" data-logic-probe-state={reading.state}>
      <span className="sandbox-probe-led" aria-hidden />{PROBE_TEXT[reading.state]}
      {reading.volts !== null && <code> {reading.volts.toFixed(1)} V</code>}
    </p>
  </details>;
}
