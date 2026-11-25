import { describe, expect, it } from 'vitest';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { SEGMENTS } from '../src/plant/equipment/operator';
import { freshWorld } from '../src/plant/world/bodies';
import { vec } from '../src/plant/world/math';
import { ctxOf } from '../src/plant/world/equipment';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { COMPONENTS } from '../src/components/registry';
import type { Command, WorldState } from '../src/sim/signals';

const def = (k: string) => PLANT_EQUIPMENT[k];
const ctx = (k: string, params: Record<string, number> = {}) => ctxOf({ id: 'd', kind: k, originMm: vec(0, 0, 0), yawDeg: 0, params });
/** One device scan with the given commands, params and fault; returns the signals it reads. */
const read = (k: string, params: Record<string, number>, commands: Record<string, boolean | number> = {}, fault: string | null = null, prior = def(k).fresh({})) => {
  const c = ctx(k, params);
  const out = def(k).step(prior, freshWorld(), commands, 10, fault, c);
  return { signals: def(k).read(out.state, out.world, c), state: out.state };
};

describe('R12/R19 potentiometer', () => {
  it('turns the knob position into a 0-10 V signal (or 0-5 V full scale)', () => {
    expect(read('potentiometer', { positionPct: 0 }).signals.volts).toBe(0);
    expect(read('potentiometer', { positionPct: 50 }).signals.volts).toBe(5);
    expect(read('potentiometer', { positionPct: 100 }).signals.volts).toBe(10);
    expect(read('potentiometer', { positionPct: 40, rangeV: 5 }).signals.volts).toBe(2);
    expect(read('potentiometer', { positionPct: 25 }).signals.percent).toBe(25);
  });
  it('an open wiper reads 0 V and a stuck wiper holds its last value', () => {
    expect(read('potentiometer', { positionPct: 80 }, {}, 'wiper-open').signals.volts).toBe(0);
    const held = read('potentiometer', { positionPct: 60 });
    expect(read('potentiometer', { positionPct: 10 }, {}, 'wiper-stuck', held.state).signals.volts).toBe(6);
  });
});

describe('R12/R19 3-position selector', () => {
  it('exactly one of left / centre / right is closed, matching the position', () => {
    expect(read('selector-3pos', { position: 0 }).signals).toEqual({ left: true, centre: false, right: false });
    expect(read('selector-3pos', { position: 1 }).signals).toEqual({ left: false, centre: true, right: false });
    expect(read('selector-3pos', { position: 2 }).signals).toEqual({ left: false, centre: false, right: true });
  });
  it('a dead contact never closes even when selected', () => {
    expect(read('selector-3pos', { position: 0 }, {}, 'left-contact-dead').signals.left).toBe(false);
    expect(read('selector-3pos', { position: 2 }, {}, 'right-contact-dead').signals.right).toBe(false);
    expect(read('selector-3pos', { position: 2 }, {}, 'left-contact-dead').signals.right).toBe(true);
  });
});

describe('R12/R19 seven-segment display', () => {
  const show = (digit: number, extra: Record<string, boolean> = {}) => read('seven-segment', {}, { b0: !!(digit & 1), b1: !!(digit & 2), b2: !!(digit & 4), b3: !!(digit & 8), ...extra });
  const pattern = (sig: Record<string, unknown>) => 'ABCDEFG'.split('').map(n => (sig['seg' + n] ? 1 : 0)).join('');
  it('decodes every BCD digit to its standard segment pattern', () => {
    const expected = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];
    for (let d = 0; d <= 9; d++) { const r = show(d); expect(pattern(r.signals), 'digit ' + d).toBe(expected[d]); expect(r.signals.digit).toBe(d); }
    expect(SEGMENTS).toHaveLength(10);
  });
  it('codes above 9 are invalid and blank the display; blank and lamp test override', () => {
    const invalid = show(12);
    expect(pattern(invalid.signals)).toBe('0000000'); expect(invalid.signals.invalid).toBe(true); expect(invalid.signals.digit).toBe(-1);
    expect(pattern(show(5, { blank: true }).signals)).toBe('0000000');
    expect(pattern(show(5, { lampTest: true }).signals)).toBe('1111111');
  });
  it('a dead segment and a dead display are visible faults', () => {
    expect(pattern(read('seven-segment', {}, { b0: false, b1: false, b2: false, b3: false }, 'segment-c-dead').signals)).toBe('1101110');
    expect(pattern(read('seven-segment', {}, { b0: true }, 'display-off').signals)).toBe('0000000');
  });
});

describe('R12/R19 numeric display and bar meter', () => {
  it('shows the commanded value to the set decimals and reports its fraction of full scale', () => {
    const r = read('numeric-display', { decimals: 1, fullScale: 200 }, { value: 123.456 });
    expect(r.signals.shown).toBe(123.5); expect(r.signals.fraction).toBeCloseTo(0.6175, 4); expect(r.signals.over).toBe(false);
    expect(read('numeric-display', { decimals: 0, fullScale: 100 }, { value: 250 }).signals).toMatchObject({ shown: 250, fraction: 1, over: true });
    expect(read('numeric-display', { decimals: 2, fullScale: 100 }, { value: -3.14159 }).signals.shown).toBe(-3.14);
  });
  it('a frozen display keeps its last value, a dead one shows zero, and an absurd command is refused', () => {
    const first = read('numeric-display', {}, { value: 42 });
    expect(read('numeric-display', {}, { value: 99 }, 'display-frozen', first.state).signals.shown).toBe(42);
    expect(read('numeric-display', {}, { value: 99 }, 'display-off').signals.shown).toBe(0);
    expect(() => read('numeric-display', {}, { value: 1e9 })).toThrow(/Invalid numeric/);
  });
});

describe('R12/R19 pushbutton station and indicator panel', () => {
  it('start closes when held, stop is normally closed and opens when pressed, lamps follow the commands', () => {
    const idle = read('operator-station', {});
    expect(idle.signals).toEqual({ start: false, stop: true, reset: false, greenLit: false, redLit: false });
    expect(read('operator-station', { startPressed: 1 }).signals.start).toBe(true);
    expect(read('operator-station', { stopPressed: 1 }).signals.stop).toBe(false);
    expect(read('operator-station', { resetPressed: 1 }).signals.reset).toBe(true);
    expect(read('operator-station', {}, { greenLamp: true, redLamp: true }).signals).toMatchObject({ greenLit: true, redLit: true });
  });
  it('station faults: a welded STOP contact never opens, a stuck START is always pressed, a burnt lamp stays dark', () => {
    expect(read('operator-station', { stopPressed: 1 }, {}, 'stop-contact-welded').signals.stop).toBe(true);
    expect(read('operator-station', {}, {}, 'start-stuck').signals.start).toBe(true);
    expect(read('operator-station', {}, { greenLamp: true }, 'green-lamp-burnt').signals.greenLit).toBe(false);
  });
  it('the indicator panel lights the commanded lamps, counts them, sounds the horn, and lamp test lights all', () => {
    const r = read('indicator-panel', {}, { lamp1: true, lamp3: true, horn: true });
    expect(r.signals).toMatchObject({ lit1: true, lit2: false, lit3: true, lit4: false, hornOn: true, litCount: 2 });
    expect(read('indicator-panel', {}, { lampTest: true }).signals).toMatchObject({ litCount: 4, hornOn: true });
  });
  it('burnt lamps and a dead horn are faults the lamp test reveals', () => {
    const t = read('indicator-panel', {}, { lampTest: true }, 'lamp1-burnt');
    expect(t.signals).toMatchObject({ lit1: false, lit2: true, litCount: 3 });
    expect(read('indicator-panel', {}, { horn: true }, 'horn-dead').signals.hornOn).toBe(false);
  });
});

describe('R12/R19 through the real engine: potentiometer -> PLC analog input; PLC -> displays', () => {
  const P = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], at: number): Command => ({ k: 'place', id, kind, at: { x: at, y: 10 } });
  const W = (id: string, from: string, to: string): Command => ({ k: 'wire', id, from, to });
  it('every operator device is a registered component with terminals', () => {
    for (const k of ['potentiometer', 'selector-3pos', 'seven-segment', 'numeric-display', 'operator-station', 'indicator-panel'] as const)
      expect(COMPONENTS[k].terminals.length, k).toBeGreaterThan(0);
    expect(COMPONENTS.potentiometer.terminals.some(t => t.name === 'AN_volts' && t.role === 'analog-output')).toBe(true);
    expect(COMPONENTS['numeric-display'].terminals.some(t => t.name === 'SET_value' && t.role === 'analog-input')).toBe(true);
  });
  it('turning the knob changes the PLC analog input reading live', () => {
    let w: WorldState = tick(createWorld(), [P('ps', 'supply', 10), P('plc', 'plc16', 90), P('pot', 'potentiometer', 200),
      W('a', 'ps.P24', 'plc.L+'), W('b', 'ps.M0', 'plc.M'), W('c', 'ps.P24', 'pot.L+'), W('d', 'ps.M0', 'pot.M'), W('e', 'pot.AN_volts', 'plc.AI0')]).world;
    expect(w.lastError).toBeNull();
    w = tick(w, [{ k: 'loadST', source: 'VAR_OUTPUT y : BOOL; END_VAR y := TRUE;' }, { k: 'run' }]).world;
    const reading = () => renderSnapshot(w).plcs.plc.io.analogInputs?.find(p => p.terminal === 'AI0')?.value ?? NaN;
    for (let i = 0; i < 6; i++) w = tick(w).world;
    expect(reading()).toBe(0);
    expect(renderSnapshot(w).plcs.plc.io.analogInputs?.[0]).toMatchObject({ connected: true, source: 'pot.AN_volts', unit: 'V' });
    w = tick(w, [{ k: 'setOperator', id: 'pot', key: 'positionPct', value: 70 }]).world;
    expect(w.lastError).toBeNull();
    for (let i = 0; i < 6; i++) w = tick(w).world;
    expect(reading()).toBeCloseTo(7, 6);
    w = tick(w, [{ k: 'setOperator', id: 'pot', key: 'positionPct', value: 20 }]).world;
    for (let i = 0; i < 6; i++) w = tick(w).world;
    expect(reading()).toBeCloseTo(2, 6);
  });
  it('device settings are validated: a knob position outside 0-100 is refused', () => {
    let w: WorldState = tick(createWorld(), [P('pot', 'potentiometer', 10)]).world;
    w = tick(w, [{ k: 'setParam', id: 'pot', key: 'positionPct', value: 140 }]).world;
    expect(w.lastError).toBeTruthy();
    expect(validateProject).toBeTruthy();
  });
  it('an operator cannot touch equipment settings through the live channel', () => {
    let w: WorldState = tick(createWorld(), [P('pot', 'potentiometer', 10), P('cyl', 'cylinder', 90)]).world;
    for (const bad of [{ id: 'pot', key: 'rangeV', value: 5 }, { id: 'cyl', key: 'boreMm', value: 60 }, { id: 'nope', key: 'positionPct', value: 5 }, { id: 'pot', key: 'positionPct', value: 500 }]) {
      const r = tick(w, [{ k: 'setOperator', ...bad }]).world;
      expect(r.lastError, JSON.stringify(bad)).toBeTruthy();
      expect(r.operatorValues).toBeUndefined();
    }
  });
  it('analog control: the knob drives a numeric display and a proportional valve through a numeric wire', () => {
    let w: WorldState = tick(createWorld(), [P('ps', 'supply', 10), P('pot', 'potentiometer', 90), P('disp', 'numeric-display', 170), P('valve', 'proportional-valve', 250),
      W('a', 'ps.P24', 'pot.L+'), W('b', 'ps.M0', 'pot.M'), W('c', 'pot.AN_volts', 'disp.SET_value'), W('d', 'pot.AN_percent', 'valve.SET_openingPct')]).world;
    expect(w.lastError).toBeNull();
    w = tick(w, [{ k: 'run' }]).world;
    const sig = (id: string, name: string) => w.plantWorld.signals[id]?.[name];
    for (let i = 0; i < 8; i++) w = tick(w).world;
    expect(sig('disp', 'shown')).toBe(0);
    w = tick(w, [{ k: 'setOperator', id: 'pot', key: 'positionPct', value: 60 }]).world;
    for (let i = 0; i < 100; i++) w = tick(w).world;
    expect(sig('disp', 'shown')).toBe(6);
    expect(sig('valve', 'openingPct') as number).toBeGreaterThan(55);
    // turn it back down: both follow
    w = tick(w, [{ k: 'setOperator', id: 'pot', key: 'positionPct', value: 0 }]).world;
    for (let i = 0; i < 200; i++) w = tick(w).world;
    expect(sig('disp', 'shown')).toBe(0); expect(sig('valve', 'openingPct')).toBe(0);
  });
  it('an unpowered potentiometer sends nothing: the display stays at zero', () => {
    let w: WorldState = tick(createWorld(), [P('pot', 'potentiometer', 90), P('disp', 'numeric-display', 170), W('c', 'pot.AN_volts', 'disp.SET_value')]).world;
    w = tick(w, [{ k: 'run' }, { k: 'setOperator', id: 'pot', key: 'positionPct', value: 80 }]).world;
    for (let i = 0; i < 20; i++) w = tick(w).world;
    expect(w.plantWorld.signals.disp?.shown).toBe(0);
  });
  it('the station buttons work live: held START closes its contact and releasing opens it; STOP is normally closed', () => {
    let w: WorldState = tick(createWorld(), [P('ps', 'supply', 10), P('st', 'operator-station', 90), W('a', 'ps.P24', 'st.L+'), W('b', 'ps.M0', 'st.M')]).world;
    w = tick(w, [{ k: 'run' }]).world;
    const sig = (n: string) => w.plantWorld.signals.st?.[n];
    for (let i = 0; i < 4; i++) w = tick(w).world;
    expect(sig('start')).toBe(false); expect(sig('stop')).toBe(true);
    w = tick(w, [{ k: 'setOperator', id: 'st', key: 'startPressed', value: 1 }, { k: 'setOperator', id: 'st', key: 'stopPressed', value: 1 }]).world;
    for (let i = 0; i < 4; i++) w = tick(w).world;
    expect(sig('start')).toBe(true); expect(sig('stop')).toBe(false);
    w = tick(w, [{ k: 'setOperator', id: 'st', key: 'startPressed', value: 0 }]).world;
    for (let i = 0; i < 4; i++) w = tick(w).world;
    expect(sig('start')).toBe(false);
  });
});
