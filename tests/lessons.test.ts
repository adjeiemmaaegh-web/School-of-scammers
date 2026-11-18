import { describe, expect, it } from 'vitest';
import { LESSONS, gradeLesson, lessonById, starterProject, type Lesson } from '../src/exercises/lessons';
import { createWorld, tick } from '../src/sim/orchestrator';
import type { Command, ProjectFile } from '../src/sim/signals';

const wires = (pairs: [string, string][]): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));
const build = (lesson: Lesson, extra: Command[]): ProjectFile => {
  const w = tick(tick(createWorld(), lesson.starterCommands).world, extra).world;
  expect(w.lastError, `building ${lesson.id}`).toBeNull();
  return w.project;
};
const ST = (pt: string, withTimer = true) => ['VAR_INPUT', '  Go : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Lamp : BOOL;', 'END_VAR', ...(withTimer ? ['VAR', '  tm : TON;', 'END_VAR', `tm(IN := Go, PT := ${pt});`, 'Lamp := tm.Q;'] : ['Lamp := Go;'])].join('\n');
const l3 = (source: string): Command[] => [
  ...wires([['ps.P24', 'p.L+'], ['ps.M0', 'p.M'], ['ps.P24', 'go.A'], ['go.B', 'p.I0.0'], ['p.Q0.0', 'lamp.L+'], ['lamp.M-', 'ps.M0']]),
  { k: 'configureIo', plc: 'p', io: { inputs: { 'I0.0': 'Go' }, outputs: { 'Q0.0': 'Lamp' } } }, { k: 'loadST', source }];
const L1 = lessonById('lamp-pushbutton')!, L2 = lessonById('relay-seal-in')!, L3 = lessonById('st-delayed-lamp')!;
const solution1 = wires([['ps.P24', 'go.A'], ['go.B', 'lamp.L+'], ['lamp.M-', 'ps.M0']]);
const solution2 = wires([['ps.P24', 'stop.A'], ['stop.B', 'start.A'], ['stop.B', 'k.13'], ['start.B', 'k.A1'], ['k.14', 'k.A1'], ['k.A2', 'ps.M0'], ['ps.P24', 'k.23'], ['k.24', 'lamp.L+'], ['lamp.M-', 'ps.M0']]);

describe('R9.3/R9.4 lessons', () => {
  it('starters contain parts only: no wires and no learner program, so they never hold the answer', () => {
    for (const l of LESSONS) {
      const p = starterProject(l);
      expect(p.wires, l.id).toEqual([]);
      expect(p.components.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.objectives.length).toBeGreaterThan(0); expect(l.hints.length).toBeGreaterThan(0);
    }
  });
  it('every lesson expects each checked device both ON and OFF (a vacuous build cannot pass)', () => {
    for (const l of LESSONS) {
      const byDevice = new Map<string, Set<boolean>>();
      for (const c of l.checks) for (const e of c.expect) byDevice.set(e.device, (byDevice.get(e.device) ?? new Set()).add(e.on));
      for (const [device, states] of byDevice) expect([...states].sort(), `${l.id}:${device}`).toEqual([false, true]);
      for (const c of l.checks) for (const e of c.expect) expect(l.starterCommands.some(s => s.k === 'place' && s.id === e.device), `${l.id}:${e.device}`).toBe(true);
    }
  });
  it('a correct build of each lesson passes every check', () => {
    expect(gradeLesson(L1, build(L1, solution1)).passed).toBe(true);
    expect(gradeLesson(L2, build(L2, solution2)).passed).toBe(true);
    expect(gradeLesson(L3, build(L3, l3(ST('T#1s')))).passed).toBe(true);
  });
  it('accepts a different correct implementation (any tag names, extra parts)', () => {
    const renamed = l3(ST('T#1s').replaceAll('Go', 'Pressed').replaceAll('Lamp', 'Beacon'));
    (renamed[6] as { io: { inputs: Record<string, string>; outputs: Record<string, string> } }).io = { inputs: { 'I0.0': 'Pressed' }, outputs: { 'Q0.0': 'Beacon' } };
    expect(gradeLesson(L3, build(L3, renamed)).passed).toBe(true);
    const withExtra = build(L1, [{ k: 'place', id: 'spare', kind: 'lamp', at: { x: 600, y: 300 } }, ...solution1]);
    expect(gradeLesson(L1, withExtra).passed).toBe(true);
  });
  it('rejects an unbuilt starter, an always-on lamp and a lamp that never lights, naming the failing expectation', () => {
    const starter = gradeLesson(L1, starterProject(L1));
    expect(starter.passed).toBe(false); expect(starter.built).toBe(false);
    const alwaysOn = gradeLesson(L1, build(L1, wires([['ps.P24', 'lamp.L+'], ['lamp.M-', 'ps.M0']])));
    expect(alwaysOn.passed).toBe(false);
    expect(alwaysOn.results.find(r => !r.passed)!.reason).toMatch(/lamp was ON, it should be OFF/);
    const never = gradeLesson(L1, build(L1, wires([['ps.P24', 'go.A'], ['go.B', 'lamp.L+']])));
    expect(never.passed).toBe(false);
    expect(never.results.some(r => /should be ON/.test(r.reason))).toBe(true);
  });
  it('rejects a relay circuit without the seal-in, and PLC programs with the wrong or no delay', () => {
    const noSeal = solution2.filter(c => !(c.k === 'wire' && c.from === 'k.14'));
    const r2 = gradeLesson(L2, build(L2, noSeal));
    expect(r2.passed).toBe(false); expect(r2.results.find(r => !r.passed)!.label).toMatch(/latches/i);
    expect(gradeLesson(L3, build(L3, l3(ST('T#3s')))).results.find(r => !r.passed)!.label).toMatch(/On after the delay/);
    expect(gradeLesson(L3, build(L3, l3(ST('', false)))).results.find(r => !r.passed)!.label).toMatch(/Still off before the delay/);
  });
  it('never throws on a rejected project and is deterministic', () => {
    const bad = { ...starterProject(L1), components: 'nope' } as unknown as ProjectFile;
    const r = gradeLesson(L1, bad);
    expect(r.passed).toBe(false);
    const a = JSON.stringify(gradeLesson(L2, build(L2, solution2))), b = JSON.stringify(gradeLesson(L2, build(L2, solution2)));
    expect(a).toBe(b);
  });
  it('runs fast enough to run on the UI thread', () => {
    const project = build(L3, l3(ST('T#1s')));
    const t0 = performance.now(); gradeLesson(L3, project);
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});
