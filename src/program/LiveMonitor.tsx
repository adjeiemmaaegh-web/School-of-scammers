import { useEffect, useState } from 'react';
import type { RenderSnapshot } from '../sim/signals';

export function LiveMonitor({ snapshot, onBreakpoint }: {
  snapshot: RenderSnapshot; onBreakpoint: (scan: number | null) => void;
}) {
  const [target, setTarget] = useState('');
  const [watch, setWatch] = useState('');
  useEffect(() => {
    if (snapshot.breakpointScan !== null) setTarget(String(snapshot.breakpointScan));
  }, [snapshot.breakpointScan]);
  const values = Object.entries(snapshot.tagValues);
  const visible = watch.trim() ? values.filter(([name]) => name.toLowerCase().includes(watch.trim().toLowerCase())) : values;
  const threshold = Number(target);
  const valid = target.trim() !== '' && Number.isSafeInteger(threshold) &&
    threshold > snapshot.tick && threshold <= 1_000_000;
  return <section className="sandbox-live-monitor" aria-label="Live PLC monitor">
    <div className="sandbox-section-head"><div><span className="eyebrow">Engineering instrumentation</span><h2>Live PLC monitor</h2></div>
      <span className="status-pill is-idle">{snapshot.language.toUpperCase()} · scan {snapshot.tick}</span></div>
    <p className="sandbox-help">Values are sampled and published by the authoritative worker. Green means TRUE in this simulated snapshot, not electrical safety verification.</p>
    <label className="sandbox-monitor-search">Watch/filter tags
      <input type="search" value={watch} onChange={event => setWatch(event.target.value)}
        placeholder="Start, Run, Aux…" aria-label="Filter watched PLC tags" /></label>
    <div className="sandbox-monitor-table" role="table" aria-label="Live PLC tag values">
      <div role="row" className="sandbox-monitor-header"><span role="columnheader">Tag</span><span role="columnheader">Live value</span></div>
      {visible.map(([name,value]) =>
        <div role="row" key={name}><code role="cell">{name}</code>
          <strong role="cell" className={value === true ? 'is-live' : ''}>{typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value)}</strong></div>)}
      {!visible.length && <p className="sandbox-help">No matching signals.</p>}
    </div>
    {Object.keys(snapshot.ladderMemory).length > 0 && <details className="sandbox-memory-detail">
      <summary>Instruction memory (timers &amp; counters)</summary>
      {Object.entries(snapshot.ladderMemory).map(([rung, memory]) =>
        <div key={rung} className="sandbox-memory-row"><code>{rung}</code><span>{memory.elapsedMs} ms</span>
          <span>CV {memory.count}</span><strong>{memory.done ? 'Q TRUE' : 'Q FALSE'}</strong></div>)}
    </details>}
    <div className="sandbox-breakpoint-panel">
      <h3>Scan breakpoint</h3>
      <p className="sandbox-help">Choose a future scan. The worker stops after that scan completes; this does not force I/O.</p>
      <div>
        <input type="number" min={snapshot.tick + 1} max="1000000" value={target}
          placeholder="e.g. 25" aria-label="Breakpoint scan number"
          onChange={e => setTarget(e.target.value)} />
        <button className="btn ghost small" type="button" disabled={!valid || snapshot.running}
          onClick={() => onBreakpoint(threshold)}>Set</button>
        <button className="btn ghost small" type="button" disabled={snapshot.running || snapshot.breakpointScan === null}
          onClick={() => { onBreakpoint(null); setTarget(''); }}>Clear</button>
      </div>
      {snapshot.breakpointScan !== null && <p role="status">Armed at scan {snapshot.breakpointScan}</p>}
      {snapshot.breakpointHit && <p className="sandbox-breakpoint-hit" role="status">{snapshot.breakpointHit}</p>}
    </div>
  </section>;
}
