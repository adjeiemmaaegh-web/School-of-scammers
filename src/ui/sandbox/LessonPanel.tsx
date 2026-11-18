import { useState } from 'react';
import { LESSONS, gradeLesson, lessonById, starterProject, type LessonResult } from '../../exercises/lessons';
import type { ProjectFile } from '../../sim/signals';

type Props = { project: ProjectFile; editable: boolean; canStart: boolean; onStart: (title: string, starter: ProjectFile) => Promise<boolean> };

/** Guided lessons (R9.3-R9.5): start an unwired starter, build it, then check the outcome through the real simulator. */
export function LessonPanel({ project, editable, canStart, onStart }: Props) {
  const [id, setId] = useState(LESSONS[0].id);
  const [result, setResult] = useState<LessonResult | null>(null);
  const lesson = lessonById(id)!;
  return <section className="ux6-lesson" aria-label="Guided lessons" data-lesson-panel>
    <h4>Guided lessons</h4>
    <label>Lesson
      <select data-lesson-select value={id} onChange={e => { setId(e.target.value); setResult(null); }}>
        {LESSONS.map(l => <option key={l.id} value={l.id}>{l.title} ({l.level})</option>)}
      </select>
    </label>
    <p>{lesson.summary}</p>
    <ul>{lesson.objectives.map(o => <li key={o}>{o}</li>)}</ul>
    <details><summary>Hints</summary><ul>{lesson.hints.map(h => <li key={h}>{h}</li>)}</ul></details>
    <div className="ux6-lesson-actions">
      <button type="button" className="btn ghost small" data-lesson-start disabled={!canStart || !editable}
        title={!canStart ? 'Needs the project library (not available in this browser mode).' : !editable ? 'Pause the simulation first.' : 'Opens the unwired starter parts as a new project; your current project stays in the library.'}
        onClick={() => { setResult(null); void onStart(lesson.title, starterProject(lesson)); }}>Start this lesson (new project)</button>
      <button type="button" className="btn primary small" data-lesson-check onClick={() => setResult(gradeLesson(lesson, project))}>Check my work</button>
    </div>
    {result && <div className="ux6-lesson-result" role="status" data-lesson-result={result.passed ? 'passed' : 'failed'}>
      <strong>{result.passed ? 'All checks passed.' : 'Not yet.'}</strong>
      <ul>{result.results.map(r => <li key={r.label} data-lesson-check-result={r.passed ? 'pass' : 'fail'}>{r.passed ? '✓' : '✗'} {r.label}{r.passed ? '' : `: ${r.reason}`}</li>)}</ul>
      <small>Checked by running your project through the simulator; passing is about what it does, not how you built it. Self-reported local practice, not a certificate.</small>
    </div>}
  </section>;
}
