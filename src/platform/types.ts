/**
 * Core platform contracts shared by every trade.
 *
 * Design intent (see docs/product/PRD.md):
 *  - An *exercise* is the atomic unit shared by both audiences (learner + employer).
 *  - The same exercise definition runs in two modes: `learning` and `assessment`.
 *  - Exercise definitions live in code (inside a trade module). The only things
 *    that cross the wire / get stored are an `Assignment` (which exercise, mode,
 *    seed) and a `Result` (evidence + rubric) — both fully serializable.
 *  - Difficulty is a first-class 1..10 ladder.
 */
import type { ComponentType } from 'react';

export type TradeId = 'plc' | 'cctv' | 'bms' | 'phone-pc' | 'electronics';

export type ExerciseMode = 'learning' | 'assessment';

/** 1 (entry) .. 10 (expert) — the shared difficulty ladder. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface TradeMeta {
  id: TradeId;
  name: string;
  blurb: string;
  status: 'available' | 'coming-soon';
}

export interface Objective {
  id: string;
  label: string;
}

export interface Criterion {
  id: string;
  label: string;
  max: number;
  earned: number;
  reason: string;
}

export interface RubricResult {
  score: number;
  max: number;
  passed: boolean;
  /** True when a critical safety violation holds the result regardless of score. */
  safetyHold: boolean;
  criteria: Criterion[];
}

/** One recorded action in the evidence trail. */
export interface EvidenceEvent {
  index: number;
  /** ms since the attempt started. */
  at: number;
  action: string;
  detail: string;
  accepted: boolean;
}

/** What a `reduce` returns: the next state plus an optional event to record. */
export interface ReduceResult<S> {
  next: S;
  event?: { action: string; detail: string; accepted: boolean };
}

/**
 * The interactive surface of an exercise. Each exercise ships a component that
 * renders its own simulation and dispatches exercise-specific actions.
 */
export interface ExercisePlayProps<S, A> {
  state: S;
  mode: ExerciseMode;
  dispatch: (action: A) => void;
  objectives: Record<string, boolean>;
}

/**
 * A complete exercise. Generic over its simulation state `S` and action type `A`.
 * Functions are pure so the runtime can record evidence and grade deterministically.
 */
export interface ExerciseDefinition<S = unknown, A = unknown> {
  id: string;
  trade: TradeId;
  rank: Rank;
  version: string;
  title: string;
  estMinutes: number;
  /** One-line summary for cards. */
  summary: string;
  /** Work-order-style scenario brief (can contain line breaks). */
  scenario: string;
  objectives: Objective[];
  /** Hints shown in learning mode only. */
  hints: string[];
  /** Create the initial simulation state. `seed` enables future seeded variants. */
  init: (seed: number) => S;
  /** Pure transition. Returns next state and an optional event to record. */
  reduce: (state: S, action: A) => ReduceResult<S>;
  /** Live objective completion, keyed by objective id. */
  objectiveStatus: (state: S) => Record<string, boolean>;
  /** Grade the (final) state. */
  evaluate: (state: S) => RubricResult;
  /** The interactive React component. */
  Play: ComponentType<ExercisePlayProps<S, A>>;
}

/** A ladder rung that is designed but not yet built. */
export interface PlannedExercise {
  rank: Rank;
  title: string;
  summary: string;
  estMinutes?: number;
}

export interface TradeModule {
  meta: TradeMeta;
  /** Built, playable exercises — ideally one per rank 1..10. */
  exercises: ExerciseDefinition<any, any>[];
  /** Designed-but-not-built rungs, so the ladder shows the full 1..10. */
  planned?: PlannedExercise[];
}

/** A unified 1..10 ladder view: each rung is either playable or planned. */
export interface LadderRung {
  rank: Rank;
  title: string;
  summary: string;
  estMinutes?: number;
  def?: ExerciseDefinition<any, any>;
  status: 'playable' | 'planned';
}

/** Serializable: what an employer sends a candidate. */
export interface Assignment {
  kind: 'skills-lab-assignment';
  formatVersion: 1;
  trade: TradeId;
  exerciseId: string;
  exerciseVersion: string;
  mode: ExerciseMode;
  seed: number;
  /** Optional free-text label from the employer. */
  label?: string;
  createdAt: string;
}

/** Serializable: what a candidate returns to an employer. */
export interface AttemptResult {
  kind: 'skills-lab-result';
  formatVersion: 1;
  assignment: Assignment;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  evidence: EvidenceEvent[];
  rubric: RubricResult;
}
