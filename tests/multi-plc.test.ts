import { describe, expect, it } from 'vitest';
import { blankProgram, createWorld, latchProgram, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

/** One motor starter "panel": supply, PLC, START, STOP, contactor, motor, wired like the P1 circuit. */
const panelPlaces = (n: number, dx: number): Command[] => [
  { k: 'place', id: `ps${n}`, kind: 'supply', at: { x: 10 + dx, y: 10 } },
  { k: 'place', id: `plc${n}`, kind: 'plc', at: { x: 280 + dx, y: 10 } },
  { k: 'place', id: `start${n}`, kind: 'start', at: { x: 10 + dx, y: 240 } },
  { k: 'place', id: `stop${n}`, kind: 'stop', at: { x: 280 + dx, y: 240 } },
  { k: 'place', id: `con${n}`, kind: 'contactor', at: { x: 560 + dx, y: 10 } },
  { k: 'place', id: `motor${n}`, kind: 'motor', at: { x: 800 + dx, y: 10 } },
];
const panelLinks = (n: number): [string, string][] => [
  [`ps${n}.P24`, `plc${n}.L+`], [`ps${n}.M0`, `plc${n}.M`],
  [`ps${n}.P24`, `start${n}.A`], [`start${n}.B`, `plc${n}.I0.0`],
  [`ps${n}.P24`, `stop${n}.A`], [`stop${n}.B`, `plc${n}.I0.1`],
  [`plc${n}.Q0.0`, `con${n}.A1`], [`ps${n}.M0`, `con${n}.A2`],
  [`ps${n}.P24`, `con${n}.13`], [`con${n}.14`, `motor${n}.L+`], [`ps${n}.M0`, `motor${n}.M-`],
];
const wires = (pairs: [string, string][], prefix: string): Command[] =>
  pairs.map(([from, to], i): Command => ({ k: 'wire', id: `${prefix}${i}`, from, to }));

/** Two complete, independent panels. PLC 1 is the first PLC; PLC 2 is an additional one. */
function twoPanels(extra: Command[] = []): WorldState {
  const w = tick(createWorld(), [
    ...panelPlaces(1, 0), ...panelPlaces(2, 0),
    ...wires(panelLinks(1), 'a'), ...wires(panelLinks(2), 'b'),
    { k: 'loadProgram', program: latchProgram() },
    { k: 'loadProgram', program: latchProgram(), plc: 'plc2' },
    ...extra,
  ]).world;
  expect(w.lastError).toBeNull();
  return w;
}
const scan = (w: WorldState, n: number): WorldState => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const run = (w: WorldState) => tick(w, [{ k: 'run' }]).world;
const press = (w: WorldState, id: string, settle = 10) => scan(tick(w, [{ k: 'operate', id, pressed: true }]).world, settle);
const release = (w: WorldState, id: string, settle = 10) => scan(tick(w, [{ k: 'operate', id, pressed: false }]).world, settle);

describe('two panels with their own PLCs', () => {
  it('builds: two PLCs and two supplies are accepted and each PLC has its own program slot', () => {
    const w = twoPanels();
    expect(w.project.components.filter(c => c.kind === 'plc').map(c => c.id)).toEqual(['plc1', 'plc2']);
    expect(w.project.plcPrograms?.plc2?.program.rungs[0].coil).toBe('Run');
    expect(Object.keys(renderSnapshot(w).plcs)).toEqual(['plc1', 'plc2']);
  });

  it('each PLC powers up from its own supply and reports its own state', () => {
    const w = scan(run(twoPanels()), 5);
    const s = renderSnapshot(w);
    expect(s.plcs.plc1.powered).toBe(true);
    expect(s.plcs.plc2.powered).toBe(true);
    expect(s.plcs.plc1.inputs.StopOK).toBe(true);
    expect(s.plcs.plc2.inputs.StopOK).toBe(true);
  });

  it('starting panel 1 runs motor 1 only; panel 2 is untouched', () => {
    let w = press(run(twoPanels()), 'start1');
    expect(w.deviceOn.motor1).toBe(true);
    expect(w.deviceOn.motor2).toBe(false);
    const s = renderSnapshot(w);
    expect(s.plcs.plc1.outputs['Q0.0']).toBe(true);
    expect(s.plcs.plc2.outputs['Q0.0']).toBe(false);
    expect(w.deviceOn.con1).toBe(true);
    expect(w.deviceOn.con2).toBe(false);
    w = release(w, 'start1', 20);
    expect(w.deviceOn.motor1).toBe(true); // sealed in by PLC 1's own latch
  });

  it('starting panel 2 runs motor 2 only (the additional PLC really executes its program)', () => {
    let w = press(run(twoPanels()), 'start2');
    expect(w.deviceOn.motor2).toBe(true);
    expect(w.deviceOn.motor1).toBe(false);
    w = release(w, 'start2', 20);
    expect(w.deviceOn.motor2).toBe(true); // sealed in by PLC 2's latch, not PLC 1's
    expect(renderSnapshot(w).plcs.plc2.coils.Run).toBe(true);
  });

  it('both panels run and stop independently', () => {
    let w = release(press(release(press(run(twoPanels()), 'start1'), 'start1'), 'start2'), 'start2');
    expect(w.deviceOn).toMatchObject({ motor1: true, motor2: true });
    w = release(press(w, 'stop1', 20), 'stop1', 20);
    expect(w.deviceOn).toMatchObject({ motor1: false, motor2: true });
    w = release(press(w, 'stop2', 20), 'stop2', 20);
    expect(w.deviceOn).toMatchObject({ motor1: false, motor2: false });
  });

  it('legacy fields mirror the first panel only', () => {
    const w = release(press(release(press(run(twoPanels()), 'start2'), 'start2'), 'start1'), 'start1');
    expect(w.motorOn).toBe(w.deviceOn.motor1);
    expect(w.contactorOn).toBe(w.deviceOn.con1);
    const only2 = release(press(run(twoPanels()), 'start2'), 'start2');
    expect(only2.motorOn).toBe(false); // motor 2 is running but the legacy flag follows motor 1
    expect(only2.deviceOn.motor2).toBe(true);
  });

  it('every motor has its own shaft angle that advances only while that motor runs', () => {
    const w = scan(press(run(twoPanels()), 'start1'), 20);
    expect(w.motorAngles.motor1).toBeGreaterThan(0);
    expect(w.motorAngles.motor2 ?? 0).toBe(0);
  });
});

describe('each PLC runs its own program', () => {
  it('PLC 2 can be a different program: no seal-in, so it drops out when START is released', () => {
    const w0 = tick(twoPanels(), [{ k: 'loadProgram', program: blankProgram(), plc: 'plc2' }]).world;
    let w = release(press(release(press(run(w0), 'start1'), 'start1', 20), 'start2'), 'start2', 20);
    expect(w.deviceOn.motor1).toBe(true); // PLC 1 still latches
    expect(w.deviceOn.motor2).toBe(false); // PLC 2 follows START only
    w = press(w, 'start2');
    expect(w.deviceOn.motor2).toBe(true);
  });

  it('PLC 2 can run Structured Text while PLC 1 runs Ladder', () => {
    const st = ['VAR_INPUT', ' Start : BOOL;', ' StopOK : BOOL;', 'END_VAR', 'VAR_OUTPUT', ' Run : BOOL;', 'END_VAR',
      'Run := StopOK AND (Start OR Run);'].join('\n');
    const w0 = tick(twoPanels(), [{ k: 'loadST', source: st, plc: 'plc2' }]).world;
    expect(w0.project.plcPrograms?.plc2?.language).toBe('st');
    expect(w0.project.language ?? 'ladder').toBe('ladder');
    expect(renderSnapshot(w0).plcs.plc1.language).toBe('ladder');
    expect(renderSnapshot(w0).plcs.plc2.language).toBe('st');
    const w = release(press(run(w0), 'start2'), 'start2', 20);
    expect(w.deviceOn.motor2).toBe(true);
    expect(w.deviceOn.motor1).toBe(false);
  });

  it('editing PLC 2 never touches PLC 1\'s program, and vice versa', () => {
    const w0 = twoPanels();
    const edited = tick(w0, [{ k: 'loadProgram', program: blankProgram(), plc: 'plc2' }]).world;
    expect(edited.project.program).toEqual(w0.project.program);
    const edited1 = tick(w0, [{ k: 'loadProgram', program: blankProgram() }]).world;
    expect(edited1.project.plcPrograms).toEqual(w0.project.plcPrograms);
    expect(edited1.project.program.rungs[0].elements[0]).toMatchObject({ tag: 'Start' });
  });

  it('a program command for an unknown PLC is refused', () => {
    const w = tick(twoPanels(), [{ k: 'loadProgram', program: latchProgram(), plc: 'nope' }]).world;
    expect(w.lastError).toMatch(/Unknown PLC/);
  });
});

describe('PLCs interact only through the wired 24 V netlist', () => {
  /** Panel 2's START input is fed from PLC 1's Q0.0: motor 2 may only start once motor 1 is running. */
  const sequenced = (): WorldState => {
    const tie: [string, string][] = [['ps1.M0', 'ps2.M0'], ['plc1.Q0.0', 'plc2.I0.0']];
    const links = panelLinks(2).filter(([a, b]) => ![a, b].includes('start2.A') && ![a, b].includes('start2.B'));
    const w = tick(createWorld(), [
      ...panelPlaces(1, 0), ...panelPlaces(2, 0),
      ...wires(panelLinks(1), 'a'), ...wires(links, 'b'), ...wires(tie, 't'),
      { k: 'loadProgram', program: latchProgram() },
      { k: 'loadProgram', program: latchProgram(), plc: 'plc2' },
    ]).world;
    expect(w.lastError).toBeNull();
    return w;
  };
  it('PLC 2 starts only because PLC 1\'s output drives its input', () => {
    let w = scan(run(sequenced()), 15);
    expect(w.deviceOn).toMatchObject({ motor1: false, motor2: false });
    expect(renderSnapshot(w).plcs.plc2.inputs.Start).toBe(false);
    w = press(w, 'start1', 20);
    expect(w.deviceOn.motor1).toBe(true);
    expect(renderSnapshot(w).plcs.plc2.inputs.Start).toBe(true); // 24 V crossed from PLC 1 to PLC 2
    expect(w.deviceOn.motor2).toBe(true);
  });
  it('cutting the signal wire between the PLCs stops the chain', () => {
    const w0 = sequenced();
    const wire = w0.project.wires.find(x => x.from === 'plc1.Q0.0' && x.to === 'plc2.I0.0')!;
    const w = press(run(tick(w0, [{ k: 'unwire', id: wire.id }]).world), 'start1', 20);
    expect(w.deviceOn.motor1).toBe(true);
    expect(w.deviceOn.motor2).toBe(false);
  });
  it('without the common (M0) tie, the signal cannot cross between isolated supplies', () => {
    const w0 = sequenced();
    const tie = w0.project.wires.find(x => x.from === 'ps1.M0' && x.to === 'ps2.M0')!;
    const w = press(run(tick(w0, [{ k: 'unwire', id: tie.id }]).world), 'start1', 20);
    expect(w.deviceOn.motor1).toBe(true);
    expect(w.deviceOn.motor2).toBe(false);
  });
});

describe('faults and diagnostics work per device, not just on the first', () => {
  it('welded contacts on contactor 2 run motor 2 unprompted and leave panel 1 alone', () => {
    const w0 = tick(twoPanels(), [{ k: 'injectFault', kind: 'contactor-welded', target: 'con2', hidden: false }]).world;
    let w = scan(run(w0), 15);
    expect(w.deviceOn.motor2).toBe(true);
    expect(w.deviceOn.motor1).toBe(false);
    w = release(press(release(press(w, 'start1'), 'start1'), 'stop1', 20), 'stop1', 20);
    expect(w.deviceOn.motor1).toBe(false); // panel 1 stops normally
    expect(w.deviceOn.motor2).toBe(true); // panel 2 cannot be stopped
  });
  it('an open coil on contactor 1 stops motor 1 but not motor 2', () => {
    const w0 = tick(twoPanels(), [{ k: 'injectFault', kind: 'contactor-coil-open', target: 'con1', hidden: false }]).world;
    const w = release(press(release(press(run(w0), 'start1'), 'start1'), 'start2'), 'start2', 20);
    expect(w.deviceOn.motor1).toBe(false);
    expect(w.deviceOn.motor2).toBe(true);
  });
  it('the multimeter reads inside a panel that is not the first', () => {
    const w = scan(run(twoPanels()), 5);
    const m = tick(w, [{ k: 'setMeterProbe', lead: 'positive', terminal: 'plc2.L+' }, { k: 'setMeterProbe', lead: 'negative', terminal: 'plc2.M' }]).world.meter;
    expect(m).toMatchObject({ status: 'measured', volts: 24 });
  });
});

describe('the meter respects supply isolation', () => {
  const read = (w: WorldState, pos: string, neg: string) => tick(w, [
    { k: 'setMeterProbe', lead: 'positive', terminal: pos }, { k: 'setMeterProbe', lead: 'negative', terminal: neg }]).world.meter;
  it('probing between two unconnected supplies is floating, not a made-up 24 V', () => {
    const w = scan(run(twoPanels()), 4);
    expect(read(w, 'ps1.P24', 'ps2.M0')).toMatchObject({ status: 'floating', volts: null });
    expect(read(w, 'ps2.P24', 'ps2.M0')).toMatchObject({ status: 'measured', volts: 24 });
  });
  it('the same holds while the simulation is paused (a separate code path)', () => {
    const w = tick(scan(run(twoPanels()), 4), [{ k: 'pause' }]).world;
    expect(w.running).toBe(false);
    expect(read(w, 'ps1.P24', 'ps2.M0')).toMatchObject({ status: 'floating', volts: null });
    expect(read(w, 'ps1.P24', 'ps1.M0')).toMatchObject({ status: 'measured', volts: 24 });
  });
  it('once the commons are tied, the same probe pair is meaningful', () => {
    const w = scan(run(twoPanels([{ k: 'wire', id: 'common', from: 'ps1.M0', to: 'ps2.M0' }])), 4);
    expect(read(w, 'ps1.P24', 'ps2.M0')).toMatchObject({ status: 'measured', volts: 24 });
  });
});

describe('power, errors and limits', () => {
  it('an unpowered additional PLC does nothing and is called out; the other panel is unaffected', () => {
    const w0 = twoPanels();
    const lead = w0.project.wires.find(x => x.from === 'ps2.P24' && x.to === 'plc2.L+')!;
    let w = press(run(tick(w0, [{ k: 'unwire', id: lead.id }]).world), 'start1', 20);
    expect(renderSnapshot(w).plcs.plc2.powered).toBe(false);
    expect(w.diagnostics.some(d => /PLC plc2 is not powered/.test(d))).toBe(true);
    expect(w.deviceOn.motor1).toBe(true);
    w = press(w, 'start2', 20);
    expect(w.deviceOn.motor2).toBe(false);
  });
  it('a runtime fault in an additional PLC fails the whole plant closed and names that PLC', () => {
    // PLC 2 divides by zero the moment its START is pressed. Panel 1 is happily running at that point.
    const divide = { id: 'division', version: '1', symbols: { A: { description: 'numeric', type: 'REAL' as const, initial: 0 } },
      rungs: [{ id: 'div', elements: [{ type: 'contact' as const, tag: 'Start' }], coil: 'Run',
        operation: { kind: 'div' as const, target: 'A', left: { kind: 'literal' as const, value: 1 }, right: { kind: 'literal' as const, value: 0 } } }] };
    const w0 = tick(twoPanels(), [{ k: 'loadProgram', program: divide, plc: 'plc2' }]).world;
    expect(w0.lastError).toBeNull();
    let w = release(press(run(w0), 'start1', 20), 'start1', 20);
    expect(w.running).toBe(true);
    expect(w.deviceOn.motor1).toBe(true);
    w = press(w, 'start2', 3);
    expect(w.running).toBe(false);
    expect(w.lastError).toMatch(/PLC plc2 runtime error.*division by zero/);
    expect(w.deviceOn).toEqual({});
    expect(renderSnapshot(w).plcs.plc1.outputs['Q0.0']).toBe(false); // the healthy panel is de-energised too
  });
  it('run is refused when an additional PLC\'s program is invalid, naming it', () => {
    const w0 = twoPanels();
    const broken = { ...w0, project: { ...w0.project, plcPrograms: { plc2: { program: { id: 'x', version: '1', rungs: [{ id: 'r', elements: [], coil: 'Nope' }] } } } } } as unknown as WorldState;
    const w = tick(broken, [{ k: 'run' }]).world;
    expect(w.running).toBe(false);
    expect(w.lastError).toMatch(/PLC plc2/);
  });
  it('up to 6 PLCs and 6 supplies, then a clear error', () => {
    let w = createWorld();
    for (let i = 0; i < 6; i++) w = tick(w, [{ k: 'place', id: `p${i}`, kind: 'plc', at: { x: 10 + i * 100, y: 10 } },
      { k: 'place', id: `s${i}`, kind: 'supply', at: { x: 10 + i * 100, y: 300 } }]).world;
    expect(w.lastError).toBeNull();
    expect(tick(w, [{ k: 'place', id: 'p6', kind: 'plc', at: { x: 10, y: 500 } }]).world.lastError).toMatch(/At most 6 PLCs/);
    expect(tick(w, [{ k: 'place', id: 's6', kind: 'supply', at: { x: 10, y: 500 } }]).world.lastError).toMatch(/At most 6 24V supplies/);
  });
  it('the reversing drive set is still one per project (its contactor pairing is not generalised yet)', () => {
    const w = tick(createWorld(), [{ k: 'place', id: 'r1', kind: 'revmotor', at: { x: 10, y: 10 } }, { k: 'place', id: 'r2', kind: 'revmotor', at: { x: 300, y: 10 } }]).world;
    expect(w.lastError).toMatch(/one of each station/);
  });
});

describe('project files', () => {
  it('a two-PLC project round-trips with each program intact', () => {
    const w = tick(twoPanels(), [{ k: 'loadProgram', program: blankProgram(), plc: 'plc2' }]).world;
    const copy = validateProject(JSON.parse(JSON.stringify(w.project)));
    expect(copy.plcPrograms?.plc2.program.rungs[0].elements[0]).toMatchObject({ tag: 'Start' });
    expect(copy.program.rungs[0].elements.length).toBe(2); // PLC 1 keeps the latch in the legacy field
    const reloaded = tick(createWorld(), [{ k: 'loadProject', project: copy }]).world;
    expect(reloaded.lastError).toBeNull();
    expect(Object.keys(renderSnapshot(reloaded).plcs)).toEqual(['plc1', 'plc2']);
  });
  it('a single-PLC project keeps its exact legacy shape: no plcPrograms key', () => {
    const w = tick(createWorld(), [...panelPlaces(1, 0), ...wires(panelLinks(1), 'a')]).world;
    expect(Object.hasOwn(validateProject(w.project), 'plcPrograms')).toBe(false);
    expect(Object.hasOwn(w.project, 'plcPrograms')).toBe(false);
  });
  it('rejects programs filed under the first PLC, under a non-PLC, or with an invalid body', () => {
    const w = twoPanels();
    const withKey = (key: string, value: unknown) => ({ ...w.project, plcPrograms: { [key]: value } });
    const ok = { program: latchProgram() };
    expect(() => validateProject(withKey('plc1', ok))).toThrow(/not an additional PLC/);
    expect(() => validateProject(withKey('motor1', ok))).toThrow(/not an additional PLC/);
    expect(() => validateProject(withKey('plc2', { program: { id: 'x', version: '1', rungs: [{ id: 'r', elements: [], coil: 'Nope' }] } }))).toThrow(/PLC plc2/);
    expect(() => validateProject(withKey('plc2', { program: latchProgram(), language: 'st' }))).toThrow(/ST mode requires/);
    expect(() => validateProject({ ...w.project, plcPrograms: [] })).toThrow(/Invalid PLC programs/);
  });
  it('more than 6 PLCs in a file is rejected', () => {
    const w = createWorld();
    const components = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, kind: 'plc' as const, x: 10 + i * 50, y: 10, pressed: false }));
    expect(() => validateProject({ ...w.project, components })).toThrow(/At most 6 PLCs/);
  });
});

describe('determinism', () => {
  it('the same two-panel session replays to identical snapshots', () => {
    const play = () => {
      let w = release(press(release(press(run(twoPanels()), 'start1'), 'start1'), 'start2'), 'start2', 30);
      w = release(press(w, 'stop1', 15), 'stop1', 15);
      return JSON.stringify(renderSnapshot(w));
    };
    expect(play()).toBe(play());
  });
});
