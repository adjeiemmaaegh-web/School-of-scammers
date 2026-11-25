/// <reference lib="webworker" />
import { createWorld, renderSnapshot, tick } from './orchestrator';
import type { RunRequest } from './assessment-handler';
import { haltedSimulationWorld } from './phases/fail-closed';
import { parseWorkerIngress, WorkerMailbox } from './worker-mailbox';
import { boundedWorkerEvents } from './event-stream';
import type { SimEvent, WorkerRequest, WorkerResponse, WorkerTiming } from './signals';
import { createTimingWindow, freshClock, isTimeScale, pumpClock, scanMsOf, scanTiming, type ClockState } from './scan-config';

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
let world = createWorld();
const mailbox = new WorkerMailbox();
function reject(message: string, requestId?: number): void {
  ctx.postMessage({ kind: 'snapshot', snapshot: { ...renderSnapshot(world), lastError: message },
    events: boundedWorkerEvents([{ tick: world.tick, kind: 'error', detail: message }]),
    ...(requestId === undefined ? {} : { requestId }) } satisfies WorkerResponse);
}

/** Pacing only: how fast model time passes against the wall clock. It never changes what a scan computes. */
let timeScale = 1;
let clock: ClockState = freshClock();
let lastPumpAt = performance.now();
let lastTimingAt = 0;
let behind = false;
const timingWindow = createTimingWindow(40);
/** Hard bounds so a slow computer degrades gracefully (the diagnostics report it) instead of freezing the page. */
const PUMP_MS = 10;
const MAX_SCANS_PER_PUMP = 50;
const PUMP_COMPUTE_BUDGET_MS = 40;

/** Runs `count` scans (the first one carries the queued commands) and posts ONE snapshot with every event produced. */
function dispatch(commands: Extract<WorkerRequest, { kind: 'commands' }>['commands'] = [], requestId?: number, requestIds?: number[], count = 1): number {
  const before = world.project;
  const events: SimEvent[] = [];
  let snapshot = renderSnapshot(world);
  let ran = 0;
  const started = performance.now();
  for (let i = 0; i < count; i++) {
    const t0 = performance.now();
    try {
      const result = tick(world, i === 0 ? commands : []);
      world = result.world;
      snapshot = result.snapshot;
      events.push(...result.events);
      ran++;
    } catch (error) {
      const message = 'Simulation tick failed: ' + (error instanceof Error ? error.message : 'unknown error');
      world = haltedSimulationWorld(world, message, 'Worker tick interrupted; simulated outputs deenergized', 30);
      snapshot = renderSnapshot(world);
      events.push({ tick: world.tick, kind: 'error', detail: message });
      break;
    }
    if (world.running) timingWindow.add(performance.now() - t0);
    // A halted/paused world stops consuming the backlog; so does an exhausted compute budget.
    if (!world.running || performance.now() - started > PUMP_COMPUTE_BUDGET_MS) break;
  }
  // tick() keeps the same project object when nothing was edited (tests/r3-project-identity.test.ts), so the full-project
  // JSON compare only runs when the object actually changed, not on every scan.
  const documentChanged = before !== world.project && JSON.stringify(before) !== JSON.stringify(world.project);
  const reply: WorkerResponse = { kind: 'snapshot', snapshot, events: boundedWorkerEvents(events),
    ...(requestId === undefined ? {} : { requestId }),
    ...(requestIds?.length ? { requestIds } : {}),
    ...(before !== world.project ? { project: world.project } : {}),
    ...(documentChanged ? { previousProject: before } : {}) };
  ctx.postMessage(reply);
  return ran;
}
function postTiming(force = false): void {
  const now = performance.now();
  if (!force && now - lastTimingAt < 250) return;
  lastTimingAt = now;
  const { mean, max } = timingWindow.stats();
  const timing: WorkerTiming = { kind: 'timing',
    timing: scanTiming(scanMsOf(world.project), timeScale, mean, max, clock.droppedScans, behind) };
  ctx.postMessage(timing);
}
/** P12 assessment requests: this same worker file runs as a FRESH instance for an assessment (isolated from the live sandbox world), and
 * the scene matrices load lazily so they never weigh on the sandbox's critical path. */
const isAssessment = (kind: unknown): boolean => typeof kind === 'string' && kind.startsWith('run-');
ctx.onmessage = (event: MessageEvent<WorkerRequest | RunRequest>) => {
  if (isAssessment((event.data as { kind?: unknown } | null)?.kind)) {
    const req = event.data as RunRequest;
    void import('./assessment-handler').then(m => { const reply = m.handleAssessment(req); if (reply) ctx.postMessage(reply); });
    return;
  }
  const data = event.data as WorkerRequest;
  if (data?.kind === 'timeScale') {
    if (isTimeScale(data.scale)) { timeScale = data.scale; clock = { ...clock, owedModelMs: 0 }; behind = false; postTiming(true); }
    return;
  }
  const parsed = parseWorkerIngress(data);
  if (!parsed.ok) { reject(parsed.error, parsed.requestId); return; }
  const packet = parsed.packet;
  // Priority Pause preserves accepted FIFO controls and does not wait for a slow clock.
  if (world.running && packet.commands.length === 1 && packet.commands[0].k === 'pause') {
    const batch = mailbox.takeWithPause(packet.requestId);
    dispatch(batch.commands, batch.requestIds.length === 1 ? batch.requestIds[0] : undefined,
      batch.requestIds.length > 1 ? batch.requestIds : undefined);
    clock = freshClock(); behind = false; postTiming(true);
    return;
  }
  if (world.running) {
    const error = mailbox.enqueue(packet);
    if (error) reject(error, packet.requestId);
  } else {
    dispatch(packet.commands, packet.requestId);
    clock = freshClock(); postTiming(true);
  }
};
ctx.postMessage({ kind: 'snapshot', snapshot: renderSnapshot(world), events: [], project: world.project } satisfies WorkerResponse);
setInterval(() => {
  const now = performance.now();
  const elapsed = Math.min(now - lastPumpAt, 250); // a suspended tab must not queue seconds of backlog
  lastPumpAt = now;
  if (!world.running) {
    clock = freshClock(); behind = false;
    if (mailbox.hasPending) {
      const { commands, requestIds: ids } = mailbox.take();
      dispatch(commands, ids.length === 1 ? ids[0] : undefined, ids.length > 1 ? ids : undefined);
    }
    return;
  }
  const pumped = pumpClock(clock, elapsed, scanMsOf(world.project), timeScale, MAX_SCANS_PER_PUMP);
  clock = pumped.state;
  behind = pumped.behind;
  // Queued edits wait for the next DUE scan: they never insert an extra scan, so PLC timing is identical at every speed.
  if (pumped.scans > 0) {
    const { commands, requestIds: ids } = mailbox.take();
    const ran = dispatch(commands, ids.length === 1 ? ids[0] : undefined,
      ids.length > 1 ? ids : undefined, pumped.scans);
    if (ran < pumped.scans) { clock = { ...clock, droppedScans: clock.droppedScans + (pumped.scans - ran) }; behind = true; }
    postTiming();
  }
}, PUMP_MS);
