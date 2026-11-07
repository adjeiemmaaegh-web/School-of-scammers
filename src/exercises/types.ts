/**
 * P6 — scenario exercises that run on the real sandbox engine.
 *
 * A scenario is NOT a bespoke state machine. It is a starter `ProjectFile` (what is already placed,
 * wired, programmed or faulted) plus a set of outcome `checks`. Grading loads the learner's final
 * project into a fresh headless world, drives it with scripted operator actions and plant events,
 * and measures what actually happened. Any wiring or logic that produces the required behaviour
 * passes (multi-solution grading); nothing compares against a model answer.
 *
 * Pure and DOM-free: no Date, no Math.random — the same project and evidence always grade the same.
 */
import type { EvidenceEvent, Objective, Rank, TradeId } from '../platform/types';
import type { ProjectFile } from '../sim/signals';

export interface GradeContext {
  /** The learner's final project (placed devices, wires, program, remaining faults). */
  project: ProjectFile;
  /** The project exactly as the scenario handed it out for this seed. */
  starter: ProjectFile;
  /** Recorded actions of the attempt (see `evidenceFromCommand`). */
  evidence: readonly EvidenceEvent[];
  seed: number;
}

export interface CheckOutcome { pass: boolean; reason: string }

/** One graded outcome. Pass earns `max`, fail earns 0 — behaviour either happens or it does not. */
export interface ScenarioCheck {
  id: string;
  label: string;
  max: number;
  /** A required check must pass for the attempt to pass, however many points are earned elsewhere. */
  required?: boolean;
  run: (ctx: GradeContext) => CheckOutcome;
}

export interface ScenarioDefinition {
  id: string;
  trade: TradeId;
  /** Difficulty on the shared 1..10 ladder. */
  rank: Rank;
  version: string;
  title: string;
  estMinutes: number;
  summary: string;
  /** Work-order-style brief shown beside the workbench. */
  scenario: string;
  hints: string[];
  /** What the learner starts with. `seed` picks variants (e.g. which fault). */
  starter: (seed: number) => ProjectFile;
  checks: ScenarioCheck[];
  /** Fraction of the maximum score needed to pass. */
  passMark: number;
  /** True when the learner must use the multimeter / replace-a-part loop (troubleshooting). */
  troubleshooting?: boolean;
}

export const scenarioObjectives = (def: ScenarioDefinition): Objective[] =>
  def.checks.map(c => ({ id: c.id, label: c.label }));
