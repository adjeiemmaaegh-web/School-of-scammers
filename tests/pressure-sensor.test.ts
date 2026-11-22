import { describe, expect, it } from 'vitest';
import { DemoBuilder } from '../src/plant/demos/builder';
import { COMPONENTS } from '../src/components/registry';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { airSensorReadings } from '../src/sim/air-sensors';
import type { ProjectFile, WorldState } from '../src/sim/signals';

const ST = `VAR_INPUT Analog0 : REAL; Analog1 : REAL; AtPressure : BOOL; END_VAR
VAR_OUTPUT Pump : BOOL; END_VAR
Pump := TRUE;`;
/** Compressor -> regulator (4 bar). Sensor `sOut` on the regulator outlet, `sRec` on the receiver; both on PLC analog inputs, `sOut`'s contact on I0.0. */
function plant(opts: { pump?: boolean; powerOut?: boolean; plumbOut?: boolean; outSetpoint?: number; compressor?: boolean } = {}): ProjectFile {
  const { pump = true, powerOut = true, plumbOut = true, outSetpoint, compressor = true } = opts;
  const b = new DemoBuilder();
  if (compressor) b.place('comp', 'compressor', 0, 0);
  b.place('reg', 'air-regulator', 200, 0, { setpointBar: 4 }).place('sOut', 'pressure-sensor', 400, 0, outSetpoint ? { setpointBar: outSetpoint } : {}).place('sRec', 'pressure-sensor', 0, 200);
  b.io.inputs['I0.0'] = 'AtPressure'; b.io.outputs['Q0.0'] = 'Pump';
  if (compressor) { if (pump) b.wire('plc.Q0.0', 'comp.A1'); b.wire('comp.A2', 'ps.M0'); b.wire('comp.AIR', 'reg.AIR_IN'); b.wire('comp.AIR', 'sRec.AIR'); }
  if (plumbOut) b.wire('reg.AIR_OUT', 'sOut.AIR');
  if (powerOut) b.power('sOut');
  b.power('sRec');
  b.wire('sOut.AN_pressureBar', 'plc.AI0'); b.wire('sRec.AN_pressureBar', 'plc.AI1'); b.wire('sOut.OUT_atPressure', 'plc.I0.0');
  return b.build(ST);
}
const load = (p: ProjectFile): WorldState => {
  const w = tick(createWorld(), [{ k: 'loadProject', project: p }, { k: 'run' }]).world;
  expect(w.lastError).toBeNull();
  return w;
};
const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const tag = (w: WorldState, name: string) => w.plcs.plc!.tagValues[name];

describe('R06 air pressure sensor', () => {
  it('has an air port, an analog output and a digital contact besides its power pins', () => {
    const t = COMPONENTS['pressure-sensor'].terminals;
    expect(t.find(x => x.name === 'AIR')?.role).toBe('air');
    expect(t.find(x => x.name === 'AN_pressureBar')?.role).toBe('analog-output');
    expect(t.find(x => x.name === 'OUT_atPressure')?.role).toBe('output');
  });
  it('real behaviour: it reads the regulated pressure after the regulator and the receiver pressure before it, in bar, into the PLC', () => {
    const w = scans(load(plant()), 600);                                  // 30 s: the receiver is up to pressure
    expect(tag(w, 'Analog0') as number).toBeCloseTo(4, 1);                // the regulator holds its outlet at its 4 bar limit
    expect(tag(w, 'Analog1') as number).toBeGreaterThan(5.5);             // the receiver sits between cut-in (6) and cut-out (8)
    expect(tag(w, 'Analog1') as number).toBeLessThan(8.5);
    expect(tag(w, 'AtPressure')).toBe(true);                              // contact closed at 4 bar (setpoint 4)
    expect(renderSnapshot(w).plcs.plc.io.analogInputs?.find(p => p.tag === 'Analog0')?.unit).toBe('bar');
  });
  it('the pressure builds up over time rather than appearing at once', () => {
    let w = load(plant());
    w = scans(w, 6);
    expect(tag(w, 'Analog1') as number).toBeLessThan(1.5);
    w = scans(w, 100);
    const mid = tag(w, 'Analog1') as number;
    expect(mid).toBeGreaterThan(1.5);
    expect(tag(w, 'AtPressure')).toBe(false);                             // regulator outlet has not reached 4 bar yet
    w = scans(w, 500);
    expect(tag(w, 'Analog1') as number).toBeGreaterThan(mid);
    expect(tag(w, 'AtPressure')).toBe(true);
  });
  it('the contact follows its setpoint: an outlet sensor set above the regulator limit never closes', () => {
    const w = scans(load(plant({ outSetpoint: 6 })), 600);
    expect(tag(w, 'Analog0') as number).toBeCloseTo(4, 1);
    expect(tag(w, 'AtPressure')).toBe(false);
  });
  it('an unplumbed sensor reads 0 bar; an unpowered one loses its source (the PLC reports it) and its contact stays open', () => {
    const unplumbed = scans(load(plant({ plumbOut: false })), 600);
    expect(tag(unplumbed, 'Analog0')).toBe(0); expect(tag(unplumbed, 'AtPressure')).toBe(false);
    expect(tag(unplumbed, 'Analog1') as number).toBeGreaterThan(5.5);     // the other sensor is unaffected
    let dead = tick(createWorld(), [{ k: 'loadProject', project: plant({ powerOut: false }) }, { k: 'run' }]).world;
    dead = scans(dead, 20);
    expect(dead.lastError).toMatch(/Analog0 has no connected source/);   // no supply = no signal, exactly like any unpowered analog source
    expect(dead.running).toBe(false);
  });
  it('with the pump off no pressure is ever read; a project without a compressor has no air at all', () => {
    const off = scans(load(plant({ pump: false })), 400);
    expect(tag(off, 'Analog0')).toBe(0); expect(tag(off, 'Analog1')).toBe(0);
    const none = scans(load(plant({ compressor: false })), 100);
    expect(tag(none, 'Analog0')).toBe(0);
  });
  it('a leak shows up on the gauge: with a pump too slow to keep up, the receiver pressure falls', () => {
    const slow = plant();
    slow.params = { ...(slow.params ?? {}), comp: { fillBarPerS: 0.3 } };   // a pump slower than the 0.4 bar/s leak
    let w = scans(load(slow), 600);
    const healthy = tag(w, 'Analog1') as number;
    expect(healthy).toBeGreaterThan(5.5);
    w = tick(w, [{ k: 'pause' }, { k: 'injectFault', kind: 'air-leak', target: 'comp', hidden: false }, { k: 'run' }]).world;
    expect(w.lastError).toBeNull();
    w = scans(w, 600);
    expect(tag(w, 'Analog1') as number).toBeLessThan(healthy - 3);        // the gauge shows the loss
    expect(tag(w, 'AtPressure')).toBe(false);                             // so does the outlet contact once the regulator is starved
  });
  it('a broken air line (open-wire fault on the plumbing) cuts the reading to 0 bar', () => {
    let w = scans(load(plant()), 600);
    expect(tag(w, 'Analog0') as number).toBeCloseTo(4, 1);
    const line = w.project.wires.find(x => (x.from === 'reg.AIR_OUT' && x.to === 'sOut.AIR') || (x.to === 'reg.AIR_OUT' && x.from === 'sOut.AIR'))!;
    w = tick(w, [{ k: 'pause' }, { k: 'injectFault', kind: 'wire-open', target: line.id, hidden: false }, { k: 'run' }]).world;
    expect(w.lastError).toBeNull();
    w = scans(w, 20);
    expect(tag(w, 'Analog0')).toBe(0);
    expect(tag(w, 'AtPressure')).toBe(false);
    expect(tag(w, 'Analog1') as number).toBeGreaterThan(5.5);             // upstream of the break nothing changed
  });
  it('airSensorReadings is exposed directly and the project validates with the new device', () => {
    const p = plant();
    expect(() => validateProject(p)).not.toThrow();
    const r = airSensorReadings(p, { comp: { pressureBar: 7, pumping: false } });
    expect(r.sRec).toBe(7); expect(r.sOut).toBe(4);                       // regulator limits to 4
    expect(airSensorReadings(p, {}).sRec).toBe(0);
  });
});
