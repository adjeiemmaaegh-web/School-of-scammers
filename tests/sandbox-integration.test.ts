import { describe, expect, it } from 'vitest';
import { createWorld, latchProgram, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const placed: Command[] = [
  { k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } },
  { k: 'place', id: 'plc', kind: 'plc', at: { x: 280, y: 10 } },
  { k: 'place', id: 'start', kind: 'start', at: { x: 10, y: 240 } },
  { k: 'place', id: 'stop', kind: 'stop', at: { x: 280, y: 240 } },
  { k: 'place', id: 'con', kind: 'contactor', at: { x: 560, y: 10 } },
  { k: 'place', id: 'motor', kind: 'motor', at: { x: 800, y: 10 } },
];
const pairs = [
  ['ps.P24', 'plc.L+'], ['ps.M0', 'plc.M'],
  ['ps.P24', 'start.A'], ['start.B', 'plc.I0.0'],
  ['ps.P24', 'stop.A'], ['stop.B', 'plc.I0.1'],
  ['plc.Q0.0', 'con.A1'], ['ps.M0', 'con.A2'],
  ['ps.P24', 'con.13'], ['con.14', 'motor.L+'], ['ps.M0', 'motor.M-'],
];
const wireCommands = pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));
function fixture(wires: Command[] = wireCommands): WorldState {
  return tick(createWorld(), [...placed, ...wires, { k: 'loadProgram', program: latchProgram() }]).world;
}
const scan = (w: WorldState, n = 1): WorldState => {
  for (let i = 0; i < n; i++) w = tick(w).world;
  return w;
};
describe('P1 open sandbox: real ladder → wiring → motor', () => {
  it('seals in after Start is released and releases on Stop', () => {
    let w = fixture();
    w = tick(w, [{ k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world;
    w = scan(w, 3);
    expect(renderSnapshot(w).motorOn).toBe(true);
    const angleWhenRunning = w.motorAngleRad;
    expect(angleWhenRunning).toBeGreaterThan(0);
    w = tick(w, [{ k: 'operate', id: 'start', pressed: false }]).world;
    w = scan(w, 3);
    expect(w.inputs.Start).toBe(false);
    expect(renderSnapshot(w).motorOn).toBe(true);
    w = tick(w, [{ k: 'operate', id: 'stop', pressed: true }]).world;
    w = scan(w, 3);
    expect(renderSnapshot(w).motorOn).toBe(false);
    const angleAtStop = w.motorAngleRad;
    w = scan(w, 4);
    expect(w.motorAngleRad).toBe(angleAtStop);
  });
  it('wrong ladder logic stops the motor after releasing Start', () => {
    let w = fixture();
    w = tick(w, [{ k: 'loadProgram', program: { id: 'wrong', version: '1', rungs: [
      { id: 'r1', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' },
    ] } }, { k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world;
    w = scan(w, 3);
    expect(w.motorOn).toBe(true);
    w = tick(w, [{ k: 'operate', id: 'start', pressed: false }]).world;
    w = scan(w, 3);
    expect(w.motorOn).toBe(false);
  });
  it('broken PLC output wiring prevents contactor and motor from energising', () => {
    let w = fixture(wireCommands.filter(c => c.k !== 'wire' || c.from !== 'plc.Q0.0'));
    w = tick(w, [{ k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world;
    w = scan(w, 4);
    expect(w.coils.Run).toBe(true);
    expect(w.motorOn).toBe(false);
  });
  it('same scenario and command log replay to an identical result', () => {
    const commands: Command[][] = [[{ k: 'operate', id: 'start', pressed: true }, { k: 'run' }], [], [], [{ k: 'operate', id: 'start', pressed: false }], [], []];
    const run = () => commands.reduce((w, c) => tick(w, c).world, fixture());
    expect(run()).toEqual(run());
  });
  it('rejects malicious/invalid project structure without mutating state', () => {
    const source = fixture();
    const bad = { ...source.project, wires: [{ id: 'fake', from: 'missing.A', to: 'plc.I0.0' }] };
    expect(() => validateProject(bad)).toThrow(/wire/);
    expect(() => validateProject({ ...source.project, components: [{ ...source.project.components[0], kind: '__proto__' }] })).toThrow(/component/);
    const next = tick(source, [{ k: 'loadProject', project: bad }]).world;
    expect(next.project).toEqual(source.project);
    expect(next.lastError).toMatch(/wire/);
  });
});
