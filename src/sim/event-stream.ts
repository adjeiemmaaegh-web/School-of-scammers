/** R3.6 — Bounded, pure worker-to-UI simulation event stream.
 *
 * The authoritative tick() retains full event causality for its own step.
 * This adapter limits only the outgoing display/diagnostic payload, preserving
 * the newest events and explicitly stating how many older events were omitted.
 * No wall clock, project persistence, or simulation state mutation.
 */
import type { SimEvent } from './signals';

export const MAX_WORKER_REPLY_EVENTS = 256;
export const MAX_WORKER_EVENT_DETAIL_CHARS = 512;

/** Every reply stays bounded even if a large scene emits many events in one scan. */
export function boundedWorkerEvents(events: readonly SimEvent[]): SimEvent[] {
  // Keep one slot for the overflow notice when events exceed the limit.
  const omitted = Math.max(0, events.length - (MAX_WORKER_REPLY_EVENTS - 1));
  const retained = omitted > 0 ? events.slice(-MAX_WORKER_REPLY_EVENTS + 1) : events;
  const trimmed = retained.map(e => ({
    ...e,
    detail: e.detail.length > MAX_WORKER_EVENT_DETAIL_CHARS
      ? e.detail.slice(0, MAX_WORKER_EVENT_DETAIL_CHARS - 3) + '...'
      : e.detail,
  }));
  if (omitted === 0) return trimmed;
  const firstTick = retained[0]?.tick ?? events[0]?.tick ?? 0;
  return [{ tick: firstTick, kind: 'event-overflow',
    detail: omitted + ' earlier simulation events omitted from this worker reply' }, ...trimmed];
}
