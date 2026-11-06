/**
 * PLC · Rank 9 · "Sorter commissioning"
 *
 * Commission a reject sorter: enable part detection and arm the diverter, then
 * run a batch so good parts pass and rejects are diverted. Mis-sorts (a reject
 * that slips through, or a config that diverts the wrong part) count against you.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

type Part = 'good' | 'reject';
const BATCH: Part[] = ['good', 'reject', 'good', 'reject', 'reject'];

interface S {
  sensorOn: boolean;
  diverterArmed: boolean;
  index: number; // next part to feed
  correct: number;
  misSort: number;
  lastAction: string;
  submitted: boolean;
}

type A =
  | { t: 'toggleSensor' }
  | { t: 'toggleDiverter' }
  | { t: 'feed' }
  | { t: 'submit' };

function init(): S {
  return { sensorOn: false, diverterArmed: false, index: 0, correct: 0, misSort: 0, lastAction: '', submitted: false };
}

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'toggleSensor':
      s.sensorOn = !s.sensorOn;
      detail = `Photoeye detection ${s.sensorOn ? 'enabled' : 'disabled'}`;
      break;
    case 'toggleDiverter':
      s.diverterArmed = !s.diverterArmed;
      detail = `Reject diverter ${s.diverterArmed ? 'armed' : 'disarmed'}`;
      break;
    case 'feed': {
      if (s.index >= BATCH.length) {
        accepted = false;
        detail = 'Batch complete';
        break;
      }
      const part = BATCH[s.index];
      const detected = s.sensorOn;
      const diverted = detected && s.diverterArmed && part === 'reject';
      // Correct outcome: reject -> diverted, good -> passes.
      const outcome = diverted ? 'diverted' : 'passed';
      const isCorrect = (part === 'reject' && diverted) || (part === 'good' && !diverted);
      if (isCorrect) s.correct++;
      else s.misSort++;
      s.lastAction = `Part ${s.index + 1} (${part}) ${outcome} — ${isCorrect ? 'correct' : 'MIS-SORT'}`;
      s.index++;
      detail = s.lastAction;
      break;
    }
    case 'submit':
      s.submitted = true;
      detail = 'Attempt submitted';
      break;
  }
  return { next: s, event: { action: a.t, detail, accepted } };
}

function objectiveStatus(s: S): Record<string, boolean> {
  const done = s.index >= BATCH.length;
  return {
    sensor: s.sensorOn,
    diverter: s.diverterArmed,
    batch: done,
    clean: done && s.misSort === 0,
  };
}

function evaluate(s: S): RubricResult {
  const done = s.index >= BATCH.length;
  const criteria = [
    { id: 'sensing', label: 'Part detection configured', max: 20, earned: s.sensorOn ? 20 : 0, reason: s.sensorOn ? 'Photoeye detection enabled' : 'Detection not enabled' },
    { id: 'diverter', label: 'Diverter armed', max: 20, earned: s.diverterArmed ? 20 : 0, reason: s.diverterArmed ? 'Reject diverter armed' : 'Diverter not armed' },
    { id: 'batch', label: 'Batch commissioned', max: 20, earned: done ? 20 : Math.round((s.index / BATCH.length) * 20), reason: done ? 'Full batch run' : `${s.index}/${BATCH.length} parts run` },
    { id: 'sorting', label: 'Correct sorting', max: 40, earned: done ? Math.max(0, 40 - s.misSort * 20) : 0, reason: s.misSort === 0 ? 'No mis-sorts' : `${s.misSort} mis-sort(s)` },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && done && s.misSort === 0, safetyHold: false, criteria };
}

function Scene({ s }: { s: S }) {
  return (
    <svg className="plc-scene" viewBox="0 0 480 200" role="img" aria-label="Reject sorter conveyor.">
      <ellipse cx="240" cy="178" rx="200" ry="12" fill="var(--scene-shadow)" />
      <rect x="40" y="100" width="400" height="28" rx="6" fill="var(--scene-belt-1)" stroke="var(--scene-line)" />
      {/* photoeye */}
      <rect x="230" y="70" width="22" height="16" rx="3" fill={s.sensorOn ? 'var(--scene-motor)' : 'var(--scene-bg)'} stroke={s.sensorOn ? 'var(--ok)' : 'var(--scene-line)'} />
      <line x1="241" y1="86" x2="241" y2="100" stroke={s.sensorOn ? 'var(--ok)' : 'var(--scene-dim)'} strokeWidth="2" strokeDasharray="3 2" />
      <text x="241" y="64" textAnchor="middle" className="scene-label">PHOTOEYE</text>
      {/* pusher / diverter */}
      <rect x="300" y="128" width="40" height="16" rx="3" fill={s.diverterArmed ? 'var(--accent)' : 'var(--scene-dim)'} />
      <text x="320" y="166" textAnchor="middle" className="scene-label">DIVERTER</text>
      {/* progress */}
      <text x="60" y="56" className="scene-label">BATCH {s.index}/{BATCH.length}</text>
      <text x="60" y="88" className="scene-label" fill="var(--ok)">✓ {s.correct}</text>
      <text x="120" y="88" className="scene-label" fill={s.misSort ? 'var(--crit)' : 'var(--muted)'}>✕ {s.misSort}</text>
      <text x="240" y="194" textAnchor="middle" className="scene-label">{s.lastAction || 'configure, then feed parts'}</text>
    </svg>
  );
}

function Play({ state, dispatch }: ExercisePlayProps<S, A>) {
  const s = state;
  const locked = s.submitted;
  const done = s.index >= BATCH.length;
  return (
    <div className="exercise-sim">
      <div className="sim-canvas">
        <div className="sim-canvas-bar">
          <span>Reject sorter · commissioning</span>
          <span className={`status-pill ${s.misSort ? 'is-crit' : done ? 'is-ok' : 'is-idle'}`}>✓{s.correct} ✕{s.misSort}</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Configure</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'toggleSensor' })} disabled={locked}>{s.sensorOn ? '✓ Detection on' : 'Enable detection'}</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'toggleDiverter' })} disabled={locked}>{s.diverterArmed ? '✓ Diverter armed' : 'Arm diverter'}</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Run the batch</span>
          <div className="control-row">
            <button className="btn primary" onClick={() => dispatch({ t: 'feed' })} disabled={locked || done}>{done ? 'Batch complete' : 'Feed next part'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const sorterCommission: ExerciseDefinition<S, A> = {
  id: 'plc-sorter-commission',
  trade: 'plc',
  rank: 9,
  version: '1.0.0',
  title: 'Sorter commissioning',
  estMinutes: 50,
  summary: 'Commission a reject sorter: detect parts, arm the diverter, and run a batch with no mis-sorts.',
  scenario:
    'WO-079 — Commission a reject sorter. Enable photoeye part detection and arm the reject diverter, then run ' +
    'the batch so good parts pass through and rejects are diverted. The commissioning passes only if every part ' +
    'is sorted correctly.',
  objectives: [
    { id: 'sensor', label: 'Enable part detection' },
    { id: 'diverter', label: 'Arm the reject diverter' },
    { id: 'batch', label: 'Run the full batch' },
    { id: 'clean', label: 'Sort every part correctly' },
  ],
  hints: [
    'Both detection and the diverter must be configured before running, or rejects will slip through.',
    'Enable the photoeye, arm the diverter, then feed the batch one part at a time.',
    'Watch the correct/mis-sort tally as the batch runs.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
