/// <reference lib="webworker" />
import { createWorld, renderSnapshot, tick, SCAN_MS } from './orchestrator';
import type { WorkerRequest, WorkerResponse } from './signals';

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
let world = createWorld();
function dispatch(commands: WorkerRequest['commands'] = []): void {
  const before = world.project;
  const result = tick(world, commands);
  world = result.world;
  const reply: WorkerResponse = { kind: 'snapshot', snapshot: result.snapshot, events: result.events,
    ...(before !== world.project ? { project: world.project } : {}) };
  ctx.postMessage(reply);
}
ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data?.kind === 'commands' && Array.isArray(event.data.commands)) dispatch(event.data.commands);
};
ctx.postMessage({ kind: 'snapshot', snapshot: renderSnapshot(world), events: [], project: world.project } satisfies WorkerResponse);
setInterval(() => { if (world.running) dispatch(); }, SCAN_MS);
