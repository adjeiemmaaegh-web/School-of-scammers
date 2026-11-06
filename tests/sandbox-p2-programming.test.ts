import { describe, expect, it } from 'vitest';
import { createWorld, newProject, renderSnapshot, tick, validateProject, validateSandboxProgram } from '../src/sim/orchestrator';
import { DEFAULT_ST_SOURCE } from '../src/program/p2-contract';
import type { LadderDocument } from '../src/engineering/ladder';
import type { Command, WorldState } from '../src/sim/signals';

const placed: Command[] = [
  { k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } },
  { k: 'place', id: 'plc', kind: 'plc', at: { x: 280, y: 10 } },
  { k: 'place', id: 'start', kind: 'start', at: { x: 10, y: 240 } },
  { k: 'place', id: 'stop', kind: 'stop', at: { x: 280, y: 240 } },
  { k: 'place', id: 'con', kind: 'contactor', at: { x: 560, y: 10 } },
  { k: 'place', id: 'motor', kind: 'motor', at: { x: 800, y: 10 } },
];
const pairs: [string,string][] = [
  ['ps.P24', 'plc.L+'], ['ps.M0', 'plc.M'],
  ['ps.P24', 'start.A'], ['start.B', 'plc.I0.0'],
  ['ps.P24', 'stop.A'], ['stop.B', 'plc.I0.1'],
  ['plc.Q0.0', 'con.A1'], ['ps.M0', 'con.A2'],
  ['ps.P24', 'con.13'], ['con.14', 'motor.L+'], ['ps.M0', 'motor.M-'],
];
const wires = pairs.map(([from,to], i): Command => ({ k: 'wire', id: `wire${i}`, from, to }));
const build = () => tick(createWorld(), [...placed, ...wires]).world;
const scan = (initial: WorldState, scans: number) => {
  let w = initial;
  for (let n=0; n<scans; n++) w=tick(w).world;
  return w;
};
const contact = (tag: string) => ({ type: 'contact' as const, tag });
const delayProgram: LadderDocument = {
  id: 'delay-lesson', version: '1.0',
  symbols: { DelayReady: { description: 'TON elapsed' } },
  rungs: [
    { id: 'timer', elements: [contact('Start')], coil: 'DelayReady',
      operation: { kind: 'ton', presetMs: 150 } },
    { id: 'drive', elements: [contact('StopOK'), contact('DelayReady')], coil: 'Run' },
  ],
};
const counterProgram: LadderDocument = {
  id: 'counter-lesson', version: '1.0',
  symbols: { CountReady: { description: 'Two rising input edges' } },
  rungs: [
    { id: 'count', elements: [contact('Start')], coil: 'CountReady',
      operation: { kind: 'ctu', preset: 2 } },
    { id: 'drive', elements: [contact('CountReady'), contact('StopOK')], coil: 'Run' },
  ],
};

describe('P2 real worker programming modes and scan-state contract', () => {
  it('extends the actual motor wiring with a real TON and multi-rung scan order', () => {
    expect(validateSandboxProgram(delayProgram)).toEqual([]);
    let w = tick(build(), [{ k: 'loadProgram', program: delayProgram },
      { k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world;
    expect(w.ladderMemory.timer.elapsedMs).toBe(50);
    expect(w.coils.Run).toBe(false);
    w = scan(w, 1);
    expect(w.ladderMemory.timer.elapsedMs).toBe(100);
    expect(w.coils.Run).toBe(false);
    w = scan(w, 1);
    expect(w.ladderMemory.timer.elapsedMs).toBe(150);
    expect(w.coils.DelayReady).toBe(true);
    expect(w.coils.Run).toBe(true);
    w = scan(w, 3);
    expect(w.motorOn).toBe(true);
    expect(renderSnapshot(w).ladderSteps).toHaveLength(2);
    w = tick(w, [{ k: 'operate', id: 'start', pressed: false }]).world;
    w = scan(w, 4);
    expect(w.ladderMemory.timer.elapsedMs).toBe(0);
    expect(w.motorOn).toBe(false);
  });
  it('CTU increments only on actual rising Start edges, exposing CV and tag values', () => {
    let w = tick(build(), [{ k: 'loadProgram', program: counterProgram },
      { k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world;
    expect(w.ladderMemory.count.count).toBe(1);
    w = scan(w, 4);
    expect(w.ladderMemory.count.count).toBe(1);
    w = tick(w, [{ k: 'operate', id: 'start', pressed: false }]).world;
    w = scan(w, 2);
    w = tick(w, [{ k: 'operate', id: 'start', pressed: true }]).world;
    w = scan(w, 4);
    expect(w.ladderMemory.count.count).toBe(2);
    expect(w.tagValues.CountReady).toBe(true);
    expect(w.motorOn).toBe(true);
  });
  it('executes real compiled ST against the same physical motor and persists PLC memory', () => {
    let w = tick(build(), [{ k: 'loadST', source: DEFAULT_ST_SOURCE }]).world;
    expect(w.project.language).toBe('st');
    expect(w.project.stSource).toBe(DEFAULT_ST_SOURCE);
    w = tick(w, [{ k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world;
    w = scan(w, 4);
    expect(w.coils.Run).toBe(true);
    expect(w.motorOn).toBe(true);
    w = tick(w, [{ k: 'operate', id: 'start', pressed: false }]).world;
    w = scan(w, 3);
    expect(w.motorOn).toBe(true);
    expect(w.stMemory.Run).toBe(true);
    w = tick(w, [{ k: 'operate', id: 'stop', pressed: true }]).world;
    w = scan(w, 4);
    expect(w.motorOn).toBe(false);
    expect(w.stMemory.Run).toBe(false);
    const checked = validateProject(w.project);
    expect(checked.stSource).toBe(DEFAULT_ST_SOURCE);
    expect(checked.language).toBe('st');
  });
  it('rejects invalid ST on load without mutating the good project', () => {
    const w = build();
    const invalid = tick(w, [{ k: 'loadST', source: 'Run := BAD!!!' }]).world;
    expect(invalid.project).toEqual(w.project);
    expect(invalid.lastError).toBeTruthy();
    expect(() => validateProject({ ...w.project, language: 'st', stSource: 'Run := 12;' })).not.toThrow();
    const runtime = tick(build(), [{ k: 'loadST', source: 'Run := 12;' },
      { k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world;
    expect(runtime.running).toBe(false);
    expect(runtime.lastError).toMatch(/Run output must be BOOL/);
  });
  it('maps case-insensitive ST output to canonical wired Run/Q0.0', () => {
    let w = tick(build(), [{ k: 'loadST', source: 'run := Start AND StopOK;' },
      { k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world;
    w = scan(w, 5);
    expect(w.coils.Run).toBe(true);
    expect(renderSnapshot(w).io['Q0.0']).toBe(true);
    expect(w.motorOn).toBe(true);
  });
  it('handles future scan breakpoints without forcing any I/O', () => {
    let w = tick(build(), [{ k: 'breakAtScan', scan: 3 },
      { k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world;
    expect(w.tick).toBe(1);
    w = scan(w, 3);
    expect(w.tick).toBe(3);
    expect(w.running).toBe(false);
    expect(w.breakpointHit).toBe('Paused at scan 3');
    const noChange = tick(w).world;
    expect(noChange.tick).toBe(3);
    w = tick(w, [{ k: 'breakAtScan', scan: null }]).world;
    expect(w.breakpointScan).toBeNull();
  });
  it('imports pre-P2 v1 projects with their original default Ladder behavior', () => {
    const project = newProject();
    const legacy = { formatVersion: 1, components: project.components, wires: project.wires,
      program: project.program };
    expect(validateProject(legacy)).toEqual(legacy);
    let w = createWorld(validateProject(legacy));
    w = tick(w, [{ k: 'step' }]).world;
    expect(w.tick).toBe(1);
    expect(w.project.language).toBeUndefined();
    expect(w.project.program.rungs).toHaveLength(1);
  });
  it('fails closed on undeclared contacts, duplicate coils and excessive rungs', () => {
    const invalid = { ...delayProgram,
      rungs: [{ ...delayProgram.rungs[0], elements: [contact('UnknownBool')] }, ...delayProgram.rungs.slice(1)] };
    expect(validateSandboxProgram(invalid).join(' ')).toMatch(/unknown contact/);
    const many = { ...delayProgram, rungs: Array.from({ length: 9 },
      (_, i) => ({ id: `r${i}`, elements: [contact('Start')], coil: `Aux${i}` })) };
    expect(validateSandboxProgram(many).join(' ')).toMatch(/at most 8/);
  });
});
