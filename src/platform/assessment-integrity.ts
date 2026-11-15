/** Pure boundaries for candidate-facing offline assessments. These codes remain unsigned. */
import type { Assignment, AttemptResult } from './types';

type ExerciseIdentity = { id: string; trade: string; version: string };

export function isIssuedAssessmentCompatible(
  assignment: Assignment | undefined | null,
  definition: ExerciseIdentity | undefined | null,
): boolean {
  return !!assignment && !!definition &&
    assignment.mode === 'assessment' &&
    assignment.exerciseId === definition.id &&
    assignment.trade === definition.trade &&
    assignment.exerciseVersion === definition.version;
}

/** The exercise controller may reconstruct a fresh local assignment at submit.
 * Echo the actual issued assignment so reviewers can compare its identity fields.
 * Reject mismatched attempts instead of silently relabelling their results.
 */
export function preserveIssuedAssignment(result: AttemptResult, issued: Assignment): AttemptResult {
  const actual = result.assignment;
  if (!isIssuedAssessmentCompatible(issued, {
    id: actual.exerciseId, trade: actual.trade, version: actual.exerciseVersion,
  }) || actual.mode !== 'assessment' || actual.seed !== issued.seed) {
    throw new Error('Attempt does not match the issued assessment');
  }
  return { ...result, assignment: { ...issued } };
}
