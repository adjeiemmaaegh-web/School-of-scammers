import { describe, expect, it } from 'vitest';
import { summarizeDiagnostics } from '../src/diagnostics/summary';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x = 10, y = 10): Command => ({ k: 'place', id, kind, at: { x, y } });
const wires = (pairs: [string, string][]): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));
const scan = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const sum = (w: WorldState) => summarizeDiagnostics(w.project, renderSnapshot(w));

describe('R8.1 diagnostics summary', () => {
  it('reports rails, controllers, devices and alarms from the worker snapshot', () => {
    let w = tick(createWorld(), [{ k: 'addPanel', template: 'motor-starter' }]).world;
    w = scan(tick(w, [{ k: 'run' }]).world, 4);
    const s = sum(w);
    expect(s.running).toBe(true);
    expect(s.rails).toHaveLength(1);
    expect(s.rails[0]).toMatchObject({ state: 'live', volts: 24 });
    expect(s.controllers).toHaveLength(1);
    expect(s.controllers[0].powered).toBe(true);
    expect(s.shortCircuit).toBe(false);
    const start = w.project.components.find(c => c.kind === 'start')!.id;
    w = scan(tick(w, [{ k: 'operate', id: start, pressed: true }]).world, 8);
    expect(sum(w).devicesOn.length).toBeGreaterThan(0);
  });
  it('flags a direct supply short and a floating rail', () => {
    const shorted = tick(createWorld(), [place('ps', 'supply'), ...wires([['ps.P24', 'ps.M0']])]).world;
    expect(sum(scan(tick(shorted, [{ k: 'run' }]).world, 2)).shortCircuit).toBe(true);
    const lone = tick(createWorld(), [place('ps', 'supply')]).world;
    expect(sum(lone).rails[0].state).toBe('floating');
  });
  it('never counts or names a hidden fault, only revealed ones', () => {
    let w = tick(createWorld(), [place('k', 'relay'), { k: 'injectFault', kind: 'contactor-coil-open', target: 'k', hidden: true }]).world;
    expect(sum(w).revealedFaults).toBe(0);
    expect(JSON.stringify(sum(w))).not.toMatch(/coil-open|coil open/i);
    w = tick(w, [{ k: 'revealFault', id: w.project.faults![0].id }]).world;
    expect(sum(w).revealedFaults).toBe(1);
  });
  it('is a pure function of the snapshot (deterministic)', () => {
    const w = scan(tick(tick(createWorld(), [{ k: 'addPanel', template: 'motor-starter' }]).world, [{ k: 'run' }]).world, 3);
    expect(JSON.stringify(sum(w))).toBe(JSON.stringify(sum(w)));
  });
});
