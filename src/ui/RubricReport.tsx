import { useState } from 'react';
import type { AttemptResult, ExerciseMode } from '../platform/types';

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function RubricReport({
  result,
  mode,
  onRetry,
  actions,
}: {
  result: AttemptResult;
  mode: ExerciseMode;
  onRetry?: () => void;
  actions?: React.ReactNode;
}) {
  const { rubric } = result;
  const [trailOpen, setTrailOpen] = useState(mode === 'assessment');
  const pct = rubric.max > 0 ? Math.round((rubric.score / rubric.max) * 100) : 0;
  const state = rubric.safetyHold ? 'crit' : rubric.passed ? 'ok' : 'warn';

  return (
    <div className={`result-panel ${state}`} role="status" aria-live="polite">
      <div className="result-head">
        <div>
          <span className="panel-eyebrow">{mode === 'assessment' ? 'Assessment result' : 'Practice result'}</span>
          <div className="result-verdict">
            {rubric.safetyHold ? 'Safety hold' : rubric.passed ? 'Passed' : 'Not passed'}
          </div>
        </div>
        <div className="result-score tabular">
          {pct}<span>%</span>
        </div>
      </div>

      {rubric.safetyHold && (
        <p className="result-flag">A critical safety action was violated — this holds the result regardless of score.</p>
      )}

      <div className="criteria">
        {rubric.criteria.map((c) => {
          const full = c.earned >= c.max;
          return (
            <div key={c.id} className="criterion">
              <div className="criterion-top">
                <b>{c.label}</b>
                <span className={`tabular ${full ? 'is-ok' : c.earned > 0 ? '' : 'is-off'}`}>{c.earned}/{c.max}</span>
              </div>
              <div className="criterion-bar"><span style={{ width: `${c.max ? (c.earned / c.max) * 100 : 0}%` }} /></div>
              <small>{c.reason}</small>
            </div>
          );
        })}
      </div>

      {result.evidence.length > 0 && (
        <div className="action-trail">
          <button className="hints-toggle" onClick={() => setTrailOpen(!trailOpen)} aria-expanded={trailOpen}>
            <span className="panel-eyebrow">Action trail · {result.evidence.length} recorded (latest 300 shown)</span>
            <span>{trailOpen ? '−' : '+'}</span>
          </button>
          {trailOpen && (
            <ol className="trail-list">
              {result.evidence.slice(-300).map((e) => (
                <li key={e.index} className={e.accepted ? '' : 'rejected'}>
                  <span className="trail-time tabular">{fmtTime(e.at)}</span>
                  <span className="trail-detail">
                    <code>{e.action}</code> {e.detail}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <p className="muted small">
        Attempt took {Math.round(result.durationMs / 1000)}s · {result.evidence.length} recorded actions.
        {mode === 'learning' && ' Practice score only — not a workplace certification.'}
      </p>

      <div className="result-actions">
        {actions}
        {onRetry && <button className="btn ghost block" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}
