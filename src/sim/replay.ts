/**
 * R3.7 — Deterministic, bounded replay of the authoritative simulator.
 *
 * Frames represent successive worker dispatch boundaries (one configured-period tick
 * each); extraScans advances the SAME tick path with no commands.
 * This is a reusable source-level replay primitive for instructor scenarios
 * and diagnostics, not an alternative runtime or a wall-clock scheduler.
 */
import { createWorld, renderSnapshot, tick } from './orchestrator';
import type { Command, ProjectFile, RenderSnapshot, SimEvent, WorldState } from './signals';
import { parseWorkerIngress } from './worker-mailbox';

export const MAX_REPLAY_FRAMES = 512;
export const MAX_REPLAY_EXTRA_SCANS = 5_000;
export const MAX_REPLAY_COMMANDS = 4_096;
/** Bound cumulative serialized command data, not just the number of commands. */
export const MAX_REPLAY_COMMAND_BYTES = 8_000_000;
export const MAX_REPLAY_CHECKPOINTS = 64;
/** Retain bounded diagnostic events even when one frame advances thousands of scans. */
export const MAX_REPLAY_EVENTS_PER_CHECKPOINT = 512;

export type ReplayFrame = {
  readonly commands?: readonly Command[];
  readonly extraScans?: number;
  /** Named snapshot checkpoint. Unlabelled frames are not retained. */
  readonly checkpoint?: string;
};
export type ReplayCheckpoint = {
  readonly name: string;
  readonly frame: number;
  readonly tick: number;
  /** Snapshot retained only at requested checkpoints; never persisted to a project. */
  readonly snapshot: RenderSnapshot;
  readonly events: readonly SimEvent[];
  /** Count of subsequent events omitted after the retained-event limit. */
  readonly droppedEvents: number;
};
export type ReplayResult = {
  readonly finalTick: number;
  readonly checkpoints: readonly ReplayCheckpoint[];
  readonly finalSnapshot: RenderSnapshot;
};

function validateFrames(frames: readonly ReplayFrame[]): void {
  if (!Array.isArray(frames)) throw new TypeError('Malformed replay script');
  if (frames.length > MAX_REPLAY_FRAMES)
    throw new RangeError('Replay exceeds its frame limit');
  let commands = 0, scans = 0, checkpoints = 0, bytes = 0;
  const checkpointNames = new Set<string>();
  for (const frame of frames) {
    if (!frame || typeof frame !== 'object' || Array.isArray(frame) ||
        (frame.commands !== undefined && !Array.isArray(frame.commands)))
      throw new TypeError('Malformed replay frame');
    const parsed = parseWorkerIngress({ kind: 'commands', commands: frame.commands ?? [] });
    if (!parsed.ok) throw new TypeError(parsed.error);
    commands += parsed.packet.commands.length;
    bytes += parsed.packet.bytes;
    if (bytes > MAX_REPLAY_COMMAND_BYTES) throw new RangeError('Replay exceeds its command byte budget');
    if (frame.extraScans !== undefined && (!Number.isSafeInteger(frame.extraScans) || frame.extraScans < 0))
      throw new RangeError('Invalid replay scan count');
    scans += frame.extraScans ?? 0;
    if (frame.checkpoint !== undefined) {
      if (typeof frame.checkpoint !== 'string' || frame.checkpoint.length < 1 ||
          frame.checkpoint.length > 64) throw new RangeError('Invalid replay checkpoint name');
      if (checkpointNames.has(frame.checkpoint)) throw new TypeError('Duplicate replay checkpoint name');
      checkpointNames.add(frame.checkpoint);
      checkpoints++;
    }
  }
  if (commands > MAX_REPLAY_COMMANDS || scans > MAX_REPLAY_EXTRA_SCANS ||
      checkpoints > MAX_REPLAY_CHECKPOINTS)
    throw new RangeError('Replay exceeds its command, scan or checkpoint budget');
}

/** Executes a validated script using the existing configured-period kernel. */
export function replaySimulation(project: ProjectFile, frames: readonly ReplayFrame[]): ReplayResult {
  validateFrames(frames);
  let world: WorldState = createWorld(project);
  const checkpoints: ReplayCheckpoint[] = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    let result = tick(world, frame.commands ?? []);
    world = result.world;
    // Only named checkpoints retain events. A 5000-scan replay cannot grow an
    // unbounded intermediate list or exhaust the inspector's memory budget.
    const events: SimEvent[] = [];
    let droppedEvents = 0;
    const collect = (next: readonly SimEvent[]): void => {
      if (!frame.checkpoint) return;
      for (const event of next) {
        if (events.length < MAX_REPLAY_EVENTS_PER_CHECKPOINT) events.push(event);
        else droppedEvents++;
      }
    };
    collect(result.events);
    for (let n = 0; n < (frame.extraScans ?? 0); n++) {
      result = tick(world);
      world = result.world;
      collect(result.events);
    }
    if (frame.checkpoint) checkpoints.push({
      name: frame.checkpoint, frame: i, tick: world.tick,
      snapshot: renderSnapshot(world), events, droppedEvents,
    });
  }
  return { finalTick: world.tick, checkpoints, finalSnapshot: renderSnapshot(world) };
}

/** Compare two independent replays by exact serialized snapshot and event data.
 * A digest alone is not proof of equality: compare full values instead.
 * This does not mutate or record either input project or script.
 */
export function compareSimulationReplay(project: ProjectFile, frames: readonly ReplayFrame[]): {
  identical: boolean; firstDifferentCheckpoint: string | null;
} {
  const left = replaySimulation(project, frames);
  const right = replaySimulation(project, frames);
  for (let i = 0; i < left.checkpoints.length; i++) {
    const a = left.checkpoints[i], b = right.checkpoints[i];
    if (JSON.stringify({ snapshot: a.snapshot, events: a.events, droppedEvents: a.droppedEvents }) !==
        JSON.stringify({ snapshot: b.snapshot, events: b.events, droppedEvents: b.droppedEvents }))
      return { identical: false, firstDifferentCheckpoint: a.name };
  }
  const finalSame = JSON.stringify(left.finalSnapshot) === JSON.stringify(right.finalSnapshot);
  return {
    identical: finalSame,
    // A divergence after the last named checkpoint must not be reported with
    // a misleading null divergence location.
    firstDifferentCheckpoint: finalSame ? null : 'final',
  };
}
