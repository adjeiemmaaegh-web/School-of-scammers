/**
 * PLC · Rank 2 · "Motor seal-in & stop interlock"
 *
 * A ladder-logic build task. The learner assembles a latching start/stop rung by
 * adding a seal-in (holding) contact and a stop (NC) interlock, then proves it:
 * a momentary Start must latch the motor on, and Stop must drop it out.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

interface S {
  hasSealIn: boolean;
  hasStop: boolean;
  motor: boolean;
  /** proof flags captured during testing */
  latchProven: boolean; // motor stayed on after Start released (needs seal-in)
  stopProven: boolean; // Stop dropped the motor
  ranWithoutStart: boolean; // safety: motor energised with no start — should never happen
  submitted: boolean;
}

type A =
  | { t: 'toggleSealIn' }
  | { t: 'toggleStop' }
  | { t: 'tapStart' } // momentary press + release
  | { t: 'pressStop' }
  | { t: 'submit' };

function init(): S {
  return { hasSealIn: false, hasStop: false, motor: false, latchProven: false, stopProven: false, ranWithoutStart: false, submitted: false };
}

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'toggleSealIn':
      s.hasSealIn = !s.hasSealIn;
      detail = `Seal-in (holding) contact ${s.hasSealIn ? 'added to' : 'removed from'} the rung`;
      break;
    case 'toggleStop':
      s.hasStop = !s.hasStop;
      detail = `Stop (NC) interlock ${s.hasStop ? 'added to' : 'removed from'} the rung`;
      break;
    case 'tapStart': {
      // Momentary: energise, then on release the motor holds only if a seal-in exists.
      const held = s.hasSealIn;
      s.motor = held;
      if (held) s.latchProven = true;
      detail = held ? 'Momentary Start: motor latched via seal-in' : 'Momentary Start: motor dropped on release (no seal-in)';
      break;
    }
    case 'pressStop':
      if (!s.hasStop) {
        accepted = false;
        detail = 'No stop interlock in the rung — Stop has no effect';
      } else if (s.motor) {
        s.motor = false;
        s.stopProven = true;
        detail = 'Stop interlock opened the rung — motor stopped';
      } else {
        accepted = false;
        detail = 'Motor already stopped';
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
    sealin: s.hasSealIn,
    stop: s.hasStop,
    latch: s.latchProven,
    stopproof: s.stopProven,
  };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'build', label: 'Rung constructed', max: 35, earned: (s.hasSealIn ? 20 : 0) + (s.hasStop ? 15 : 0), reason: s.hasSealIn && s.hasStop ? 'Seal-in and stop interlock present' : 'Rung incomplete' },
    { id: 'latch', label: 'Latch verified', max: 30, earned: s.latchProven ? 30 : 0, reason: s.latchProven ? 'Motor held after momentary Start' : 'Motor did not latch' },
    { id: 'stop', label: 'Stop verified', max: 25, earned: s.stopProven ? 25 : 0, reason: s.stopProven ? 'Stop dropped the motor out' : 'Stop not demonstrated' },
    { id: 'process', label: 'Process discipline', max: 10, earned: s.hasSealIn && s.hasStop && s.latchProven && s.stopProven ? 10 : 0, reason: 'Build, latch and stop all demonstrated' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.latchProven && s.stopProven, safetyHold: s.ranWithoutStart, criteria };
}

function RungScene({ s }: { s: S }) {
  const on = (v: boolean) => (v ? 'var(--ok)' : 'var(--scene-dim)');
  return (
    <svg className="plc-scene" viewBox="0 0 480 190" role="img" aria-label={`Ladder rung. Seal-in ${s.hasSealIn ? 'present' : 'absent'}, stop ${s.hasStop ? 'present' : 'absent'}, motor ${s.motor ? 'on' : 'off'}.`}>
      <line x1="24" y1="20" x2="24" y2="170" stroke="var(--scene-line)" strokeWidth="2.5" />
      <line x1="456" y1="20" x2="456" y2="170" stroke="var(--scene-line)" strokeWidth="2.5" />
      {/* main line: Start -NO- ... -Stop NC- (coil) */}
      <line x1="24" y1="60" x2="90" y2="60" stroke={on(s.motor)} strokeWidth="2.6" />
      <line x1="90" y1="48" x2="90" y2="72" stroke={on(s.motor)} strokeWidth="2.6" />
      <line x1="110" y1="48" x2="110" y2="72" stroke={on(s.motor)} strokeWidth="2.6" />
      <text x="100" y="40" textAnchor="middle" className="scene-label">START</text>
      <line x1="110" y1="60" x2="300" y2="60" stroke={on(s.motor)} strokeWidth="2.6" />
      {/* stop NC contact */}
      <line x1="300" y1="48" x2="300" y2="72" stroke={s.hasStop ? on(s.motor) : 'var(--crit)'} strokeWidth="2.6" />
      <line x1="320" y1="48" x2="320" y2="72" stroke={s.hasStop ? on(s.motor) : 'var(--crit)'} strokeWidth="2.6" />
      <line x1="300" y1="48" x2="320" y2="72" stroke={s.hasStop ? on(s.motor) : 'var(--crit)'} strokeWidth="2" />
      <text x="310" y="40" textAnchor="middle" className="scene-label">{s.hasStop ? 'STOP (NC)' : 'no stop'}</text>
      <line x1="320" y1="60" x2="410" y2="60" stroke={on(s.motor)} strokeWidth="2.6" />
      {/* coil */}
      <path d="M410 52 a9 9 0 0 1 0 16" fill="none" stroke={on(s.motor)} strokeWidth="2.8" />
      <path d="M422 52 a9 9 0 0 0 0 16" fill="none" stroke={on(s.motor)} strokeWidth="2.8" />
      <text x="416" y="40" textAnchor="middle" className="scene-label" fill={on(s.motor)}>MOTOR</text>
      {/* seal-in branch */}
      {s.hasSealIn && (
        <>
          <line x1="60" y1="60" x2="60" y2="120" stroke={on(s.motor)} strokeWidth="2.6" />
          <line x1="60" y1="120" x2="90" y2="120" stroke={on(s.motor)} strokeWidth="2.6" />
          <line x1="90" y1="108" x2="90" y2="132" stroke={on(s.motor)} strokeWidth="2.6" />
          <line x1="110" y1="108" x2="110" y2="132" stroke={on(s.motor)} strokeWidth="2.6" />
          <line x1="110" y1="120" x2="250" y2="120" stroke={on(s.motor)} strokeWidth="2.6" />
          <line x1="250" y1="60" x2="250" y2="120" stroke={on(s.motor)} strokeWidth="2.6" />
          <text x="100" y="150" textAnchor="middle" className="scene-label" fill={on(s.motor)}>MOTOR (seal-in)</text>
        </>
      )}
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
          <span>Ladder rung · motor latch</span>
          <span className={`status-pill ${s.motor ? 'is-ok' : 'is-idle'}`}>{s.motor ? '● Motor latched' : '● Motor off'}</span>
        </div>
        <RungScene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Build the rung</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'toggleSealIn' })} disabled={locked}>{s.hasSealIn ? '✓ Seal-in contact' : 'Add seal-in contact'}</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'toggleStop' })} disabled={locked}>{s.hasStop ? '✓ Stop interlock' : 'Add stop interlock'}</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Test the logic</span>
          <div className="control-row">
            <button className="btn primary" onClick={() => dispatch({ t: 'tapStart' })} disabled={locked}>Tap Start (momentary)</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'pressStop' })} disabled={locked}>Press Stop</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const motorSealin: ExerciseDefinition<S, A> = {
  id: 'plc-motor-sealin',
  trade: 'plc',
  rank: 2,
  version: '1.0.0',
  title: 'Motor seal-in & stop interlock',
  estMinutes: 20,
  summary: 'Build a latching start/stop rung with a seal-in contact and a stop permissive, then prove it.',
  scenario:
    'WO-005 — A motor must latch on from a momentary Start push-button and drop out on Stop. ' +
    'Build the control rung: add a seal-in (holding) contact so the motor stays energised after Start is ' +
    'released, and a normally-closed Stop interlock. Then tap Start and press Stop to prove the latch.',
  objectives: [
    { id: 'sealin', label: 'Add a seal-in (holding) contact' },
    { id: 'stop', label: 'Add a stop (NC) interlock' },
    { id: 'latch', label: 'Prove the motor latches after a momentary Start' },
    { id: 'stopproof', label: 'Prove Stop drops the motor out' },
  ],
  hints: [
    'A momentary Start only pulses — without a seal-in branch the motor drops the instant you release it.',
    'The seal-in contact lets the motor output hold itself in once started.',
    'A stop interlock is normally-closed, in series, so pressing it breaks the rung.',
    'Add both elements, tap Start (watch it hold), then press Stop.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
