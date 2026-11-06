import { useCallback, useState } from 'react';
import type { AttemptResult, ExerciseDefinition, ExerciseMode } from '../platform/types';
import { useExercise } from '../platform/exercise-runtime';
import { RubricReport } from './RubricReport';

export interface ExercisePlayerProps {
  def: ExerciseDefinition<any, any>;
  initialMode?: ExerciseMode;
  seed?: number;
  /** Learner can switch modes & reset. Candidate (assessment) cannot. */
  allowModeSwitch?: boolean;
  allowReset?: boolean;
  /** Called when the attempt is submitted (e.g. to record progress or export). */
  onSubmitted?: (result: AttemptResult) => void;
  /** Extra actions to show in the result panel (e.g. export for candidates). */
  resultActions?: (result: AttemptResult) => React.ReactNode;
}

export function ExercisePlayer({
  def,
  initialMode = 'learning',
  seed = 1,
  allowModeSwitch = true,
  allowReset = true,
  onSubmitted,
  resultActions,
}: ExercisePlayerProps) {
  const [mode, setMode] = useState<ExerciseMode>(initialMode);
  const [hintsOpen, setHintsOpen] = useState(false);
  // Re-mount the controller when mode changes so state resets cleanly.
  return (
    <ExercisePlayerInner
      key={mode}
      def={def}
      mode={mode}
      seed={seed}
      hintsOpen={hintsOpen}
      setHintsOpen={setHintsOpen}
      allowModeSwitch={allowModeSwitch}
      allowReset={allowReset}
      onModeChange={setMode}
      onSubmitted={onSubmitted}
      resultActions={resultActions}
    />
  );
}

function ExercisePlayerInner({
  def,
  mode,
  seed,
  hintsOpen,
  setHintsOpen,
  allowModeSwitch,
  allowReset,
  onModeChange,
  onSubmitted,
  resultActions,
}: {
  def: ExerciseDefinition<any, any>;
  mode: ExerciseMode;
  seed: number;
  hintsOpen: boolean;
  setHintsOpen: (v: boolean) => void;
  allowModeSwitch: boolean;
  allowReset: boolean;
  onModeChange: (m: ExerciseMode) => void;
  onSubmitted?: (result: AttemptResult) => void;
  resultActions?: (result: AttemptResult) => React.ReactNode;
}) {
  const ctl = useExercise(def, mode, seed);
  const Play = def.Play;

  const handleSubmit = useCallback(() => {
    const result = ctl.submit();
    onSubmitted?.(result);
  }, [ctl, onSubmitted]);

  return (
    <div className="exercise-shell">
      <div className="exercise-bar">
        <div className="exercise-ident">
          <span className="rank-badge">R{def.rank}</span>
          <h1>{def.title}</h1>
        </div>
        <div className="exercise-tools">
          {allowModeSwitch && (
            <div className="mode-switch" role="group" aria-label="Mode">
              <button
                className={mode === 'learning' ? 'on' : ''}
                onClick={() => onModeChange('learning')}
                disabled={ctl.submitted}
              >
                Learning
              </button>
              <button
                className={mode === 'assessment' ? 'on' : ''}
                onClick={() => onModeChange('assessment')}
                disabled={ctl.submitted}
              >
                Assessment
              </button>
            </div>
          )}
          {!allowModeSwitch && (
            <span className={`status-pill ${mode === 'assessment' ? 'is-crit' : 'is-idle'}`}>
              {mode === 'assessment' ? 'Assessment · exam conditions' : 'Learning'}
            </span>
          )}
          {allowReset && (
            <button className="btn ghost small" onClick={ctl.reset}>Reset</button>
          )}
        </div>
      </div>

      <div className="exercise-grid">
        <section className="exercise-main" aria-label="Simulation">
          <Play state={ctl.state} mode={mode} dispatch={ctl.dispatch} objectives={ctl.objectives} />
        </section>

        <aside className="exercise-side">
          <div className="panel brief">
            <span className="panel-eyebrow">Work order</span>
            <p>{def.scenario}</p>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-eyebrow">Objectives</span>
              <span className="tabular muted">{ctl.objectivesComplete}/{ctl.objectivesTotal}</span>
            </div>
            <ul className="objective-list">
              {def.objectives.map((o) => {
                const done = ctl.objectives[o.id];
                return (
                  <li key={o.id} className={done ? 'done' : ''}>
                    <span className="obj-box" aria-hidden="true">{done ? '✓' : ''}</span>
                    {o.label}
                  </li>
                );
              })}
            </ul>
          </div>

          {mode === 'learning' && def.hints.length > 0 && (
            <div className="panel">
              <button className="hints-toggle" onClick={() => setHintsOpen(!hintsOpen)} aria-expanded={hintsOpen}>
                <span className="panel-eyebrow">Hints</span>
                <span>{hintsOpen ? '−' : '+'}</span>
              </button>
              {hintsOpen && (
                <ol className="hint-list">
                  {def.hints.map((h, i) => <li key={i}>{h}</li>)}
                </ol>
              )}
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <span className="panel-eyebrow">Evidence trail</span>
              <span className="tabular muted">{ctl.evidence.length}</span>
            </div>
            <div className="evidence-log" aria-live="polite">
              {ctl.evidence.length === 0 ? (
                <p className="muted small">No actions recorded yet.</p>
              ) : (
                ctl.evidence.slice().reverse().map((e) => (
                  <div key={e.index} className={`evidence-row ${e.accepted ? '' : 'rejected'}`}>
                    <code>#{e.index} {e.action}</code>
                    <p>{e.detail}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {!ctl.submitted ? (
            <button className="btn primary block" onClick={handleSubmit}>
              {mode === 'assessment' ? 'Submit for assessment →' : 'Submit attempt →'}
            </button>
          ) : (
            ctl.result && (
              <RubricReport
                result={ctl.result}
                mode={mode}
                onRetry={allowReset ? ctl.reset : undefined}
                actions={resultActions?.(ctl.result)}
              />
            )
          )}
        </aside>
      </div>
    </div>
  );
}
