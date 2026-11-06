/**
 * CCTV · Rank 3 · "IP addressing & NVR"
 *
 * Give a new camera a valid static IP on the NVR's subnet with no conflict, set
 * the gateway, and add it to the NVR so it comes online.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

const SUBNET = '192.168.1'; // /24
const NVR_IP = '192.168.1.1';
const EXISTING_CAM = '192.168.1.10';
const CORRECT_GW = '192.168.1.1';

const IP_OPTIONS = ['192.168.1.10', '192.168.0.11', '192.168.1.11', '10.0.0.11'];
const GW_OPTIONS = ['192.168.1.1', '192.168.0.1', '0.0.0.0'];

interface S {
  ip: string | null;
  gw: string | null;
  added: boolean;
  submitted: boolean;
}

type A =
  | { t: 'setIp'; ip: string }
  | { t: 'setGw'; gw: string }
  | { t: 'add' }
  | { t: 'submit' };

function init(): S {
  return { ip: null, gw: null, added: false, submitted: false };
}

const ipValid = (ip: string | null) => ip === '192.168.1.11'; // in-subnet, no conflict
const inSubnet = (ip: string | null) => !!ip && ip.startsWith(SUBNET + '.');
const conflict = (ip: string | null) => ip === NVR_IP || ip === EXISTING_CAM;
const online = (s: S) => ipValid(s.ip) && s.gw === CORRECT_GW && s.added;

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'setIp':
      s.ip = a.ip;
      s.added = false;
      detail = conflict(a.ip) ? `Set ${a.ip} — conflicts with an existing device` : !inSubnet(a.ip) ? `Set ${a.ip} — not on the NVR subnet` : `Set camera IP ${a.ip}`;
      break;
    case 'setGw':
      s.gw = a.gw;
      detail = `Set gateway ${a.gw}`;
      break;
    case 'add':
      if (!s.ip || !s.gw) {
        accepted = false;
        detail = 'Set an IP and gateway first';
      } else {
        s.added = true;
        detail = online(s) ? 'Camera added to NVR — channel online' : 'Added to NVR, but the camera does not come online';
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
    subnet: inSubnet(s.ip) && !conflict(s.ip),
    gw: s.gw === CORRECT_GW,
    online: online(s),
  };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'addressing', label: 'Valid in-subnet IP', max: 30, earned: inSubnet(s.ip) && !conflict(s.ip) ? 30 : 0, reason: !inSubnet(s.ip) ? 'IP not on the NVR subnet' : conflict(s.ip) ? 'IP conflicts with another device' : 'Valid IP on the subnet' },
    { id: 'conflict', label: 'No address conflict', max: 20, earned: s.ip && !conflict(s.ip) ? 20 : 0, reason: conflict(s.ip) ? 'Address already in use' : 'No conflict' },
    { id: 'gateway', label: 'Correct gateway', max: 20, earned: s.gw === CORRECT_GW ? 20 : 0, reason: s.gw === CORRECT_GW ? 'Gateway matches the subnet' : 'Gateway wrong or unset' },
    { id: 'online', label: 'Camera online on NVR', max: 30, earned: online(s) ? 30 : 0, reason: online(s) ? 'Channel online' : 'Camera not online' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && online(s), safetyHold: false, criteria };
}

function Scene({ s }: { s: S }) {
  return (
    <svg className="plc-scene" viewBox="0 0 480 180" role="img" aria-label="NVR, switch and camera network.">
      <rect x="30" y="60" width="90" height="50" rx="8" fill="var(--scene-motor)" stroke="var(--scene-line)" />
      <text x="75" y="88" textAnchor="middle" className="scene-label">NVR</text>
      <text x="75" y="100" textAnchor="middle" className="scene-label">{NVR_IP}</text>
      <line x1="120" y1="85" x2="200" y2="85" stroke="var(--scene-line)" strokeWidth="3" />
      <rect x="200" y="60" width="80" height="50" rx="8" fill="var(--scene-motor)" stroke="var(--scene-line)" />
      <text x="240" y="90" textAnchor="middle" className="scene-label">SWITCH</text>
      <line x1="280" y1="85" x2="360" y2="85" stroke={online(s) ? 'var(--ok)' : 'var(--scene-dim)'} strokeWidth="3" />
      <rect x="360" y="60" width="90" height="50" rx="8" fill="var(--scene-motor)" stroke={online(s) ? 'var(--ok)' : 'var(--scene-line)'} strokeWidth={online(s) ? 2.4 : 1.6} />
      <circle cx="405" cy="72" r="4" fill={online(s) ? 'var(--ok)' : 'var(--crit)'} />
      <text x="405" y="92" textAnchor="middle" className="scene-label">CAMERA</text>
      <text x="405" y="104" textAnchor="middle" className="scene-label">{s.ip ?? '—'}</text>
      <text x="240" y="150" textAnchor="middle" className="scene-label" fill={online(s) ? 'var(--ok)' : 'var(--muted)'}>{online(s) ? 'CHANNEL ONLINE' : s.added ? 'camera unreachable' : 'existing cam: ' + EXISTING_CAM}</text>
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
          <span>Network · NVR subnet {SUBNET}.0/24</span>
          <span className={`status-pill ${online(s) ? 'is-ok' : 'is-idle'}`}>{online(s) ? '● Online' : '● Offline'}</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Camera IP address</span>
          <div className="control-row">
            {IP_OPTIONS.map((ip) => (
              <button key={ip} className={`btn ${s.ip === ip ? 'primary' : 'ghost'} small`} onClick={() => dispatch({ t: 'setIp', ip })} disabled={locked}>{ip}</button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Gateway</span>
          <div className="control-row">
            {GW_OPTIONS.map((gw) => (
              <button key={gw} className={`btn ${s.gw === gw ? 'primary' : 'ghost'} small`} onClick={() => dispatch({ t: 'setGw', gw })} disabled={locked}>{gw}</button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">NVR</span>
          <div className="control-row">
            <button className="btn primary" onClick={() => dispatch({ t: 'add' })} disabled={locked}>Add camera to NVR</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ipAddressing: ExerciseDefinition<S, A> = {
  id: 'cctv-ip-addressing',
  trade: 'cctv',
  rank: 3,
  version: '1.0.0',
  title: 'IP addressing & NVR',
  estMinutes: 30,
  summary: 'Give a camera a valid, conflict-free static IP on the NVR subnet and bring it online.',
  scenario:
    `JOB-115 — Add a new IP camera to an NVR on the ${SUBNET}.0/24 network. The NVR is ${NVR_IP} and an ` +
    `existing camera already uses ${EXISTING_CAM}. Give the new camera a valid static IP with no conflict, set ` +
    'the correct gateway, and add it to the NVR so the channel comes online.',
  objectives: [
    { id: 'subnet', label: 'Assign a valid, conflict-free IP on the subnet' },
    { id: 'gw', label: 'Set the correct gateway' },
    { id: 'online', label: 'Bring the camera online on the NVR' },
  ],
  hints: [
    `The camera must be on the ${SUBNET}.x subnet, and not reuse ${NVR_IP} or ${EXISTING_CAM}.`,
    `The gateway on this subnet is ${CORRECT_GW}.`,
    'Set IP and gateway, then add the camera to the NVR.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
