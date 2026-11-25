import { describe, expect, it } from 'vitest';
import { DemoBuilder } from '../src/plant/demos/builder';
import { createWorld, tick } from '../src/sim/orchestrator';
import { LEGACY_NAMES, namesOf, defaultIo } from '../src/sim/plc-io';
import { compileSfcToSt, extractSfc, validateSfc, type SfcDocument } from '../src/engineering/sfc';
import type { Command, WorldState } from '../src/sim/signals';

const NAMES = namesOf(defaultIo('plc16'));
/** PLC16 with a start button on In0 and a stop button on In1 (both pushbuttons wired to 24V). */
function bench(): WorldState {
  const b = new DemoBuilder();
  b.place('go', 'start', -300, 200).place('halt', 'start', -200, 200);
  b.wire('ps.P24', 'go.A'); b.wire('go.B', 'plc.I0.0'); b.wire('ps.P24', 'halt.A'); b.wire('halt.B', 'plc.I0.1');
  const w = tick(createWorld(), [{ k: 'loadProject', project: b.build('VAR_INPUT In0 : BOOL; END_VAR VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := In0;') }]).world;
  expect(w.lastError).toBeNull();
  return w;
}
const send = (w: WorldState, ...cmds: Command[]) => tick(w, cmds).world;
const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const tagOf = (w: WorldState, tag: string) => w.plcs.plc!.tagValues[tag];
const press = (w: WorldState, id: string, n = 3) => scans(send(scans(send(w, { k: 'operate', id, pressed: true }), n), { k: 'operate', id, pressed: false }), n);

const sequence: SfcDocument = {
  steps: [
    { id: 'Idle', initial: true },
    { id: 'Fill', actions: [{ q: 'N', tag: 'Out0' }], minMs: 500 },
    { id: 'Hold', actions: [{ q: 'S', tag: 'Out1' }, { q: 'P', tag: 'Out2' }] },
    { id: 'Drain', actions: [{ q: 'R', tag: 'Out1' }] },
  ],
  transitions: [
    { from: ['Idle'], to: ['Fill'], when: 'In0' },
    { from: ['Fill'], to: ['Hold'], when: 'T_Fill' },
    { from: ['Hold'], to: ['Drain'], when: 'In1' },
    { from: ['Drain'], to: ['Idle'], when: 'TRUE' },
  ],
};

describe('R07 sequential function chart', () => {
  it('runs a real sequence on the scan engine: N holds, timer gates a transition, S latches, P pulses once, R resets', () => {
    let w = send(bench(), { k: 'loadSFC', document: sequence });
    expect(w.lastError).toBeNull();
    w = send(w, { k: 'run' });
    w = scans(w, 5);
    expect(tagOf(w, 'SFC_Idle')).toBe(true); expect(tagOf(w, 'Out0')).toBe(false);
    // press Start: Fill runs (N), waits its 500 ms, then Hold (S latches Out1, P pulses Out2 once)
    w = send(w, { k: 'operate', id: 'go', pressed: true });
    w = scans(w, 3);
    expect(tagOf(w, 'SFC_Fill')).toBe(true); expect(tagOf(w, 'Out0')).toBe(true);
    expect(tagOf(w, 'SFC_Hold')).toBe(false);                     // timer not done yet
    w = send(w, { k: 'operate', id: 'go', pressed: false });
    let sawPulse = 0;
    for (let i = 0; i < 20; i++) { w = tick(w).world; if (tagOf(w, 'Out2') === true) sawPulse++; }
    expect(tagOf(w, 'SFC_Hold')).toBe(true);
    expect(tagOf(w, 'Out0')).toBe(false);                         // N output drops when the step is left
    expect(tagOf(w, 'Out1')).toBe(true);                          // S output stays set
    expect(sawPulse).toBe(1);                                     // P: exactly one scan
    w = press(w, 'halt');
    expect(tagOf(w, 'Out1')).toBe(false);                         // R in Drain reset it
    expect(tagOf(w, 'SFC_Idle')).toBe(true);                      // and the chart returned to the start
  });
  it('a transition fires only while its condition is true: the step does not advance without Start', () => {
    let w = send(bench(), { k: 'loadSFC', document: sequence }, { k: 'run' });
    w = scans(w, 60);
    expect(tagOf(w, 'SFC_Idle')).toBe(true); expect(tagOf(w, 'SFC_Fill')).toBe(false);
  });
  it('parallel split and join: both branches run, and the join waits for both', () => {
    const doc: SfcDocument = {
      steps: [{ id: 'A', initial: true }, { id: 'B1', actions: [{ q: 'N', tag: 'Out0' }] }, { id: 'B2', actions: [{ q: 'N', tag: 'Out1' }] },
        { id: 'B1done' }, { id: 'B2done' }, { id: 'End', actions: [{ q: 'N', tag: 'Out3' }] }],
      transitions: [
        { from: ['A'], to: ['B1', 'B2'], when: 'In0' },
        { from: ['B1'], to: ['B1done'], when: 'TRUE' }, { from: ['B2'], to: ['B2done'], when: 'In1' },
        { from: ['B1done', 'B2done'], to: ['End'], when: 'TRUE' }],
    };
    let w = send(bench(), { k: 'loadSFC', document: doc }, { k: 'run' });
    w = scans(w, 3);
    w = send(w, { k: 'operate', id: 'go', pressed: true }); w = scans(w, 4);
    expect(tagOf(w, 'SFC_B2')).toBe(true); expect(tagOf(w, 'SFC_B1done')).toBe(true);
    expect(tagOf(w, 'SFC_End')).toBe(false);                      // join waits for the second branch
    expect(tagOf(w, 'Out1')).toBe(true);
    w = send(w, { k: 'operate', id: 'halt', pressed: true }); w = scans(w, 4);
    expect(tagOf(w, 'SFC_End')).toBe(true); expect(tagOf(w, 'Out3')).toBe(true);
    expect(tagOf(w, 'SFC_B1done')).toBe(false); expect(tagOf(w, 'SFC_B2done')).toBe(false);
  });
  it('two enabled transitions from one step: the earlier one wins, deterministically', () => {
    const doc: SfcDocument = { steps: [{ id: 'S0', initial: true }, { id: 'X', actions: [{ q: 'N', tag: 'Out0' }] }, { id: 'Y', actions: [{ q: 'N', tag: 'Out1' }] }],
      transitions: [{ from: ['S0'], to: ['X'], when: 'TRUE' }, { from: ['S0'], to: ['Y'], when: 'TRUE' }] };
    const w = scans(send(bench(), { k: 'loadSFC', document: doc }, { k: 'run' }), 6);
    expect(tagOf(w, 'SFC_X')).toBe(true); expect(tagOf(w, 'SFC_Y')).toBe(false);
  });
  it('S is stored on entry, not re-asserted: a later R in a parallel branch stays reset while the S step remains active', () => {
    const doc: SfcDocument = {
      steps: [{ id: 'A', initial: true }, { id: 'Setter', actions: [{ q: 'S', tag: 'Out0' }] }, { id: 'Waiter' }, { id: 'Resetter', actions: [{ q: 'R', tag: 'Out0' }] }, { id: 'After' }],
      transitions: [{ from: ['A'], to: ['Setter', 'Waiter'], when: 'In0' }, { from: ['Waiter'], to: ['Resetter'], when: 'In1' }, { from: ['Resetter'], to: ['After'], when: 'TRUE' }],
    };
    let w = send(bench(), { k: 'loadSFC', document: doc }, { k: 'run' });
    w = scans(w, 3);
    w = press(w, 'go');
    expect(tagOf(w, 'Out0')).toBe(true);
    w = press(w, 'halt');
    expect(tagOf(w, 'SFC_Setter')).toBe(true);                    // the S step is still active ...
    expect(tagOf(w, 'SFC_After')).toBe(true);
    expect(tagOf(w, 'Out0')).toBe(false);                         // ... but the stored output stays reset
  });
  it('an S action on the initial step takes effect from the first scan', () => {
    const doc: SfcDocument = { steps: [{ id: 'Init', initial: true, actions: [{ q: 'S', tag: 'Out0' }] }], transitions: [] };
    expect(tagOf(scans(send(bench(), { k: 'loadSFC', document: doc }, { k: 'run' }), 3), 'Out0')).toBe(true);
  });
  it('reset beats set in the same scan', () => {
    const doc: SfcDocument = { steps: [{ id: 'S0', initial: true, actions: [{ q: 'S', tag: 'Out0' }, { q: 'R', tag: 'Out0' }] }], transitions: [] };
    const w = scans(send(bench(), { k: 'loadSFC', document: doc }, { k: 'run' }), 6);
    expect(tagOf(w, 'Out0')).toBe(false);
  });
  it('round-trips: the chart is recovered from the generated source', () => {
    const src = compileSfcToSt(sequence, NAMES);
    expect(extractSfc(src, NAMES)).toEqual(sequence);
    expect(extractSfc('Out0 := In0;', NAMES)).toBeNull();
    const tricky: SfcDocument = { steps: [{ id: 'S0', initial: true }, { id: 'S1' }], transitions: [{ from: ['S0'], to: ['S1'], when: 'In0 AND (In1 OR TRUE)' }] };
    expect(extractSfc(compileSfcToSt(tricky, NAMES), NAMES)).toEqual(tricky);
  });
  it('refuses bad charts with clear messages and leaves the running program alone', () => {
    const bad = (d: unknown) => validateSfc(d, NAMES).join('; ');
    expect(bad({ steps: [], transitions: [] })).toMatch(/1-32 steps/);
    expect(bad({ steps: [{ id: 'A' }], transitions: [] })).toMatch(/initial/);
    expect(bad({ steps: [{ id: 'A', initial: true }, { id: 'a' }], transitions: [] })).toMatch(/twice/);
    expect(bad({ steps: [{ id: '1x', initial: true }], transitions: [] })).toMatch(/letters/);
    expect(bad({ steps: [{ id: 'A', initial: true, actions: [{ q: 'N', tag: 'Nope' }] }], transitions: [] })).toMatch(/not a BOOL output/);
    expect(bad({ steps: [{ id: 'A', initial: true }], transitions: [{ from: ['A'], to: ['Z'], when: 'TRUE' }] })).toMatch(/unknown step Z/);
    expect(bad({ steps: [{ id: 'A', initial: true }], transitions: [{ from: ['A'], to: ['A'], when: 'a; b' }] })).toMatch(/condition/);
    expect(bad({ steps: [{ id: 'A', initial: true, minMs: 0 }], transitions: [] })).toMatch(/minimum time/);
    let w = send(bench(), { k: 'loadSFC', document: { steps: [{ id: 'A', initial: true }], transitions: [{ from: ['A'], to: ['A'], when: 'Undeclared' }] } });
    expect(w.lastError).toMatch(/SFC/);
    expect(w.project.stSource).toContain('Out0 := In0');            // the previous program is untouched
    w = send(bench(), { k: 'loadSFC', document: sequence, plc: 'ghost' });
    expect(w.lastError).toMatch(/Unknown PLC/);
  });
  it('works on the classic fixed-map PLC too (Run output)', () => {
    const doc: SfcDocument = { steps: [{ id: 'Off', initial: true }, { id: 'On', actions: [{ q: 'N', tag: 'Run' }] }], transitions: [{ from: ['Off'], to: ['On'], when: 'Start' }, { from: ['On'], to: ['Off'], when: 'NOT StopOK' }] };
    expect(() => compileSfcToSt(doc, LEGACY_NAMES)).not.toThrow();
    expect(compileSfcToSt(doc, LEGACY_NAMES)).toContain('Run := SFC_On;');
  });
});
