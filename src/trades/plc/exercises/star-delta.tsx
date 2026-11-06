/**
 * PLC · Rank 7 · "Star–delta start sequencing"
 *
 * Commission a three-contactor star–delta starter: start in star (KM1 main +
 * KM2 star), open star, then close delta (KM3). The star and delta contactors
 * must never be closed together — an overlap is a short and holds the result.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

interface S {
  km1: boolean; // main
  km2: boolean; // star
  km3: boolean; // delta
  startedInStar: boolean;
  transitioned: boolean; // star opened before delta
  deltaRun: boolean;
  overlap: boolean; // star & delta both closed — fault
  submitted: boolean;
}

type A =
  | { t: 'closeMain' }
  | { t: 'closeStar' }
  | { t: 'openStar' }
  | { t: 'closeDelta' }
  | { t: 'stop' }
  | { t: 'submit' };

function init(): S {
  return { km1: false, km2: false, km3: false, startedInStar: false, transitioned: false, deltaRun: false, overlap: false, submitted: false };
}

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'closeMain':
      s.km1 = true;
      detail = 'Main contactor KM1 closed';
      break;
    case 'closeStar':
      if (!s.km1) {
        accepted = false;
        detail = 'Close the main contactor KM1 first';
      } else if (s.km3) {
        accepted = false;
        s.overlap = true;
        detail = 'OVERLAP: closing star while delta is closed is a short circuit';
      } else {
        s.km2 = true;
        s.startedInStar = true;
        detail = 'Star contactor KM2 closed — motor starting in star';
      }
      break;
    case 'openStar':
      if (s.km2) {
        s.km2 = false;
        s.transitioned = true;
        detail = 'Star contactor KM2 opened — dead time before delta';
      } else {
        accepted = false;
        detail = 'Star is not closed';
      }
      break;
    case 'closeDelta':
      if (!s.km1) {
        accepted = false;
        detail = 'Close the main contactor KM1 first';
      } else if (s.km2) {
        accepted = false;
        s.overlap = true;
        detail = 'OVERLAP: closing delta while star is closed is a short circuit';
      } else if (!s.startedInStar) {
        accepted = false;
        detail = 'Start in star before going to delta';
      } else {
        s.km3 = true;
        s.deltaRun = true;
        detail = 'Delta contactor KM3 closed — motor running in delta';
      }
      break;
    case 'stop':
      s.km1 = s.km2 = s.km3 = false;
      detail = 'All contactors opened — motor stopped';
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
    star: s.startedInStar,
    transition: s.transitioned,
    delta: s.deltaRun,
    interlock: !s.overlap,
  };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'star', label: 'Start in star', max: 25, earned: s.startedInStar ? 25 : 0, reason: s.startedInStar ? 'Started with main + star' : 'Did not start in star' },
    { id: 'transition', label: 'Transition (open star)', max: 20, earned: s.transitioned ? 20 : 0, reason: s.transitioned ? 'Star opened before delta' : 'No clean transition' },
    { id: 'delta', label: 'Run in delta', max: 25, earned: s.deltaRun ? 25 : 0, reason: s.deltaRun ? 'Reached delta run' : 'Delta run not reached' },
    { id: 'interlock', label: 'Anti-overlap interlock', max: 30, earned: s.overlap ? 0 : 30, reason: s.overlap ? 'Star and delta were closed together (short)' : 'Star and delta never overlapped' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.deltaRun && !s.overlap, safetyHold: s.overlap, criteria };
}

function Coil({ x, label, on }: { x: number; label: string; on: boolean }) {
  return (
    <g>
      <rect x={x} y="56" width="96" height="60" rx="10" fill={on ? 'var(--scene-motor)' : 'var(--scene-bg)'} stroke={on ? 'var(--ok)' : 'var(--scene-line)'} strokeWidth={on ? 2.4 : 1.6} />
      <circle cx={x + 48} cy="80" r="11" fill="none" stroke={on ? 'var(--ok)' : 'var(--scene-dim)'} strokeWidth="2.4" />
      <text x={x + 48} y="134" textAnchor="middle" className="scene-label">{label}</text>
      <text x={x + 48} y="104" textAnchor="middle" className="scene-label" fill={on ? 'var(--ok)' : 'var(--scene-dim)'}>{on ? 'CLOSED' : 'open'}</text>
    </g>
  );
}

function Play({ state, dispatch }: ExercisePlayProps<S, A>) {
  const s = state;
  const locked = s.submitted;
  return (
    <div className="exercise-sim">
      <div className="sim-canvas">
        <div className="sim-canvas-bar">
          <span>Star–delta starter</span>
          <span className={`status-pill ${s.overlap ? 'is-crit' : s.deltaRun ? 'is-ok' : 'is-idle'}`}>
            {s.overlap ? '● Interlock fault' : s.deltaRun ? '● Running (delta)' : s.startedInStar ? '● Starting (star)' : '● Stopped'}
          </span>
        </div>
        <svg className="plc-scene" viewBox="0 0 480 160" role="img" aria-label="Three contactor coils: main, star, delta.">
          <Coil x={40} label="KM1 MAIN" on={s.km1} />
          <Coil x={192} label="KM2 STAR" on={s.km2} />
          <Coil x={344} label="KM3 DELTA" on={s.km3} />
        </svg>
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Start sequence</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'closeMain' })} disabled={locked}>Close KM1 (main)</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'closeStar' })} disabled={locked}>Close KM2 (star)</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Transition to delta</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'openStar' })} disabled={locked}>Open KM2 (star)</button>
            <button className="btn primary" onClick={() => dispatch({ t: 'closeDelta' })} disabled={locked}>Close KM3 (delta)</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'stop' })} disabled={locked}>Stop</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const starDelta: ExerciseDefinition<S, A> = {
  id: 'plc-star-delta',
  trade: 'plc',
  rank: 7,
  version: '1.0.0',
  title: 'Star–delta start sequencing',
  estMinutes: 40,
  summary: 'Commission a three-contactor star–delta starter with a correct transition and anti-overlap interlock.',
  scenario:
    'WO-055 — Commission a star–delta starter. Start the motor in star (main KM1 + star KM2), then transition ' +
    'to delta: open the star contactor, allow dead time, and close the delta contactor (KM3). The star and ' +
    'delta contactors must never be closed at the same time — that is a short circuit.',
  objectives: [
    { id: 'star', label: 'Start the motor in star' },
    { id: 'transition', label: 'Open star before closing delta' },
    { id: 'delta', label: 'Run the motor in delta' },
    { id: 'interlock', label: 'Never overlap star and delta' },
  ],
  hints: [
    'Close the main contactor first, then the star contactor to start.',
    'Before going to delta you must open the star contactor — never close delta while star is still closed.',
    'Correct order: main → star → (open star) → delta.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
