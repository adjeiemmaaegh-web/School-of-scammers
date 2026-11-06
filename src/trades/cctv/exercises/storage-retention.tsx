/**
 * CCTV · Rank 7 · "Storage & retention sizing"
 *
 * Size the NVR storage to hit a retention target. Choose a recording mode
 * (continuous vs motion) and a disk size, and read the resulting days of
 * retention from the camera count and bitrate.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';
import { NvrArt, Scene as Scene2 } from '../../../ui/device-art';

const CAMERAS = 8;
const BITRATE = 4; // Mbps each
const TARGET_DAYS = 30;
const DISKS = [4, 8, 16]; // TB

type Mode = 'none' | 'continuous' | 'motion';
const DUTY: Record<Exclude<Mode, 'none'>, number> = { continuous: 1, motion: 0.4 };

interface S {
  mode: Mode;
  diskTB: number; // 0 = none
  verified: boolean;
  submitted: boolean;
}

type A = { t: 'mode'; m: Mode } | { t: 'disk'; tb: number } | { t: 'verify' } | { t: 'submit' };

function init(): S {
  return { mode: 'none', diskTB: 0, verified: false, submitted: false };
}

function gbPerDay(mode: Mode): number {
  if (mode === 'none') return 0;
  return (CAMERAS * BITRATE * DUTY[mode] * 86400) / 8 / 1000; // Mb/s → GB/day
}
function retentionDays(s: S): number {
  const g = gbPerDay(s.mode);
  if (!g || !s.diskTB) return 0;
  return (s.diskTB * 1000) / g;
}
const meets = (s: S) => retentionDays(s) >= TARGET_DAYS;

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'mode':
      s.mode = a.m;
      detail = `Recording mode: ${a.m} (${a.m === 'none' ? '—' : gbPerDay(a.m).toFixed(0) + ' GB/day'})`;
      break;
    case 'disk':
      s.diskTB = a.tb;
      detail = `Disk sized at ${a.tb} TB`;
      break;
    case 'verify':
      if (meets(s)) { s.verified = true; detail = `Verified: ${retentionDays(s).toFixed(0)} days ≥ ${TARGET_DAYS} day target`; }
      else { accepted = false; detail = s.mode === 'none' || !s.diskTB ? 'Choose a recording mode and disk size' : `Only ${retentionDays(s).toFixed(0)} days — below the ${TARGET_DAYS} day target`; }
      break;
    case 'submit':
      s.submitted = true;
      detail = 'Attempt submitted';
      break;
  }
  return { next: s, event: { action: a.t, detail, accepted } };
}

function objectiveStatus(s: S): Record<string, boolean> {
  return { mode: s.mode !== 'none', disk: s.diskTB > 0, retention: meets(s), verify: s.verified };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'mode', label: 'Recording mode chosen', max: 20, earned: s.mode !== 'none' ? 20 : 0, reason: s.mode !== 'none' ? `${s.mode} recording` : 'No mode chosen' },
    { id: 'disk', label: 'Disk sized', max: 20, earned: s.diskTB > 0 ? 20 : 0, reason: s.diskTB > 0 ? `${s.diskTB} TB` : 'No disk sized' },
    { id: 'retention', label: 'Retention target met', max: 45, earned: meets(s) ? 45 : 0, reason: meets(s) ? `${retentionDays(s).toFixed(0)} days` : `${retentionDays(s).toFixed(0)} days (target ${TARGET_DAYS})` },
    { id: 'process', label: 'Verification', max: 15, earned: s.verified ? 15 : 0, reason: s.verified ? 'Sizing verified' : 'Not verified' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && meets(s), safetyHold: false, criteria };
}

function Scene({ s }: { s: S }) {
  const days = retentionDays(s);
  const pct = Math.min(100, (days / (TARGET_DAYS * 1.5)) * 100);
  return (
    <Scene2 viewBox="0 0 480 180" label={`Retention ${days.toFixed(0)} days vs ${TARGET_DAYS} target.`}>
      <NvrArt x={20} y={30} scale={0.9} online={meets(s)} />
      <text x={74} y={92} textAnchor="middle" className="scene-label">{CAMERAS} cams · {BITRATE} Mbps</text>
      <text x={74} y={106} textAnchor="middle" className="scene-label">{s.mode === 'none' ? 'no mode' : gbPerDay(s.mode).toFixed(0) + ' GB/day'}</text>
      {/* retention readout */}
      <text x="330" y="54" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="38" fill={meets(s) ? 'var(--ok)' : 'var(--accent)'}>{days.toFixed(0)}</text>
      <text x="330" y="74" textAnchor="middle" className="scene-label">DAYS RETENTION · target {TARGET_DAYS}</text>
      <rect x="210" y="96" width="240" height="12" rx="6" fill="var(--surface-2)" stroke="var(--scene-line)" />
      <rect x="210" y="96" width={240 * pct / 100} height="12" rx="6" fill={meets(s) ? 'var(--ok)' : 'var(--accent)'} />
      <line x1={210 + 240 / 1.5} y1="92" x2={210 + 240 / 1.5} y2="112" stroke="var(--scene-line)" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x={210 + 240 / 1.5} y="128" textAnchor="middle" className="scene-label">{TARGET_DAYS}d</text>
      <text x="330" y="156" textAnchor="middle" className="scene-label">{s.diskTB ? s.diskTB + ' TB disk' : 'no disk sized'}</text>
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
          <span>NVR storage · retention</span>
          <span className={`status-pill ${meets(s) ? 'is-ok' : 'is-idle'}`}>{retentionDays(s).toFixed(0)}d</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Recording mode</span>
          <div className="control-row">
            <button className={`btn ${s.mode === 'continuous' ? 'primary' : 'ghost'}`} onClick={() => dispatch({ t: 'mode', m: 'continuous' })} disabled={locked}>Continuous</button>
            <button className={`btn ${s.mode === 'motion' ? 'primary' : 'ghost'}`} onClick={() => dispatch({ t: 'mode', m: 'motion' })} disabled={locked}>Motion (~40%)</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Disk size</span>
          <div className="control-row">
            {DISKS.map((tb) => (
              <button key={tb} className={`btn ${s.diskTB === tb ? 'primary' : 'ghost'}`} onClick={() => dispatch({ t: 'disk', tb })} disabled={locked}>{tb} TB</button>
            ))}
            <button className="btn primary" onClick={() => dispatch({ t: 'verify' })} disabled={locked}>Verify sizing</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const storageRetention: ExerciseDefinition<S, A> = {
  id: 'cctv-storage-retention',
  trade: 'cctv',
  rank: 7,
  version: '1.0.0',
  title: 'Storage & retention sizing',
  estMinutes: 35,
  summary: `Size the NVR disk and recording mode to keep ${TARGET_DAYS} days of footage from ${CAMERAS} cameras.`,
  scenario:
    `JOB-152 — The client needs ${TARGET_DAYS} days of retention from ${CAMERAS} cameras at ${BITRATE} Mbps each. ` +
    'Choose a recording mode and disk size so the NVR holds at least the target retention. Read the days of ' +
    'retention from the configuration and verify it meets spec.',
  objectives: [
    { id: 'mode', label: 'Choose a recording mode' },
    { id: 'disk', label: 'Size the disk' },
    { id: 'retention', label: `Meet the ${TARGET_DAYS}-day retention target` },
    { id: 'verify', label: 'Verify the sizing' },
  ],
  hints: [
    'Continuous recording writes ~2.5× what motion-only recording does.',
    'Watch the days-of-retention readout change as you pick a mode and disk.',
    'Continuous needs a large disk; motion recording hits the target on a smaller one.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
