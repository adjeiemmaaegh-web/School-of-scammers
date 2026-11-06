/**
 * PLC · Rank 8 · "Tank level & pump permissive"
 *
 * Control a fill pump from level inputs with a documented permissive and a
 * high-level trip. Without the trip configured, continuing to fill overfills the
 * tank — a protection failure that holds the result.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

const HIGH = 80; // high-level setpoint (%)

interface S {
  tripConfigured: boolean;
  pump: boolean;
  level: number; // %
  highTripFired: boolean;
  overfilled: boolean;
  verified: boolean;
  submitted: boolean;
}

type A =
  | { t: 'toggleTrip' }
  | { t: 'startPump' }
  | { t: 'stopPump' }
  | { t: 'fill' }
  | { t: 'drain' }
  | { t: 'verify' }
  | { t: 'submit' };

function init(): S {
  return { tripConfigured: false, pump: false, level: 20, highTripFired: false, overfilled: false, verified: false, submitted: false };
}

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'toggleTrip':
      s.tripConfigured = !s.tripConfigured;
      detail = `High-level trip ${s.tripConfigured ? 'added to the pump permissive' : 'removed'}`;
      break;
    case 'startPump':
      if (s.level >= HIGH && s.tripConfigured) {
        accepted = false;
        detail = 'Pump permissive inhibited — level is at/above high setpoint';
      } else {
        s.pump = true;
        detail = 'Pump started';
      }
      break;
    case 'stopPump':
      s.pump = false;
      detail = 'Pump stopped';
      break;
    case 'fill':
      if (!s.pump) {
        accepted = false;
        detail = 'Start the pump to fill';
      } else {
        s.level = Math.min(100, s.level + 20);
        detail = `Filling — level ${s.level}%`;
        if (s.level >= HIGH) {
          if (s.tripConfigured) {
            s.pump = false;
            s.highTripFired = true;
            detail = `High-level trip at ${s.level}% — pump stopped by permissive`;
          } else if (s.level >= 100) {
            s.overfilled = true;
            detail = 'OVERFILL: level reached 100% with no high-level trip configured';
          }
        }
      }
      break;
    case 'drain':
      s.level = Math.max(0, s.level - 20);
      detail = `Drained — level ${s.level}%`;
      break;
    case 'verify':
      if (s.tripConfigured && s.highTripFired && !s.overfilled) {
        s.verified = true;
        detail = 'Verified: high-level trip protects the tank';
      } else {
        accepted = false;
        detail = 'Verification needs the high-level trip to stop the pump during a fill';
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
    trip: s.tripConfigured,
    run: s.highTripFired || s.pump || s.level > 20,
    protect: s.highTripFired && !s.overfilled,
    verify: s.verified,
  };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'trip', label: 'High-level trip configured', max: 25, earned: s.tripConfigured ? 25 : 0, reason: s.tripConfigured ? 'Trip added to the pump permissive' : 'No high-level trip' },
    { id: 'control', label: 'Pump control', max: 20, earned: s.highTripFired || s.level > 20 ? 20 : 0, reason: 'Pump operated and filled the tank' },
    { id: 'protect', label: 'High-level protection', max: 35, earned: s.highTripFired && !s.overfilled ? 35 : 0, reason: s.overfilled ? 'Tank overfilled — protection failed' : s.highTripFired ? 'Trip stopped the pump at the setpoint' : 'Protection not demonstrated' },
    { id: 'process', label: 'Verification', max: 20, earned: s.verified ? 20 : 0, reason: s.verified ? 'Protection verified' : 'Not verified' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.verified && !s.overfilled, safetyHold: s.overfilled, criteria };
}

function Scene({ s }: { s: S }) {
  const fillH = 120 * (s.level / 100);
  const high = s.level >= HIGH;
  return (
    <svg className="plc-scene" viewBox="0 0 480 200" role="img" aria-label={`Tank at ${s.level}%, pump ${s.pump ? 'running' : 'off'}.`}>
      {/* tank */}
      <rect x="150" y="30" width="140" height="140" rx="8" fill="var(--scene-bg)" stroke="var(--scene-line)" strokeWidth="2" />
      <rect x="152" y={32 + (136 - fillH)} width="136" height={fillH} rx="4" fill={s.overfilled ? 'var(--crit)' : 'var(--ok)'} opacity="0.5" />
      {/* high mark */}
      <line x1="150" y1={30 + 140 * (1 - HIGH / 100)} x2="290" y2={30 + 140 * (1 - HIGH / 100)} stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="5 3" />
      <text x="296" y={34 + 140 * (1 - HIGH / 100)} className="scene-label" fill="var(--accent)">HIGH {HIGH}%</text>
      <text x="220" y="110" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="26" fill="var(--ink)">{s.level}%</text>
      {/* pump */}
      <circle cx="80" cy="150" r="22" fill="var(--scene-motor)" stroke={s.pump ? 'var(--ok)' : 'var(--scene-line)'} strokeWidth={s.pump ? 2.4 : 1.6} />
      <text x="80" y="186" textAnchor="middle" className="scene-label">{s.pump ? 'PUMP ON' : 'PUMP OFF'}</text>
      <path d="M102 150 H150" stroke={s.pump ? 'var(--ok)' : 'var(--scene-dim)'} strokeWidth="3" />
      <text x="220" y="190" textAnchor="middle" className="scene-label" fill={high ? 'var(--accent)' : 'var(--muted)'}>{s.highTripFired ? 'HIGH-LEVEL TRIP ACTIVE' : s.tripConfigured ? 'trip permissive armed' : 'no high-level trip'}</text>
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
          <span>Tank fill · pump permissive</span>
          <span className={`status-pill ${s.overfilled ? 'is-crit' : s.verified ? 'is-ok' : 'is-idle'}`}>{s.level}%</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Permissive</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'toggleTrip' })} disabled={locked}>{s.tripConfigured ? '✓ High-level trip' : 'Add high-level trip'}</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Operate</span>
          <div className="control-row">
            <button className="btn primary" onClick={() => dispatch({ t: 'startPump' })} disabled={locked}>Start pump</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'fill' })} disabled={locked}>Fill step</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'stopPump' })} disabled={locked}>Stop pump</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'drain' })} disabled={locked}>Drain</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'verify' })} disabled={locked}>Verify protection</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const tankLevel: ExerciseDefinition<S, A> = {
  id: 'plc-tank-level',
  trade: 'plc',
  rank: 8,
  version: '1.0.0',
  title: 'Tank level & pump permissive',
  estMinutes: 45,
  summary: 'Control a fill pump from level inputs with a high-level trip, and prove the tank cannot overfill.',
  scenario:
    'WO-068 — A tank is filled by a pump. Build the pump permissive so the pump can run to fill the tank but a ' +
    'high-level trip stops it at the setpoint — the tank must never overfill. Configure the trip, operate the ' +
    'pump through a fill, and verify the protection.',
  objectives: [
    { id: 'trip', label: 'Add the high-level trip to the permissive' },
    { id: 'run', label: 'Run the pump and fill the tank' },
    { id: 'protect', label: 'High-level trip stops the pump (no overfill)' },
    { id: 'verify', label: 'Verify the protection' },
  ],
  hints: [
    'The pump permissive should include a high-level trip so the pump stops at the setpoint.',
    'Add the trip first, then start the pump and fill — watch it stop at the high mark.',
    'Filling with no trip configured will overfill the tank and fail the protection criterion.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
