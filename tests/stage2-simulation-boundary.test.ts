import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/sim/orchestrator';
import { stepThreePhase } from '../src/sim/phases/three-phase';
import {
  MAX_WORKER_COMMANDS_PER_PACKET, MAX_WORKER_PENDING_COMMANDS,
  MAX_WORKER_PENDING_REQUESTS, MAX_WORKER_PACKET_BYTES,
  WorkerMailbox, parseWorkerIngress,
} from '../src/sim/worker-mailbox';
import type { Command } from '../src/sim/signals';

function accepted(commands: Command[], requestId?: number) {
  const parsed = parseWorkerIngress({ kind: 'commands', commands, requestId });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.packet;
}

describe('Stage 2 worker ingress: deterministic bounded command queue', () => {
  it('accepts valid v1 control requests and preserves request ID 0 for restored-project acknowledgement', () => {
    const command: Command = { k: 'loadProject', project: { formatVersion: 1 } };
    const packet = accepted([command], 0);
    expect(packet.commands).toEqual([command]);
    expect(packet.requestId).toBe(0);
    expect(packet.bytes).toBeGreaterThan(0);
  });

  it('rejects malformed and unrecognized messages without processing any commands', () => {
    for (const request of [
      null, undefined, 23, {}, { kind: 'run', commands: [] },
      { kind: 'commands', commands: 'run' },
      { kind: 'commands', commands: [{ k: 'unknown' }] },
      { kind: 'commands', commands: [{ k: 'run' }, null] },
    ]) {
      expect(parseWorkerIngress(request).ok).toBe(false);
    }
    const bad = parseWorkerIngress({ kind: 'commands', commands: 'invalid', requestId: 41 });
    expect(bad).toMatchObject({ ok: false, requestId: 41 });
  });

  it('enforces both command count and UTF-8 payload-size limits', () => {
    const tooMany = parseWorkerIngress({
      kind: 'commands',
      commands: Array.from({ length: MAX_WORKER_COMMANDS_PER_PACKET + 1 }, (): Command => ({ k: 'pause' })),
      requestId: 3,
    });
    expect(tooMany).toMatchObject({ ok: false, requestId: 3 });
    const tooBig = parseWorkerIngress({
      kind: 'commands',
      commands: [{ k: 'loadST', source: 'X'.repeat(MAX_WORKER_PACKET_BYTES) }],
    });
    expect(tooBig.ok).toBe(false);
    // An ASCII-length bound is insufficient: UTF-8 may use up to four bytes per symbol.
    const utf8 = parseWorkerIngress({
      kind: 'commands',
      commands: [{ k: 'loadST', source: '🍀'.repeat(320000) }],
    });
    expect(utf8.ok).toBe(false);
  });

  it('preserves FIFO order, duplicate IDs and complete acknowledgement batches; drain empties memory', () => {
    const mailbox = new WorkerMailbox();
    expect(mailbox.enqueue(accepted([{ k: 'run' }], 7))).toBeNull();
    expect(mailbox.enqueue(accepted([{ k: 'pause' }, { k: 'step' }], 7))).toBeNull();
    expect(mailbox.commandCount).toBe(3);
    expect(mailbox.pendingBytes).toBeGreaterThan(0);
    const next = mailbox.take();
    expect(next.commands.map(command => command.k)).toEqual(['run', 'pause', 'step']);
    expect(next.requestIds).toEqual([7, 7]);
    expect(mailbox.commandCount).toBe(0);
    expect(mailbox.pendingBytes).toBe(0);
    expect(mailbox.hasPending).toBe(false);
    expect(mailbox.take()).toEqual({ commands: [], requestIds: [] });
  });

  it('rejects a full queue atomically and permits the caller to retry after one scan', () => {
    const mailbox = new WorkerMailbox();
    const group = Array.from({ length: MAX_WORKER_COMMANDS_PER_PACKET }, (): Command => ({ k: 'step' }));
    expect(mailbox.enqueue(accepted(group, 1))).toBeNull();
    expect(mailbox.enqueue(accepted(group, 2))).toBeNull();
    expect(mailbox.commandCount).toBe(MAX_WORKER_PENDING_COMMANDS);
    expect(mailbox.enqueue(accepted([{ k: 'pause' }], 3))).toMatch(/queue is busy/);
    expect(mailbox.commandCount).toBe(MAX_WORKER_PENDING_COMMANDS);
    const batch = mailbox.take();
    expect(batch.requestIds).toEqual([1, 2]);
    expect(mailbox.enqueue(accepted([{ k: 'pause' }], 3))).toBeNull();
  });

  it('does not accumulate queue bytes for empty requests without an acknowledgement ID', () => {
    const mailbox = new WorkerMailbox();
    const empty = accepted([]);
    for (let n = 0; n < 10_000; n++) expect(mailbox.enqueue(empty)).toBeNull();
    expect(mailbox.hasPending).toBe(false);
    expect(mailbox.pendingBytes).toBe(0);
    expect(mailbox.enqueue(accepted([{ k: 'step' }], 0))).toBeNull();
    expect(mailbox.take().requestIds).toEqual([0]);
  });

  it('bounds empty acknowledgement-only messages and queued bytes as well as commands', () => {
    const mailbox = new WorkerMailbox();
    for (let n = 0; n < MAX_WORKER_PENDING_REQUESTS; n++)
      expect(mailbox.enqueue(accepted([], n))).toBeNull();
    expect(mailbox.hasPending).toBe(true);
    expect(mailbox.enqueue(accepted([], MAX_WORKER_PENDING_REQUESTS))).toMatch(/queue is busy/);
    expect(mailbox.take().requestIds).toHaveLength(MAX_WORKER_PENDING_REQUESTS);

    const large = accepted([{ k: 'loadST', source: 'A'.repeat(900000) }], 1);
    expect(mailbox.enqueue(large)).toBeNull();
    expect(mailbox.enqueue(large)).toBeNull();
    expect(mailbox.enqueue(large)).toMatch(/queue is busy/);
    expect(mailbox.take().commands).toHaveLength(2);
  });
});

describe('Stage 2 extracted three-phase phase contract', () => {
  it('does not invent phase power, faults, events, or drives in an empty worker world', () => {
    const world = createWorld();
    const outputs: Record<string, boolean> = {};
    const events: { tick: number; kind: string; detail: string }[] = [];
    const result = stepThreePhase(world, [], 50, outputs, events);
    expect(result).toEqual({});
    expect(outputs).toEqual({});
    expect(events).toEqual([]);
    expect(world.tick).toBe(0);
  });
});
