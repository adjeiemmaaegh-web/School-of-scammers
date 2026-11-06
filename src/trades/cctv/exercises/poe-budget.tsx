/**
 * CCTV · Rank 4 · "PoE power budget"
 *
 * Power all the required cameras from a PoE switch without exceeding its power
 * budget. A tempting high-draw PTZ would push the switch over budget.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

const BUDGET = 65; // watts

interface Cam {
  id: string;
  name: string;
  watts: number;
  required: boolean;
}

const CAMERAS: Cam[] = [
  { id: 'd1', name: 'Dome 1', watts: 6.5, required: true },
  { id: 'd2', name: 'Dome 2', watts: 6.5, required: true },
  { id: 'b1', name: 'Bullet 1', watts: 12.9, required: true },
  { id: 'b2', name: 'Bullet 2', watts: 12.9, required: true },
  { id: 'ir', name: 'IR Bullet', watts: 25.5, required: true },
  { id: 'ptz', name: 'PTZ dome', watts: 25.5, required: false },
];

interface S {
  connected: string[];
  submitted: boolean;
}

type A = { t: 'toggle'; id: string } | { t: 'submit' };

function init(): S {
  return { connected: [], submitted: false };
}

const total = (s: S) => CAMERAS.filter((c) => s.connected.includes(c.id)).reduce((n, c) => n + c.watts, 0);
const overload = (s: S) => total(s) > BUDGET;
const allRequired = (s: S) => CAMERAS.filter((c) => c.required).every((c) => s.connected.includes(c.id));

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev, connected: [...prev.connected] };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'toggle': {
      const cam = CAMERAS.find((c) => c.id === a.id)!;
      const i = s.connected.indexOf(a.id);
      if (i >= 0) {
        s.connected.splice(i, 1);
        detail = `Disconnected ${cam.name}`;
      } else {
        s.connected.push(a.id);
        detail = `Connected ${cam.name} (${cam.watts}W) — load now ${total(s).toFixed(1)}W`;
        if (overload(s)) { accepted = false; detail = `Connecting ${cam.name} exceeds the ${BUDGET}W budget (${total(s).toFixed(1)}W)`; }
      }
      break;
    }
    case 'submit':
      s.submitted = true;
      detail = 'Attempt submitted';
      break;
  }
  return { next: s, event: { action: a.t, detail, accepted } };
}

function objectiveStatus(s: S): Record<string, boolean> {
  return {
    required: allRequired(s),
    budget: !overload(s),
    done: allRequired(s) && !overload(s),
  };
}

function evaluate(s: S): RubricResult {
  const criteria = [
    { id: 'required', label: 'All required cameras powered', max: 45, earned: allRequired(s) ? 45 : Math.round((CAMERAS.filter((c) => c.required && s.connected.includes(c.id)).length / 5) * 45), reason: allRequired(s) ? 'Every required camera is powered' : 'Not all required cameras powered' },
    { id: 'budget', label: 'Within power budget', max: 40, earned: !overload(s) ? 40 : 0, reason: overload(s) ? `Over budget (${total(s).toFixed(1)}W / ${BUDGET}W)` : `Load ${total(s).toFixed(1)}W / ${BUDGET}W` },
    { id: 'efficiency', label: 'No needless load', max: 15, earned: s.connected.every((id) => CAMERAS.find((c) => c.id === id)?.required) ? 15 : 0, reason: 'Only required cameras connected' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && allRequired(s) && !overload(s), safetyHold: false, criteria };
}

function Play({ state, dispatch }: ExercisePlayProps<S, A>) {
  const s = state;
  const locked = s.submitted;
  const used = total(s);
  const pct = Math.min(100, (used / BUDGET) * 100);
  return (
    <div className="exercise-sim">
      <div className="sim-canvas">
        <div className="sim-canvas-bar">
          <span>PoE switch · {BUDGET}W budget</span>
          <span className={`status-pill ${overload(s) ? 'is-crit' : allRequired(s) ? 'is-ok' : 'is-idle'}`}>{used.toFixed(1)}W / {BUDGET}W</span>
        </div>
        <div className="poe-panel">
          <div className="poe-gauge"><span className={overload(s) ? 'over' : ''} style={{ width: `${pct}%` }} /></div>
          <ul className="poe-list">
            {CAMERAS.map((c) => {
              const on = s.connected.includes(c.id);
              return (
                <li key={c.id} className={`poe-row ${on ? 'on' : ''}`}>
                  <span className="poe-name">{c.name} {c.required ? <em>required</em> : <em className="opt">optional</em>}</span>
                  <span className="poe-watts tabular">{c.watts}W</span>
                  <button className={`btn ${on ? 'primary' : 'ghost'} small`} onClick={() => dispatch({ t: 'toggle', id: c.id })} disabled={locked}>{on ? 'Connected' : 'Connect'}</button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

export const poeBudget: ExerciseDefinition<S, A> = {
  id: 'cctv-poe-budget',
  trade: 'cctv',
  rank: 4,
  version: '1.0.0',
  title: 'PoE power budget',
  estMinutes: 30,
  summary: 'Power all the required cameras from a PoE switch without exceeding its power budget.',
  scenario:
    `JOB-120 — Connect the site's cameras to a PoE switch with a ${BUDGET}W power budget. Power every required ` +
    'camera while keeping the total draw within budget. Watch the high-draw devices — not everything will fit.',
  objectives: [
    { id: 'required', label: 'Power every required camera' },
    { id: 'budget', label: 'Stay within the power budget' },
    { id: 'done', label: 'A working, in-budget configuration' },
  ],
  hints: [
    'Add up the wattage of the cameras you connect and compare against the switch budget.',
    'The required cameras just fit; the optional PTZ would push the switch over budget.',
    'Connect only what the job requires.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
