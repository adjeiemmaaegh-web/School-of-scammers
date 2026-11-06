/**
 * PLC · Rank 3 · "24V sensor to PLC input"
 *
 * A wire-and-measure exercise with its own self-contained deterministic reducer
 * (no engine state machine). Demonstrates the exercise contract generalizing to
 * a different task archetype: safe isolation, correct termination, and
 * measurement — rather than operate-and-repair.
 *
 * A 3-wire PNP sensor (brown +24V, blue 0V, black signal) must be wired to
 * input I0.0. The learner isolates the supply, terminates all three cores,
 * re-energizes, presents a target, and measures the input to confirm the signal.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

type Wire = 'brown' | 'blue' | 'black';

interface S {
  energized: boolean;
  wired: Record<Wire, boolean>;
  /** unsafe terminations attempted while energized */
  unsafeWiring: number;
  targetPresent: boolean;
  measuredInput: boolean; // last measurement captured
  measuredOnce: boolean;
  verified: boolean;
  submitted: boolean;
}

type A =
  | { t: 'isolate' }
  | { t: 'energize' }
  | { t: 'wire'; wire: Wire }
  | { t: 'target'; present: boolean }
  | { t: 'measure' }
  | { t: 'verify' }
  | { t: 'submit' };

const WIRE_LABEL: Record<Wire, string> = {
  brown: 'Brown → +24V',
  blue: 'Blue → 0V',
  black: 'Black (signal) → I0.0',
};

function init(): S {
  return {
    energized: true, // starts live — learner must isolate first
    wired: { brown: false, blue: false, black: false },
    unsafeWiring: 0,
    targetPresent: false,
    measuredInput: false,
    measuredOnce: false,
    verified: false,
    submitted: false,
  };
}

/** Input is TRUE only when fully & correctly wired, energized, and a target is present. */
function inputLive(s: S): boolean {
  return s.energized && s.wired.brown && s.wired.blue && s.wired.black && s.targetPresent;
}

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev, wired: { ...prev.wired } };
  let accepted = true;
  let detail = '';

  switch (a.t) {
    case 'isolate':
      s.energized = false;
      detail = 'Supply isolated — safe to terminate conductors';
      break;
    case 'energize':
      s.energized = true;
      detail = 'Supply re-energized';
      break;
    case 'wire':
      if (s.energized) {
        accepted = false;
        s.unsafeWiring++;
        detail = `Rejected: isolate the supply before terminating ${a.wire}`;
      } else {
        s.wired[a.wire] = true;
        detail = `${WIRE_LABEL[a.wire]} terminated`;
      }
      break;
    case 'target':
      s.targetPresent = a.present;
      detail = a.present ? 'Target presented to sensor face' : 'Target removed';
      break;
    case 'measure':
      s.measuredInput = inputLive(s);
      s.measuredOnce = true;
      detail = `Measured I0.0 = ${s.measuredInput ? '24V (TRUE)' : '0V (FALSE)'}`;
      break;
    case 'verify':
      if (inputLive(s) && s.measuredOnce) {
        s.verified = true;
        detail = 'Verified: input follows the target with all cores terminated';
      } else {
        accepted = false;
        detail = 'Verification needs all cores wired, supply on, target present and a measurement';
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
  const allWired = s.wired.brown && s.wired.blue && s.wired.black;
  return {
    isolate: s.unsafeWiring === 0 && allWired, // wired safely (never while live)
    terminate: allWired,
    energize: allWired && s.energized,
    measure: s.measuredOnce && s.measuredInput,
    verify: s.verified,
  };
}

function evaluate(s: S): RubricResult {
  const allWired = s.wired.brown && s.wired.blue && s.wired.black;
  const criteria = [
    { id: 'wiring', label: 'Correct termination', max: 35, earned: allWired ? 35 : Object.values(s.wired).filter(Boolean).length * 10, reason: allWired ? 'All three cores terminated correctly' : 'Not all cores terminated' },
    { id: 'safety', label: 'Safe isolation', max: 20, earned: s.unsafeWiring === 0 ? 20 : 0, reason: s.unsafeWiring === 0 ? 'Isolated before terminating' : `${s.unsafeWiring} termination(s) attempted live` },
    { id: 'measure', label: 'Measurement', max: 15, earned: s.measuredOnce && s.measuredInput ? 15 : 0, reason: s.measuredOnce ? (s.measuredInput ? 'Confirmed 24V at active input' : 'Measured, but input not proven high') : 'Input not measured' },
    { id: 'verify', label: 'Functional verification', max: 20, earned: s.verified ? 20 : 0, reason: s.verified ? 'Input follows target' : 'Not verified' },
    { id: 'process', label: 'Process discipline', max: 10, earned: allWired && s.energized && s.verified ? 10 : 0, reason: 'Isolate → terminate → energize → measure → verify' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.unsafeWiring === 0 && s.verified, safetyHold: s.unsafeWiring > 0, criteria };
}

function TerminalScene({ s }: { s: S }) {
  const live = inputLive(s);
  const core = (on: boolean) => (on ? 'var(--ok)' : 'var(--scene-dim)');
  return (
    <svg className="plc-scene" viewBox="0 0 480 240" role="img" aria-label={`Sensor wiring. Supply ${s.energized ? 'live' : 'isolated'}. Input ${live ? 'TRUE' : 'FALSE'}.`}>
      <ellipse cx="240" cy="214" rx="200" ry="14" fill="var(--scene-shadow)" />
      {/* supply rail */}
      <rect x="40" y="40" width="120" height="54" rx="8" fill="var(--scene-motor)" stroke="var(--scene-line)" />
      <text x="100" y="62" textAnchor="middle" className="scene-label">24V SUPPLY</text>
      <circle cx="72" cy="80" r="5" fill={s.energized ? 'var(--ok)' : 'var(--scene-dim)'} />
      <text x="100" y="84" textAnchor="middle" className="scene-label">{s.energized ? 'LIVE' : 'ISOLATED'}</text>
      {/* PLC input card */}
      <rect x="320" y="40" width="120" height="54" rx="8" fill="var(--scene-motor)" stroke="var(--scene-line)" />
      <text x="380" y="62" textAnchor="middle" className="scene-label">PLC INPUT I0.0</text>
      <circle cx="408" cy="80" r="5" fill={live ? 'var(--ok)' : 'var(--scene-dim)'} />
      {/* sensor */}
      <rect x="196" y="150" width="88" height="46" rx="8" fill={live ? 'var(--scene-motor)' : 'var(--scene-motor)'} stroke="var(--scene-line)" />
      <text x="240" y="176" textAnchor="middle" className="scene-label">3-WIRE SENSOR</text>
      {/* target */}
      {s.targetPresent && <rect x="250" y="120" width="26" height="22" rx="3" fill="var(--scene-parcel)" stroke="var(--scene-line)" />}
      {/* cores */}
      <path d="M160 67 H240 V150" fill="none" stroke={core(s.wired.brown)} strokeWidth="3" />
      <text x="188" y="60" className="scene-label" fill={core(s.wired.brown)}>brown +24V</text>
      <path d="M100 94 V196 H196" fill="none" stroke={core(s.wired.blue)} strokeWidth="3" />
      <text x="120" y="212" className="scene-label" fill={core(s.wired.blue)}>blue 0V</text>
      <path d="M284 173 H360 V94" fill="none" stroke={core(s.wired.black)} strokeWidth="3" />
      <text x="300" y="150" className="scene-label" fill={core(s.wired.black)}>black signal</text>
    </svg>
  );
}

function SensorPlay({ state, mode, dispatch }: ExercisePlayProps<S, A>) {
  const s = state;
  const locked = s.submitted;
  const allWired = s.wired.brown && s.wired.blue && s.wired.black;
  return (
    <div className="exercise-sim">
      <div className="sim-canvas">
        <div className="sim-canvas-bar">
          <span>Field wiring · sensor to I0.0</span>
          <span className={`status-pill ${s.energized ? 'is-crit' : 'is-idle'}`}>{s.energized ? '● Supply live' : '● Isolated'}</span>
        </div>
        <TerminalScene s={s} />
      </div>

      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Supply</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'isolate' })} disabled={locked || !s.energized}>Isolate supply</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'energize' })} disabled={locked || s.energized}>Re-energize</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Terminate cores (isolate first)</span>
          <div className="control-row">
            {(['brown', 'blue', 'black'] as Wire[]).map((w) => (
              <button key={w} className="btn ghost" onClick={() => dispatch({ t: 'wire', wire: w })} disabled={locked || s.wired[w]}>
                {s.wired[w] ? `✓ ${WIRE_LABEL[w]}` : WIRE_LABEL[w]}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Test &amp; verify</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'target', present: !s.targetPresent })} disabled={locked}>{s.targetPresent ? 'Remove target' : 'Present target'}</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'measure' })} disabled={locked}>Measure I0.0</button>
            <button className="btn primary" onClick={() => dispatch({ t: 'verify' })} disabled={locked}>Verify</button>
          </div>
        </div>
      </div>

      {s.measuredOnce && (
        <div className="sim-instrument">
          <div className="instrument-head"><span>Multimeter · I0.0</span><small>Last reading</small></div>
          <div className="io-grid">
            <div className="io-cell"><code>Input I0.0</code><strong className={s.measuredInput ? 'is-true' : 'is-false'}>{s.measuredInput ? '24V · TRUE' : '0V · FALSE'}</strong></div>
            <div className="io-cell"><code>Cores wired</code><strong className={allWired ? 'is-true' : 'is-false'}>{Object.values(s.wired).filter(Boolean).length}/3</strong></div>
          </div>
          {mode === 'learning' && !s.measuredInput && (
            <p className="instrument-hint">For a PNP sensor the input only reads 24V when all three cores are terminated, the supply is on, and a target is in front of the sensor.</p>
          )}
        </div>
      )}
    </div>
  );
}

export const sensorWiring: ExerciseDefinition<S, A> = {
  id: 'plc-sensor-wiring',
  trade: 'plc',
  rank: 3,
  version: '1.0.0',
  title: '24V sensor to PLC input',
  estMinutes: 25,
  summary: 'Safely wire a 3-wire 24V sensor to a PLC input and confirm the signal with a meter.',
  scenario:
    'WO-014 — A new 3-wire PNP proximity sensor must be connected to PLC input I0.0. ' +
    'Isolate the control supply, terminate the brown (+24V), blue (0V) and black (signal) cores, ' +
    're-energize, present a target and measure the input to confirm it switches.',
  objectives: [
    { id: 'isolate', label: 'Terminate cores only with the supply isolated' },
    { id: 'terminate', label: 'Terminate all three cores correctly' },
    { id: 'energize', label: 'Re-energize the supply' },
    { id: 'measure', label: 'Measure the input high with a target present' },
    { id: 'verify', label: 'Verify the input follows the target' },
  ],
  hints: [
    'Never terminate conductors on a live supply — isolate first.',
    'Brown is +24V, blue is 0V, black is the switched signal to the input.',
    'After wiring, re-energize, present a target, then measure I0.0.',
    'Run Verify once the input reads 24V with the target present.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play: SensorPlay,
};
