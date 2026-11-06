/**
 * CCTV · Rank 9 · "Bandwidth & stream profiles"
 *
 * Set each camera's remote stream profile so the total fits the WAN uplink
 * budget, while the two priority cameras still stream at high quality.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

const BUDGET = 10; // Mbps WAN uplink

type Profile = 'low' | 'med' | 'high';
const RATE: Record<Profile, number> = { low: 1, med: 2, high: 4 };

interface Cam {
  id: string;
  name: string;
  priority: boolean;
}
const CAMERAS: Cam[] = [
  { id: 'ent', name: 'Entrance', priority: true },
  { id: 'till', name: 'Till', priority: true },
  { id: 'aisle', name: 'Aisle', priority: false },
  { id: 'store', name: 'Stockroom', priority: false },
];

interface S {
  profiles: Record<string, Profile>;
  submitted: boolean;
}

type A = { t: 'set'; id: string; p: Profile } | { t: 'submit' };

function init(): S {
  return { profiles: { ent: 'low', till: 'low', aisle: 'low', store: 'low' }, submitted: false };
}

const total = (s: S) => CAMERAS.reduce((n, c) => n + RATE[s.profiles[c.id]], 0);
const overBudget = (s: S) => total(s) > BUDGET;
const prioritiesHigh = (s: S) => CAMERAS.filter((c) => c.priority).every((c) => s.profiles[c.id] === 'high');

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev, profiles: { ...prev.profiles } };
  let accepted = true;
  let detail = '';
  if (a.t === 'set') {
    s.profiles[a.id] = a.p;
    const cam = CAMERAS.find((c) => c.id === a.id)!;
    detail = `${cam.name} → ${a.p} (${RATE[a.p]} Mbps). Total ${total(s)} / ${BUDGET} Mbps`;
    if (overBudget(s)) { accepted = false; detail = `Over uplink budget: ${total(s)} / ${BUDGET} Mbps`; }
  } else {
    s.submitted = true;
    detail = 'Attempt submitted';
  }
  return { next: s, event: { action: a.t, detail, accepted } };
}

function objectiveStatus(s: S): Record<string, boolean> {
  return { priority: prioritiesHigh(s), budget: !overBudget(s), done: prioritiesHigh(s) && !overBudget(s) };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'priority', label: 'Priority cameras at high quality', max: 45, earned: prioritiesHigh(s) ? 45 : 0, reason: prioritiesHigh(s) ? 'Entrance and Till stream high' : 'A priority camera is not high quality' },
    { id: 'budget', label: 'Within uplink budget', max: 40, earned: !overBudget(s) ? 40 : 0, reason: overBudget(s) ? `Over budget (${total(s)}/${BUDGET})` : `Total ${total(s)}/${BUDGET} Mbps` },
    { id: 'all', label: 'All cameras streaming', max: 15, earned: 15, reason: 'Every camera has a profile' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && prioritiesHigh(s) && !overBudget(s), safetyHold: false, criteria };
}

function Play({ state, dispatch }: ExercisePlayProps<S, A>) {
  const s = state;
  const locked = s.submitted;
  const pct = Math.min(100, (total(s) / BUDGET) * 100);
  return (
    <div className="exercise-sim">
      <div className="sim-canvas">
        <div className="sim-canvas-bar">
          <span>WAN uplink · {BUDGET} Mbps budget</span>
          <span className={`status-pill ${overBudget(s) ? 'is-crit' : prioritiesHigh(s) ? 'is-ok' : 'is-idle'}`}>{total(s)} / {BUDGET} Mbps</span>
        </div>
        <div className="poe-panel">
          <div className="poe-gauge"><span className={overBudget(s) ? 'over' : ''} style={{ width: `${pct}%` }} /></div>
          <ul className="poe-list">
            {CAMERAS.map((c) => (
              <li key={c.id} className="poe-row">
                <span className="poe-name">{c.name} {c.priority && <em>priority</em>}</span>
                <span className="profile-seg">
                  {(['low', 'med', 'high'] as Profile[]).map((p) => (
                    <button key={p} className={`btn ${s.profiles[c.id] === p ? 'primary' : 'ghost'} small`} onClick={() => dispatch({ t: 'set', id: c.id, p })} disabled={locked}>{p} {RATE[p]}M</button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export const bandwidthProfiles: ExerciseDefinition<S, A> = {
  id: 'cctv-bandwidth-profiles',
  trade: 'cctv',
  rank: 9,
  version: '1.0.0',
  title: 'Bandwidth & stream profiles',
  estMinutes: 40,
  summary: 'Fit all remote streams into the WAN uplink while keeping the priority cameras at high quality.',
  scenario:
    `JOB-178 — Remote viewing runs over a ${BUDGET} Mbps WAN uplink. Set each camera's remote stream profile so ` +
    'the total fits the uplink budget, while the two priority cameras (Entrance and Till) still stream at high ' +
    'quality. Lower-priority cameras take the remaining bandwidth.',
  objectives: [
    { id: 'priority', label: 'Keep priority cameras at high quality' },
    { id: 'budget', label: 'Stay within the uplink budget' },
    { id: 'done', label: 'A working, in-budget profile set' },
  ],
  hints: [
    'Add up each camera’s stream bitrate and compare with the uplink budget.',
    'The two priority cameras must be high (4 Mbps each); that leaves little for the rest.',
    'Drop the non-priority cameras to low to fit the budget.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
