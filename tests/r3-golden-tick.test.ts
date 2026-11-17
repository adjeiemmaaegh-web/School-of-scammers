/**
 * R3.1 characterization ("golden") tests for the tick pipeline. Each scenario runs a fixed command script through the
 * real tick() and records an FNV-1a digest of the published snapshot at checkpoints. They pin CURRENT behaviour so that
 * a refactor of the orchestrator (R3.3) that changes any observable output fails loudly. If a digest changes on purpose
 * (a deliberate behaviour change), regenerate with `GOLDEN_PRINT=1 npx vitest run tests/r3-golden-tick.test.ts` and say why in the PR.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const fnv = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
};
const digest = (w: WorldState) => fnv(JSON.stringify(renderSnapshot(w)));
const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x = 10, y = 10): Command => ({ k: 'place', id, kind, at: { x, y } });
const wires = (pairs: [string, string][]): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));
const scan = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const cmd = (w: WorldState, ...c: Command[]) => tick(w, c).world;

/** Runs a scenario and returns the digests at its checkpoints. */
type Scenario = (checkpoint: (label: string, w: WorldState) => void) => void;
const run = (scenario: Scenario): Record<string, string> => {
  const out: Record<string, string> = {};
  scenario((label, w) => { out[label] = digest(w); });
  return out;
};

const scenarios: Record<string, Scenario> = {
  // The classic first PLC (legacy fixed I/O path): start, hold, stop.
  'classic-starter-panel': cp => {
    let w = cmd(createWorld(), { k: 'addPanel', template: 'motor-starter' });
    cp('built', w);
    w = scan(cmd(w, { k: 'run' }), 4); cp('idle', w);
    const start = w.project.components.find(c => c.kind === 'start')!.id, stop = w.project.components.find(c => c.kind === 'stop')!.id;
    w = scan(cmd(w, { k: 'operate', id: start, pressed: true }), 6); cp('start-pressed', w);
    w = scan(cmd(w, { k: 'operate', id: start, pressed: false }), 30); cp('latched', w);
    w = scan(cmd(w, { k: 'operate', id: stop, pressed: true }), 6); cp('stopped', w);
    w = cmd(w, { k: 'pause' }); cp('paused', w);
  },
  // Two isolated panels: each PLC samples only its own wiring.
  'two-panels': cp => {
    let w = cmd(createWorld(), { k: 'addPanel', template: 'motor-starter' }, { k: 'addPanel', template: 'motor-starter' });
    cp('built', w);
    w = scan(cmd(w, { k: 'run' }), 3);
    const starts = w.project.components.filter(c => c.kind === 'start').map(c => c.id);
    w = scan(cmd(w, { k: 'operate', id: starts[1], pressed: true }), 8); cp('second-started', w);
    w = scan(cmd(w, { k: 'operate', id: starts[0], pressed: true }), 8); cp('both-started', w);
  },
  // Configurable 16/16 PLC (Structured Text) driving a cylinder and a stack light.
  'plc16-cylinder-stacklight': cp => {
    let w = tick(createWorld(), [
      place('ps', 'supply'), place('p', 'plc16', 250), place('go', 'start'), place('c', 'cylinder', 600), place('sl', 'stacklight', 700),
      ...wires([['ps.P24', 'p.L+'], ['ps.M0', 'p.M'], ['ps.P24', 'go.A'], ['go.B', 'p.I0.0'], ['ps.P24', 'c.L+'], ['c.EXT_LS', 'p.I0.1'], ['c.RET_LS', 'p.I0.2'],
        ['p.Q0.0', 'c.EXT+'], ['p.Q0.1', 'c.RET+'], ['ps.M0', 'c.M-'], ['p.Q0.2', 'sl.G'], ['p.Q0.3', 'sl.R'], ['ps.M0', 'sl.M-']]),
      { k: 'configureIo', plc: 'p', io: { inputs: { 'I0.0': 'Go', 'I0.1': 'Extended', 'I0.2': 'Retracted' }, outputs: { 'Q0.0': 'Ext', 'Q0.1': 'Ret', 'Q0.2': 'Green', 'Q0.3': 'Red' } } },
      { k: 'loadST', source: ['VAR_INPUT', '  Go : BOOL;', '  Extended : BOOL;', '  Retracted : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Ext : BOOL;', '  Ret : BOOL;', '  Green : BOOL;', '  Red : BOOL;', 'END_VAR',
        'Ext := Go AND NOT Extended;', 'Ret := NOT Go AND NOT Retracted;', 'Green := Go;', 'Red := NOT Go;'].join('\n') }]).world;
    cp('built', w);
    w = scan(cmd(w, { k: 'run' }), 4); cp('retracted', w);
    w = scan(cmd(w, { k: 'operate', id: 'go', pressed: true }), 12); cp('extending', w);
    w = scan(w, 40); cp('extended', w);
    w = scan(cmd(w, { k: 'operate', id: 'go', pressed: false }), 40); cp('returned', w);
    w = cmd(w, { k: 'injectFault', kind: 'cylinder-jammed', target: 'c', hidden: false });
    w = scan(cmd(w, { k: 'operate', id: 'go', pressed: true }), 70); cp('jammed-alarm', w);
  },
  // Hard-wired control: relay seal-in plus an on-delay relay, no PLC at all.
  'hardwired-relay-timer': cp => {
    let w = tick(createWorld(), [
      place('ps', 'supply'), place('start', 'start'), place('stop', 'stop'), place('k', 'relay'), place('t', 'timerelay'), place('ma', 'lamp'), place('mb', 'lamp'),
      ...wires([['ps.P24', 'stop.A'], ['stop.B', 'start.A'], ['stop.B', 'k.13'], ['start.B', 'k.A1'], ['k.14', 'k.A1'], ['k.A2', 'ps.M0'],
        ['ps.P24', 'k.23'], ['k.24', 'ma.L+'], ['ma.M-', 'ps.M0'], ['k.24', 't.A1'], ['t.A2', 'ps.M0'], ['ps.P24', 't.13'], ['t.14', 'mb.L+'], ['mb.M-', 'ps.M0']]),
      { k: 'setParam', id: 't', key: 'delayMs', value: 1000 }]).world;
    cp('built', w);
    w = scan(cmd(w, { k: 'run' }), 3); cp('idle', w);
    w = scan(cmd(w, { k: 'operate', id: 'start', pressed: true }), 4);
    w = scan(cmd(w, { k: 'operate', id: 'start', pressed: false }), 8); cp('timing', w);
    w = scan(w, 20); cp('delay-elapsed', w);
    w = scan(cmd(w, { k: 'operate', id: 'stop', pressed: true }), 4); cp('stopped', w);
  },
  // Two supplies that must stay isolated, with the multimeter across them.
  'isolated-supplies-meter': cp => {
    let w = tick(createWorld(), [
      place('a', 'supply'), place('b', 'supply'), place('la', 'lamp'), place('lb', 'lamp'),
      ...wires([['a.P24', 'la.L+'], ['la.M-', 'a.M0'], ['b.P24', 'lb.L+'], ['lb.M-', 'b.M0']]),
      { k: 'setMeterProbe', lead: 'positive', terminal: 'a.P24' }, { k: 'setMeterProbe', lead: 'negative', terminal: 'b.M0' }]).world;
    cp('paused-meter', w);
    w = scan(cmd(w, { k: 'run' }), 4); cp('running-meter', w);
  },
};

const GOLDEN: Record<string, Record<string, string>> = {
  'classic-starter-panel': {"built":"b18f1be1","idle":"d19f5df0","start-pressed":"e56accb6","latched":"4ebe5403","stopped":"9a2fb5ff","paused":"05f213f4"},
  'two-panels': {"built":"1b4b2bf2","second-started":"d2ba8b1d","both-started":"20dae9c4"},
  'plc16-cylinder-stacklight': {"built":"84fe0fe2","retracted":"a5175d79","extending":"e6a530b6","extended":"94c4d101","returned":"f76bf069","jammed-alarm":"6ae087e7"},
  'hardwired-relay-timer': {"built":"f3a1de52","idle":"44068c28","timing":"bd59bf29","delay-elapsed":"83ced935","stopped":"d0042edd"},
  'isolated-supplies-meter': {"paused-meter":"0c51b9e0","running-meter":"1dff261d"},
};
describe('R3.1 golden tick digests', () => {
  for (const [name, scenario] of Object.entries(scenarios)) {
    it(`${name} is byte-stable and replays identically`, () => {
      const first = run(scenario), second = run(scenario);
      expect(second).toEqual(first); // determinism: same script, same snapshots
      if (process.env.GOLDEN_PRINT) process.stderr.write(`GOLDEN ${name} ${JSON.stringify(first)}\n`);
      else expect(first).toEqual(GOLDEN[name]);
    });
  }
});

/** The digests above pin behaviour; these facts show that what is pinned is the behaviour we actually intend. */
describe('R3.1 the pinned scenarios show the intended behaviour', () => {
  const states = (scenario: Scenario) => { const out: Record<string, WorldState> = {}; scenario((l, w) => { out[l] = w; }); return out; };
  it('classic starter: motor off, on while latched, off after stop', () => {
    const s = states(scenarios['classic-starter-panel']);
    const motor = s.built.project.components.find(c => c.kind === 'motor')!.id;
    expect([s.idle, s['start-pressed'], s.latched, s.stopped].map(w => w.deviceOn[motor] === true)).toEqual([false, true, true, false]);
  });
  it('two panels: only the pressed panel starts', () => {
    const s = states(scenarios['two-panels']);
    const motors = s.built.project.components.filter(c => c.kind === 'motor').map(c => c.id);
    expect(motors.map(m => s['second-started'].deviceOn[m] === true)).toEqual([false, true]);
    expect(motors.map(m => s['both-started'].deviceOn[m] === true)).toEqual([true, true]);
  });
  it('plc16 station: rod travels, reaches both ends, then the jam alarm trips', () => {
    const s = states(scenarios['plc16-cylinder-stacklight']);
    const rod = (w: WorldState) => renderSnapshot(w).cylinders.c;
    expect(rod(s.retracted).position).toBe(0);
    expect(rod(s.extending).position).toBeGreaterThan(0);
    expect(rod(s.extended).position).toBe(1);
    expect(rod(s.returned).position).toBe(0);
    expect(rod(s['jammed-alarm']).alarm).toBe('CYLINDER TRAVEL TIMEOUT');
    expect(s.extended.deviceOn['sl-G']).toBe(true);
  });
  it('hard-wired timer: second lamp only after the delay', () => {
    const s = states(scenarios['hardwired-relay-timer']);
    expect([s.timing.deviceOn.ma, s.timing.deviceOn.mb]).toEqual([true, false]);
    expect([s['delay-elapsed'].deviceOn.ma, s['delay-elapsed'].deviceOn.mb]).toEqual([true, true]);
    expect([s.stopped.deviceOn.ma, s.stopped.deviceOn.mb]).toEqual([false, false]);
  });
  it('isolated supplies: the meter floats across them, paused and running', () => {
    const s = states(scenarios['isolated-supplies-meter']);
    expect(s['paused-meter'].meter.status).toBe('floating');
    expect(s['running-meter'].meter.status).toBe('floating');
  });
});
