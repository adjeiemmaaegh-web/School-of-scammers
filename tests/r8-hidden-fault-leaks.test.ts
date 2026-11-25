import { describe, expect, it } from 'vitest';
import { redactHiddenFaults } from '../src/sim/redact';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x = 10, y = 10): Command => ({ k: 'place', id, kind, at: { x, y } });
const wires = (pairs: [string, string][]): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));
const scan = (w: WorldState, n: number) => { const events: string[] = []; for (let i = 0; i < n; i++) { const r = tick(w); w = r.world; events.push(...r.events.map(e => `${e.kind}:${e.detail}`)); } return { w, events }; };

describe('R8 hidden faults do not name themselves', () => {
  const bench = () => tick(createWorld(), [
    place('ps', 'supply'), place('go', 'start'), place('mycoil', 'relay'), place('lamp', 'lamp'),
    ...wires([['ps.P24', 'go.A'], ['go.B', 'mycoil.A1'], ['mycoil.A2', 'ps.M0'], ['ps.P24', 'mycoil.13'], ['mycoil.14', 'lamp.L+'], ['lamp.M-', 'ps.M0']]),
    { k: 'injectFault', kind: 'contactor-coil-open', target: 'mycoil', hidden: true }]).world;
  it('the published snapshot and every event omit the fault kind, its label and the culprit part while it is hidden', () => {
    let w = bench();
    w = tick(w, [{ k: 'run' }]).world;
    const run = scan(tick(w, [{ k: 'operate', id: 'go', pressed: true }]).world, 40);
    const snapshotText = JSON.stringify(renderSnapshot(run.w));
    // the symptom is visible (the lamp never lights) ...
    expect(run.w.deviceOn.lamp).toBe(false);
    // ... but the answer is not published anywhere a learner sees.
    for (const secret of ['contactor-coil-open', 'coil open', 'Contactor coil open', 'Open coil']) {
      expect(snapshotText, `snapshot leaks "${secret}"`).not.toContain(secret);
      expect(run.events.join('|'), `events leak "${secret}"`).not.toContain(secret);
    }
    expect(run.events.join('|')).not.toMatch(/fault injected/i);
  });
  it('the injection event is neutral for a hidden fault, and revealing names it only on request', () => {
    const r = tick(createWorld(), [place('k', 'relay'), { k: 'injectFault', kind: 'contactor-welded', target: 'k', hidden: true }]);
    expect(r.events.map(e => e.detail).join('|')).toMatch(/hidden/);
    expect(r.events.map(e => e.detail).join('|')).not.toMatch(/welded|\bk\b/i);
    const id = r.world.project.faults![0].id;
    const revealed = tick(r.world, [{ k: 'revealFault', id }]);
    expect(revealed.events.map(e => e.detail).join('|')).toMatch(/welded/i);
  });
  it('redaction removes hidden faults from a downloadable project and keeps visible ones', () => {
    let w = bench();
    w = tick(w, [{ k: 'injectFault', kind: 'contactor-welded', target: 'mycoil', hidden: false }]).world;
    expect(w.project.faults!.length).toBe(2);
    const exported = redactHiddenFaults(w.project);
    expect(exported.faults!.map(f => f.hidden)).toEqual([false]);
    expect(JSON.stringify(exported)).not.toContain('contactor-coil-open');
    const onlyHidden = redactHiddenFaults(bench().project);
    expect(onlyHidden.faults).toBeUndefined();
    expect(redactHiddenFaults(createWorld().project)).toEqual(createWorld().project);
  });
  it('redaction also drops seeded plant equipment faults from a graded export (F-12) and keeps everything else', () => {
    const project = { ...createWorld().project, plantFaults: { s1: 'stuck-extended' }, faults: [] };
    const exported = redactHiddenFaults(project);
    expect(exported.plantFaults).toBeUndefined();
    expect(JSON.stringify(exported)).not.toContain('stuck-extended');
    expect(exported.components).toEqual(project.components);
    const both = redactHiddenFaults({ ...bench().project, plantFaults: { s1: 'stuck-extended' } });
    expect(both.plantFaults).toBeUndefined(); expect(both.faults).toBeUndefined();
    const empty = { ...createWorld().project, plantFaults: {} };
    expect(redactHiddenFaults(empty)).toBe(empty);
  });
});
