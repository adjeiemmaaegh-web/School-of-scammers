import { describe, expect, it } from 'vitest';
import { createWorld, latchProgram, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { faultCandidates, pickSeededFault } from '../src/sim/faults';
import type { Command, FaultKind, WorldState } from '../src/sim/signals';

/** The shared P1 start/stop circuit: 6 devices, 11 wires (w0..w10), real latch program. */
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
const wires = pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));
const fixture = (): WorldState =>
  tick(createWorld(), [...placed, ...wires, { k: 'loadProgram', program: latchProgram() }]).world;
const scan = (w: WorldState, n = 1): WorldState => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const inject = (kind: FaultKind, target: string, extra: { stuckPressed?: boolean; hidden?: boolean } = {}): Command =>
  ({ k: 'injectFault', kind, target, hidden: extra.hidden ?? false,
    ...(extra.stuckPressed !== undefined ? { stuckPressed: extra.stuckPressed } : {}) });
const withFault = (cmd: Command, w = fixture()): WorldState => tick(w, [cmd]).world;
/** Press START, run the PLC and let it settle. */
const started = (w: WorldState, scans = 12): WorldState =>
  scan(tick(w, [{ k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world, scans);
const meter = (w: WorldState, pos: string, neg: string) => tick(w, [
  { k: 'setMeterProbe', lead: 'positive', terminal: pos }, { k: 'setMeterProbe', lead: 'negative', terminal: neg },
]).world.meter;
const faultsOf = (w: WorldState) => w.project.faults ?? [];

describe('P5 baseline: the fixture is healthy and raises no false alarms', () => {
  it('starts, latches and stops the motor through a full cycle with no alarms', () => {
    let w = started(fixture(), 10);
    expect(w.motorOn).toBe(true);
    w = scan(tick(w, [{ k: 'operate', id: 'start', pressed: false }]).world, 30);
    expect(w.motorOn).toBe(true); // sealed in
    w = scan(tick(w, [{ k: 'operate', id: 'stop', pressed: true }]).world, 30);
    expect(w.motorOn).toBe(false);
    expect(w.alarms).toEqual([]);
    expect(w.project.faults).toBeUndefined();
  });
});

describe('P5 fault symptoms come from the real circuit, and the meter tells the story', () => {
  it('open conductor: the wire is still listed, but nothing flows past it', () => {
    const w = started(withFault(inject('wire-open', 'w9')));
    expect(w.project.wires).toHaveLength(11);
    expect(w.project.wires.some(x => x.id === 'w9')).toBe(true);
    expect(w.contactorOn).toBe(true); // control side is healthy
    expect(w.motorOn).toBe(false);
    expect(meter(w, 'motor.L+', 'motor.M-').status).toBe('floating'); // dead downstream of the break
    expect(meter(w, 'con.13', 'con.A2')).toMatchObject({ status: 'measured', volts: 24 }); // live upstream
  });

  it('open coil: Q0.0 is on and 24 V is across the coil, yet it never pulls in', () => {
    const w = started(withFault(inject('contactor-coil-open', 'con')));
    expect(renderSnapshot(w).io['Q0.0']).toBe(true);
    expect(w.contactorOn).toBe(false);
    expect(w.motorOn).toBe(false);
    expect(meter(w, 'con.A1', 'con.A2')).toMatchObject({ status: 'measured', volts: 24 });
  });

  it('welded contacts: the motor runs with no command and cannot be stopped', () => {
    let w = tick(withFault(inject('contactor-welded', 'con')), [{ k: 'run' }]).world;
    w = scan(w, 10);
    expect(w.motorOn).toBe(true); // nobody pressed Start
    expect(w.coils.Run).not.toBe(true);
    expect(w.contactorOn).toBe(false); // the armature (coil) is released: the weld is not visible
    w = scan(tick(w, [{ k: 'operate', id: 'start', pressed: true }]).world, 6);
    w = scan(tick(w, [{ k: 'operate', id: 'start', pressed: false }, { k: 'operate', id: 'stop', pressed: true }]).world, 20);
    expect(w.coils.Run).toBe(false); // the PLC did stop its output...
    expect(w.motorOn).toBe(true); // ...but the motor keeps running
  });

  it('open winding: contactor closes and 24 V reaches the motor terminals, but it never runs', () => {
    const w = started(withFault(inject('motor-open-winding', 'motor')));
    expect(w.contactorOn).toBe(true);
    expect(w.motorOn).toBe(false);
    expect(meter(w, 'motor.L+', 'motor.M-')).toMatchObject({ status: 'measured', volts: 24 });
  });

  it('stuck-pressed START starts the motor by itself and ignores the operator', () => {
    let w = tick(withFault(inject('button-stuck', 'start', { stuckPressed: true })), [{ k: 'run' }]).world;
    w = scan(w, 8);
    expect(w.motorOn).toBe(true);
    w = scan(tick(w, [{ k: 'operateToggle', id: 'start' }, { k: 'operateToggle', id: 'start' }]).world, 4);
    expect(w.inputs.Start).toBe(true); // lever moved, contact did not
  });

  it('stuck-released START never starts the motor however it is pressed', () => {
    const w = started(withFault(inject('button-stuck', 'start', { stuckPressed: false })));
    expect(w.project.components.find(c => c.id === 'start')!.pressed).toBe(true); // operator pressed it
    expect(w.inputs.Start).toBe(false);
    expect(w.motorOn).toBe(false);
  });

  it('stuck-open STOP contact (stuck as if pressed) blocks every start', () => {
    const w = started(withFault(inject('button-stuck', 'stop', { stuckPressed: true })));
    expect(w.inputs.StopOK).toBe(false);
    expect(w.motorOn).toBe(false);
  });

  it('stuck-closed STOP contact is latent: the motor runs, but STOP no longer stops it', () => {
    const control = scan(tick(started(fixture(), 8), [{ k: 'operate', id: 'stop', pressed: true }]).world, 12);
    expect(control.motorOn).toBe(false); // a healthy STOP does stop it
    let w = started(withFault(inject('button-stuck', 'stop', { stuckPressed: false })), 8);
    expect(w.motorOn).toBe(true);
    w = scan(tick(w, [{ k: 'operate', id: 'stop', pressed: true }]).world, 12);
    expect(w.motorOn).toBe(true);
  });
});

describe('P5 supervisory alarms report symptoms, never causes', () => {
  it('welded contacts raise UNCOMMANDED_RUN, clear when commanded, and return after STOP', () => {
    let w = tick(withFault(inject('contactor-welded', 'con')), [{ k: 'run' }]).world;
    w = scan(w, 4);
    expect(w.alarms).toEqual([]); // not yet persistent
    w = scan(w, 6);
    expect(w.alarms).toHaveLength(1);
    expect(w.alarms[0]).toMatchObject({ code: 'UNCOMMANDED_RUN', severity: 'fault', clearedAtScan: null });
    w = scan(tick(w, [{ k: 'operate', id: 'start', pressed: true }]).world, 4);
    expect(w.alarms[0].clearedAtScan).not.toBeNull(); // now it IS commanded
    w = scan(tick(w, [{ k: 'operate', id: 'start', pressed: false }, { k: 'operate', id: 'stop', pressed: true }]).world, 15);
    expect(w.alarms.filter(a => a.code === 'UNCOMMANDED_RUN')).toHaveLength(2);
    expect(w.alarms[1].id).toBeGreaterThan(w.alarms[0].id);
    expect(w.alarms[1].clearedAtScan).toBeNull();
  });

  it('a dead motor raises START_FAILURE only after one second of commanded run', () => {
    let w = started(withFault(inject('motor-open-winding', 'motor')), 15);
    expect(w.alarms).toEqual([]);
    w = scan(w, 15);
    expect(w.alarms).toHaveLength(1);
    expect(w.alarms[0]).toMatchObject({ code: 'START_FAILURE', severity: 'warning' });
    w = scan(w, 40);
    expect(w.alarms).toHaveLength(1); // raised once, not repeatedly
  });

  it('the same START_FAILURE symptom appears for different causes, so the cause stays hidden', () => {
    const causes: Command[] = [
      inject('contactor-coil-open', 'con'), inject('wire-open', 'w9'), inject('motor-open-winding', 'motor'),
    ];
    for (const cause of causes) {
      const w = started(withFault(cause), 30);
      expect(w.alarms.map(a => a.code)).toEqual(['START_FAILURE']);
      expect(w.alarms[0].message).not.toMatch(/welded|winding|stuck|broken|open coil|fault-\d|\bw\d+\b/i);
    }
  });

  it('events and snapshots do not leak a hidden fault', () => {
    const r = tick(fixture(), [inject('contactor-coil-open', 'con', { hidden: true })]);
    expect(r.events.map(e => e.detail)).toEqual(['A fault was injected (hidden)']);
    const w = scan(tick(r.world, [{ k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world, 30);
    const published = JSON.stringify(renderSnapshot(w));
    expect(published).not.toMatch(/contactor-coil-open|fault-1|welded|winding/);
  });
});

describe('P5 repair, reveal and clear', () => {
  it('replacing the faulty part restores operation, and only with the plant paused', () => {
    let w = started(withFault(inject('contactor-coil-open', 'con')));
    expect(w.motorOn).toBe(false);
    const refused = tick(w, [{ k: 'repair', target: 'con' }]).world; // still running
    expect(refused.lastError).toBe('Pause simulation before modifying the project');
    expect(faultsOf(refused)).toHaveLength(1);
    w = tick(w, [{ k: 'pause' }]).world;
    const r = tick(w, [{ k: 'repair', target: 'con' }]);
    expect(faultsOf(r.world)).toEqual([]);
    expect(r.world.project.faults).toBeUndefined(); // v1 shape restored
    expect(r.events.map(e => e.detail)).toEqual(['Replaced con with the simulation isolated']);
    const again = scan(tick(r.world, [{ k: 'run' }]).world, 12);
    expect(again.motorOn).toBe(true);
  });

  it('replacing a healthy part changes nothing and says nothing about the fault', () => {
    const w = tick(withFault(inject('contactor-coil-open', 'con')), [{ k: 'repair', target: 'motor' }]);
    expect(faultsOf(w.world)).toHaveLength(1);
    expect(w.events.map(e => e.detail)).toEqual(['Replaced motor with the simulation isolated']);
  });

  it('refuses to repair something that does not exist', () => {
    expect(tick(fixture(), [{ k: 'repair', target: 'ghost' }]).world.lastError)
      .toBe('Nothing to repair: unknown component or wire');
  });

  it('re-terminating a wire repairs a wire-open fault, and deleting the wire drops it', () => {
    const w = withFault(inject('wire-open', 'w9'));
    expect(faultsOf(tick(w, [{ k: 'repair', target: 'w9' }]).world)).toEqual([]);
    const removed = tick(w, [{ k: 'unwire', id: 'w9' }]).world;
    expect(faultsOf(removed)).toEqual([]);
    expect(() => validateProject(JSON.parse(JSON.stringify(removed.project)))).not.toThrow();
  });

  it('reveal and clear describe the fault only once it is visible', () => {
    const hidden = withFault(inject('motor-open-winding', 'motor', { hidden: true }));
    expect(faultsOf(hidden)[0].hidden).toBe(true);
    const revealed = tick(hidden, [{ k: 'revealFault', id: 'fault-1' }]);
    expect(revealed.events.map(e => e.detail)).toEqual(['Fault revealed: Open winding in motor']);
    expect(faultsOf(revealed.world)[0].hidden).toBe(false);
    expect(tick(revealed.world, [{ k: 'revealFault', id: 'fault-1' }]).events).toEqual([]); // already visible
    expect(tick(hidden, [{ k: 'clearFault', id: 'fault-1' }]).events.map(e => e.detail)).toEqual(['A hidden fault was cleared']);
    expect(tick(revealed.world, [{ k: 'clearFault', id: 'fault-1' }]).events.map(e => e.detail))
      .toEqual(['Fault cleared: Open winding in motor']);
    expect(tick(fixture(), [{ k: 'clearFault', id: 'nope' }]).world.lastError).toBe('Unknown fault');
  });

  it('can be injected while the plant is running', () => {
    let w = started(fixture(), 10);
    expect(w.motorOn).toBe(true);
    w = scan(tick(w, [inject('motor-open-winding', 'motor')]).world, 5);
    expect(w.motorOn).toBe(false); // a part failing in service
  });
});

describe('P5 injection is validated', () => {
  const err = (cmd: Command, w = fixture()) => tick(w, [cmd]).world.lastError ?? '';
  /** A deliberately malformed injectFault, as untrusted input could produce at runtime. */
  const tampered = (over: Record<string, unknown>) => ({ ...inject('wire-open', 'w0'), ...over }) as unknown as Command;
  it('rejects bad kinds, targets and flags with a clear message', () => {
    expect(err(tampered({ kind: 'melted' }))).toMatch(/Unknown fault kind/);
    expect(err(inject('contactor-coil-open', 'motor'))).toMatch(/missing or unsupported part/);
    expect(err(inject('wire-open', 'nope'))).toMatch(/missing or unsupported part/);
    expect(err(inject('button-stuck', 'ps', { stuckPressed: true }))).toMatch(/missing or unsupported part/);
    expect(err(inject('button-stuck', 'start'))).toMatch(/needs a stuckPressed state/);
    expect(err(inject('wire-open', 'w0', { stuckPressed: true }))).toMatch(/cannot set stuckPressed/);
    expect(err(tampered({ hidden: 'yes' }))).toMatch(/boolean hidden flag/);
  });
  it('does not allow the training E-stop to be faulted', () => {
    const w = tick(fixture(), [{ k: 'place', id: 'es', kind: 'estop', at: { x: 5, y: 500 } }]).world;
    expect(err(inject('button-stuck', 'es', { stuckPressed: true }), w)).toMatch(/missing or unsupported part/);
  });
  it('rejects a second fault on the same part and more than eight faults', () => {
    const w = withFault(inject('wire-open', 'w0'));
    expect(err(inject('wire-open', 'w0'), w)).toMatch(/Duplicate fault on the same part/);
    let many = fixture();
    for (let i = 0; i < 8; i++) many = withFault(inject('wire-open', `w${i}`), many);
    expect(faultsOf(many)).toHaveLength(8);
    expect(err(inject('wire-open', 'w8'), many)).toMatch(/Invalid fault list/);
  });
  it('leaves the project untouched when injection fails', () => {
    const w = fixture();
    expect(tick(w, [inject('wire-open', 'nope')]).world.project).toEqual(w.project);
  });
});

describe('P5 seeded faults are reproducible', () => {
  it('picks the same fault for the same seed and covers many faults across seeds', () => {
    const project = fixture().project;
    expect(pickSeededFault(project, 42)).toEqual(pickSeededFault(project, 42));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const f = pickSeededFault(project, seed)!;
      seen.add(`${f.kind}:${f.target}:${f.stuckPressed ?? ''}`);
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });
  it('lists candidates in a fixed order and only for parts that can take the fault', () => {
    const c = faultCandidates(fixture().project);
    expect(c.filter(x => x.kind === 'wire-open')).toHaveLength(11);
    expect(c.filter(x => x.kind === 'button-stuck')).toHaveLength(4); // start/stop x pressed/released
    expect(c.filter(x => x.kind === 'contactor-coil-open').map(x => x.target)).toEqual(['con']);
    expect(c.filter(x => x.kind === 'motor-open-winding').map(x => x.target)).toEqual(['motor']);
    expect(faultCandidates(fixture().project)).toEqual(c);
  });
  it('injects the same fault in two independent worlds and never repeats a part', () => {
    const seeded = (): WorldState => tick(fixture(), [{ k: 'injectSeededFault', seed: 7, hidden: true }]).world;
    expect(faultsOf(seeded())).toEqual(faultsOf(seeded()));
    expect(faultsOf(seeded())).toHaveLength(1);
    const twice = tick(seeded(), [{ k: 'injectSeededFault', seed: 7, hidden: true }]).world;
    const [a, b] = faultsOf(twice);
    expect(`${a.kind}:${a.target}`).not.toBe(`${b.kind}:${b.target}`);
  });
  it('reports clear errors for an empty project or a non-integer seed', () => {
    expect(tick(createWorld(), [{ k: 'injectSeededFault', seed: 3, hidden: false }]).world.lastError)
      .toBe('No applicable fault for this project');
    expect(tick(fixture(), [{ k: 'injectSeededFault', seed: 1.5, hidden: false }]).world.lastError)
      .toBe('Fault seed must be a whole number');
  });
  it('every seeded fault produces a project that validates', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const w = tick(fixture(), [{ k: 'injectSeededFault', seed, hidden: seed % 2 === 0 }]).world;
      expect(() => validateProject(JSON.parse(JSON.stringify(w.project)))).not.toThrow();
    }
  });
});

describe('P5 faults travel with the project file', () => {
  it('round-trips through JSON and keeps the same symptom, including hidden flags', () => {
    let w = withFault(inject('motor-open-winding', 'motor', { hidden: true }));
    w = withFault(inject('button-stuck', 'stop', { stuckPressed: false }), w);
    const reloaded = createWorld(validateProject(JSON.parse(JSON.stringify(w.project))));
    expect(faultsOf(reloaded)).toEqual(faultsOf(w));
    expect(faultsOf(reloaded).map(f => f.hidden)).toEqual([true, false]);
    expect(started(reloaded).motorOn).toBe(false); // the dead motor survived export/import
  });
  it('loads legacy projects with no faults key and keeps that shape', () => {
    const legacy = JSON.parse(JSON.stringify(fixture().project));
    delete legacy.faults;
    const loaded = validateProject(legacy);
    expect('faults' in loaded).toBe(false);
    expect(started(createWorld(loaded)).motorOn).toBe(true);
  });
  it('rejects malformed fault data on import', () => {
    const base = JSON.parse(JSON.stringify(fixture().project));
    const bad = (faults: unknown) => () => validateProject({ ...base, faults });
    const f = { id: 'fault-1', kind: 'wire-open', target: 'w0', hidden: false };
    expect(bad([{ ...f, target: 'gone' }])).toThrow(/missing or unsupported part/);
    expect(bad([{ ...f, kind: 'melted' }])).toThrow(/Unknown fault kind/);
    expect(bad([f, { ...f, target: 'w1' }])).toThrow(/duplicate fault id/);
    expect(bad([f, { ...f, id: 'fault-2' }])).toThrow(/Duplicate fault on the same part/);
    expect(bad([{ ...f, hidden: 'no' }])).toThrow(/boolean hidden flag/);
    expect(bad('nope')).toThrow(/Invalid fault list/);
    expect(bad([f])).not.toThrow();
  });
});

describe('P5 determinism', () => {
  it('replays a command log with faults identically', () => {
    const log: Command[][] = [
      [inject('contactor-welded', 'con', { hidden: true })], [{ k: 'run' }],
      [{ k: 'operate', id: 'start', pressed: true }], [{ k: 'operate', id: 'start', pressed: false }],
      [{ k: 'injectSeededFault', seed: 11, hidden: false }], [{ k: 'pause' }], [{ k: 'repair', target: 'con' }], [{ k: 'run' }],
    ];
    const play = () => {
      let w = fixture();
      for (const cmds of log) w = scan(tick(w, cmds).world, 9);
      return w;
    };
    const a = play(), b = play();
    expect(b.project).toEqual(a.project);
    expect(b.alarms).toEqual(a.alarms);
    expect(b.tick).toBe(a.tick);
    expect(JSON.stringify(b.voltages)).toBe(JSON.stringify(a.voltages));
  });
});
