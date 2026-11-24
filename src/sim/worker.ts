/// <reference lib="webworker" />
import { createWorld, renderSnapshot, tick, SCAN_MS } from './orchestrator';
import { haltedSimulationWorld } from './phases/fail-closed';
import { parseWorkerIngress, WorkerMailbox } from './worker-mailbox';
import { boundedWorkerEvents } from './event-stream';
import type { Command, WorkerResponse } from './signals';

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
let world = createWorld();
const mailbox = new WorkerMailbox();

/** Reject a complete malformed or overflowing message, ACK its request ID, and
 * leave the authoritative world and queued commands untouched. */
function reject(message: string, requestId?: number, requestIds?: number[]): void {
  const reply: WorkerResponse = {
    kind: 'snapshot',
    snapshot: { ...renderSnapshot(world), lastError: message },
    events: boundedWorkerEvents([{ tick: world.tick, kind: 'error', detail: message }]),
    ...(requestId === undefined ? {} : { requestId }),
    ...(requestIds?.length ? { requestIds } : {}),
  };
  ctx.postMessage(reply);
}

/** An unexpected simulation exception stops the modeled controllers and
 * actuators; it must not leave stale energised outputs running invisibly. */
function haltOnException(message: string): void {
  world = haltedSimulationWorld(world, message,
    'Worker tick interrupted; simulated outputs deenergized', 30);
}

function dispatch(commands: readonly Command[] = [], requestId?: number, requestIds?: number[]): void {
  const before = world.project;
  let result: ReturnType<typeof tick>;
  try {
    result = tick(world, commands);
  } catch (error) {
    const message = 'Simulation tick failed: ' + (error instanceof Error ? error.message : 'unknown error');
    haltOnException(message);
    reject(message, requestId, requestIds);
    return;
  }
  world = result.world;
  // Pure clock scans retain the same project object. Only actual document
  // changes need a full JSON compare for Undo/Redo history in the UI.
  const documentChanged = before !== world.project &&
    JSON.stringify(before) !== JSON.stringify(world.project);
  const reply: WorkerResponse = {
    kind: 'snapshot', snapshot: result.snapshot, events: boundedWorkerEvents(result.events),
    ...(requestId === undefined ? {} : { requestId }),
    ...(requestIds?.length ? { requestIds } : {}),
    ...(before !== world.project ? { project: world.project } : {}),
    ...(documentChanged ? { previousProject: before } : {}),
  };
  ctx.postMessage(reply);
}

ctx.onmessage = (event: MessageEvent<unknown>) => {
  const parsed = parseWorkerIngress(event.data);
  if (!parsed.ok) {
    reject(parsed.error, parsed.requestId);
    return;
  }
  const packet = parsed.packet;
  // Pause bypasses queue capacity, not FIFO ordering. Apply previously
  // accepted controls before Pause in the same tick dispatch: dropping a
  // queued E-stop reset or button release silently changes the circuit.
  // The final Pause prevents clock advancement except an explicit queued Step.
  // This is virtual model control, not a physical safety stop.
  if (world.running && packet.commands.length === 1 && packet.commands[0].k === 'pause') {
    const batch = mailbox.takeWithPause(packet.requestId);
    dispatch(batch.commands, batch.requestIds.length === 1 ? batch.requestIds[0] : undefined,
      batch.requestIds.length > 1 ? batch.requestIds : undefined);
    return;
  }
  // During Run the single 50 ms clock owns scans. A received command only
  // joins a bounded FIFO; nothing can insert an extra PLC scan in this path.
  if (world.running) {
    const error = mailbox.enqueue(packet);
    if (error) reject(error, packet.requestId);
  } else dispatch(packet.commands, packet.requestId);
};

ctx.postMessage({
  kind: 'snapshot', snapshot: renderSnapshot(world), events: [], project: world.project,
} satisfies WorkerResponse);

setInterval(() => {
  if (world.running || mailbox.hasPending) {
    const { commands, requestIds } = mailbox.take();
    dispatch(commands, requestIds.length === 1 ? requestIds[0] : undefined,
      requestIds.length > 1 ? requestIds : undefined);
  }
}, SCAN_MS);
