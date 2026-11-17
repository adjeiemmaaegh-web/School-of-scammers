import { summarizeDiagnostics } from '../../diagnostics/summary';
import type { ProjectFile, RenderSnapshot } from '../../sim/signals';

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

/** One-glance diagnostics: power rails, controllers, alarms, live devices, plus jumps to the detailed instruments. */
export function DiagnosticsOverview({ project, snapshot }: { project: ProjectFile; snapshot: RenderSnapshot }) {
  const s = summarizeDiagnostics(project, snapshot);
  return <section className="ux6-diag-overview" aria-label="Diagnostics overview" data-diagnostics-overview>
    <div className="ux6-diag-chips">
      <span data-diag-scan>Scan {s.scan} · {s.running ? 'running' : 'paused'}</span>
      <span data-diag-alarms className={s.activeAlarms.length ? 'is-bad' : ''}>{s.activeAlarms.length} active alarm(s)</span>
      <span data-diag-short className={s.shortCircuit ? 'is-bad' : ''}>{s.shortCircuit ? 'Supply short' : 'No supply short'}</span>
      <span>{s.devicesOn.length} device(s) energised</span>
      <span>{s.revealedFaults} revealed fault(s)</span>
    </div>
    <div className="ux6-diag-grid">
      <div><h4>Power rails</h4>
        {s.rails.length ? <ul>{s.rails.map(r => <li key={r.supply} data-diag-rail={r.supply} data-diag-rail-state={r.state}>{r.supply}: {r.state === 'live' ? `${r.volts} V` : r.state}</li>)}</ul> : <p>No supply placed.</p>}</div>
      <div><h4>Controllers</h4>
        {s.controllers.length ? <ul>{s.controllers.map(c => <li key={c.id} data-diag-plc={c.id}>{c.id}: {c.powered ? 'powered' : 'no power'} · {c.inputsOn} in / {c.outputsOn} out on</li>)}</ul> : <p>No controller placed.</p>}</div>
      <div><h4>Alarms</h4>
        {s.activeAlarms.length ? <ul>{s.activeAlarms.map(a => <li key={a.id}>{a.severity}: {a.message}</li>)}</ul> : <p>None active.</p>}</div>
      <div><h4>Energised devices</h4>
        {s.devicesOn.length ? <p>{s.devicesOn.join(', ')}</p> : <p>None.</p>}</div>
    </div>
    <nav className="ux6-diag-jumps" aria-label="Jump to an instrument">
      {[['diag-monitor', 'Live monitor'], ['diag-wiring', 'Wiring list'], ['diag-meter', 'Meter'], ['diag-faults', 'Faults'], ['diag-events', 'Events']].map(([id, label]) =>
        <button key={id} type="button" className="btn ghost small" data-diag-jump={id} onClick={() => jump(id)}>{label}</button>)}
    </nav>
  </section>;
}
