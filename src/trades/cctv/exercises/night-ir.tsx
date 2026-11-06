/**
 * CCTV · Rank 6 · "Night & IR exposure"
 *
 * Configure IR illumination and exposure for a dark scene: enough light to see,
 * without washing out a near subject (too much IR) or motion blur (exposure too
 * slow).
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';
import { CameraArt, Scene as Scene2 } from '../../../ui/device-art';

type Exposure = 'fast' | 'medium' | 'slow';

interface S {
  ir: number; // 0..100
  exposure: Exposure;
  verified: boolean;
  submitted: boolean;
}

type A = { t: 'ir'; d: number } | { t: 'exposure'; e: Exposure } | { t: 'verify' } | { t: 'submit' };

function init(): S {
  return { ir: 0, exposure: 'fast', verified: false, submitted: false };
}

const litEnough = (s: S) => s.ir >= 40;
const washout = (s: S) => s.ir > 70;
const blur = (s: S) => s.exposure === 'slow';
const good = (s: S) => litEnough(s) && !washout(s) && !blur(s);

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'ir':
      s.ir = Math.max(0, Math.min(100, s.ir + a.d));
      detail = `IR illuminator at ${s.ir}%` + (washout(s) ? ' — near objects washing out' : '');
      break;
    case 'exposure':
      s.exposure = a.e;
      detail = `Exposure set to ${a.e}` + (blur(s) ? ' — risk of motion blur' : '');
      break;
    case 'verify':
      if (good(s)) { s.verified = true; detail = 'Verified: clear, usable night image'; }
      else { accepted = false; detail = !litEnough(s) ? 'Image too dark' : washout(s) ? 'Near subject washed out by IR' : 'Motion blur from slow exposure'; }
      break;
    case 'submit':
      s.submitted = true;
      detail = 'Attempt submitted';
      break;
  }
  return { next: s, event: { action: a.t, detail, accepted } };
}

function objectiveStatus(s: S): Record<string, boolean> {
  return { lit: litEnough(s), wash: !washout(s) && litEnough(s), blur: !blur(s), verify: s.verified };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'light', label: 'Adequate illumination', max: 30, earned: litEnough(s) ? 30 : 0, reason: litEnough(s) ? 'Scene bright enough to identify' : 'Scene too dark' },
    { id: 'washout', label: 'No IR wash-out', max: 25, earned: !washout(s) ? 25 : 0, reason: washout(s) ? 'Near subject over-exposed by IR' : 'No wash-out' },
    { id: 'blur', label: 'No motion blur', max: 25, earned: !blur(s) ? 25 : 0, reason: blur(s) ? 'Slow exposure blurs moving subjects' : 'Exposure fast enough' },
    { id: 'process', label: 'Verification', max: 20, earned: s.verified ? 20 : 0, reason: s.verified ? 'Image verified' : 'Not verified' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.verified, safetyHold: false, criteria };
}

function Scene({ s }: { s: S }) {
  // monitor preview brightness: 0..1
  const bright = Math.min(1, s.ir / 60);
  const subjectOpacity = washout(s) ? 0.1 : 0.35 + bright * 0.4;
  return (
    <Scene2 viewBox="0 0 480 190" label={`Night camera preview. IR ${s.ir}%, exposure ${s.exposure}.`}>
      <CameraArt x={18} y={18} scale={0.85} on />
      {/* monitor */}
      <rect x="150" y="20" width="300" height="150" rx="8" fill="#05080c" stroke="var(--scene-line)" strokeWidth="2" />
      {/* ambient fill from IR */}
      <rect x="153" y="23" width="294" height="144" rx="6" fill="#9fb4c8" opacity={bright * 0.5} />
      {washout(s) && <rect x="153" y="23" width="294" height="144" rx="6" fill="#fff" opacity="0.4" />}
      {/* subject silhouette */}
      <g opacity={subjectOpacity} className={blur(s) ? 'ir-blur' : ''}>
        <circle cx="300" cy="90" r="18" fill="#dfe8f0" />
        <rect x="282" y="104" width="36" height="52" rx="10" fill="#dfe8f0" />
      </g>
      <text x="300" y="186" textAnchor="middle" className="scene-label" fill={good(s) ? 'var(--ok)' : 'var(--muted)'}>
        {good(s) ? 'USABLE NIGHT IMAGE' : washout(s) ? 'WASHED OUT' : blur(s) ? 'MOTION BLUR' : s.ir < 40 ? 'TOO DARK' : 'preview'}
      </text>
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
          <span>Night preview · IR &amp; exposure</span>
          <span className={`status-pill ${good(s) ? 'is-ok' : 'is-idle'}`}>IR {s.ir}% · {s.exposure}</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">IR illuminator</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'ir', d: -20 })} disabled={locked}>− IR</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'ir', d: 20 })} disabled={locked}>+ IR</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Exposure</span>
          <div className="control-row">
            {(['fast', 'medium', 'slow'] as Exposure[]).map((e) => (
              <button key={e} className={`btn ${s.exposure === e ? 'primary' : 'ghost'}`} onClick={() => dispatch({ t: 'exposure', e })} disabled={locked}>{e}</button>
            ))}
            <button className="btn primary" onClick={() => dispatch({ t: 'verify' })} disabled={locked}>Verify image</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const nightIr: ExerciseDefinition<S, A> = {
  id: 'cctv-night-ir',
  trade: 'cctv',
  rank: 6,
  version: '1.0.0',
  title: 'Night & IR exposure',
  estMinutes: 30,
  summary: 'Set IR and exposure for a usable night image without wash-out or motion blur.',
  scenario:
    'JOB-140 — A camera covers a dark loading area at night. Set the IR illuminator and exposure so a person ' +
    'is clearly visible: bright enough to identify, without washing out when they get close to the camera, and ' +
    'without motion blur as they move. Verify the image.',
  objectives: [
    { id: 'lit', label: 'Make the scene bright enough' },
    { id: 'wash', label: 'Avoid IR wash-out on near subjects' },
    { id: 'blur', label: 'Avoid motion blur' },
    { id: 'verify', label: 'Verify the night image' },
  ],
  hints: [
    'Too little IR and the scene is unusably dark; too much and anyone close to the camera blows out white.',
    'A slow exposure brightens the image but smears moving subjects — keep it fast or medium at night.',
    'Aim for moderate IR with a fast/medium exposure, then verify.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
