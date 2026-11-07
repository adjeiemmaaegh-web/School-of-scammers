import { describe, expect, it } from 'vitest';
import { COMPONENTS, PLC16_INPUT_TERMINALS, PLC16_OUTPUT_TERMINALS } from '../src/components/registry';
import { createWorld, latchProgram, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { defaultIo, ioOf, validateIoMap } from '../src/sim/plc-io';
import type { Command, WorldState } from '../src/sim/signals';

const contact = (tag: string) => ({ type: 'contact' as const, tag });
const prog = (rungs: [string, string][]) => ({ id: 'p', version: '1', rungs: rungs.map(([tag, coil], i) => ({ id: `r${i}`, elements: [contact(tag)], coil })) });
const w = (pairs: [string, string][]): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));

/** Supply, one 16/16 PLC, a pushbutton on I0.3 and a lamp on Q0.5. */
const bench = (extra: Command[] = []): WorldState => {
  const world = tick(createWorld(), [
    { k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } }, { k: 'place', id: 'p', kind: 'plc16', at: { x: 250, y: 10 } },
    { k: 'place', id: 'b', kind: 'start', at: { x: 10, y: 200 } }, { k: 'place', id: 'l', kind: 'lamp', at: { x: 500, y: 10 } },
    ...w([['ps.P24', 'p.L+'], ['ps.M0', 'p.M'], ['ps.P24', 'b.A'], ['b.B', 'p.I0.3'], ['p.Q0.5', 'l.L+'], ['l.M-', 'ps.M0']]), ...extra]).world;
  expect(world.lastError).toBeNull();
  return world;
};
const scan = (x: WorldState, n: number): WorldState => { for (let i = 0; i < n; i++) x = tick(x).world; return x; };
const press = (x: WorldState, id: string, on = true) => scan(tick(x, [{ k: 'operate', id, pressed: on }]).world, 6);
const run = (x: WorldState) => tick(x, [{ k: 'run' }]).world;
const view = (x: WorldState, id = 'p') => renderSnapshot(x).plcs[id];

describe('the 16/16 controller', () => {
  it('has 16 inputs and 16 outputs across two banks, plus L+ and M', () => {
    const t = COMPONENTS.plc16.terminals;
    expect(t.filter(x => x.role === 'input').map(x => x.name)).toEqual(PLC16_INPUT_TERMINALS);
    expect(t.filter(x => x.role === 'output').map(x => x.name)).toEqual(PLC16_OUTPUT_TERMINALS);
    expect(PLC16_INPUT_TERMINALS[15]).toBe('I1.7');
    expect(PLC16_OUTPUT_TERMINALS[15]).toBe('Q1.7');
    expect(new Set(t.map(x => x.name)).size).toBe(t.length);
  });
  it('as the first PLC gets a placeholder program that compiles for its own tags, so Run works at once', () => {
    const world = bench();
    expect(world.project.program.rungs[0]).toMatchObject({ coil: 'Out0' });
    expect(run(world).running).toBe(true);
  });
  it('drives a lamp on Q0.5 from a button on I0.3 through user-written logic, with neutral default tag names', () => {
    let world = tick(bench(), [{ k: 'loadProgram', program: prog([['In3', 'Out5']]) }]).world;
    expect(world.lastError).toBeNull();
    world = run(world);
    expect(world.deviceOn.l).toBe(false);
    world = press(world, 'b');
    expect(world.deviceOn.l).toBe(true);
    expect(view(world).io.inputs.find(p => p.terminal === 'I0.3')).toMatchObject({ tag: 'In3', on: true });
    expect(view(world).io.outputs.find(p => p.terminal === 'Q0.5')).toMatchObject({ tag: 'Out5', on: true });
    expect(view(world).outputs['Q0.5']).toBe(true);
    expect(view(world).kind).toBe('plc16');
    world = press(world, 'b', false);
    expect(world.deviceOn.l).toBe(false);
  });
  it('runs Structured Text against its own tags too, and rejects an unknown input name', () => {
    const st = ['VAR_INPUT', '  In3 : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Out5 : BOOL;', 'END_VAR', 'Out5 := In3;'].join('\n');
    let world = tick(bench(), [{ k: 'loadST', source: st }]).world;
    expect(world.lastError).toBeNull();
    world = press(run(world), 'b');
    expect(world.deviceOn.l).toBe(true);
    const bad = tick(bench(), [{ k: 'loadST', source: st.replaceAll('In3', 'Start') }]).world;
    expect(bad.lastError).toMatch(/Unsupported VAR_INPUT Start/);
    expect(bad.lastError).toMatch(/In0/);
  });
  it('uses both banks: an input on I1.7 drives an output on Q1.7 independently of the first bank', () => {
    const world = tick(createWorld(), [
      { k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } }, { k: 'place', id: 'p', kind: 'plc16', at: { x: 250, y: 10 } },
      { k: 'place', id: 'l1', kind: 'lamp', at: { x: 500, y: 10 } }, { k: 'place', id: 'l2', kind: 'lamp', at: { x: 500, y: 200 } },
      ...w([['ps.P24', 'p.L+'], ['ps.M0', 'p.M'], ['ps.P24', 'p.I1.7'], ['p.Q1.7', 'l1.L+'], ['l1.M-', 'ps.M0'], ['p.Q0.0', 'l2.L+'], ['l2.M-', 'ps.M0']]),
      { k: 'loadProgram', program: prog([['In15', 'Out15'], ['In0', 'Out0']]) }]).world;
    expect(world.lastError).toBeNull();
    const r = scan(run(world), 6);
    expect(r.deviceOn).toMatchObject({ l1: true, l2: false }); // In15 is high, In0 is not
    expect(view(r).outputs['Q1.7']).toBe(true);
    expect(view(r).outputs['Q0.0']).toBe(false);
  });
});

describe('renaming tags', () => {
  const rename = { k: 'configureIo' as const, plc: 'p', io: { inputs: { 'I0.3': 'Level' }, outputs: { 'Q0.5': 'Alarm' } } };
  it('is refused while the active program still uses the old names, and says why', () => {
    const world = tick(bench([{ k: 'loadProgram', program: prog([['In3', 'Out5']]) }]), [rename]).world;
    expect(world.lastError).toMatch(/Renaming would break the program on p/);
    expect(ioOf(world.project, { id: 'p', kind: 'plc16' }).inputs['I0.3']).toBe('In3');
    expect(world.project.plcIo).toBeUndefined();
  });
  it('works on a program that does not use the renamed tags, after which the new names drive the plant', () => {
    let world = tick(bench([{ k: 'loadProgram', program: prog([['In0', 'Out0']]) }]), [rename]).world;
    expect(world.lastError).toBeNull();
    expect(world.project.plcIo?.p.inputs['I0.3']).toBe('Level');
    world = tick(world, [{ k: 'loadProgram', program: prog([['Level', 'Alarm']]) }]).world;
    expect(world.lastError).toBeNull();
    world = press(run(world), 'b');
    expect(world.deviceOn.l).toBe(true);
    expect(view(world).io.inputs.find(p => p.terminal === 'I0.3')?.tag).toBe('Level');
    expect(view(world).io.outputs.find(p => p.terminal === 'Q0.5')?.tag).toBe('Alarm');
    // the old names are gone for this controller (checked while paused, when edits are allowed)
    const paused = tick(world, [{ k: 'pause' }]).world;
    expect(tick(paused, [{ k: 'loadProgram', program: prog([['In3', 'Out5']]) }]).world.lastError).toMatch(/unknown contact In3/);
  });
  it('restoring every default name removes the saved entry', () => {
    let world = tick(bench([{ k: 'loadProgram', program: prog([['In0', 'Out0']]) }]), [rename]).world;
    expect(world.project.plcIo).toBeDefined();
    world = tick(world, [{ k: 'configureIo', plc: 'p', io: defaultIo('plc16') }]).world;
    expect(world.project.plcIo).toBeUndefined();
    expect(Object.hasOwn(world.project, 'plcIo')).toBe(false);
  });
  it('is refused while running, and for an unknown PLC', () => {
    const world = tick(bench([{ k: 'loadProgram', program: prog([['In0', 'Out0']]) }]), [{ k: 'run' }]).world;
    expect(tick(world, [rename]).world.lastError).toMatch(/Pause simulation/);
    expect(tick(bench(), [{ ...rename, plc: 'nope' }]).world.lastError).toMatch(/Unknown PLC/);
  });
  it('the classic five-in/six-out controller has a fixed map and cannot be renamed', () => {
    const world = tick(createWorld(), [{ k: 'place', id: 'c', kind: 'plc', at: { x: 10, y: 10 } }, { k: 'configureIo', plc: 'c', io: { inputs: { 'I0.0': 'Go' }, outputs: {} } }]).world;
    expect(world.lastError).toMatch(/fixed I\/O map/);
  });
});

describe('renaming the first terminals of a fresh controller', () => {
  const first = { k: 'configureIo' as const, plc: 'p', io: { inputs: { 'I0.0': 'Go' }, outputs: { 'Q0.0': 'Ext' } } };
  it('the untouched placeholder program follows the rename, so a new controller can be named straight away', () => {
    const world = tick(bench(), [first]).world;
    expect(world.lastError).toBeNull();
    expect(world.project.program.rungs[0]).toMatchObject({ elements: [{ tag: 'Go' }], coil: 'Ext' });
    expect(world.project.stSource).toContain('Ext := Go;');
    expect(run(world).running).toBe(true); // and it still runs
    // again, to different names, still following
    const again = tick(world, [{ k: 'configureIo', plc: 'p', io: { inputs: { 'I0.0': 'Open' }, outputs: { 'Q0.0': 'Close' } } }]).world;
    expect(again.project.program.rungs[0]).toMatchObject({ elements: [{ tag: 'Open' }], coil: 'Close' });
  });
  it('a program the user wrote is NOT rewritten, and still protects them', () => {
    const written = bench([{ k: 'loadProgram', program: prog([['In0', 'Out0'], ['In3', 'Out5']]) }]);
    const refused = tick(written, [first]).world;
    expect(refused.lastError).toMatch(/Renaming would break the program/);
    expect(refused.project.program.rungs).toHaveLength(2);
  });
  it('an extra 16/16 controller without a saved program also gets a placeholder in its own current names', () => {
    let world = tick(createWorld(), [{ k: 'place', id: 'a', kind: 'plc', at: { x: 10, y: 10 } }, { k: 'place', id: 'z', kind: 'plc16', at: { x: 10, y: 300 } },
      { k: 'configureIo', plc: 'z', io: { inputs: { 'I0.0': 'Sensor' }, outputs: { 'Q0.0': 'Valve' } } }]).world;
    expect(world.lastError).toBeNull();
    world = tick(world, [{ k: 'run' }]).world;
    expect(world.running).toBe(true); // run validates the extra's generated placeholder against its renamed tags
  });
});

describe('tag-name validation', () => {
  const bad = (io: unknown) => validateIoMap('plc16', io);
  it('rejects bad names, reserved words, duplicates (case-insensitive, across inputs and outputs) and foreign terminals', () => {
    expect(bad({ inputs: { 'I0.0': '1abc' }, outputs: {} })[0]).toMatch(/not a valid tag name/);
    expect(bad({ inputs: { 'I0.0': 'has space' }, outputs: {} })[0]).toMatch(/not a valid tag name/);
    expect(bad({ inputs: { 'I0.0': 'a'.repeat(25) }, outputs: {} })[0]).toMatch(/not a valid tag name/);
    for (const word of ['TRUE', 'and', 'End_Var', 'bool', 'Unused', '__proto__']) expect(bad({ inputs: { 'I0.0': word }, outputs: {} })[0], word).toMatch(/not a valid tag name/);
    expect(bad({ inputs: { 'I0.0': 'Dup', 'I0.1': 'dup' }, outputs: {} })[0]).toMatch(/used by both/);
    expect(bad({ inputs: { 'I0.0': 'Same' }, outputs: { 'Q0.0': 'SAME' } })[0]).toMatch(/used by both/);
    expect(bad({ inputs: { 'I0.0': 'In1' }, outputs: {} })[0]).toMatch(/used by both/); // collides with the default name of I0.1
    expect(bad({ inputs: { 'Q0.0': 'X' }, outputs: {} })[0]).toMatch(/not an input terminal/);
    expect(bad({ inputs: {}, outputs: { 'I0.0': 'X' } })[0]).toMatch(/not an output terminal/);
    expect(bad({ inputs: { 'I9.9': 'X' }, outputs: {} })[0]).toMatch(/not an input terminal/);
    expect(bad(null)[0]).toMatch(/must be an object/);
    expect(bad({ inputs: [], outputs: {} })[0]).toMatch(/must be an object/);
  });
  it('accepts a full set of descriptive names', () => {
    const inputs = Object.fromEntries(PLC16_INPUT_TERMINALS.map((t, i) => [t, `Sensor_${i}`]));
    const outputs = Object.fromEntries(PLC16_OUTPUT_TERMINALS.map((t, i) => [t, `Valve_${i}`]));
    expect(bad({ inputs, outputs })).toEqual([]);
  });
});

describe('mixed controllers in one project', () => {
  const both = (first: 'plc' | 'plc16'): WorldState => {
    const second = first === 'plc' ? 'plc16' : 'plc';
    const world = tick(createWorld(), [
      { k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } }, { k: 'place', id: 'a', kind: first, at: { x: 250, y: 10 } },
      { k: 'place', id: 'z', kind: second, at: { x: 250, y: 300 } }, { k: 'place', id: 'b', kind: 'start', at: { x: 10, y: 200 } },
      { k: 'place', id: 'l', kind: 'lamp', at: { x: 600, y: 10 } },
      ...w([['ps.P24', 'a.L+'], ['ps.M0', 'a.M'], ['ps.P24', 'z.L+'], ['ps.M0', 'z.M'], ['ps.P24', 'b.A'], ['b.B', 'z.I0.0'], ['ps.P24', 'z.I0.1'], ['z.Q0.0', 'l.L+'], ['l.M-', 'ps.M0']])]).world;
    expect(world.lastError).toBeNull();
    return world;
  };
  it('a classic first PLC with a 16/16 second PLC: the second runs its own tags', () => {
    let world = tick(both('plc'), [{ k: 'loadProgram', program: prog([['In0', 'Out0']]), plc: 'z' }]).world;
    expect(world.lastError).toBeNull();
    world = press(run(world), 'b');
    expect(world.deviceOn.l).toBe(true);
    expect(Object.keys(renderSnapshot(world).plcs)).toEqual(['a', 'z']);
    expect(view(world, 'a').kind).toBe('plc');
    expect(view(world, 'z').kind).toBe('plc16');
  });
  it('a 16/16 first PLC with a classic second PLC: the classic one keeps its fixed names', () => {
    let world = tick(both('plc16'), [{ k: 'loadProgram', program: latchProgram(), plc: 'z' }]).world;
    expect(world.lastError).toBeNull();
    world = press(run(world), 'b'); // wired to the classic PLC's I0.0 = Start; Q0.0 = Run drives the lamp
    expect(world.deviceOn.l).toBe(true);
    expect(view(world, 'z').io.inputs.find(p => p.terminal === 'I0.0')?.tag).toBe('Start');
  });
  it('a classic program is rejected on a 16/16 PLC, and a 16/16 program on a classic PLC', () => {
    expect(tick(both('plc'), [{ k: 'loadProgram', program: latchProgram(), plc: 'z' }]).world.lastError).toMatch(/Start|Run/);
    expect(tick(both('plc'), [{ k: 'loadProgram', program: prog([['In0', 'Out0']]), plc: 'a' }]).world.lastError).toMatch(/In0|Out0/);
    // and the program was not loaded
    expect(tick(both('plc'), [{ k: 'loadProgram', program: latchProgram(), plc: 'z' }]).world.project.plcPrograms).toBeUndefined();
  });
});

describe('project files and editing', () => {
  it('names round-trip through a saved project and a single classic project keeps its exact shape', () => {
    const rename = { k: 'configureIo' as const, plc: 'p', io: { inputs: { 'I0.3': 'Level' }, outputs: { 'Q0.5': 'Alarm' } } };
    const world = tick(bench([{ k: 'loadProgram', program: prog([['In0', 'Out0']]) }]), [rename]).world;
    const copy = validateProject(JSON.parse(JSON.stringify(world.project)));
    expect(copy.plcIo?.p.inputs['I0.3']).toBe('Level');
    const reloaded = tick(createWorld(), [{ k: 'loadProject', project: copy }]).world;
    expect(reloaded.lastError).toBeNull();
    expect(view(reloaded).io.inputs.find(p => p.terminal === 'I0.3')?.tag).toBe('Level');
    const classic = tick(createWorld(), [{ k: 'place', id: 'c', kind: 'plc', at: { x: 10, y: 10 } }]).world;
    expect(Object.hasOwn(validateProject(classic.project), 'plcIo')).toBe(false);
  });
  it('rejects I/O configuration for a classic PLC, an unknown id, invalid names, or a program that no longer matches', () => {
    const world = tick(bench([{ k: 'loadProgram', program: prog([['In0', 'Out0']]) }]), []).world;
    const withIo = (plcIo: unknown) => ({ ...world.project, plcIo });
    expect(() => validateProject(withIo({ nope: { inputs: {}, outputs: {} } }))).toThrow(/not a configurable PLC/);
    expect(() => validateProject(withIo({ p: { inputs: { 'I0.0': '1x' }, outputs: {} } }))).toThrow(/not a valid tag name/);
    expect(() => validateProject(withIo({ p: { inputs: { 'I0.0': 'Renamed' }, outputs: {} } }))).toThrow(/unknown contact In0/); // program still says In0
    expect(() => validateProject(withIo([]))).toThrow(/Invalid PLC I\/O/);
    const classic = tick(createWorld(), [{ k: 'place', id: 'c', kind: 'plc', at: { x: 10, y: 10 } }]).world;
    expect(() => validateProject({ ...classic.project, plcIo: { c: { inputs: {}, outputs: {} } } })).toThrow(/not a configurable PLC/);
  });
  it('removing a 16/16 PLC drops its names; removing the first PLC promotes the next with its own program', () => {
    const rename = { k: 'configureIo' as const, plc: 'p', io: { inputs: { 'I0.3': 'Level' }, outputs: {} } };
    let world = tick(bench([{ k: 'loadProgram', program: prog([['In0', 'Out0']]) }]), [rename]).world;
    world = tick(world, [{ k: 'remove', id: 'p' }]).world;
    expect(world.project.plcIo).toBeUndefined();
    // first = classic, second = 16/16 with a program; removing the classic promotes the 16/16 into the legacy fields
    let two = tick(createWorld(), [{ k: 'place', id: 'a', kind: 'plc', at: { x: 10, y: 10 } }, { k: 'place', id: 'z', kind: 'plc16', at: { x: 10, y: 300 } },
      { k: 'loadProgram', program: prog([['In1', 'Out2']]), plc: 'z' }]).world;
    expect(two.lastError).toBeNull();
    two = tick(two, [{ k: 'remove', id: 'a' }]).world;
    expect(two.project.program.rungs[0]).toMatchObject({ coil: 'Out2' });
    expect(() => validateProject(JSON.parse(JSON.stringify(two.project)))).not.toThrow();
    expect(Object.keys(renderSnapshot(two).plcs)).toEqual(['z']);
  });
  it('replays identically', () => {
    const play = () => JSON.stringify(renderSnapshot(press(run(tick(bench(), [{ k: 'loadProgram', program: prog([['In3', 'Out5']]) }]).world), 'b')));
    expect(play()).toBe(play());
  });
});
