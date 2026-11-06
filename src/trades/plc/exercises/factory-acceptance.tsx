/**
 * PLC · Rank 10 · "Factory acceptance test" (capstone)
 *
 * Run a scripted FAT over a commissioned line. One check is seeded to fail (an
 * injected fault). The candidate must run every check, then correctly flag the
 * one that failed. Flagging a passing check, or missing the fault, costs marks.
 */
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';

const CHECKS = [
  'E-stop dominates run',
  'Start permissive required',
  'Motor runs on command',
  'Photoeye stops feed',
  'Guard interlock trips',
  'Overload trips motor',
];

type Res = 'untested' | 'pass' | 'fail';

interface S {
  faultIndex: number;
  results: Res[];
  flagged: number | null;
  submitted: boolean;
}

type A =
  | { t: 'run'; i: number }
  | { t: 'runAll' }
  | { t: 'flag'; i: number }
  | { t: 'submit' };

function init(seed: number): S {
  return {
    faultIndex: Math.abs(Math.floor(seed)) % CHECKS.length,
    results: CHECKS.map(() => 'untested'),
    flagged: null,
    submitted: false,
  };
}

function reduce(prev: S, a: A): { next: S; event?: { action: string; detail: string; accepted: boolean } } {
  if (prev.submitted) return { next: prev };
  const s: S = { ...prev, results: [...prev.results] };
  let accepted = true;
  let detail = '';
  switch (a.t) {
    case 'run': {
      const res: Res = a.i === s.faultIndex ? 'fail' : 'pass';
      s.results[a.i] = res;
      detail = `FAT check "${CHECKS[a.i]}": ${res.toUpperCase()}`;
      break;
    }
    case 'runAll':
      s.results = CHECKS.map((_, i) => (i === s.faultIndex ? 'fail' : 'pass'));
      detail = 'Ran all FAT checks';
      break;
    case 'flag':
      s.flagged = a.i;
      detail = a.i === s.faultIndex ? `Flagged the failing check: "${CHECKS[a.i]}"` : `Flagged "${CHECKS[a.i]}" — but that check passes`;
      if (a.i !== s.faultIndex) accepted = false;
      break;
    case 'submit':
      s.submitted = true;
      detail = 'FAT report submitted';
      break;
  }
  return { next: s, event: { action: a.t, detail, accepted } };
}

function objectiveStatus(s: S): Record<string, boolean> {
  const allRun = s.results.every((r) => r !== 'untested');
  const faultObserved = s.results[s.faultIndex] === 'fail';
  return {
    run: allRun,
    detect: faultObserved,
    flag: s.flagged === s.faultIndex,
  };
}

function evaluate(s: S): RubricResult {
  const runCount = s.results.filter((r) => r !== 'untested').length;
  const allRun = runCount === CHECKS.length;
  const faultObserved = s.results[s.faultIndex] === 'fail';
  const correctFlag = s.flagged === s.faultIndex;
  const wrongFlag = s.flagged !== null && s.flagged !== s.faultIndex;
  const criteria = [
    { id: 'coverage', label: 'FAT coverage', max: 25, earned: Math.round((runCount / CHECKS.length) * 25), reason: allRun ? 'All checks run' : `${runCount}/${CHECKS.length} checks run` },
    { id: 'detect', label: 'Fault detected', max: 25, earned: faultObserved ? 25 : 0, reason: faultObserved ? 'The failing check was observed' : 'Failing check not run' },
    { id: 'identify', label: 'Correct fault flagged', max: 40, earned: correctFlag ? 40 : 0, reason: correctFlag ? 'Flagged the right failing check' : wrongFlag ? 'Flagged a passing check' : 'No fault flagged' },
    { id: 'discipline', label: 'No false flag', max: 10, earned: wrongFlag ? 0 : 10, reason: wrongFlag ? 'A passing check was flagged' : 'No false flags' },
  ];
  const score = criteria.reduce((n, c) => n + c.earned, 0);
  const max = criteria.reduce((n, c) => n + c.max, 0);
  return { score, max, passed: score >= 70 && allRun && correctFlag, safetyHold: false, criteria };
}

function Play({ state, dispatch }: ExercisePlayProps<S, A>) {
  const s = state;
  const locked = s.submitted;
  return (
    <div className="exercise-sim">
      <div className="sim-canvas">
        <div className="sim-canvas-bar">
          <span>Factory acceptance test</span>
          <span className="status-pill is-idle">{s.results.filter((r) => r !== 'untested').length}/{CHECKS.length} run</span>
        </div>
        <ul className="fat-list">
          {CHECKS.map((name, i) => {
            const r = s.results[i];
            const flagged = s.flagged === i;
            return (
              <li key={i} className={`fat-row ${r}`}>
                <span className="fat-name">{name}</span>
                <span className="fat-controls">
                  <span className={`fat-result ${r}`}>{r === 'untested' ? '—' : r === 'pass' ? 'PASS' : 'FAIL'}</span>
                  <button className="btn ghost small" onClick={() => dispatch({ t: 'run', i })} disabled={locked}>Run</button>
                  <button className={`btn ${flagged ? 'primary' : 'ghost'} small`} onClick={() => dispatch({ t: 'flag', i })} disabled={locked}>{flagged ? 'Flagged' : 'Flag fault'}</button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="sim-controls">
        <div className="control-row">
          <button className="btn ghost" onClick={() => dispatch({ t: 'runAll' })} disabled={locked}>Run all checks</button>
        </div>
      </div>
    </div>
  );
}

export const factoryAcceptance: ExerciseDefinition<S, A> = {
  id: 'plc-factory-acceptance',
  trade: 'plc',
  rank: 10,
  version: '1.0.0',
  title: 'Factory acceptance test',
  estMinutes: 55,
  summary: 'Run a scripted FAT over a commissioned line, detect the injected fault, and flag it correctly.',
  scenario:
    'WO-090 — Perform the factory acceptance test on a commissioned line. Run every acceptance check — ' +
    'permissives, E-stop dominance, photoeye stop, guard and overload interlocks — identify the one check that ' +
    'fails (an injected fault), and flag it. Do not flag a check that passes.',
  objectives: [
    { id: 'run', label: 'Run every acceptance check' },
    { id: 'detect', label: 'Observe the failing check' },
    { id: 'flag', label: 'Flag the correct failing check' },
  ],
  hints: [
    'Run all the checks first — one of them will report FAIL.',
    'The injected fault is seeded, so different assignments fail on a different check.',
    'Flag only the check that failed; flagging a passing check costs marks.',
  ],
  init,
  reduce,
  objectiveStatus,
  evaluate,
  Play,
};
