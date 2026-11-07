import type { ReactNode } from 'react';
import type { Assignment, AttemptResult, ExerciseMode } from '../platform/types';
import type { ScenarioDefinition } from './types';

/**
 * What a page passes to the workbench to host one scenario attempt. It names the scenario by id
 * only: the workbench chunk resolves the full definition (starter, checks), so pages that merely
 * link to a scenario never pull the simulator and grader into the landing bundle.
 */
export interface ScenarioRequest {
  scenarioId: string;
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

/** A request resolved against the catalogue (workbench-internal). */
export interface ScenarioSession extends Omit<ScenarioRequest, 'scenarioId'> {
  def: ScenarioDefinition;
}

/** Browser-local storage key for one attempt, so a reload resumes it. */
export const scenarioStorageKey = (s: Pick<ScenarioSession, 'def' | 'mode' | 'seed'>): string =>
  `efo-scenario-v1:${s.def.id}:${s.mode}:${s.seed}`;
