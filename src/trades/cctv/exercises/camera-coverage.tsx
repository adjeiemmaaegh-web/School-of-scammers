/**
 * CCTV · Rank 1 · "Camera coverage & aiming"
 *
 * Plan-view aiming task. Pan and zoom (field of view) a camera so it fully
 * covers the entrance while keeping a neighbour's window (a privacy zone) out of
 * shot — and without wasting coverage on an over-wide field of view.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

const TARGET_LO = 70;
const TARGET_HI = 110; // doorway spans 70..110 deg
const PRIVACY = 140; // neighbour window
const EFFICIENT_FOV = 60;

interface S {
  pan: number; // 10..170 deg (90 = straight ahead)
  fov: number; // 20..90 deg
  verified: boolean;
  submitted: boolean;
}

type A =
  | { t: 'pan'; d: number }
  | { t: 'fov'; d: number }
  | { t: 'verify' }
  | { t: 'submit' };

function init(): S {
  return { pan: 55, fov: 30, verified: false, submitted: false };
}

const arc = (s: S) => ({ lo: s.pan - s.fov / 2, hi: s.pan + s.fov / 2 });
const coversDoor = (s: S) => { const a = arc(s); return a.lo <= TARGET_LO && a.hi >= TARGET_HI; };
const excludesPrivacy = (s: S) => { const a = arc(s); return PRIVACY < a.lo || PRIVACY > a.hi; };
const efficient = (s: S) => s.fov <= EFFICIENT_FOV;

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'pan':
      s.pan = Math.max(10, Math.min(170, s.pan + a.d));
      detail = `Panned to ${s.pan}°`;
      break;
    case 'fov':
      s.fov = Math.max(20, Math.min(90, s.fov + a.d));
      detail = `Field of view set to ${s.fov}°`;
      break;
    case 'verify':
      if (coversDoor(s) && excludesPrivacy(s)) {
        s.verified = true;
        detail = 'Verified: entrance covered, privacy zone excluded';
      } else {
        accepted = false;
        detail = !coversDoor(s) ? 'Entrance not fully covered' : 'Privacy zone is in shot';
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
  return { cover: coversDoor(s), privacy: excludesPrivacy(s), efficient: efficient(s), verify: s.verified };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'cover', label: 'Entrance covered', max: 35, earned: coversDoor(s) ? 35 : 0, reason: coversDoor(s) ? 'Entrance fully within the field of view' : 'Entrance not fully covered' },
    { id: 'privacy', label: 'Privacy zone excluded', max: 30, earned: excludesPrivacy(s) ? 30 : 0, reason: excludesPrivacy(s) ? "Neighbour's window out of shot" : 'Privacy zone is in shot' },
    { id: 'framing', label: 'Efficient framing', max: 15, earned: efficient(s) ? 15 : 0, reason: efficient(s) ? 'Field of view kept tight' : 'Field of view wider than needed' },
    { id: 'process', label: 'Verification', max: 20, earned: s.verified ? 20 : 0, reason: s.verified ? 'Aim verified' : 'Not verified' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.verified, safetyHold: false, criteria };
}

function pt(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

function Scene({ s }: { s: S }) {
  const cx = 240, cy = 180, R = 150;
  const a = arc(s);
  const steps = 16;
  const poly = [[cx, cy]];
  for (let i = 0; i <= steps; i++) poly.push(pt(cx, cy, R, a.lo + ((a.hi - a.lo) * i) / steps));
  const [dlo1x, dlo1y] = pt(cx, cy, R, TARGET_LO);
  const [dhi1x, dhi1y] = pt(cx, cy, R, TARGET_HI);
  const [px, py] = pt(cx, cy, R, PRIVACY);
  const ok = coversDoor(s) && excludesPrivacy(s);
  return (
    <svg className="plc-scene" viewBox="0 0 480 210" role="img" aria-label={`Plan view. Camera pan ${s.pan}°, field of view ${s.fov}°.`}>
      {/* coverage sector */}
      <polygon points={poly.map((p) => p.join(',')).join(' ')} fill={ok ? 'color-mix(in srgb, var(--ok) 22%, transparent)' : 'color-mix(in srgb, var(--accent) 20%, transparent)'} stroke={ok ? 'var(--ok)' : 'var(--accent)'} strokeWidth="1.5" />
      {/* doorway target */}
      <line x1={dlo1x} y1={dlo1y} x2={dhi1x} y2={dhi1y} stroke="var(--ok)" strokeWidth="6" strokeLinecap="round" />
      <text x={(dlo1x + dhi1x) / 2} y={Math.min(dlo1y, dhi1y) - 8} textAnchor="middle" className="scene-label" fill="var(--ok)">ENTRANCE</text>
      {/* privacy zone */}
      <circle cx={px} cy={py} r="9" fill="none" stroke="var(--crit)" strokeWidth="2.4" />
      <line x1={px - 6} y1={py - 6} x2={px + 6} y2={py + 6} stroke="var(--crit)" strokeWidth="2.4" />
      <text x={px} y={py - 14} textAnchor="middle" className="scene-label" fill="var(--crit)">PRIVACY</text>
      {/* camera */}
      <circle cx={cx} cy={cy} r="9" fill="var(--scene-motor)" stroke="var(--scene-line)" strokeWidth="2" />
      <text x={cx} y={cy + 24} textAnchor="middle" className="scene-label">CAMERA · {s.pan}° / {s.fov}° FOV</text>
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
          <span>Site plan · camera aim</span>
          <span className={`status-pill ${coversDoor(s) && excludesPrivacy(s) ? 'is-ok' : 'is-idle'}`}>pan {s.pan}° · fov {s.fov}°</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Pan</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'pan', d: -10 })} disabled={locked}>◄ Pan left</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'pan', d: 10 })} disabled={locked}>Pan right ►</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Field of view (zoom)</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'fov', d: -10 })} disabled={locked}>Zoom in (tighter)</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'fov', d: 10 })} disabled={locked}>Zoom out (wider)</button>
            <button className="btn primary" onClick={() => dispatch({ t: 'verify' })} disabled={locked}>Verify aim</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const cameraCoverage: ExerciseDefinition<S, A> = {
  id: 'cctv-camera-coverage',
  trade: 'cctv',
  rank: 1,
  version: '1.0.0',
  title: 'Camera coverage & aiming',
  estMinutes: 20,
  summary: 'Aim and zoom a camera to cover the entrance while keeping a privacy zone out of shot.',
  scenario:
    'JOB-101 — A fixed camera overlooks a shop entrance. Pan and set the field of view so the whole entrance ' +
    'is covered, the neighbouring window (a privacy zone) stays out of shot, and the field of view is no wider ' +
    'than it needs to be. Verify the aim.',
  objectives: [
    { id: 'cover', label: 'Fully cover the entrance' },
    { id: 'privacy', label: 'Keep the privacy zone out of shot' },
    { id: 'efficient', label: 'Keep the field of view tight' },
    { id: 'verify', label: 'Verify the aim' },
  ],
  hints: [
    'The entrance sits roughly straight ahead; pan until the whole doorway is inside the shaded view.',
    'The privacy marker (upper-left) must stay outside the view — do not pan or zoom so wide that it creeps in.',
    'A tighter field of view gives more detail; only widen as much as the entrance needs.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
