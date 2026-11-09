import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { editWorkspace } from '../src/workspace/editor';
import { makeFragment } from '../src/workspace/clipboard';
import { programOf } from '../src/sim/plcs';
import { terminalPoint } from '../src/render/scene-coordinates';
import type { ProjectFile, WorldState } from '../src/sim/signals';

const starter = (): ProjectFile => {
  const world = tick(createWorld(), [{ k: 'addPanel', template: 'motor-starter' }]).world;
  expect(world.lastError).toBeNull();
  return world.project;
};
const valid = (p: ProjectFile): ProjectFile => validateProject(JSON.parse(JSON.stringify(p)));

describe('P1 pure project editor', () => {
  it('moves multiple selected devices uniformly with snap and preserves wiring', () => {
    const before = starter();
    const ids = ['start-1', 'stop-1'];
    const moved = editWorkspace(before, { kind: 'translate', ids, delta: { x: 36, y: 14 }, grid: 25 });
    expect(moved.components.find(c => c.id === 'start-1')?.x).toBe(35);
    expect(moved.components.find(c => c.id === 'start-1')?.y).toBe(175);
    expect(moved.components.find(c => c.id === 'stop-1')?.x).toBe(210);
    expect(moved.wires).toEqual(before.wires);
    expect(before.components.find(c => c.id === 'start-1')?.x).toBe(10);
    expect(valid(moved)).toEqual(moved);
  });
  it('duplicates an entire panel with new IDs, internal wires, and a separate PLC program', () => {
    const before = starter();
    const copied = editWorkspace(before, { kind: 'duplicate', ids: before.components.map(c => c.id),
      offset: { x: 400, y: 0 }, grid: 5 });
    expect(copied.components).toHaveLength(12);
    expect(copied.wires).toHaveLength(22);
    const clonedPlc = copied.components.find(c => c.kind === 'plc' && c.id !== 'plc-1');
    expect(clonedPlc).toBeTruthy();
    expect(programOf(copied, clonedPlc!.id).program).toEqual(before.program);
    const originalIds = new Set(before.components.map(c => c.id));
    const clonedIds = new Set(copied.components.filter(c => !originalIds.has(c.id)).map(c => c.id));
    expect(copied.wires.filter(w => !before.wires.some(old => old.id === w.id))
      .every(w => clonedIds.has(w.from.split('.')[0]) && clonedIds.has(w.to.split('.')[0]))).toBe(true);
    expect(valid(copied)).toEqual(copied);
  });
  it('copies only internal conductors; pastes healthy instances without phantom external links', () => {
    const before = starter();
    const fragment = makeFragment(before, ['supply-1', 'start-1']);
    expect(fragment.components).toHaveLength(2);
    expect(fragment.wires).toHaveLength(1);
    const next = editWorkspace(before, { kind: 'paste', fragment, at: { x: 450, y: 260 }, grid: 5 });
    expect(next.components).toHaveLength(8);
    expect(next.wires).toHaveLength(12);
    const added = next.wires[next.wires.length - 1];
    expect(added.from).toMatch(/copy/);
    expect(added.to).toMatch(/copy/);
    expect(valid(next)).toEqual(next);
    expect(before.wires).toHaveLength(11);
  });
  it('deletes several devices atomically and removes all attached wires/programs', () => {
    const before = starter();
    const after = editWorkspace(before, { kind: 'delete', ids: ['plc-1', 'motor-1'] });
    expect(after.components.map(c => c.id)).not.toContain('plc-1');
    expect(after.components.map(c => c.id)).not.toContain('motor-1');
    expect(after.wires.some(w => w.from.startsWith('plc-1.') || w.to.startsWith('motor-1.'))).toBe(false);
    expect(valid(after)).toEqual(after);
  });
  it('rotates electrical terminals with their mesh, and rejects unmodelled physical rotations', () => {
    const p = starter();
    const before = terminalPoint(p, 'start-1.A')!;
    const rotated = editWorkspace(p, { kind: 'rotate', ids: ['start-1'], quarterTurns: 1 });
    const after = terminalPoint(rotated, 'start-1.A')!;
    expect(rotated.components.find(c => c.id === 'start-1')?.yawDeg).toBe(90);
    expect(after.x).not.toBe(before.x);
    expect(after.z).not.toBe(before.z);
    expect(valid(rotated)).toEqual(rotated);
    const withTank = tick(createWorld(), [{ k: 'place', id: 't', kind: 'tank', at: { x: 200, y: 200 } }]).world.project;
    expect(() => editWorkspace(withTank, { kind: 'rotate', ids: ['t'], quarterTurns: 1 }))
      .toThrow(/orientation-locked/);
    // The line-shaped curtain's physical sensing kernel is not yet yaw-aware.
    // Refuse cosmetic rotation until model geometry and detection agree.
    const withCurtain = tick(createWorld(), [
      { k: 'place', id: 'curtain', kind: 'light-curtain', at: { x: 200, y: 200 } },
    ]).world.project;
    expect(() => editWorkspace(withCurtain, {
      kind: 'rotate', ids: ['curtain'], quarterTurns: 1,
    })).toThrow(/orientation-locked/);
  });
  it('fails safely at the authoritative worker boundary; bad edits are not half-applied', () => {
    const initial = tick(createWorld(), [{ k: 'addPanel', template: 'motor-starter' }]).world;
    const invalid = tick(initial, [{ k: 'editWorkspace', edit: { kind: 'duplicate',
      ids: ['start-1', 'missing'], offset: { x: 25, y: 25 }, grid: 5 } }]).world;
    expect(invalid.lastError).toMatch(/missing/);
    expect(invalid.project).toEqual(initial.project);
    const running = tick(initial, [{ k: 'run' }]).world;
    const rejected = tick(running, [{ k: 'editWorkspace', edit: {
      kind: 'translate', ids: ['start-1'], delta: { x: 50, y: 0 }, grid: 5,
    } }]).world;
    expect(rejected.lastError).toMatch(/Pause/);
    expect(rejected.project).toEqual(initial.project);
  });
});

describe('P1 editor integration with actual learner programming', () => {
  const step = (w: WorldState, n: number): WorldState => {
    for (let i = 0; i < n; i++) w = tick(w).world;
    return w;
  };
  it('a rotated and moved start button still operates a student-wired motor latch', () => {
    let w = tick(createWorld(), [{ k: 'addPanel', template: 'motor-starter' }]).world;
    w = tick(w, [{ k: 'editWorkspace', edit: {
      kind: 'rotate', ids: ['start-1'], quarterTurns: 1,
    } }, { k: 'editWorkspace', edit: {
      kind: 'translate', ids: ['start-1'], delta: { x: 25, y: 25 }, grid: 5,
    } }]).world;
    expect(w.lastError).toBeNull();
    const snap = renderSnapshot(w);
    expect(snap.components.find(c => c.id === 'start-1')?.yawDeg).toBe(90);
    w = step(tick(w, [{ k: 'run' }, { k: 'operate', id: 'start-1', pressed: true }]).world, 6);
    expect(w.deviceOn['motor-1']).toBe(true);
    w = step(tick(w, [{ k: 'operate', id: 'start-1', pressed: false }]).world, 6);
    expect(w.deviceOn['motor-1']).toBe(true);
    w = step(tick(w, [{ k: 'operate', id: 'stop-1', pressed: true }]).world, 6);
    expect(w.deviceOn['motor-1']).toBe(false);
  });
  it('rejects corrupted saved orientation but preserves old JSON with no yaw field', () => {
    const p = starter();
    expect(valid(p)).toEqual(p);
    expect(() => validateProject({ ...p, components: p.components.map(c => c.id === 'start-1' ?
      { ...c, yawDeg: 45 } : c) })).toThrow(/quarter turn/);
  });
});
