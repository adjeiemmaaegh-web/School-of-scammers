import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { decodeAssignment, encodeResult } from '../platform/persistence';
import { isIssuedAssessmentCompatible, preserveIssuedAssignment } from '../platform/assessment-integrity';
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
    // Opening a different assignment must show its exam introduction again,
    // never inherit the previous candidate's 'started' state.
    const onHash = () => { setState(readAssignmentFromHash()); setStarted(false); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const exerciseDef = useMemo(() => (assignment ? getExercise(assignment.exerciseId) : undefined), [assignment]);
  const scenarioDef = useMemo(() => (assignment ? getScenarioMeta(assignment.exerciseId) : undefined), [assignment]);
  const def = exerciseDef ?? scenarioDef;
  const assignmentMatches = isIssuedAssessmentCompatible(assignment, def);
  const session = useMemo<ScenarioRequest | null>(() => (assignmentMatches && assignment && scenarioDef ? {
    scenarioId: scenarioDef.id, mode: 'assessment', seed: assignment.seed, allowRestart: false, assignment,
    resultActions: (result: AttemptResult) => <ReturnCode result={result} originalAssignment={assignment!} />,
  } : null), [assignmentMatches, assignment, scenarioDef]);

  const loadManual = () => {
    try {
      setState({ assignment: decodeAssignment(manual) });
      setStarted(false);
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

  if (!assignmentMatches || !def) {
    return (
      <>
        <AppHeader />
        <main id="main" className="wrap page narrow">
          <h1 className="page-title">This task isn't available</h1>
          <p className="sub">The assigned exercise, trade, mode or version does not match this build (<code>{assignment.exerciseId}</code>, version {assignment.exerciseVersion}). Request a compatible assignment.</p>
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
              <li>Recent learner actions are recorded as local evidence (up to 400); no independent identity verification.</li>
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
    <SandboxPage key={`${session.scenarioId}:${session.seed}:${assignment.createdAt}`} scenario={session} /></Suspense>;

  return (
    <>
      <AppHeader />
      <main id="main" className="wrap wrap-wide page">
        <ExercisePlayer
          key={`${assignment.exerciseId}:${assignment.exerciseVersion}:${assignment.seed}:${assignment.createdAt}`}
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

function ReturnCode({ result, originalAssignment }: { result: AttemptResult; originalAssignment: Assignment }) {
  const portableResult = preserveIssuedAssignment(result, originalAssignment);
  return (
    <div className="return-code">
      <p className="muted small">Send this locally generated result code to your employer. Offline codes are unsigned and can be edited; they do not prove identity or certification.</p>
      <CopyField label="Result code" value={encodeResult(portableResult)} textarea />
    </div>
  );
}
