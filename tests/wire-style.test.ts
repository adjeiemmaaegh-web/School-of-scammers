import { describe, expect, it } from 'vitest';
import { MAX_WIRE_LABEL, pruneWireStyles, validateWireStyles, withWireStyle, WIRE_COLORS } from '../src/components/wire-style';
import { createLibrary, createMemoryStore } from '../src/platform/project-library';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x = 10, y = 10): Command => ({ k: 'place', id, kind, at: { x, y } });
const bench = () => tick(createWorld(), [place('ps', 'supply'), place('go', 'start'), place('lamp', 'lamp'),
  { k: 'wire', id: 'w1', from: 'ps.P24', to: 'go.A' }, { k: 'wire', id: 'w2', from: 'go.B', to: 'lamp.L+' }, { k: 'wire', id: 'w3', from: 'lamp.M-', to: 'ps.M0' }]).world;
const scan = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const style = (w: WorldState, ...c: Command[]) => tick(w, c).world;

describe('R5.1 wire colour and net label', () => {
  it('sets, changes and clears a colour and a label; an empty style disappears from the file', () => {
    let w = style(bench(), { k: 'setWireStyle', id: 'w1', color: 'red', label: '+24V' });
    expect(w.lastError).toBeNull(); expect(w.project.wireStyles).toEqual({ w1: { color: 'red', label: '+24V' } });
    w = style(w, { k: 'setWireStyle', id: 'w1', color: 'blue' });
    expect(w.project.wireStyles!.w1).toEqual({ color: 'blue', label: '+24V' });
    w = style(w, { k: 'setWireStyle', id: 'w1', label: null });
    expect(w.project.wireStyles!.w1).toEqual({ color: 'blue' });
    w = style(w, { k: 'setWireStyle', id: 'w1', color: null });
    expect(w.project.wireStyles).toBeUndefined();
    expect(style(bench(), { k: 'setWireStyle', id: 'w1', label: '   ' }).project.wireStyles).toBeUndefined();
  });
  it('rejects unknown wires, unknown colours, oversize or control-character labels, and works only while paused', () => {
    const w = bench();
    expect(style(w, { k: 'setWireStyle', id: 'nope', color: 'red' }).lastError).toMatch(/Unknown wire/);
    expect(style(w, { k: 'setWireStyle', id: 'w1', color: 'pink' }).lastError).toMatch(/colour/);
    expect(style(w, { k: 'setWireStyle', id: 'w1', label: 'x'.repeat(MAX_WIRE_LABEL + 1) }).lastError).toMatch(/at most/);
    expect(style(w, { k: 'setWireStyle', id: 'w1', label: 'a\u0000b' }).lastError).toMatch(/plain text/);
    const running = style(tick(w, [{ k: 'run' }]).world, { k: 'setWireStyle', id: 'w1', color: 'red' });
    expect(running.lastError).toMatch(/Pause/); expect(running.project.wireStyles).toBeUndefined();
  });
  it('is presentation only: styling every wire leaves every scan identical', () => {
    const plain = bench();
    let styled = bench();
    for (const id of ['w1', 'w2', 'w3']) styled = style(styled, { k: 'setWireStyle', id, color: 'orange', label: `net ${id}` });
    const run = (w: WorldState) => { w = tick(w, [{ k: 'run' }]).world; w = tick(w, [{ k: 'operate', id: 'go', pressed: true }]).world; return scan(w, 10); };
    const a = renderSnapshot(run(plain)), b = renderSnapshot(run(styled));
    expect({ ...b, voltages: b.voltages }).toMatchObject({ voltages: a.voltages, deviceOn: a.deviceOn });
    expect(b.deviceOn.lamp).toBe(true);
  });
  it('is pruned with its wire (unwire, device removal) and validated on load', () => {
    let w = style(bench(), { k: 'setWireStyle', id: 'w1', color: 'red' }, { k: 'setWireStyle', id: 'w2', label: 'to lamp' });
    w = style(w, { k: 'unwire', id: 'w1' });
    expect(w.project.wireStyles).toEqual({ w2: { label: 'to lamp' } });
    w = style(w, { k: 'remove', id: 'lamp' });
    expect(w.project.wireStyles).toBeUndefined();
    const base = JSON.parse(JSON.stringify(bench().project));
    for (const bad of [{ ghost: { color: 'red' } }, { w1: { color: 'nope' } }, { w1: { label: 5 } }, { w1: { extra: 1 } }, { w1: 'red' }, [], null])
      expect(() => validateProject({ ...base, wireStyles: bad }), JSON.stringify(bad)).toThrow();
    expect(validateProject({ ...base, wireStyles: { w1: { color: 'red', label: 'L1' } } }).wireStyles).toEqual({ w1: { color: 'red', label: 'L1' } });
    expect(validateProject({ ...base, wireStyles: { w1: {} } }).wireStyles).toBeUndefined();
  });
  it('old project files without styles load unchanged, and styled projects round-trip through the library', async () => {
    const legacy = JSON.parse(JSON.stringify(bench().project));
    expect('wireStyles' in validateProject(legacy)).toBe(false);
    const styled = style(bench(), { k: 'setWireStyle', id: 'w3', color: 'blue', label: '0V' }).project;
    let n = 0;
    const lib = createLibrary({ store: createMemoryStore(), validate: validateProject, now: () => 't', newId: () => `id${++n}` });
    const made = await lib.create('styled', styled);
    if (!made.ok) throw new Error('create');
    const open = await lib.open(made.meta.id);
    expect(open.status === 'ok' && (open.project as typeof styled).wireStyles).toEqual({ w3: { color: 'blue', label: '0V' } });
  });
  it('helpers are pure and every colour has a label and a CSS value', () => {
    const p = bench().project;
    expect(withWireStyle(p, 'w1', { color: 'green' })).not.toBe(p); expect(p.wireStyles).toBeUndefined();
    expect(pruneWireStyles(p)).toBe(p);
    expect(validateWireStyles(undefined, p.wires)).toBeUndefined();
    for (const c of Object.values(WIRE_COLORS)) { expect(c.label.length).toBeGreaterThan(2); expect(c.css).toMatch(/^#[0-9a-f]{6}$/i); }
  });
});
