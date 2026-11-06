import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTrade } from '../trades/registry';
import {
  assignmentLink,
  decodeResult,
  encodeAssignment,
} from '../platform/persistence';
import type { Assignment, AttemptResult } from '../platform/types';
import { AppHeader } from '../ui/AppHeader';
import { CopyField } from '../ui/CopyField';
import { RubricReport } from '../ui/RubricReport';

export function EmployerPage() {
  const plc = getTrade('plc');
  const playable = useMemo(() => plc?.exercises ?? [], [plc]);
  const [exerciseId, setExerciseId] = useState(playable[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [assignment, setAssignment] = useState<Assignment | null>(null);

  const createAssignment = () => {
    const def = playable.find((e) => e.id === exerciseId);
    if (!def) return;
    const a: Assignment = {
      kind: 'skills-lab-assignment',
      formatVersion: 1,
      trade: def.trade,
      exerciseId: def.id,
      exerciseVersion: def.version,
      mode: 'assessment',
      seed: Math.floor(Math.random() * 1_000_000) + 1,
      label: label.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    setAssignment(a);
  };

  return (
    <>
      <AppHeader />
      <main id="main" className="wrap page">
        <nav className="crumbs"><Link to="/">Home</Link><span>/</span><strong>Employer</strong></nav>
        <span className="eyebrow">For employers &amp; interviewers</span>
        <h1 className="page-title">Set up a practical test</h1>
        <p className="sub">Pick a realistic, ranked exercise and send it to a candidate. They complete it under exam conditions; you get back an evidence-backed result to review below.</p>

        <div className="employer-grid">
          <div className="card">
            <h2 className="card-title">1 · Build the assignment</h2>
            <label className="field">
              <span>Exercise</span>
              <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
                {playable.map((e) => (
                  <option key={e.id} value={e.id}>Rank {e.rank} — {e.title}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Label (optional)</span>
              <input
                type="text"
                value={label}
                placeholder="e.g. Maintenance tech — final round"
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <button className="btn primary" onClick={createAssignment}>Generate assignment</button>
            <p className="muted small">A fixed random seed is baked in so every candidate gets the same conditions. No accounts required in this version — results come back as a code the candidate sends you.</p>
          </div>

          <div className="card">
            <h2 className="card-title">2 · Send it to the candidate</h2>
            {assignment ? (
              <>
                <p className="muted small">Share this link (or the code) with your candidate:</p>
                <CopyField label="Assignment link" value={assignmentLink(assignment)} />
                <CopyField label="Assignment code" value={encodeAssignment(assignment)} textarea />
              </>
            ) : (
              <p className="muted">Generate an assignment to get a shareable link and code.</p>
            )}
          </div>
        </div>

        <ReviewResult />
      </main>
    </>
  );
}

function ReviewResult() {
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState('');

  const review = () => {
    setError('');
    setResult(null);
    try {
      setResult(decodeResult(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that result code.');
    }
  };

  return (
    <div className="card review-card">
      <h2 className="card-title">3 · Review a returned result</h2>
      <p className="muted small">Paste the result code your candidate sends back:</p>
      <textarea
        className="code-input"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Paste result code here…"
        rows={3}
      />
      <button className="btn ghost" onClick={review} disabled={!raw.trim()}>Review result</button>
      {error && <p className="field-error">{error}</p>}
      {result && (
        <div className="review-out">
          <p className="muted small">
            {result.assignment.label ? `“${result.assignment.label}” · ` : ''}
            Exercise {result.assignment.exerciseId} · completed {new Date(result.finishedAt).toLocaleString()}
          </p>
          <RubricReport result={result} mode="assessment" />
        </div>
      )}
    </div>
  );
}
