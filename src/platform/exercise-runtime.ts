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
  // State and its evidence must commit atomically: calling setEvidence from
  // inside a setState updater is an impure React update. StrictMode can replay
  // that updater and append duplicate assessed actions for one real click.
  const [session, setSession] = useState<{state:S;evidence:EvidenceEvent[]}>(() =>
    ({state:def.init(seed),evidence:[]}));
  const {state,evidence}=session;
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const dispatch = useCallback(
    (action: A) => {
      if (submitted) return;
      const at=Math.max(0,Date.now()-startRef.current);
      setSession(prev=>{
        const {next,event}=def.reduce(prev.state,action);
        if(!event)return {state:next,evidence:prev.evidence};
        const log=prev.evidence;
        const entry:EvidenceEvent={
          index:(log.at(-1)?.index??0)+1,at,
          action:event.action,detail:event.detail,accepted:event.accepted,
        };
        const combined=[...log,entry];
        // Prevent unlimited DOM/JSON growth in long-lived local-only sessions.
        // The index remains monotonic even after older entries are evicted.
        return {state:next,evidence:combined.length>2000?
          combined.slice(-2000):combined};
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
    setSession({state:def.init(seed),evidence:[]});
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
