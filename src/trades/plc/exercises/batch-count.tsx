/**
 * PLC · Rank 5 · "Part counting & batch stop"
 *
 * Introduces the up-counter (CTU). The learner sets a batch target, feeds parts
 * past a sensor, and the line must stop automatically when the target is reached.
 * A reset must clear the count for the next batch.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

interface S {
  target: number;
  count: number;
  lineStopped: boolean;
  batchStopHit: boolean; // the stop fired exactly at target
  resetProven: boolean;
  overfed: boolean; // tried to feed past a stopped line
  submitted: boolean;
}

type A =
  | { t: 'setTarget'; n: number }
  | { t: 'feed' }
  | { t: 'reset' }
  | { t: 'submit' };

function init(): S {
  return { target: 0, count: 0, lineStopped: false, batchStopHit: false, resetProven: false, overfed: false, submitted: false };
}

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'setTarget':
      s.target = a.n;
      s.count = 0;
      s.lineStopped = false;
      detail = `Batch target set to ${a.n}`;
      break;
    case 'feed':
      if (s.target <= 0) {
        accepted = false;
        detail = 'Set a batch target first';
      } else if (s.lineStopped) {
        accepted = false;
        s.overfed = true;
        detail = 'Line is stopped at target — no more parts should pass';
      } else {
        s.count++;
        detail = `Part counted (${s.count}/${s.target})`;
        if (s.count >= s.target) {
          s.lineStopped = true;
          s.batchStopHit = true;
          detail = `Batch complete — line stopped at ${s.count}/${s.target}`;
        }
      }
      break;
    case 'reset':
      if (s.count > 0 || s.lineStopped) {
        s.resetProven = s.resetProven || s.batchStopHit; // a meaningful reset after a batch
        s.count = 0;
        s.lineStopped = false;
        detail = 'Counter reset for the next batch';
      } else {
        accepted = false;
        detail = 'Nothing to reset';
      }
      break;
    case 'submit':
      s.submitted = true;
      detail = 'Attempt submitted';
      break;
  }
  return { next: s, event: { action: a.t, detail, accepted } };
}

function objectiveStatus(s: S): Record<string, boolean> {
  return {
    target: s.target > 0,
    count: s.count > 0 || s.batchStopHit,
    stop: s.batchStopHit,
    reset: s.resetProven,
  };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'target', label: 'Batch target set', max: 20, earned: s.target > 0 ? 20 : 0, reason: s.target > 0 ? `Target ${s.target}` : 'No target set' },
    { id: 'count', label: 'Counting works', max: 25, earned: s.batchStopHit ? 25 : s.count > 0 ? 12 : 0, reason: s.count > 0 ? 'Parts counted at the sensor' : 'No parts counted' },
    { id: 'stop', label: 'Batch stop at target', max: 30, earned: s.batchStopHit && !s.overfed ? 30 : s.batchStopHit ? 15 : 0, reason: s.overfed ? 'Line was fed past the target stop' : s.batchStopHit ? 'Line stopped exactly at target' : 'Batch stop not reached' },
    { id: 'reset', label: 'Reset for next batch', max: 25, earned: s.resetProven ? 25 : 0, reason: s.resetProven ? 'Counter reset after a batch' : 'Reset not demonstrated' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.batchStopHit && s.resetProven && !s.overfed, safetyHold: false, criteria };
}

function Scene({ s }: { s: S }) {
  const digits = String(s.count).padStart(2, '0');
  return (
    <svg className="plc-scene" viewBox="0 0 480 210" role="img" aria-label={`Batch counter. ${s.count} of ${s.target}. Line ${s.lineStopped ? 'stopped' : 'running'}.`}>
      <ellipse cx="240" cy="180" rx="190" ry="14" fill="var(--scene-shadow)" />
      <rect x="40" y="120" width="400" height="30" rx="6" fill="var(--scene-belt-1)" stroke="var(--scene-line)" />
      {[60, 180, 300, 420].map((cx) => <circle key={cx} cx={cx} cy="135" r="15" fill="var(--scene-roller)" stroke="var(--scene-line)" strokeWidth="2" />)}
      {/* counter display */}
      <rect x="180" y="34" width="120" height="56" rx="10" fill="#101d2c" stroke="var(--scene-line)" />
      <text x="240" y="76" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="34" fill={s.lineStopped ? 'var(--accent)' : 'var(--ok)'}>{digits}</text>
      <text x="240" y="24" textAnchor="middle" className="scene-label">COUNT / {s.target || '—'}</text>
      {/* sensor */}
      <rect x="350" y="92" width="22" height="18" rx="3" fill="var(--scene-motor)" stroke="var(--scene-line)" />
      <line x1="361" y1="110" x2="361" y2="120" stroke="var(--ok)" strokeWidth="2" strokeDasharray="3 2" />
      <text x="361" y="86" textAnchor="middle" className="scene-label">SENSOR</text>
      <text x="60" y="170" className="scene-label" fill={s.lineStopped ? 'var(--accent)' : 'var(--ok)'}>{s.lineStopped ? 'LINE STOPPED — BATCH COMPLETE' : 'LINE RUNNING'}</text>
    </svg>
  );
}

function Play({ state, dispatch }: ExercisePlayProps<S, A>) {
  const s = state;
  const locked = s.submitted;
  return (
    <div className="exercise-sim">
      <div className="sim-canvas">
        <div className="sim-canvas-bar">
          <span>Packaging line · batch counter</span>
          <span className={`status-pill ${s.lineStopped ? 'is-ok' : 'is-idle'}`}>{s.count}/{s.target || '—'}</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Batch target</span>
          <div className="control-row">
            {[3, 5, 10].map((n) => (
              <button key={n} className={`btn ${s.target === n ? 'primary' : 'ghost'}`} onClick={() => dispatch({ t: 'setTarget', n })} disabled={locked}>{n} parts</button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Operate</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'feed' })} disabled={locked}>Part passes sensor</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'reset' })} disabled={locked}>Reset counter</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const batchCount: ExerciseDefinition<S, A> = {
  id: 'plc-batch-count',
  trade: 'plc',
  rank: 5,
  version: '1.0.0',
  title: 'Part counting & batch stop',
  estMinutes: 30,
  summary: 'Count parts with an up-counter and stop the line automatically when a batch target is reached.',
  scenario:
    'WO-030 — Product is packed in fixed batches. Set a batch target, count parts as they pass the sensor ' +
    'with an up-counter (CTU), and stop the line automatically when the target is reached. Reset the counter ' +
    'to begin the next batch.',
  objectives: [
    { id: 'target', label: 'Set a batch target' },
    { id: 'count', label: 'Count parts at the sensor' },
    { id: 'stop', label: 'Stop the line at the target' },
    { id: 'reset', label: 'Reset the counter for the next batch' },
  ],
  hints: [
    'An up-counter (CTU) increments on each sensor pulse and sets a done bit at its preset.',
    'Use the done bit to stop the line — parts should not pass once the batch is complete.',
    'After the batch, reset the counter to start again.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
