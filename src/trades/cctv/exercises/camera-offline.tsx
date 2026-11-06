/**
 * CCTV · Rank 5 · "Camera offline diagnosis"
 *
 * A camera is offline on the NVR. Take readings (PoE, link, ping, NVR channel)
 * and identify the single fault. Seeded, so assigned variants differ.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

type Fault = 'poe' | 'cable' | 'ip' | 'nvr';
const FAULTS: Fault[] = ['poe', 'cable', 'ip', 'nvr'];
const LABEL: Record<Fault, string> = { poe: 'PoE power', cable: 'cable / link', ip: 'IP addressing', nvr: 'NVR channel' };

interface S {
  fault: Fault;
  inspected: Record<Fault, boolean>;
  diagnosed: boolean;
  wrongGuesses: number;
  submitted: boolean;
}

type A = { t: 'inspect'; item: Fault } | { t: 'diagnose'; item: Fault } | { t: 'submit' };

function init(seed: number): S {
  return {
    fault: FAULTS[Math.abs(Math.floor(seed)) % FAULTS.length],
    inspected: { poe: false, cable: false, ip: false, nvr: false },
    diagnosed: false,
    wrongGuesses: 0,
    submitted: false,
  };
}

function reading(s: S, item: Fault): string {
  switch (item) {
    case 'poe': return s.fault === 'poe' ? 'port not powered (0W)' : 'powered 7.4W';
    case 'cable': return s.fault === 'cable' ? 'no link light' : 'link up, 100 Mbps';
    case 'ip': return s.fault === 'ip' ? 'ping timed out (wrong subnet)' : 'ping reply OK';
    case 'nvr': return s.fault === 'nvr' ? 'no channel configured' : 'channel present';
  }
}

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev, inspected: { ...prev.inspected } };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'inspect':
      s.inspected[a.item] = true;
      detail = `Checked ${LABEL[a.item]}: ${reading(s, a.item)}`;
      break;
    case 'diagnose':
      if (s.diagnosed) { accepted = false; detail = 'Fault already identified'; }
      else if (a.item === s.fault) { s.diagnosed = true; detail = `Correct: the fault is ${LABEL[a.item]}`; }
      else { s.wrongGuesses++; accepted = false; detail = `Incorrect: ${LABEL[a.item]} is healthy`; }
      break;
    case 'submit':
      s.submitted = true;
      detail = 'Attempt submitted';
      break;
  }
  return { next: s, event: { action: a.t, detail, accepted } };
}

function objectiveStatus(s: S): Record<string, boolean> {
  const inspectedCount = Object.values(s.inspected).filter(Boolean).length;
  return { inspect: inspectedCount >= 3, identify: s.diagnosed, clean: s.diagnosed && s.wrongGuesses === 0 };
}

function evaluate(s: S): RubricResult {
  const inspectedCount = Object.values(s.inspected).filter(Boolean).length;
  const criteria = [
    { id: 'diagnostics', label: 'Evidence gathered', max: 30, earned: Math.min(30, inspectedCount * 10), reason: `${inspectedCount} readings taken` },
    { id: 'identify', label: 'Correct identification', max: 45, earned: s.diagnosed ? 45 : 0, reason: s.diagnosed ? `Identified: ${LABEL[s.fault]}` : 'Fault not identified' },
    { id: 'discipline', label: 'No guessing', max: 25, earned: s.wrongGuesses === 0 ? 25 : Math.max(0, 25 - s.wrongGuesses * 15), reason: s.wrongGuesses === 0 ? 'Diagnosed from evidence' : `${s.wrongGuesses} wrong call(s)` },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.diagnosed, safetyHold: false, criteria };
}

function Scene({ s }: { s: S }) {
  const items: Fault[] = ['poe', 'cable', 'ip', 'nvr'];
  return (
    <svg className="plc-scene" viewBox="0 0 480 180" role="img" aria-label="Camera offline diagnosis readings.">
      <text x="240" y="30" textAnchor="middle" className="scene-label">CAMERA OFFLINE ON NVR — find the fault</text>
      {items.map((it, i) => {
        const x = 30 + i * 112;
        const shown = s.inspected[it];
        const bad = shown && s.fault === it;
        return (
          <g key={it}>
            <rect x={x} y="56" width="100" height="56" rx="8" fill={bad ? 'var(--crit)' : 'var(--scene-motor)'} stroke="var(--scene-line)" />
            <text x={x + 50} y="78" textAnchor="middle" className="scene-label">{LABEL[it].toUpperCase()}</text>
            <text x={x + 50} y="96" textAnchor="middle" className="scene-label">{shown ? reading(s, it) : '?'}</text>
          </g>
        );
      })}
      <text x="240" y="150" textAnchor="middle" className="scene-label" fill={s.diagnosed ? 'var(--ok)' : 'var(--muted)'}>{s.diagnosed ? 'FAULT IDENTIFIED' : 'take readings, then identify'}</text>
    </svg>
  );
}

function Play({ state, dispatch }: ExercisePlayProps<S, A>) {
  const s = state;
  const items: Fault[] = ['poe', 'cable', 'ip', 'nvr'];
  return (
    <div className="exercise-sim">
      <div className="sim-canvas">
        <div className="sim-canvas-bar">
          <span>Camera offline · diagnosis</span>
          <span className={`status-pill ${s.diagnosed ? 'is-ok' : 'is-crit'}`}>{s.diagnosed ? '● Solved' : '● Offline'}</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Take readings</span>
          <div className="control-row">
            {items.map((it) => (
              <button key={it} className="btn ghost small" onClick={() => dispatch({ t: 'inspect', item: it })} disabled={s.submitted}>Check {LABEL[it]}</button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Identify the fault</span>
          <div className="control-row">
            {items.map((it) => (
              <button key={it} className="btn primary small" onClick={() => dispatch({ t: 'diagnose', item: it })} disabled={s.submitted || s.diagnosed}>It's the {LABEL[it]}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const cameraOffline: ExerciseDefinition<S, A> = {
  id: 'cctv-camera-offline',
  trade: 'cctv',
  rank: 5,
  version: '1.0.0',
  title: 'Camera offline diagnosis',
  estMinutes: 35,
  summary: 'A camera is offline on the NVR. Take readings and identify the single fault.',
  scenario:
    'JOB-131 — A camera is offline on the NVR. Work through the readings — PoE power at the port, the cable ' +
    'link, the camera IP/ping, and the NVR channel — and identify the single fault. Wrong calls count against you.',
  objectives: [
    { id: 'inspect', label: 'Take readings across the path' },
    { id: 'identify', label: 'Identify the fault' },
    { id: 'clean', label: 'Diagnose without a wrong call' },
  ],
  hints: [
    'Follow the signal path: power (PoE) → link (cable) → reachability (IP/ping) → NVR channel.',
    'Each reading rules a layer in or out.',
    'Only call the fault once a reading proves it.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
