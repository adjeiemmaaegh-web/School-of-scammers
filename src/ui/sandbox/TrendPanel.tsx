import { useEffect, useMemo, useState } from 'react';
import type { ProjectFile, RenderSnapshot } from '../../sim/signals';
import { scanMsOf } from '../../sim/scan-config';
import { appendSample, MAX_TREND_SAMPLES, MAX_TREND_SERIES, seriesRange, seriesSegments, trendCsv, trendSources, type TrendSample } from '../../diagnostics/trend';

import './trend.css';

const COLORS = ['#3fb8af', '#f2a541', '#c678dd', '#e06c75'];
const W = 320, H = 110;

/**
 * Process trend (R5.5/R8.1): pick up to four real signals and watch them over model time. Values come only from the worker's
 * published snapshots; the recording is kept in the page while this panel is open (600 scans) and can be saved as CSV.
 */
export function TrendPanel({ snapshot, project }: { snapshot: RenderSnapshot; project: ProjectFile }) {
  const sources = useMemo(() => trendSources(snapshot), [snapshot]);
  const [ids, setIds] = useState<string[]>([]);
  const [buffer, setBuffer] = useState<TrendSample[]>([]);
  const scanMs = scanMsOf(project);
  useEffect(() => { if (ids.length) setBuffer(b => appendSample(b, snapshot, scanMs, ids)); }, [snapshot, ids, scanMs]);
  const choose = (slot: number, id: string) => {
    setIds(current => {
      const next = [...current];
      if (id) next[slot] = id; else next.splice(slot, 1);
      return Array.from(new Set(next.filter(Boolean))).slice(0, MAX_TREND_SERIES);
    });
    setBuffer([]);                                         // a new selection starts a new recording
  };
  const chosen = ids.map(id => sources.find(s => s.id === id) ?? { id, label: id, unit: '', kind: 'number' as const });
  const download = () => {
    const blob = new Blob(['﻿', trendCsv(buffer, chosen)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `process-trend-scan-${snapshot.tick}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const span = buffer.length > 1 ? (buffer[buffer.length - 1].timeMs - buffer[0].timeMs) / 1000 : 0;
  return <details className="sandbox-trend" data-trend-panel>
    <summary>Process trend <small>{ids.length ? `${ids.length} signal${ids.length > 1 ? 's' : ''} · ${buffer.length} scans` : 'choose signals'}</small></summary>
    <p className="sandbox-help">Recorded from the simulator's own values while this panel is open (last {MAX_TREND_SAMPLES} scans, model time). On/off signals plot as 0 and 1.</p>
    {[0, 1, 2, 3].slice(0, Math.min(ids.length + 1, MAX_TREND_SERIES)).map(slot =>
      <label key={slot} className="sandbox-trend-pick">
        <span className="sandbox-trend-swatch" style={{ background: COLORS[slot] }} aria-hidden />
        <select data-trend-select={slot} aria-label={`Trend signal ${slot + 1}`} value={ids[slot] ?? ''} onChange={e => choose(slot, e.target.value)}>
          <option value="">{slot < ids.length ? 'Remove this signal' : 'Add a signal…'}</option>
          {sources.map(s => <option key={s.id} value={s.id} disabled={ids.includes(s.id) && ids[slot] !== s.id}>{s.label}{s.unit ? ` (${s.unit})` : ''}</option>)}
        </select>
      </label>)}
    {ids.length > 0 && <>
      <svg className="sandbox-trend-chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" data-trend-chart
        aria-label={`Trend of ${chosen.map(c => c.label).join(', ')} over ${span.toFixed(1)} s of model time`}>
        <rect x="0" y="0" width={W} height={H} fill="none" stroke="currentColor" strokeOpacity=".2" />
        {ids.map((id, i) => seriesSegments(buffer, id, W, H).map((points, j) =>
          <polyline key={`${id}-${j}`} points={points} fill="none" stroke={COLORS[i]} strokeWidth={1.6} data-trend-series={id} />))}
      </svg>
      <ul className="sandbox-trend-legend">
        {chosen.map((c, i) => { const r = seriesRange(buffer, c.id); const last = buffer[buffer.length - 1]?.values[c.id];
          return <li key={c.id}><span className="sandbox-trend-swatch" style={{ background: COLORS[i] }} aria-hidden />{c.label}
            <code data-trend-value={c.id}>{last === null || last === undefined ? '—' : String(Math.round(last * 1000) / 1000)}{c.unit ? ` ${c.unit}` : ''}</code>
            {r && c.kind === 'number' && <small> range {Math.round(r.min * 100) / 100}…{Math.round(r.max * 100) / 100}</small>}</li>; })}
      </ul>
      <div className="sandbox-trend-actions">
        <small>{span.toFixed(1)} s of model time</small>
        <button type="button" className="btn ghost small" onClick={() => setBuffer([])}>Clear</button>
        <button type="button" className="btn ghost small" data-trend-csv disabled={!buffer.length} onClick={download}>Save CSV</button>
      </div>
    </>}
  </details>;
}
