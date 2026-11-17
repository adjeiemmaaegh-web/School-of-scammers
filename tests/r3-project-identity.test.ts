import { describe, expect, it } from 'vitest';
import { createWorld, tick } from '../src/sim/orchestrator';
import type { Command } from '../src/sim/signals';

const big = (): Command[] => {
  const cmds: Command[] = [];
  for (let i = 0; i < 30; i++) cmds.push({ k: 'place', id: `l${i}`, kind: 'lamp', at: { x: 10 + (i % 10) * 90, y: 10 + Math.floor(i / 10) * 80 } });
  cmds.push({ k: 'place', id: 'ps', kind: 'supply', at: { x: 900, y: 500 } });
  for (let i = 0; i < 30; i++) cmds.push({ k: 'wire', id: `a${i}`, from: 'ps.P24', to: `l${i}.L+` }, { k: 'wire', id: `b${i}`, from: `l${i}.M-`, to: 'ps.M0' });
  return cmds;
};
describe('R3.6 project object identity (the worker relies on it to skip a full-project JSON compare every scan)', () => {
  it('a scan with no edit command keeps the very same project object, running or paused', () => {
    let w = tick(createWorld(), big()).world;
    expect(w.lastError).toBeNull();
    expect(w.project.components.length).toBe(31);
    for (let i = 0; i < 3; i++) { const before = w.project; w = tick(w).world; expect(w.project).toBe(before); }
    w = tick(w, [{ k: 'run' }]).world;
    for (let i = 0; i < 5; i++) { const before = w.project; w = tick(w).world; expect(w.project).toBe(before); }
    const before = w.project;
    w = tick(w, [{ k: 'operate', id: 'ps', pressed: true }]).world; // an operate command may legitimately touch the project
    expect(w.project === before || JSON.stringify(w.project) !== JSON.stringify(before)).toBe(true);
  });
  it('an edit produces a new project object', () => {
    const w0 = tick(createWorld(), big()).world;
    const w1 = tick(w0, [{ k: 'place', id: 'extra', kind: 'lamp', at: { x: 400, y: 400 } }]).world;
    expect(w1.lastError).toBeNull();
    expect(w1.project).not.toBe(w0.project);
  });
});
