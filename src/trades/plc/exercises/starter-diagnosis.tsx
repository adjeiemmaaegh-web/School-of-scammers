/**
 * PLC · Rank 6 · "Motor starter fault diagnosis"
 *
 * A diagnosis exercise with a seeded fault (fuse / overload / contactor). The
 * learner takes readings across the starter, then identifies the faulty
 * component. Guessing without evidence — or guessing wrong — is penalised.
 * The seed selects the fault, so employer-assigned variants differ per candidate.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

type Fault = 'fuse' | 'overload' | 'contactor';
const FAULTS: Fault[] = ['fuse', 'overload', 'contactor'];

interface S {
  fault: Fault;
  inspected: Record<Fault | 'control', boolean>;
  diagnosed: boolean;
  wrongGuesses: number;
  submitted: boolean;
}

type A =
  | { t: 'inspect'; item: Fault | 'control' }
  | { t: 'diagnose'; item: Fault }
  | { t: 'submit' };

function init(seed: number): S {
  return {
    fault: FAULTS[Math.abs(Math.floor(seed)) % FAULTS.length],
    inspected: { fuse: false, overload: false, contactor: false, control: false },
    diagnosed: false,
    wrongGuesses: 0,
    submitted: false,
  };
}

const LABEL: Record<Fault, string> = { fuse: 'control fuse F1', overload: 'overload relay OL1', contactor: 'contactor K1' };

function reading(s: S, item: Fault | 'control'): string {
  if (item === 'control') return s.fault === 'fuse' ? '0V — no control voltage' : '24V present';
  if (item === 'fuse') return s.fault === 'fuse' ? 'open circuit (blown)' : 'continuity OK';
  if (item === 'overload') return s.fault === 'overload' ? 'TRIPPED' : 'healthy / reset';
  return s.fault === 'contactor' ? 'coil open — not pulling in' : 'coil OK, pulls in';
}

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev, inspected: { ...prev.inspected } };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'inspect':
      s.inspected[a.item] = true;
      detail = `Checked ${a.item === 'control' ? 'control voltage' : LABEL[a.item]}: ${reading(s, a.item)}`;
      break;
    case 'diagnose':
      if (s.diagnosed) {
        accepted = false;
        detail = 'Fault already identified';
      } else if (a.item === s.fault) {
        s.diagnosed = true;
        detail = `Correct: the ${LABEL[a.item]} is the fault`;
      } else {
        s.wrongGuesses++;
        accepted = false;
        detail = `Incorrect call: ${LABEL[a.item]} is healthy`;
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
  const inspectedCount = Object.values(s.inspected).filter(Boolean).length;
  return {
    inspect: inspectedCount >= 3,
    identify: s.diagnosed,
    clean: s.diagnosed && s.wrongGuesses === 0,
  };
}

function evaluate(s: S): RubricResult {
  const inspectedCount = Object.values(s.inspected).filter(Boolean).length;
  const criteria = [
    { id: 'diagnostics', label: 'Evidence gathered', max: 30, earned: Math.min(30, inspectedCount * 8), reason: `${inspectedCount} readings taken` },
    { id: 'identify', label: 'Correct identification', max: 45, earned: s.diagnosed ? 45 : 0, reason: s.diagnosed ? `Identified the ${LABEL[s.fault]}` : 'Fault not identified' },
    { id: 'discipline', label: 'No guessing', max: 25, earned: s.wrongGuesses === 0 ? 25 : Math.max(0, 25 - s.wrongGuesses * 15), reason: s.wrongGuesses === 0 ? 'Diagnosed from evidence, no wrong calls' : `${s.wrongGuesses} incorrect call(s)` },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && s.diagnosed, safetyHold: false, criteria };
}

function Scene({ s }: { s: S }) {
  const faulted = (f: Fault) => (s.inspected[f] && s.fault === f ? 'var(--crit)' : 'var(--scene-motor)');
  return (
    <svg className="plc-scene" viewBox="0 0 480 200" role="img" aria-label="Motor starter panel for fault diagnosis.">
      <rect x="24" y="24" width="432" height="152" rx="10" fill="var(--scene-bg)" stroke="var(--scene-line)" />
      {/* fuse */}
      <rect x="60" y="60" width="70" height="40" rx="6" fill={faulted('fuse')} stroke="var(--scene-line)" />
      <text x="95" y="118" textAnchor="middle" className="scene-label">FUSE F1</text>
      <text x="95" y="130" textAnchor="middle" className="scene-label">{s.inspected.fuse ? reading(s, 'fuse') : '?'}</text>
      {/* contactor */}
      <rect x="205" y="60" width="70" height="40" rx="6" fill={faulted('contactor')} stroke="var(--scene-line)" />
      <text x="240" y="118" textAnchor="middle" className="scene-label">K1</text>
      <text x="240" y="130" textAnchor="middle" className="scene-label">{s.inspected.contactor ? reading(s, 'contactor') : '?'}</text>
      {/* overload */}
      <rect x="350" y="60" width="70" height="40" rx="6" fill={faulted('overload')} stroke="var(--scene-line)" />
      <text x="385" y="118" textAnchor="middle" className="scene-label">OL1</text>
      <text x="385" y="130" textAnchor="middle" className="scene-label">{s.inspected.overload ? reading(s, 'overload') : '?'}</text>
      <text x="240" y="48" textAnchor="middle" className="scene-label">MOTOR STARTER — motor will not run</text>
      <text x="240" y="162" textAnchor="middle" className="scene-label" fill={s.diagnosed ? 'var(--ok)' : 'var(--muted)'}>{s.diagnosed ? 'FAULT IDENTIFIED' : 'control voltage: ' + (s.inspected.control ? reading(s, 'control') : '?')}</text>
    </svg>
  );
}

function Play({ state, dispatch }: ExercisePlayProps<S, A>) {
  const s = state;
  const locked = s.submitted || s.diagnosed;
  return (
    <div className="exercise-sim">
      <div className="sim-canvas">
        <div className="sim-canvas-bar">
          <span>Motor starter · diagnosis</span>
          <span className={`status-pill ${s.diagnosed ? 'is-ok' : 'is-crit'}`}>{s.diagnosed ? '● Solved' : '● Fault present'}</span>
        </div>
        <Scene s={s} />
      </div>
      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Take readings</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch({ t: 'inspect', item: 'control' })} disabled={s.submitted}>Control voltage</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'inspect', item: 'fuse' })} disabled={s.submitted}>Fuse F1</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'inspect', item: 'contactor' })} disabled={s.submitted}>Contactor K1</button>
            <button className="btn ghost" onClick={() => dispatch({ t: 'inspect', item: 'overload' })} disabled={s.submitted}>Overload OL1</button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Identify the faulty component</span>
          <div className="control-row">
            <button className="btn primary" onClick={() => dispatch({ t: 'diagnose', item: 'fuse' })} disabled={locked}>It's the fuse</button>
            <button className="btn primary" onClick={() => dispatch({ t: 'diagnose', item: 'contactor' })} disabled={locked}>It's the contactor</button>
            <button className="btn primary" onClick={() => dispatch({ t: 'diagnose', item: 'overload' })} disabled={locked}>It's the overload</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const starterDiagnosis: ExerciseDefinition<S, A> = {
  id: 'plc-starter-diagnosis',
  trade: 'plc',
  rank: 6,
  version: '1.0.0',
  title: 'Motor starter fault diagnosis',
  estMinutes: 35,
  summary: 'A motor will not run. Take readings across the starter and identify the faulty component.',
  scenario:
    'WO-042 — A direct-on-line motor starter will not run the motor. Systematically take readings — control ' +
    'voltage, fuse continuity, contactor coil and overload status — then identify the single faulty component. ' +
    'Diagnose from the evidence; wrong calls count against you.',
  objectives: [
    { id: 'inspect', label: 'Take readings across the starter' },
    { id: 'identify', label: 'Identify the faulty component' },
    { id: 'clean', label: 'Diagnose without a wrong call' },
  ],
  hints: [
    'Work methodically from the supply inward: control voltage first.',
    'No control voltage points upstream (the fuse); good voltage but no pull-in points at the contactor; a tripped overload breaks the circuit after the contactor.',
    'Only call the fault once the readings prove it.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
