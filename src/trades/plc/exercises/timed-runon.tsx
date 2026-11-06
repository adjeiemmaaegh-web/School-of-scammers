/**
 * PLC · Rank 4 · "Timed conveyor run-on"
 *
 * Introduces the on-delay timer (TON). After a part clears the photoeye the belt
 * must keep running for a configured run-on time, then stop. The learner sets a
 * timer preset and runs a cycle to observe and verify the behaviour.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

type Phase = 'idle' | 'part-present' | 'running-on' | 'stopped';

interface S {
  presetS: number; // 0..4 seconds
  phase: Phase;
  measuredRunOnS: number;
  cycleRun: boolean;
  verified: boolean;
  submitted: boolean;
}

type A =
  | { t: 'setPreset'; s: number }
  | { t: 'runCycle' }
  | { t: 'verify' }
  | { t: 'submit' };

function init(): S {
  return { presetS: 0, phase: 'idle', measuredRunOnS: 0, cycleRun: false, verified: false, submitted: false };
}

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'setPreset':
      s.presetS = a.s;
      detail = `Run-on timer preset set to ${a.s}s`;
      break;
    case 'runCycle':
      s.cycleRun = true;
      s.measuredRunOnS = s.presetS;
      s.phase = 'stopped';
      detail = s.presetS > 0
        ? `Cycle run: part cleared, belt ran on ${s.presetS}s then stopped`
        : 'Cycle run: preset is 0 — belt stopped immediately as the part cleared';
      break;
    case 'verify':
      if (s.cycleRun && s.presetS > 0 && s.measuredRunOnS === s.presetS) {
        s.verified = true;
        detail = 'Verified: belt runs on for the preset then stops';
      } else {
        accepted = false;
        detail = 'Verification needs a run-on preset above 0 and a completed cycle';
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
    preset: s.presetS > 0,
    cycle: s.cycleRun,
    runon: s.cycleRun && s.measuredRunOnS > 0 && s.measuredRunOnS === s.presetS,
    verify: s.verified,
  };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'preset', label: 'Timer configured', max: 25, earned: s.presetS > 0 ? 25 : 0, reason: s.presetS > 0 ? `Run-on preset ${s.presetS}s` : 'No run-on preset set' },
    { id: 'cycle', label: 'Cycle executed', max: 25, earned: s.cycleRun ? 25 : 0, reason: s.cycleRun ? 'A full cycle was run' : 'No cycle run' },
    { id: 'runon', label: 'Run-on behaviour', max: 30, earned: s.cycleRun && s.presetS > 0 ? 30 : 0, reason: s.cycleRun && s.presetS > 0 ? 'Belt ran on then stopped on the timer' : 'Run-on not demonstrated' },
    { id: 'process', label: 'Verification', max: 20, earned: s.verified ? 20 : 0, reason: s.verified ? 'Behaviour verified' : 'Not verified' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.verified, safetyHold: false, criteria };
}

function Scene({ s }: { s: S }) {
  const running = s.phase === 'part-present' || s.phase === 'running-on';
  const pct = s.presetS > 0 && s.cycleRun ? 100 : 0;
  return (
    <svg className="plc-scene" viewBox="0 0 480 210" role="img" aria-label={`Conveyor with run-on timer. Preset ${s.presetS}s.`}>
      <ellipse cx="240" cy="180" rx="190" ry="14" fill="var(--scene-shadow)" />
      <rect x="60" y="110" width="360" height="34" rx="7" fill="var(--scene-belt-1)" stroke="var(--scene-line)" />
      {[82, 240, 398].map((cx) => <circle key={cx} cx={cx} cy="127" r="18" fill="var(--scene-roller)" stroke="var(--scene-line)" strokeWidth="2" />)}
      <circle cx="430" cy="127" r="4" fill={s.cycleRun && s.presetS > 0 ? 'var(--ok)' : 'var(--scene-dim)'} />
      <text x="240" y="100" textAnchor="middle" className="scene-label">PHOTOEYE</text>
      <line x1="240" y1="104" x2="240" y2="110" stroke="var(--scene-line)" strokeWidth="2" />
      {/* timer gauge */}
      <rect x="150" y="30" width="180" height="40" rx="8" fill="var(--scene-motor)" stroke="var(--scene-line)" />
      <text x="166" y="54" className="scene-label">RUN-ON {s.presetS}s</text>
      <rect x="150" y="66" width="180" height="6" rx="3" fill="var(--surface-2)" />
      <rect x="150" y="66" width={180 * pct / 100} height="6" rx="3" fill="var(--accent)" />
      <text x="400" y="168" textAnchor="middle" className="scene-label">{s.phase === 'stopped' ? (running ? 'RUN' : 'STOPPED') : s.phase.toUpperCase()}</text>
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
          <span>Conveyor · run-on timer</span>
          <span className={`status-pill ${s.verified ? 'is-ok' : 'is-idle'}`}>{s.verified ? '● Verified' : `preset ${s.presetS}s`}</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Run-on preset (seconds)</span>
          <div className="control-row">
            {[0, 1, 2, 3, 4].map((n) => (
              <button key={n} className={`btn ${s.presetS === n ? 'primary' : 'ghost'}`} onClick={() => dispatch({ t: 'setPreset', s: n })} disabled={locked}>{n}s</button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Cycle</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'runCycle' })} disabled={locked}>Run a part cycle</button>
            <button className="btn primary" onClick={() => dispatch({ t: 'verify' })} disabled={locked}>Verify run-on</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const timedRunon: ExerciseDefinition<S, A> = {
  id: 'plc-timed-runon',
  trade: 'plc',
  rank: 4,
  version: '1.0.0',
  title: 'Timed conveyor run-on',
  estMinutes: 25,
  summary: 'Add an on-delay timer so the belt runs on after the part clears the photoeye, then verify it.',
  scenario:
    'WO-021 — Parts must fully clear the discharge end before the belt stops. Configure an on-delay (TON) ' +
    'run-on timer so the conveyor keeps running for a set time after the photoeye clears, then run a cycle ' +
    'and verify the belt runs on for the preset and stops.',
  objectives: [
    { id: 'preset', label: 'Set a run-on timer preset above 0' },
    { id: 'cycle', label: 'Run a full part cycle' },
    { id: 'runon', label: 'Observe the belt run on for the preset' },
    { id: 'verify', label: 'Verify the run-on behaviour' },
  ],
  hints: [
    'An on-delay timer (TON) starts counting when its input turns on — here, when the part clears the photoeye.',
    'A preset of 0 gives no run-on; pick 1–4 seconds.',
    'Run a cycle, watch the run-on, then press Verify.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
