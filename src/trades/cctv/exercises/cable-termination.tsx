/**
 * CCTV · Rank 2 · "Camera cable & termination"
 *
 * Choose the right cable for an IP/PoE camera, confirm the run is within the
 * distance limit, terminate it correctly and prove the link.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';
import { CameraArt, Scene as Scene2, SwitchArt } from '../../../ui/device-art';

const DISTANCE_M = 85; // run length
const MAX_M = 100; // Cat cable / PoE limit

type Cable = 'none' | 'cat6' | 'coax';

interface S {
  cable: Cable;
  terminated: boolean;
  tested: boolean;
  linkUp: boolean;
  submitted: boolean;
}

type A =
  | { t: 'select'; cable: Cable }
  | { t: 'terminate' }
  | { t: 'test' }
  | { t: 'submit' };

function init(): S {
  return { cable: 'none', terminated: false, tested: false, linkUp: false, submitted: false };
}

const linkOk = (s: S) => s.cable === 'cat6' && s.terminated && DISTANCE_M <= MAX_M;

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'select':
      s.cable = a.cable;
      s.terminated = false;
      s.tested = false;
      s.linkUp = false;
      detail = a.cable === 'coax' ? 'Selected coax — note this IP/PoE camera needs twisted-pair' : a.cable === 'cat6' ? 'Selected Cat6 twisted-pair' : 'Cable cleared';
      break;
    case 'terminate':
      if (s.cable === 'none') {
        accepted = false;
        detail = 'Select a cable first';
      } else {
        s.terminated = true;
        detail = `Terminated both ends (T568B) on ${s.cable}`;
      }
      break;
    case 'test':
      s.tested = true;
      s.linkUp = linkOk(s);
      detail = s.linkUp ? 'Link test: 100 Mbps link up, PoE negotiated' : s.cable === 'coax' ? 'Link test: no Ethernet link (coax carries no IP/PoE)' : 'Link test: no link — check cable and termination';
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
    cable: s.cable === 'cat6',
    distance: DISTANCE_M <= MAX_M && s.cable === 'cat6',
    terminate: s.terminated,
    link: s.tested && s.linkUp,
  };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'cable', label: 'Correct cable type', max: 30, earned: s.cable === 'cat6' ? 30 : 0, reason: s.cable === 'cat6' ? 'Cat6 twisted-pair for IP/PoE' : 'Wrong cable for an IP/PoE camera' },
    { id: 'distance', label: 'Within distance limit', max: 20, earned: s.cable === 'cat6' && DISTANCE_M <= MAX_M ? 20 : 0, reason: `${DISTANCE_M}m run vs ${MAX_M}m limit` },
    { id: 'terminate', label: 'Terminated correctly', max: 25, earned: s.terminated ? 25 : 0, reason: s.terminated ? 'Both ends terminated (T568B)' : 'Not terminated' },
    { id: 'link', label: 'Link proven', max: 25, earned: s.tested && s.linkUp ? 25 : 0, reason: s.tested && s.linkUp ? 'Link up and PoE negotiated' : 'Link not proven' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.linkUp, safetyHold: false, criteria };
}

function Scene({ s }: { s: S }) {
  const col = s.cable === 'cat6' ? 'var(--ok)' : s.cable === 'coax' ? 'var(--crit)' : 'var(--scene-dim)';
  return (
    <Scene2 viewBox="0 0 480 170" label={`Cable run ${DISTANCE_M}m, ${s.cable}, link ${s.linkUp ? 'up' : 'down'}.`}>
      <CameraArt x={26} y={44} scale={0.9} on={s.linkUp} />
      <text x={60} y={118} textAnchor="middle" className="scene-label">CAMERA</text>
      {/* cable */}
      <line x1="100" y1="82" x2="372" y2="82" stroke={col} strokeWidth="4" strokeDasharray={s.terminated ? '0' : '8 6'} />
      <text x="236" y="70" textAnchor="middle" className="scene-label">{s.cable === 'none' ? 'no cable' : s.cable.toUpperCase()} · {DISTANCE_M}m</text>
      <SwitchArt x={360} y={66} scale={0.95} ports={8} lit={s.linkUp ? 1 : 0} />
      <text x={415} y={118} textAnchor="middle" className="scene-label">PoE SWITCH</text>
      <text x="240" y="150" textAnchor="middle" className="scene-label" fill={s.linkUp ? 'var(--ok)' : 'var(--muted)'}>{s.tested ? (s.linkUp ? 'LINK UP · PoE OK' : 'NO LINK') : 'not tested'}</text>
    </Scene2>
  );
}

function Play({ state, dispatch }: ExercisePlayProps<S, A>) {
  const s = state;
  const locked = s.submitted;
  return (
    <div className="exercise-sim">
      <div className="sim-canvas">
        <div className="sim-canvas-bar">
          <span>Cable run · camera to switch</span>
          <span className={`status-pill ${s.linkUp ? 'is-ok' : 'is-idle'}`}>{s.linkUp ? '● Link up' : '● No link'}</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Select cable</span>
          <div className="control-row">
            <button className={`btn ${s.cable === 'cat6' ? 'primary' : 'ghost'}`} onClick={() => dispatch({ t: 'select', cable: 'cat6' })} disabled={locked}>Cat6 (twisted pair)</button>
            <button className={`btn ${s.cable === 'coax' ? 'primary' : 'ghost'}`} onClick={() => dispatch({ t: 'select', cable: 'coax' })} disabled={locked}>Coax (RG59)</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Terminate &amp; test</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'terminate' })} disabled={locked}>Terminate both ends (T568B)</button>
            <button className="btn primary" onClick={() => dispatch({ t: 'test' })} disabled={locked}>Test link</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const cableTermination: ExerciseDefinition<S, A> = {
  id: 'cctv-cable-termination',
  trade: 'cctv',
  rank: 2,
  version: '1.0.0',
  title: 'Camera cable & termination',
  estMinutes: 25,
  summary: 'Choose the right cable for an IP/PoE camera, terminate it and prove the link.',
  scenario:
    `JOB-108 — Run and terminate the cable for an IP/PoE camera ${DISTANCE_M}m from the switch. Choose the ` +
    'correct cable for an IP camera, confirm the run is within the distance limit, terminate both ends and ' +
    'test the link.',
  objectives: [
    { id: 'cable', label: 'Choose the correct cable for IP/PoE' },
    { id: 'distance', label: 'Confirm the run is within the distance limit' },
    { id: 'terminate', label: 'Terminate both ends' },
    { id: 'link', label: 'Prove the link' },
  ],
  hints: [
    'An IP/PoE camera carries data and power over twisted pair — coax (RG59) is for analog cameras.',
    `Cat cabling and PoE are rated to ${MAX_M}m; this run is ${DISTANCE_M}m.`,
    'Terminate both ends to the same standard (T568B), then test the link.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
