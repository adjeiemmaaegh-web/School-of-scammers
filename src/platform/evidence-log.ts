/** Bounded action history for locally simulated exercises.
 * Keep this at or below the exported result-code validator's 400-event limit.
 * Discard oldest evidence deterministically; preserve its original sequence index.
 */
import type { EvidenceEvent } from './types';
export const MAX_EVIDENCE_EVENTS = 400;

export function appendBoundedEvidence(
  previous: readonly EvidenceEvent[],
  event: Pick<EvidenceEvent, 'action' | 'detail' | 'accepted'> | undefined,
  at: number,
): EvidenceEvent[] {
  if (!event) return previous as EvidenceEvent[];
  const entry: EvidenceEvent = {
    index: (previous[previous.length - 1]?.index ?? 0) + 1,
    at: Math.max(0, Math.floor(Number.isFinite(at) ? at : 0)),
    action: event.action.slice(0, 80) || 'event',
    detail: event.detail.slice(0, 1000) || 'No details',
    accepted: event.accepted,
  };
  const updated = [...previous, entry];
  return updated.length > MAX_EVIDENCE_EVENTS ? updated.slice(-MAX_EVIDENCE_EVENTS) : updated;
}
