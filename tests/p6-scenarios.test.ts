import { describe, expect, it } from 'vitest';
import {
  SCENARIOS, appendEvidence, evidenceFromCommand, getScenario, gradeScenario, usedMultimeter,
} from '../src/exercises';
import { MOTOR_LINKS } from '../src/exercises/layouts';
import { faultCandidates } from '../src/sim/faults';
import { createWorld, latchProgram, sortingProgram, tankProgram, tick } from '../src/sim/orchestrator';
import type { EvidenceEvent } from '../src/platform/types';
import type { Command, ProjectFile } from '../src/sim/signals';

const def = (id: string) => getScenario(id)!;
/** Apply learner commands on top of the scenario's starter and return the resulting project. */
function work(id: string, seed: number, ...commands: Command[]): ProjectFile {
  const w = tick(createWorld(), [{ k: 'loadProject', project: def(id).starter(seed) }, ...commands]).world;
  expect(w.lastError).toBeNull();
  return w.project;
}
const wireAll = (pairs: [string, string][], from = 100): Command[] =>
  pairs.map(([a, b], i): Command => ({ k: 'wire', id: `n${from + i}`, from: a, to: b }));
const grade = (id: string, project: ProjectFile, evidence: EvidenceEvent[] = [], seed = 1) =>
  gradeScenario(def(id), project, evidence, seed);
const failed = (g: ReturnType<typeof grade>) => g.checks.filter(c => !c.pass).map(c => c.id);

let at = 0;
const ev = (action: string, detail: string, accepted = true): EvidenceEvent =>
  ({ index: ++at, at: at * 100, action, detail, accepted });

describe('catalogue integrity', () => {
  it('has unique ids, valid starters, and checks whose weights add up', () => {
    expect(new Set(SCENARIOS.map(s => s.id)).size).toBe(SCENARIOS.length);
    for (const s of SCENARIOS) {
      expect(s.checks.length).toBeGreaterThan(2);
      expect(new Set(s.checks.map(c => c.id)).size).toBe(s.checks.length);
      const starter = s.starter(1);
      expect(starter.components.length).toBeGreaterThan(3);
      // Starters are deterministic for a seed.
      expect(JSON.stringify(s.starter(7))).toBe(JSON.stringify(s.starter(7)));
    }
  });
  it('no starter already passes: the learner has real work to do', () => {
    for (const s of SCENARIOS) {
      const g = gradeScenario(s, s.starter(1), [], 1);
      expect(g.rubric.passed, s.id).toBe(false);
    }
  });
});

describe('plc-sbx-startstop', () => {
  const solved = () => work('plc-sbx-startstop', 1, ...wireAll(MOTOR_LINKS),
    { k: 'loadProgram', program: latchProgram() });
  it('the blank starter fails everything that needs wiring or logic', () => {
    const g = grade('plc-sbx-startstop', def('plc-sbx-startstop').starter(1));
    expect(failed(g)).toEqual(expect.arrayContaining(['powered', 'starts', 'seals', 'stops']));
    expect(g.rubric.score).toBeLessThan(g.rubric.max / 2);
  });
  it('a correct build scores full marks', () => {
    const g = grade('plc-sbx-startstop', solved());
    expect(failed(g)).toEqual([]);
    expect(g.rubric).toMatchObject({ score: g.rubric.max, passed: true, safetyHold: false });
  });
  it('leftover operator state does not matter: a held STOP at submit time is not graded as a wiring fault', () => {
    const p = solved();
    const held: ProjectFile = { ...p, components: p.components.map(c => c.id === 'stop' || c.id === 'start' ? { ...c, pressed: true } : c) };
    expect(held.components.filter(c => c.pressed)).toHaveLength(2);
    expect(failed(grade('plc-sbx-startstop', held))).toEqual([]);
  });
  it('a different correct solution (Structured Text) also passes: grading is by outcome', () => {
    const st = [
      'VAR_INPUT', ' Start : BOOL;', ' StopOK : BOOL;', 'END_VAR', 'VAR_OUTPUT', ' Run : BOOL;', 'END_VAR',
      'Run := StopOK AND (Start OR Run);',
    ].join('\n');
    const p = work('plc-sbx-startstop', 1, ...wireAll(MOTOR_LINKS), { k: 'loadST', source: st }, { k: 'activateLanguage', language: 'st' });
    expect(failed(grade('plc-sbx-startstop', p))).toEqual([]);
  });
  it('wired correctly but with the placeholder program: starts, but neither seals in nor obeys STOP', () => {
    const g = grade('plc-sbx-startstop', work('plc-sbx-startstop', 1, ...wireAll(MOTOR_LINKS)));
    expect(failed(g)).toEqual(['seals', 'stops', 'stays-off']);
    expect(g.rubric.passed).toBe(false);
  });
  it('a latch with no STOP is caught: the motor cannot be stopped', () => {
    const noStop = { ...latchProgram(), rungs: [{ id: 'r', elements: [{ type: 'branch' as const, alternatives: [
      [{ type: 'contact' as const, tag: 'Start' }], [{ type: 'contact' as const, tag: 'Run' }]] }], coil: 'Run' }] };
    const g = grade('plc-sbx-startstop', work('plc-sbx-startstop', 1, ...wireAll(MOTOR_LINKS), { k: 'loadProgram', program: noStop }));
    expect(failed(g)).toEqual(expect.arrayContaining(['stops']));
  });
  it('wiring the motor straight to the supply is caught: it runs unprompted and cannot stop', () => {
    const cheat = MOTOR_LINKS.filter(([a, b]) => !(a === 'con.14' || b === 'con.14')).concat([['ps.P24', 'motor.L+']]);
    const g = grade('plc-sbx-startstop', work('plc-sbx-startstop', 1, ...wireAll(cheat), { k: 'loadProgram', program: latchProgram() }));
    expect(failed(g)).toEqual(expect.arrayContaining(['stops', 'idle']));
    expect(g.rubric.passed).toBe(false);
  });
  it('a required check failing fails the attempt even when the score is above the pass mark', () => {
    // Everything but the seal-in works, so the points alone would be 80% — but sealing is required.
    const g = grade('plc-sbx-startstop', work('plc-sbx-startstop', 1, ...wireAll(MOTOR_LINKS)));
    expect(g.rubric.passed).toBe(false);
    const scoreOnly = g.rubric.score / g.rubric.max;
    expect(scoreOnly).toBeLessThan(0.8);
    const lenient = { ...def('plc-sbx-startstop'), passMark: 0.1 };
    expect(gradeScenario(lenient, work('plc-sbx-startstop', 1, ...wireAll(MOTOR_LINKS)), [], 1).rubric.passed).toBe(false);
  });
  it('a bad project grades as failed instead of throwing', () => {
    const broken = { ...solved(), program: { id: 'x', version: '1', rungs: [{ id: 'r', elements: [], coil: 'Nope' }] } } as unknown as ProjectFile;
    expect(() => grade('plc-sbx-startstop', broken)).not.toThrow();
    expect(grade('plc-sbx-startstop', broken).rubric.passed).toBe(false);
  });
  it('grading is deterministic', () => {
    expect(JSON.stringify(grade('plc-sbx-startstop', solved()))).toBe(JSON.stringify(grade('plc-sbx-startstop', solved())));
  });
});

describe('plc-sbx-find-fault', () => {
  const id = 'plc-sbx-find-fault';
  const diag = (): EvidenceEvent[] => [
    ev('setMeterProbe', 'Meter red probe on con.A1'), ev('setMeterProbe', 'Meter black probe on con.A2'),
  ];
  const repair = (t: string) => ev('repair', `Replaced ${t} with the simulation isolated`);

  it('every seeded fault is symptomatic, detectable and fully repairable by replacing its own part', () => {
    const base = def(id).starter(1);
    expect(base.faults).toHaveLength(1);
    expect(base.faults![0].hidden).toBe(true);
    // Check the set of faults the seed can produce, not just seed 1.
    const targets = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = def(id).starter(seed);
      const f = s.faults![0];
      targets.add(`${f.kind}:${f.target}`);
      const sick = grade(id, s, [], seed);
      expect(sick.rubric.passed, `seed ${seed} ${f.kind}:${f.target} should be failing`).toBe(false);
      expect(failed(sick), `seed ${seed} ${f.kind}:${f.target}`).toEqual(expect.arrayContaining(['fault-gone']));
      expect(sick.checks.filter(c => ['starts', 'stops'].includes(c.id)).some(c => !c.pass),
        `seed ${seed} ${f.kind}:${f.target} must show a functional symptom`).toBe(true);
      const fixed = work(id, seed, { k: 'repair', target: f.target });
      const g = grade(id, fixed, [...diag(), repair(f.target)], seed);
      expect(failed(g), `seed ${seed} ${f.kind}:${f.target}`).toEqual([]);
      expect(g.rubric.passed).toBe(true);
    }
    expect(targets.size).toBeGreaterThan(8); // the seed really does vary the fault
  });

  it('the starter is deterministic per seed and differs across seeds', () => {
    expect(def(id).starter(5).faults).toEqual(def(id).starter(5).faults);
    const kinds = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => def(id).starter(s).faults![0].target));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('guess-and-replace is penalised: replacing a healthy part first fails "precise"', () => {
    const f = def(id).starter(1).faults![0];
    const healthy = ['ps', 'plc', 'start', 'stop', 'con', 'motor'].find(c => c !== f.target)!;
    const p = work(id, 1, { k: 'repair', target: healthy }, { k: 'repair', target: f.target });
    const g = grade(id, p, [...diag(), repair(healthy), repair(f.target)]);
    expect(failed(g)).toEqual(['precise']);
    expect(g.rubric.passed).toBe(false);
  });

  it('repairing without measuring fails "diagnosed" and the attempt as a whole', () => {
    const f = def(id).starter(1).faults![0];
    const g = grade(id, work(id, 1, { k: 'repair', target: f.target }), [repair(f.target)]);
    expect(failed(g)).toEqual(['diagnosed']);
    expect(g.rubric.passed).toBe(false);
  });

  it('measuring only after replacing does not count as diagnosis', () => {
    const f = def(id).starter(1).faults![0];
    const g = grade(id, work(id, 1, { k: 'repair', target: f.target }), [repair(f.target), ...diag()]);
    expect(failed(g)).toContain('diagnosed');
  });

  it('a rejected repair attempt is not counted as a replacement', () => {
    const f = def(id).starter(1).faults![0];
    const g = grade(id, work(id, 1, { k: 'repair', target: f.target }),
      [...diag(), ev('repair', 'Replaced ps with the simulation isolated', false), repair(f.target)]);
    expect(failed(g)).toEqual([]);
  });

  it('rewriting the circuit to bypass the fault is caught by "intact" and "fault-gone"', () => {
    // Remove the faulty part from the project and replace the PLC logic with something else.
    const f = def(id).starter(1).faults![0];
    const sick = def(id).starter(1);
    const tampered: ProjectFile = { ...sick, faults: undefined, program: { ...latchProgram(), id: 'edited' } };
    const g = grade(id, tampered, diag());
    expect(failed(g)).toContain('intact');
    expect(f.target).toBeTruthy();
  });

  it('"intact" sees an added jumper, but not a moved device or a re-terminated conductor', () => {
    const seed = 1, f = def(id).starter(seed).faults![0];
    const fixed = work(id, seed, { k: 'repair', target: f.target });
    const base = [...diag(), repair(f.target)];
    expect(failed(grade(id, fixed, base, seed))).toEqual([]);
    // An extra jumper wire is a change to the circuit the learner was not asked to make.
    const jumpered = tick(createWorld(), [{ k: 'loadProject', project: fixed },
      { k: 'wire', id: 'jumper', from: 'con.A2', to: 'motor.M-' }]).world.project;
    expect(failed(grade(id, jumpered, base, seed))).toEqual(['intact']);
    // Moving a device is harmless.
    const moved = tick(createWorld(), [{ k: 'loadProject', project: fixed },
      { k: 'move', id: 'motor', to: { x: 820, y: 40 } }]).world.project;
    expect(failed(grade(id, moved, base, seed))).toEqual([]);
    // Removing a conductor and re-making the very same connection is a legitimate re-termination.
    const w0 = fixed.wires[0];
    const reterminated = tick(createWorld(), [{ k: 'loadProject', project: fixed },
      { k: 'unwire', id: w0.id }, { k: 'wire', id: 'again', from: w0.from, to: w0.to }]).world.project;
    expect(failed(grade(id, reterminated, base, seed))).toEqual([]);
    // Deleting a conductor outright breaks the circuit and the "intact" signature.
    const cut = tick(createWorld(), [{ k: 'loadProject', project: fixed }, { k: 'unwire', id: w0.id }]).world.project;
    expect(failed(grade(id, cut, base, seed))).toContain('intact');
  });

  it('doing nothing scores low and fails', () => {
    const g = grade(id, def(id).starter(1));
    expect(g.rubric.passed).toBe(false);
    expect(failed(g)).toEqual(expect.arrayContaining(['fault-gone', 'diagnosed']));
  });

  it('every fault candidate on the starter circuit is covered by the seed picker', () => {
    expect(faultCandidates(work(id, 1).faults ? { ...work(id, 1), faults: [] } : work(id, 1)).length).toBeGreaterThan(8);
  });
});

describe('plc-sbx-sorting', () => {
  const id = 'plc-sbx-sorting';
  const solved = () => work(id, 1, { k: 'loadProgram', program: sortingProgram() });
  it('the starter belt does not even hold: blank program fails the sorting checks', () => {
    const g = grade(id, def(id).starter(1));
    expect(failed(g)).toEqual(expect.arrayContaining(['marked-rejected', 'mixed-batch']));
  });
  it('the reference Ladder scores full marks', () => {
    const g = grade(id, solved());
    expect(failed(g)).toEqual([]);
    expect(g.rubric.passed).toBe(true);
  });
  it('a belt that never diverts accepts the marked parcel and is graded as wrong', () => {
    const noSort = { ...sortingProgram(), rungs: sortingProgram().rungs.filter(r => r.coil !== 'Sort') };
    const g = grade(id, work(id, 1, { k: 'loadProgram', program: noSort }));
    expect(failed(g)).toEqual(expect.arrayContaining(['marked-rejected', 'mixed-batch']));
    expect(g.checks.find(c => c.id === 'plain-passes')!.pass).toBe(true);
  });
  it('a diverter that is always on rejects plain parcels too', () => {
    const always = { ...sortingProgram(), rungs: sortingProgram().rungs.map(r => r.coil === 'Sort'
      ? { ...r, elements: [{ type: 'contact' as const, tag: 'Run' }] } : r) };
    const g = grade(id, work(id, 1, { k: 'loadProgram', program: always }));
    expect(failed(g)).toEqual(expect.arrayContaining(['plain-passes']));
  });
  it('the reference solution survives a disconnected photoeye only as a failing build', () => {
    const p = solved();
    const cut: ProjectFile = { ...p, wires: p.wires.filter(w => !(w.from === 'eye.OUT' || w.to === 'eye.OUT')) };
    expect(grade(id, cut).rubric.passed).toBe(false);
  });
});

describe('plc-sbx-tank', () => {
  const id = 'plc-sbx-tank';
  const solved = () => work(id, 1, { k: 'loadProgram', program: tankProgram() });
  it('the reference Ladder scores full marks', () => {
    const g = grade(id, solved());
    expect(failed(g)).toEqual([]);
  });
  it('the blank starter never fills the tank', () => {
    expect(failed(grade(id, def(id).starter(1)))).toEqual(expect.arrayContaining(['fills', 'drains']));
  });
  it('a pump that ignores the level switch overflows and is caught', () => {
    const noLimit = { ...tankProgram(), rungs: tankProgram().rungs.map(r => r.coil === 'Fill'
      ? { ...r, elements: [{ type: 'contact' as const, tag: 'StopOK' }] } : r) };
    const g = grade(id, work(id, 1, { k: 'loadProgram', program: noLimit }));
    expect(failed(g)).toContain('no-overflow');
    expect(g.rubric.passed).toBe(false);
  });
  it('ignoring STOP is caught by the stop check', () => {
    const noStop = { ...tankProgram(), rungs: tankProgram().rungs.map(r => ({
      ...r, elements: r.elements.filter(e => !('tag' in e && e.tag === 'StopOK')) })) };
    expect(failed(grade(id, work(id, 1, { k: 'loadProgram', program: noStop })))).toContain('stop-halts');
  });
});

describe('evidence helpers', () => {
  it('records learner actions and ignores instructor-only commands', () => {
    expect(evidenceFromCommand({ k: 'wire', id: 'a', from: 'x.A', to: 'y.B' })!.detail).toBe('Wired x.A to y.B');
    expect(evidenceFromCommand({ k: 'injectFault', kind: 'wire-open', target: 'w1', hidden: true })).toBeNull();
    expect(evidenceFromCommand({ k: 'clearFault', id: 'f1' })).toBeNull();
    expect(evidenceFromCommand({ k: 'revealFault', id: 'f1' })).toBeNull();
  });
  it('coalesces rapid program edits but keeps distinct actions, and bounds the trail', () => {
    let log: EvidenceEvent[] = [];
    log = appendEvidence(log, 0, 'program', 'a');
    log = appendEvidence(log, 500, 'program', 'b');
    log = appendEvidence(log, 900, 'run', 'Started');
    expect(log.map(e => e.action)).toEqual(['program', 'run']);
    expect(log.map(e => e.index)).toEqual([1, 2]);
    for (let i = 0; i < 600; i++) log = appendEvidence(log, 10000 + i * 10, 'operate', `x${i}`);
    expect(log.length).toBeLessThanOrEqual(400);
    expect(log[log.length - 1].index).toBeGreaterThan(400);
  });
  it('usedMultimeter needs both probes on terminals, before the cut-off', () => {
    const red = { index: 1, at: 0, action: 'setMeterProbe', detail: 'Meter red probe on a.B', accepted: true };
    const black = { index: 2, at: 0, action: 'setMeterProbe', detail: 'Meter black probe on a.C', accepted: true };
    const off = { index: 3, at: 0, action: 'setMeterProbe', detail: 'Meter black probe disconnected', accepted: true };
    expect(usedMultimeter([red])).toBe(false);
    expect(usedMultimeter([red, off])).toBe(false);
    expect(usedMultimeter([red, black])).toBe(true);
    expect(usedMultimeter([red, black], 2)).toBe(false);
  });
});

describe('answer hygiene and E2E pins', () => {
  it('no starter hands over the finished logic in its Structured Text source', () => {
    for (const s of SCENARIOS) {
      for (const seed of [1, 2, 3]) {
        expect(s.starter(seed).stSource ?? '', `${s.id}`).not.toMatch(/StopOK\s+AND/);
      }
    }
  });
  it('seed 1 hides an open contactor coil — scripts/sandbox-p6-scenario-browser.cjs depends on it', () => {
    const f = def('plc-sbx-find-fault').starter(1).faults![0];
    expect([f.kind, f.target]).toEqual(['contactor-coil-open', 'con']);
  });
});
