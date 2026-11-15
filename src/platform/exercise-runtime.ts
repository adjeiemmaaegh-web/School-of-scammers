/**
 * The exercise runtime: a React hook that plays one exercise definition.
 *
 * Responsibilities:
 *  - hold the simulation state and apply the exercise's pure `reduce`
 *  - capture an evidence trail (every dispatched action, timestamped)
 *  - expose live objective completion
 *  - freeze and grade on submit (produces an AttemptResult)
 *  - reset (allowed in learning mode; disabled after submit in assessment)
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { appendBoundedEvidence } from './evidence-log';
import type {
  AttemptResult,
  EvidenceEvent,
  ExerciseDefinition,
  ExerciseMode,
  RubricResult,
} from './types';

export interface ExerciseController<S, A> {
  state: S;
  mode: ExerciseMode;
  seed: number;
  evidence: EvidenceEvent[];
  objectives: Record<string, boolean>;
  objectivesComplete: number;
  objectivesTotal: number;
  submitted: boolean;
  /** Preview of the current grade (live); becomes final on submit. */
  liveResult: RubricResult;
  /** The frozen result after submit, else null. */
  result: AttemptResult | null;
  dispatch: (action: A) => void;
  submit: () => AttemptResult;
  reset: () => void;
}

export function useExercise<S, A>(
  def: ExerciseDefinition<S, A>,
  mode: ExerciseMode,
  seed = 1,
): ExerciseController<S, A> {
  const startRef = useRef<number>(Date.now());
  // Keep the simulation state and its evidence in one pure updater: React may replay
  // state updaters during development. A nested state setter could double-log actions.
  const [session, setSession] = useState<{ state: S; evidence: EvidenceEvent[] }>(() => ({
    state: def.init(seed), evidence: [],
  }));
  const { state, evidence } = session;
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const dispatch = useCallback(
    (action: A) => {
      if (submitted) return;
      const elapsedMs = Math.max(0, Date.now() - startRef.current);
      setSession((prev) => {
        const { next, event } = def.reduce(prev.state, action);
        return { state: next, evidence: appendBoundedEvidence(prev.evidence, event, elapsedMs) };
      });
    },
    [def, submitted],
  );

  const objectives = useMemo(() => def.objectiveStatus(state), [def, state]);
  const objectiveEntries = Object.values(objectives);
  const objectivesComplete = objectiveEntries.filter(Boolean).length;
  const objectivesTotal = objectiveEntries.length;

  const liveResult = useMemo(() => def.evaluate(state), [def, state]);

  const submit = useCallback((): AttemptResult => {
    const finishedAt = Date.now();
    const rubric = def.evaluate(state);
    const attempt: AttemptResult = {
      kind: 'skills-lab-result',
      formatVersion: 1,
      assignment: {
        kind: 'skills-lab-assignment',
        formatVersion: 1,
        trade: def.trade,
        exerciseId: def.id,
        exerciseVersion: def.version,
        mode,
        seed,
        createdAt: new Date(startRef.current).toISOString(),
      },
      startedAt: new Date(startRef.current).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      durationMs: finishedAt - startRef.current,
      evidence,
      rubric,
    };
    setSubmitted(true);
    setResult(attempt);
    return attempt;
  }, [def, state, mode, seed, evidence]);

  const reset = useCallback(() => {
    startRef.current = Date.now();
    setSession({ state: def.init(seed), evidence: [] });
    setSubmitted(false);
    setResult(null);
  }, [def, seed]);

  return {
    state,
    mode,
    seed,
    evidence,
    objectives,
    objectivesComplete,
    objectivesTotal,
    submitted,
    liveResult,
    result,
    dispatch,
    submit,
    reset,
  };
}
