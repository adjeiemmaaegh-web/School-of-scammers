import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { decodeAssignment, encodeResult } from '../platform/persistence';
import { getExercise } from '../trades/registry';
import { getScenarioMeta } from '../exercises/meta';
import type { ScenarioRequest } from '../exercises/session';
import type { Assignment, AttemptResult } from '../platform/types';
import { AppHeader } from '../ui/AppHeader';
import { CopyField } from '../ui/CopyField';
import { ExercisePlayer } from '../ui/ExercisePlayer';
const SandboxPage = lazy(() => import('./SandboxPage').then(m => ({ default: m.SandboxPage })));

function readAssignmentFromHash(): { assignment?: Assignment; error?: string } {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const code = params.get('a');
  if (!code) return {};
  try {
    return { assignment: decodeAssignment(code) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid assignment link.' };
  }
}

export function CandidatePage() {
  const [{ assignment, error }, setState] = useState(() => readAssignmentFromHash());
  const [started, setStarted] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    const onHash = () => { setStarted(false); setState(readAssignmentFromHash()); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const exerciseDef = useMemo(() => (assignment ? getExercise(assignment.exerciseId) : undefined), [assignment]);
  const scenarioDef = useMemo(() => (assignment ? getScenarioMeta(assignment.exerciseId) : undefined), [assignment]);
  const def = exerciseDef ?? scenarioDef;
  // IDs and JSON shape alone do not identify the assigned exercise. Reject
  // incompatible versions/trades instead of silently grading a different task.
  const assignmentMatches=!!assignment&&!!def&&assignment.mode==='assessment'&&
    assignment.trade===def.trade&&assignment.exerciseVersion===def.version;
  const session = useMemo<ScenarioRequest | null>(() => (assignmentMatches && assignment && scenarioDef ? {
    scenarioId: scenarioDef.id, mode: 'assessment', seed: assignment.seed, allowRestart: false, assignment,
    resultActions: (result: AttemptResult) => <ReturnCode result={result} originalAssignment={assignment!} />,
  } : null), [assignmentMatches, assignment, scenarioDef]);

  const loadManual = () => {
    try {
      const decoded=decodeAssignment(manual); setStarted(false); setState({ assignment: decoded });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : 'Invalid code.' });
    }
  };

  // No assignment yet — ask for a code/link.
  if (!assignment) {
    return (
      <>
        <AppHeader />
        <main id="main" className="wrap page narrow">
          <span className="eyebrow">For candidates</span>
          <h1 className="page-title">Open your assigned task</h1>
          <p className="sub">If you were given a link, it opens the task automatically. Otherwise paste the assignment code from your employer below.</p>
          {error && <p className="field-error">{error}</p>}
          <div className="card">
            <label className="field">
              <span>Assignment code</span>
              <textarea className="code-input" rows={3} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Paste assignment code…" />
            </label>
            <button className="btn primary" onClick={loadManual} disabled={!manual.trim()}>Open task</button>
          </div>
        </main>
      </>
    );
  }

  if (!assignmentMatches) {
    return (
      <>
        <AppHeader />
        <main id="main" className="wrap page narrow">
          <h1 className="page-title">This task isn't available</h1>
          <p className="sub">This assignment's exercise, trade, mode or version is not available in this build (<code>{assignment.exerciseId}</code>, version {assignment.exerciseVersion}). Request a compatible assignment instead of attempting a different assessment.</p>
          <Link className="btn ghost" to="/">← Home</Link>
        </main>
      </>
    );
  }

  // Intro screen before exam conditions begin.
  if (!started) {
    return (
      <>
        <AppHeader />
        <main id="main" className="wrap page narrow">
          <span className="eyebrow">Assessment · {def.trade.toUpperCase()}</span>
          <h1 className="page-title">{def.title}</h1>
          {assignment.label && <p className="assign-label">Assigned: {assignment.label}</p>}
          <div className="card">
            <h2 className="card-title">Before you begin</h2>
            <p>{def.scenario}</p>
            <ul className="exam-notes">
              <li>This is an assessment — hints and solutions are withheld.</li>
              <li>Recent learner actions are recorded as local evidence (up to 2,000; no independent identity verification).</li>
              <li>When you submit, you'll get a result code to send back to your employer.</li>
              <li>Estimated time: ~{def.estMinutes} minutes.</li>
            </ul>
            <button className="btn primary block" onClick={() => setStarted(true)}>Begin assessment →</button>
          </div>
        </main>
      </>
    );
  }

  if (session) return <Suspense fallback={<main id="main" className="wrap wrap-wide page">
    <p role="status">Loading the 3D engineering workbench…</p></main>}>
    <SandboxPage key={`${session.scenarioId}:${session.seed}`} scenario={session} /></Suspense>;

  return (
    <>
      <AppHeader />
      <main id="main" className="wrap wrap-wide page">
        <ExercisePlayer
          key={`${assignment.exerciseId}:${assignment.seed}:${assignment.createdAt}`}
          def={exerciseDef!}
          initialMode="assessment"
          seed={assignment.seed}
          allowModeSwitch={false}
          allowReset={false}
          resultActions={(result: AttemptResult) => <ReturnCode result={result} originalAssignment={assignment} />}
        />
      </main>
    </>
  );
}

function ReturnCode({result,originalAssignment}:{result:AttemptResult;originalAssignment:Assignment}){
  // The exercise controller reconstructs a local session assignment. Preserve
  // the *issued* employer assignment identity, label, seed and createdAt in
  // the export so reviewers can at least compare the submitted code.
  const portable:AttemptResult={...result,assignment:originalAssignment};
  return (
    <div className="return-code">
      <p className="muted small">Send this locally generated result code back to your employer. Codes are unsigned and editable; they cannot prove who completed a task.</p>
      <CopyField label="Result code" value={encodeResult(portable)} textarea />
    </div>
  );
}
