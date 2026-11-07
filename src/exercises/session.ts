import type { ReactNode } from 'react';
import type { Assignment, AttemptResult, ExerciseMode } from '../platform/types';
import type { ScenarioDefinition } from './types';

/** Everything the workbench needs to host one scenario attempt. */
export interface ScenarioSession {
  def: ScenarioDefinition;
  mode: ExerciseMode;
  seed: number;
  /** Learner can start over (practice); candidates under exam conditions cannot. */
  allowRestart: boolean;
  /** The employer's assignment, echoed into the result so the employer can match it. */
  assignment?: Assignment;
  /** Practice only: the page re-rolls the seed and remounts, giving a fresh variant. */
  onRestart?: () => void;
  onSubmitted?: (result: AttemptResult) => void;
  resultActions?: (result: AttemptResult) => ReactNode;
}

/** Browser-local storage key for one attempt, so a reload resumes it. */
export const scenarioStorageKey = (s: Pick<ScenarioSession, 'def' | 'mode' | 'seed'>): string =>
  `efo-scenario-v1:${s.def.id}:${s.mode}:${s.seed}`;
