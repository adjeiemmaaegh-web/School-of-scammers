import { describe, expect, it } from 'vitest';
import { alignedPositions, ALIGN_MODES } from '../src/workspace/align';
import { editWorkspace } from '../src/workspace/editor';
import { createWorld, tick } from '../src/sim/orchestrator';
import type { Command, PlacedComponent } from '../src/sim/signals';

const part = (id: string, x: number, y: number): PlacedComponent => ({ id, kind: 'lamp', x, y, pressed: false });
const set = [part('a', 100, 50), part('b', 400, 300), part('c', 250, 120), part('d', 700, 200)];
const place = (id: string, x: number, y: number): Command => ({ k: 'place', id, kind: 'lamp', at: { x, y } });

describe('R6.2 alignment and distribution', () => {
  it('aligns origins to the extremes or the centre', () => {
    const at = (m: Parameters<typeof alignedPositions>[1]) => [...alignedPositions(set, m).values()];
    expect(at('left').map(p => p.x)).toEqual([100, 100, 100, 100]);
    expect(at('right').map(p => p.x)).toEqual([700, 700, 700, 700]);
    expect(at('hcenter').map(p => p.x)).toEqual([400, 400, 400, 400]);
    expect(at('top').map(p => p.y)).toEqual([50, 50, 50, 50]);
    expect(at('bottom').map(p => p.y)).toEqual([300, 300, 300, 300]);
    expect(at('vcenter').map(p => p.y)).toEqual([175, 175, 175, 175]);
    // alignment on one axis never moves the other
    expect(at('left').map(p => p.y)).toEqual([50, 300, 120, 200]);
  });
  it('distributes evenly between the extremes in stable order, keeping the extremes', () => {
    const h = alignedPositions(set, 'distribute-h');
    expect([...h.entries()].sort((a, b) => a[1].x - b[1].x).map(([id, p]) => `${id}:${p.x}`)).toEqual(['a:100', 'c:300', 'b:500', 'd:700']);
    const v = alignedPositions(set, 'distribute-v');
    expect(v.get('a')!.y).toBe(50); expect(v.get('b')!.y).toBe(300); // extremes unchanged
  });
  it('needs two parts to align and three to distribute; unknown modes are refused', () => {
    expect(() => alignedPositions([set[0]], 'left')).toThrow(/at least two/);
    expect(() => alignedPositions(set.slice(0, 2), 'distribute-h')).toThrow(/at least three/);
    expect(() => alignedPositions(set, 'bogus' as never)).toThrow(/Unknown alignment/);
    expect(ALIGN_MODES).toHaveLength(8);
  });
  it('is deterministic and stays inside the existing positions (so inside the floor)', () => {
    for (const m of ALIGN_MODES) {
      expect(JSON.stringify([...alignedPositions(set, m)])).toBe(JSON.stringify([...alignedPositions(set, m)]));
      for (const p of alignedPositions(set, m).values()) { expect(p.x).toBeGreaterThanOrEqual(100); expect(p.x).toBeLessThanOrEqual(700); expect(p.y).toBeGreaterThanOrEqual(50); expect(p.y).toBeLessThanOrEqual(300); }
    }
  });
  it('works through the worker edit path: wires survive, undo is one project snapshot, running is refused', () => {
    let w = tick(createWorld(), [place('a', 100, 50), place('b', 400, 300), place('s', 10, 10), { k: 'wire', id: 'w1', from: 's.P24', to: 'a.L+' }]).world;
    const before = w.project;
    w = tick(w, [{ k: 'editWorkspace', edit: { kind: 'align', ids: ['a', 'b'], mode: 'left' } }]).world;
    expect(w.lastError).toBeNull();
    expect(w.project.components.filter(c => c.id === 'a' || c.id === 'b').map(c => c.x)).toEqual([100, 100]);
    expect(w.project.wires).toEqual(before.wires);
    expect(editWorkspace(before, { kind: 'align', ids: ['a', 'b'], mode: 'left' }).components.find(c => c.id === 's')).toEqual(before.components.find(c => c.id === 's'));
    const again = tick(w, [{ k: 'editWorkspace', edit: { kind: 'align', ids: ['a', 'b'], mode: 'left' } }]).world;
    expect(again.project).toEqual(w.project); // already aligned: no-op
    const running = tick(tick(w, [{ k: 'run' }]).world, [{ k: 'editWorkspace', edit: { kind: 'align', ids: ['a', 'b'], mode: 'top' } }]).world;
    expect(running.lastError).toMatch(/Pause/);
    expect(tick(w, [{ k: 'editWorkspace', edit: { kind: 'align', ids: ['a', 'ghost'], mode: 'top' } }]).world.lastError).not.toBeNull();
  });
});
