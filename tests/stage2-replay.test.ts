import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import { compareSimulationReplay, replaySimulation, MAX_REPLAY_COMMAND_BYTES, MAX_REPLAY_EXTRA_SCANS, type ReplayFrame } from '../src/sim/replay';
import { MAX_WORKER_PACKET_BYTES } from '../src/sim/worker-mailbox';
import type { Command } from '../src/sim/signals';

const emptyProject = () => createWorld().project;
const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind']): Command =>
  ({ k: 'place', id, kind, at: { x: 10, y: 10 } });
const wiring: Command[] = [
  place('ps', 'supply'), place('go', 'start'), place('lamp', 'lamp'),
  { k: 'wire', id: 'w1', from: 'ps.P24', to: 'go.A' },
  { k: 'wire', id: 'w2', from: 'go.B', to: 'lamp.L+' },
  { k: 'wire', id: 'w3', from: 'lamp.M-', to: 'ps.M0' },
];

describe('Stage 2 bounded deterministic replay', () => {
  it('replays a real hard-wired lamp journey, compares full snapshots and leaves input untouched', () => {
    const project = emptyProject();
    const frames: ReplayFrame[] = [
      { commands: wiring, checkpoint: 'built' },
      { commands: [{ k: 'run' }], extraScans: 2, checkpoint: 'idle' },
      { commands: [{ k: 'operate', id: 'go', pressed: true }], extraScans: 2, checkpoint: 'on' },
      { commands: [{ k: 'operate', id: 'go', pressed: false }], extraScans: 2, checkpoint: 'off' },
      { commands: [{ k: 'pause' }] },
    ];
    const original = JSON.stringify({ project, frames });
    const result = replaySimulation(project, frames);
    const states = result.checkpoints.slice(1).map(c => c.snapshot.deviceOn.lamp === true);
    expect(states).toEqual([false, true, false]);
    expect(compareSimulationReplay(project, frames)).toEqual({ identical: true, firstDifferentCheckpoint: null });
    let world = createWorld(project);
    for (const frame of frames) {
      world = tick(world, frame.commands ?? []).world;
      for (let i = 0; i < (frame.extraScans ?? 0); i++) world = tick(world).world;
    }
    expect(result.finalSnapshot).toEqual(renderSnapshot(world));
    expect(result.finalTick).toBe(world.tick);
    expect(JSON.stringify({ project, frames })).toBe(original);
    expect(result.checkpoints[2].snapshot.deviceOn.lamp).toBe(true);
  });

  it('replays two independently powered starter panels without mutating the original project', () => {
    const project = emptyProject();
    const frames: ReplayFrame[] = [
      { commands: [{ k: 'addPanel', template: 'motor-starter' }, { k: 'addPanel', template: 'motor-starter' }], checkpoint: 'built' },
      { commands: [{ k: 'run' }], extraScans: 5, checkpoint: 'running' },
      { commands: [{ k: 'pause' }], checkpoint: 'paused' },
    ];
    const a = replaySimulation(project, frames), b = replaySimulation(project, frames);
    expect(a).toEqual(b);
    expect(a.checkpoints.map(c => c.name)).toEqual(['built', 'running', 'paused']);
    expect(project.components).toHaveLength(0);
    expect(a.finalSnapshot.running).toBe(false);
  });

  it('rejects malformed commands, oversized packets and oversized aggregate scripts before executing', () => {
    const malformed = [{ commands: null }, { commands: [{ k: 'unknown' }] }, []] as unknown as ReplayFrame[];
    for (const frame of malformed) expect(() => replaySimulation(emptyProject(), [frame])).toThrow();
    const big = { k: 'loadST', source: 'A'.repeat(MAX_WORKER_PACKET_BYTES) } as const;
    expect(() => replaySimulation(emptyProject(), [{ commands: [big] }])).toThrow(/size limit/);
    const packet = { commands: [{ k: 'loadST', source: 'A'.repeat(1_000_000) }] } as const;
    expect(() => replaySimulation(emptyProject(), Array.from({ length: Math.ceil(MAX_REPLAY_COMMAND_BYTES / 1_000_000) + 1 }, () => packet))).toThrow(/byte budget/);
    expect(() => replaySimulation(emptyProject(), [{ extraScans: MAX_REPLAY_EXTRA_SCANS + 1 }])).toThrow(/budget/);
    expect(() => replaySimulation(emptyProject(), [{ checkpoint: 'same' }, { checkpoint: 'same' }])).toThrow(/Duplicate/);
  });
});
