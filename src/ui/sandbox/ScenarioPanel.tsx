import { useMemo, useState } from 'react';
import type { AttemptResult, EvidenceEvent } from '../../platform/types';
import { gradeScenario, scenarioObjectives, type GradedCheck } from '../../exercises';
import type { ScenarioSession } from '../../exercises/session';
import type { ProjectFile } from '../../sim/signals';
import { RubricReport } from '../RubricReport';

type Props = {
  session: ScenarioSession;
  project: ProjectFile | null;
  evidence: readonly EvidenceEvent[];
  result: AttemptResult | null;
  onSubmit: (rubric: AttemptResult['rubric']) => void;
  onRestart: () => void;
};

/**
 * The work order beside the workbench: brief, objectives, hints (practice only), a "check my work"
 * that grades the CURRENT project headlessly, and submit. The scenario never touches the simulator;
 * grading replays the project through the same tick() and reports what actually happened.
 */
export function ScenarioPanel({ session, project, evidence, result, onSubmit, onRestart }: Props) {
  const { def, mode } = session;
  const [checked, setChecked] = useState<GradedCheck[] | null>(null);
  const [hintsOpen, setHintsOpen] = useState(false);
  const objectives = useMemo(() => scenarioObjectives(def), [def]);
  const practice = mode === 'learning';
  const byId = new Map((checked ?? []).map(c => [c.id, c]));
  const check = () => { if (project) setChecked(gradeScenario(def, project, evidence, session.seed).checks); };
  const submit = () => { if (project) onSubmit(gradeScenario(def, project, evidence, session.seed).rubric); };

  return <section className="sandbox-scenario panel" aria-label="Work order" data-scenario={def.id} data-scenario-mode={mode}>
    <div className="sandbox-section-head">
      <div><span className="eyebrow">{practice ? 'Practice scenario' : 'Assessment · exam conditions'} · Rank {def.rank}</span>
        <h2>{def.title}</h2></div>
      <span className={`status-pill ${practice ? 'is-idle' : 'is-crit'}`}>
        {practice ? 'Learning' : 'Assessment'}</span>
    </div>
    <div className="sandbox-scenario-grid">
      <div>
        <p className="sandbox-scenario-brief">{def.scenario}</p>
        {!practice && <ul className="exam-notes">
          <li>Hints and per-objective feedback are withheld until you submit.</li>
          <li>Your actions are recorded as evidence. The result code you send back contains it.</li>
          <li>Progress is kept in this browser, so a reload resumes your attempt.</li>
        </ul>}
        {practice && def.hints.length > 0 && <div>
          <button type="button" className="btn ghost small" aria-expanded={hintsOpen}
            onClick={() => setHintsOpen(v => !v)}>{hintsOpen ? 'Hide hints' : 'Show hints'}</button>
          {hintsOpen && <ol className="hint-list">{def.hints.map((h, i) => <li key={i}>{h}</li>)}</ol>}
        </div>}
      </div>
      <div>
        <h3>Objectives</h3>
        <ul className="objective-list" data-objectives>
          {objectives.map(o => {
            const c = byId.get(o.id);
            return <li key={o.id} className={c?.pass ? 'done' : ''} data-objective={o.id}
              data-objective-state={!practice || !c ? 'unchecked' : c.pass ? 'pass' : 'fail'}>
              <span className="obj-box" aria-hidden="true">{practice && c ? (c.pass ? '✓' : '✗') : ''}</span>
              <span>{o.label}{practice && c && !c.pass && <small className="sandbox-scenario-reason"> — {c.reason}</small>}</span>
            </li>;
          })}
        </ul>
        {!result && <div className="sandbox-actions">
          {practice && <button type="button" className="btn ghost small" data-scenario-check
            disabled={!project} onClick={check}>Check my work</button>}
          <button type="button" className="btn primary small" data-scenario-submit
            disabled={!project} onClick={submit}>
            {practice ? 'Submit attempt →' : 'Submit for assessment →'}</button>
          {session.allowRestart && <button type="button" className="btn ghost small" data-scenario-restart
            onClick={() => { setChecked(null); onRestart(); }}>Start over</button>}
        </div>}
      </div>
    </div>
    {result && <div data-scenario-result>
      <RubricReport result={result} mode={mode}
        onRetry={session.allowRestart ? () => { setChecked(null); onRestart(); } : undefined}
        actions={session.resultActions?.(result)} />
    </div>}
  </section>;
}
