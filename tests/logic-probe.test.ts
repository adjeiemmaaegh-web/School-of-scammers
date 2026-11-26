import { describe, expect, it } from 'vitest';
import { probeTerminal } from '../src/electrical/logic-probe';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { Command } from '../src/sim/signals';


describe('R5.5 logic probe', () => {
  it('classifies with type 1 thresholds and reports floating and short honestly', () => {
    expect(probeTerminal({}, [], null).state).toBe('select');
    expect(probeTerminal({ a: 24 }, [], 'a')).toEqual({ terminal: 'a', state: 'high', volts: 24 });
    expect(probeTerminal({ a: 15 }, [], 'a').state).toBe('high');
    expect(probeTerminal({ a: 14.9 }, [], 'a').state).toBe('undefined');
    expect(probeTerminal({ a: 5 }, [], 'a').state).toBe('low');
    expect(probeTerminal({ a: 0 }, [], 'a').state).toBe('low');
    expect(probeTerminal({ a: null }, [], 'a').state).toBe('floating');
    expect(probeTerminal({ b: 24 }, [], 'missing').state).toBe('floating');
    expect(probeTerminal({}, [], 'a').state).toBe('unsolved');            // nothing solved yet: no false FLOATING
    expect(probeTerminal({ a: 24 }, ['Supply short: P24 to M0'], 'a').state).toBe('short');
    expect(probeTerminal({ a: 24 }, ['Supply short'], null).state).toBe('select');
  });
  it('reads the real solver: a powered supply output is HIGH, its 0 V is LOW, an unwired PLC input floats', () => {
    let w = createWorld();
    w = tick(w, [{ k: 'addPanel', template: 'motor-starter' }]).world;
    expect(w.lastError).toBeNull();
    const ids = w.project.components.map(c => c.id + ':' + c.kind);
    const supply = w.project.components.find(c => c.kind === 'supply')!.id;
    const plc = w.project.components.find(c => c.kind === 'plc' || c.kind === 'plc16')!.id;
    w = tick(w, [{ k: 'run' }]).world; w = tick(w).world;
    const snap = renderSnapshot(w);
    expect(ids.length).toBeGreaterThan(2);
    expect(probeTerminal(snap.voltages, snap.diagnostics, `${supply}.P24`).state).toBe('high');
    expect(probeTerminal(snap.voltages, snap.diagnostics, `${supply}.M0`).state).toBe('low');
    // the wired NC stop button holds its PLC input HIGH; the input with nothing wired to it is on no driven net
    const stopIn = w.project.wires.find(x => /\.I0\.1$/.test(x.to) || /\.I0\.1$/.test(x.from));
    expect(stopIn).toBeDefined();
    expect(probeTerminal(snap.voltages, snap.diagnostics, `${plc}.I0.1`).state).toBe('high');
    expect(w.project.wires.some(x => x.from === `${plc}.I0.4` || x.to === `${plc}.I0.4`)).toBe(false);
    expect(probeTerminal(snap.voltages, snap.diagnostics, `${plc}.I0.4`).state).toBe('floating');
  });
});
