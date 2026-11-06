import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { decodeAssignment, encodeResult } from '../platform/persistence';
import { getExercise } from '../trades/registry';
import type { Assignment, AttemptResult } from '../platform/types';
import { AppHeader } from '../ui/AppHeader';
import { CopyField } from '../ui/CopyField';
import { ExercisePlayer } from '../ui/ExercisePlayer';

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
    const onHash = () => setState(readAssignmentFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const def = useMemo(() => (assignment ? getExercise(assignment.exerciseId) : undefined), [assignment]);

  const loadManual = () => {
    try {
      setState({ assignment: decodeAssignment(manual) });
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

  if (!def) {
    return (
      <>
        <AppHeader />
        <main id="main" className="wrap page narrow">
          <h1 className="page-title">This task isn't available</h1>
          <p className="sub">The assignment refers to an exercise this version doesn't have (<code>{assignment.exerciseId}</code>).</p>
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
              <li>Every action you take is recorded as evidence.</li>
              <li>When you submit, you'll get a result code to send back to your employer.</li>
              <li>Estimated time: ~{def.estMinutes} minutes.</li>
            </ul>
            <button className="btn primary block" onClick={() => setStarted(true)}>Begin assessment →</button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main id="main" className="wrap wrap-wide page">
        <ExercisePlayer
          def={def}
          initialMode="assessment"
          seed={assignment.seed}
          allowModeSwitch={false}
          allowReset={false}
          resultActions={(result: AttemptResult) => <ReturnCode result={result} />}
        />
      </main>
    </>
  );
}

function ReturnCode({ result }: { result: AttemptResult }) {
  return (
    <div className="return-code">
      <p className="muted small">Send this result code back to your employer:</p>
      <CopyField label="Result code" value={encodeResult(result)} textarea />
    </div>
  );
}
