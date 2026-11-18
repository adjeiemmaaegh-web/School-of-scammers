import { describe, expect, it } from 'vitest';
import { continuityPath } from '../src/electrical/continuity';
import type { Device } from '../src/engineering/electrical';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x = 10, y = 10): Command => ({ k: 'place', id, kind, at: { x, y } });
const wires = (pairs: [string, string][]): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));
/** supply -> START -> relay coil -> supply; relay contact feeds a lamp. */
const bench = () => tick(createWorld(), [
  place('ps', 'supply'), place('go', 'start'), place('k', 'relay'), place('lamp', 'lamp'),
  ...wires([['ps.P24', 'go.A'], ['go.B', 'k.A1'], ['k.A2', 'ps.M0'], ['ps.P24', 'k.13'], ['k.14', 'lamp.L+'], ['lamp.M-', 'ps.M0']])]).world;
const probe = (w: WorldState, a: string, b: string): WorldState =>
  tick(w, [{ k: 'setMeterMode', mode: 'continuity' }, { k: 'setMeterProbe', lead: 'positive', terminal: a }, { k: 'setMeterProbe', lead: 'negative', terminal: b }]).world;

describe('R5.5 continuity meter', () => {
  it('a wire is a conductor, an open switch is open, a closed switch conducts', () => {
    let w = bench();
    expect(probe(w, 'ps.P24', 'go.A').meter.status).toBe('conductor'); // plain wire
    expect(probe(w, 'go.A', 'go.B').meter.status).toBe('open');        // released pushbutton
    w = tick(w, [{ k: 'operate', id: 'go', pressed: true }]).world;
    expect(probe(w, 'go.A', 'go.B').meter.status).toBe('conductor');   // pressed pushbutton closes
  });
  it('a coil or lamp is "through a load", not a clean conductor; unconnected terminals are open', () => {
    const w = bench();
    expect(probe(w, 'k.A1', 'k.A2').meter.status).toBe('through-load');
    expect(probe(w, 'lamp.L+', 'lamp.M-').meter.status).toBe('through-load');
    expect(probe(w, 'k.13', 'lamp.L+').meter.status).toBe('open'); // relay contact open until pulled in
    expect(probe(w, 'k.21', 'k.22').meter.status).toBe('conductor'); // NC contact closed at rest
  });
  it('is refused while the simulation runs and works again when paused (a live continuity test is dangerous)', () => {
    let w = probe(bench(), 'ps.P24', 'go.A');
    w = tick(w, [{ k: 'run' }]).world;
    w = tick(w).world;
    expect(renderSnapshot(w).meter.status).toBe('energised');
    w = tick(w, [{ k: 'pause' }]).world;
    w = tick(w).world;
    expect(renderSnapshot(w).meter.status).toBe('conductor');
  });
  it('switching back to voltage mode restores the DC reading and an unselected probe says so', () => {
    let w = probe(bench(), 'ps.P24', 'ps.M0');
    w = tick(w, [{ k: 'setMeterMode', mode: 'voltage' }]).world;
    expect(w.meter.mode).toBeUndefined();
    expect(w.meter.status).toBe('measured'); // probes stay attached, so the DC reading is back at once
    expect(w.meter.volts).toBe(24);
    expect(tick(bench(), [{ k: 'setMeterMode', mode: 'continuity' }]).world.meter).toMatchObject({ status: 'select', mode: 'continuity' });
    expect(tick(bench(), [{ k: 'setMeterMode', mode: 'bogus' as never }]).world.lastError).toMatch(/Unknown meter mode/);
  });
  it('the solver-independent path search treats supplies as open and follows only closed switches', () => {
    const devices: Device[] = [{ id: 'ps', kind: 'supply', positive: 'a', negative: 'b', volts: 24 }, { id: 's', kind: 'switch', a: 'b', b: 'c', closed: false }, { id: 'l', kind: 'load', positive: 'c', negative: 'd', nominalVolts: 24 }];
    expect(continuityPath(devices, [], 'a', 'b')).toBe('open');
    expect(continuityPath(devices, [], 'b', 'c')).toBe('open');
    expect(continuityPath([{ id: 's', kind: 'switch', a: 'b', b: 'c', closed: true }], [], 'b', 'c')).toBe('conductor');
    expect(continuityPath(devices, [], 'c', 'd')).toBe('through-load');
  });
});
