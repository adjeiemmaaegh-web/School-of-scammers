import type { Criterion, EvidenceEvent, RubricResult } from '../platform/types';
import type { ProjectFile } from '../sim/signals';
import { parseRepairDetail } from '../sim/faults';
import type { GradeContext, ScenarioDefinition } from './types';

export interface GradedCheck extends Criterion { pass: boolean }
export interface ScenarioGrade { rubric: RubricResult; checks: GradedCheck[] }

/**
 * Grade a finished (or in-progress) attempt. A check that throws counts as failed with the error as
 * its reason, so a malformed project can never crash grading or award accidental points.
 */
export function gradeScenario(
  def: ScenarioDefinition, project: ProjectFile, evidence: readonly EvidenceEvent[], seed: number,
): ScenarioGrade {
  const ctx: GradeContext = { project, starter: def.starter(seed), evidence, seed };
  const checks = def.checks.map((check): GradedCheck => {
    let outcome: { pass: boolean; reason: string };
    try { outcome = check.run(ctx); }
    catch (e) { outcome = { pass: false, reason: `Could not be checked: ${e instanceof Error ? e.message : 'error'}` }; }
    return {
      id: check.id, label: check.label, max: check.max,
      earned: outcome.pass ? check.max : 0, reason: outcome.reason, pass: outcome.pass,
    };
  });
  const score = checks.reduce((n, c) => n + c.earned, 0);
  const max = checks.reduce((n, c) => n + c.max, 0);
  return {
    checks,
    rubric: {
      score, max, safetyHold: false,
      passed: max > 0 && score / max >= def.passMark &&
        def.checks.every((c, i) => !c.required || checks[i].pass),
      criteria: checks.map(({ pass: _pass, ...criterion }) => criterion),
    },
  };
}

/**
 * Devices and terminal-to-terminal connections as a stable string, used to prove the learner did not
 * rebuild or bypass the plant. Positions and wire ids are ignored, so moving a device or re-terminating
 * a conductor (a legitimate repair) does not change it.
 */
export const layoutSignature = (p: ProjectFile): string => JSON.stringify({
  c: p.components.map(c => `${c.id}:${c.kind}`).sort(),
  w: p.wires.map(w => [w.from, w.to].sort().join('|')).sort(),
});

/** Targets the learner replaced, in order, read from authoritative worker repair events. */
export const repairedTargets = (evidence: readonly EvidenceEvent[]): string[] =>
  evidence.filter(e => e.action === 'repair' && e.accepted)
    .map(e => parseRepairDetail(e.detail)).filter((t): t is string => t !== null);
