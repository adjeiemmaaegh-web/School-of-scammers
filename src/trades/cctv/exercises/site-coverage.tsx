/**
 * CCTV · Rank 8 · "Multi-camera site coverage"
 *
 * Assign three cameras to cover three site zones with no blind spot. Pointing two
 * cameras at the same zone leaves another uncovered.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';
import { CameraArt, Scene as Scene2 } from '../../../ui/device-art';

const ZONES = ['Entrance', 'Yard', 'Dock'] as const;
type Zone = (typeof ZONES)[number];
const CAMS = ['Cam 1', 'Cam 2', 'Cam 3'] as const;
type Cam = (typeof CAMS)[number];

interface S {
  assign: Record<Cam, Zone | null>;
  submitted: boolean;
}

type A = { t: 'assign'; cam: Cam; zone: Zone } | { t: 'submit' };

function init(): S {
  return { assign: { 'Cam 1': null, 'Cam 2': null, 'Cam 3': null }, submitted: false };
}

const coveredZones = (s: S) => new Set(Object.values(s.assign).filter(Boolean) as Zone[]);
const blindSpots = (s: S) => ZONES.filter((z) => !coveredZones(s).has(z));
const allCovered = (s: S) => blindSpots(s).length === 0;

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev, assign: { ...prev.assign } };
  let detail = '';
  if (a.t === 'assign') {
    s.assign[a.cam] = a.zone;
    detail = `${a.cam} aimed at ${a.zone}`;
    const blind = blindSpots(s);
    if (blind.length) detail += ` — blind spot: ${blind.join(', ')}`;
  } else {
    s.submitted = true;
    detail = 'Attempt submitted';
  }
  return { next: s, event: { action: a.t, detail, accepted: true } };
}

function objectiveStatus(s: S): Record<string, boolean> {
  const c = coveredZones(s);
  return { entrance: c.has('Entrance'), yard: c.has('Yard'), dock: c.has('Dock'), noblind: allCovered(s) };
}

function evaluate(s: S): RubricResult {
  const covered = coveredZones(s).size;
  const distinct = new Set(Object.values(s.assign).filter(Boolean)).size === Object.values(s.assign).filter(Boolean).length;
  const criteria = [
    { id: 'coverage', label: 'Zones covered', max: 60, earned: Math.round((covered / 3) * 60), reason: `${covered}/3 zones covered` },
    { id: 'blind', label: 'No blind spot', max: 25, earned: allCovered(s) ? 25 : 0, reason: allCovered(s) ? 'Every zone has a camera' : `Blind: ${blindSpots(s).join(', ')}` },
    { id: 'efficiency', label: 'No wasted cameras', max: 15, earned: distinct && allCovered(s) ? 15 : 0, reason: distinct ? 'Each camera covers a distinct zone' : 'Two cameras on the same zone' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && allCovered(s), safetyHold: false, criteria };
}

function Scene({ s }: { s: S }) {
  const zoneX: Record<Zone, number> = { Entrance: 90, Yard: 240, Dock: 390 };
  const camX: Record<Cam, number> = { 'Cam 1': 90, 'Cam 2': 240, 'Cam 3': 390 };
  const covered = coveredZones(s);
  return (
    <Scene2 viewBox="0 0 480 190" label="Site plan with three zones and three cameras.">
      {ZONES.map((z) => {
        const on = covered.has(z);
        return (
          <g key={z}>
            <rect x={zoneX[z] - 55} y="20" width="110" height="34" rx="6" fill={on ? 'color-mix(in srgb, var(--ok) 18%, transparent)' : 'color-mix(in srgb, var(--crit) 14%, transparent)'} stroke={on ? 'var(--ok)' : 'var(--crit)'} strokeWidth="1.5" />
            <text x={zoneX[z]} y="42" textAnchor="middle" className="scene-label" fill={on ? 'var(--ok)' : 'var(--crit)'}>{z.toUpperCase()}{on ? '' : ' ✕'}</text>
          </g>
        );
      })}
      {CAMS.map((c) => {
        const z = s.assign[c];
        return (
          <g key={c}>
            {z && <line x1={camX[c]} y1="130" x2={zoneX[z]} y2="56" stroke="var(--scene-steel)" strokeWidth="1.5" strokeDasharray="4 3" />}
            <CameraArt x={camX[c] - 44} y={128} scale={0.75} kind="dome" on={!!z} />
            <text x={camX[c]} y="182" textAnchor="middle" className="scene-label">{c}{z ? ` → ${z}` : ''}</text>
          </g>
        );
      })}
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
          <span>Site coverage · 3 zones</span>
          <span className={`status-pill ${allCovered(s) ? 'is-ok' : 'is-idle'}`}>{coveredZones(s).size}/3 covered</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        {CAMS.map((c) => (
          <div className="control-group" key={c}>
            <span className="control-label">{c} — aim at</span>
            <div className="control-row">
              {ZONES.map((z) => (
                <button key={z} className={`btn ${s.assign[c] === z ? 'primary' : 'ghost'} small`} onClick={() => dispatch({ t: 'assign', cam: c, zone: z })} disabled={locked}>{z}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const siteCoverage: ExerciseDefinition<S, A> = {
  id: 'cctv-site-coverage',
  trade: 'cctv',
  rank: 8,
  version: '1.0.0',
  title: 'Multi-camera site coverage',
  estMinutes: 40,
  summary: 'Assign three cameras to cover three site zones with no blind spot.',
  scenario:
    'JOB-166 — A site has three zones to monitor — Entrance, Yard and Dock — and three cameras. Aim each camera ' +
    'so every zone is covered with no blind spot and no two cameras wasted on the same zone.',
  objectives: [
    { id: 'entrance', label: 'Cover the Entrance' },
    { id: 'yard', label: 'Cover the Yard' },
    { id: 'dock', label: 'Cover the Dock' },
    { id: 'noblind', label: 'Leave no blind spot' },
  ],
  hints: [
    'There are exactly as many cameras as zones — one each.',
    'Pointing two cameras at the same zone leaves another zone blind.',
    'Give each camera a different zone until all three are covered.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
