import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, sortingProgram, tankProgram, tick, validateProject } from '../src/sim/orchestrator';
import { describeFault, faultCandidates, pickSeededFault } from '../src/sim/faults';
import { TANK_CAPACITY_ML } from '../src/plant/tank-process';
import type { Command, WorldState } from '../src/sim/signals';

/** The P3 sorting workcell (16 wires, w0..w15; w11 is the photoeye supply P24 -> eye.L+). */
const sortPlaces: Command[] = [
  { k: 'place', kind: 'supply', id: 'ps', at: { x: 25, y: 25 } },
  { k: 'place', kind: 'plc', id: 'plc', at: { x: 315, y: 25 } },
  { k: 'place', kind: 'contactor', id: 'con', at: { x: 555, y: 25 } },
  { k: 'place', kind: 'conveyor', id: 'belt', at: { x: 610, y: 280 } },
  { k: 'place', kind: 'start', id: 'start', at: { x: 60, y: 245 } },
  { k: 'place', kind: 'stop', id: 'stop', at: { x: 325, y: 245 } },
  { k: 'place', kind: 'photoeye', id: 'eye', at: { x: 690, y: 380 } },
  { k: 'place', kind: 'diverter', id: 'gate', at: { x: 750, y: 170 } },
];
const sortLinks: [string, string][] = [
  ['ps.P24', 'plc.L+'], ['ps.M0', 'plc.M'], ['ps.P24', 'start.A'], ['start.B', 'plc.I0.0'],
  ['ps.P24', 'stop.A'], ['stop.B', 'plc.I0.1'], ['ps.P24', 'con.13'], ['ps.M0', 'con.A2'],
  ['plc.Q0.0', 'con.A1'], ['con.14', 'belt.L+'], ['ps.M0', 'belt.M-'], ['ps.P24', 'eye.L+'],
  ['ps.M0', 'eye.M'], ['eye.OUT', 'plc.I0.2'], ['plc.Q0.1', 'gate.A1'], ['ps.M0', 'gate.A2'],
];
const sortWorld = (): WorldState => {
  const w = tick(createWorld(), [...sortPlaces,
    ...sortLinks.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }))]).world;
  return tick(w, [{ k: 'loadProgram', program: sortingProgram() }]).world;
};

/** The P3 tank workcell (11 wires). */
const tankPlaces: Command[] = [
  { k: 'place', kind: 'supply', id: 'supply', at: { x: 25, y: 25 } },
  { k: 'place', kind: 'plc', id: 'plc', at: { x: 310, y: 25 } },
  { k: 'place', kind: 'stop', id: 'stop', at: { x: 225, y: 245 } },
  { k: 'place', kind: 'tank', id: 'tank', at: { x: 680, y: 290 } },
  { k: 'place', kind: 'pump', id: 'pump', at: { x: 525, y: 280 } },
  { k: 'place', kind: 'levelprobe', id: 'probe', at: { x: 700, y: 360 } },
  { k: 'place', kind: 'drainvalve', id: 'drain', at: { x: 840, y: 360 } },
];
const tankLinks: [string, string][] = [
  ['supply.P24', 'plc.L+'], ['supply.M0', 'plc.M'], ['supply.P24', 'stop.A'], ['stop.B', 'plc.I0.1'],
  ['supply.P24', 'probe.L+'], ['supply.M0', 'probe.M'], ['probe.OUT', 'plc.I0.3'],
  ['plc.Q0.2', 'pump.L+'], ['supply.M0', 'pump.M-'], ['plc.Q0.3', 'drain.A1'], ['supply.M0', 'drain.A2'],
];
const tankWorld = (): WorldState => {
  const w = tick(createWorld(), [...tankPlaces,
    ...tankLinks.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }))]).world;
  return tick(w, [{ k: 'loadProgram', program: tankProgram() }]).world;
};

const stuck = (target: string, stuckActive: boolean, hidden = false): Command =>
  ({ k: 'injectFault', kind: 'sensor-stuck', target, stuckActive, hidden });
const scans = (w: WorldState, n: number): WorldState => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const belt = (w: WorldState): WorldState => // START pressed, run, then released: the belt runs sealed in
  tick(scans(tick(w, [{ k: 'operate', id: 'start', pressed: true }, { k: 'run' }]).world, 4),
    [{ k: 'operate', id: 'start', pressed: false }]).world;
/** Feed one parcel and run it to the end of the line, recording what the PLC saw versus the truth. */
function runParcel(w: WorldState, kind: 'plain' | 'marked') {
  let seenByPlc = false, truth = false;
  w = tick(w, [{ k: 'feedParcel', kind }]).world;
  for (let i = 0; i < 160 && w.plant.parcel !== null; i++) {
    w = tick(w).world;
    seenByPlc ||= w.inputs.Photoeye;
    truth ||= w.plant.photoeyeActive;
  }
  return { w, seenByPlc, truth };
}
const meter = (w: WorldState, pos: string, neg: string) => tick(w, [
  { k: 'setMeterProbe', lead: 'positive', terminal: pos }, { k: 'setMeterProbe', lead: 'negative', terminal: neg },
]).world.meter;

describe('P5 sensor faults: the photoeye lies to the PLC while the plant stays truthful', () => {
  it('control: a healthy photoeye accepts plain parcels and rejects marked ones', () => {
    const plain = runParcel(belt(sortWorld()), 'plain').w;
    expect([plain.plant.accepted, plain.plant.rejected]).toEqual([1, 0]);
    const marked = runParcel(belt(sortWorld()), 'marked').w;
    expect([marked.plant.accepted, marked.plant.rejected]).toEqual([0, 1]);
  });

  it('stuck ON: the PLC sees a part that is not there, so a plain parcel is rejected', () => {
    let w = belt(tick(sortWorld(), [stuck('eye', true)]).world);
    expect(w.plant.photoeyeActive).toBe(false); // nothing is at the sensor
    expect(w.inputs.Photoeye).toBe(true); // but the input says there is
    const r = runParcel(w, 'plain');
    expect([r.w.plant.accepted, r.w.plant.rejected]).toEqual([0, 1]);
    // The same lie is measurable at the PLC terminal: 24 V on I0.2 with no part present.
    w = belt(tick(sortWorld(), [stuck('eye', true)]).world);
    expect(meter(w, 'plc.I0.2', 'ps.M0')).toMatchObject({ status: 'measured', volts: 24 });
  });

  it('stuck OFF: a marked parcel is never detected, so it is wrongly accepted', () => {
    const r = runParcel(belt(tick(sortWorld(), [stuck('eye', false)]).world), 'marked');
    expect([r.w.plant.accepted, r.w.plant.rejected]).toEqual([1, 0]);
    expect(r.truth).toBe(true); // the plant DID see the mark at the eye
    expect(r.seenByPlc).toBe(false); // the PLC was never told
  });

  it('a stuck-ON output cannot conjure power: an unpowered sensor still reads nothing', () => {
    let w = tick(sortWorld(), [stuck('eye', true)]).world;
    w = tick(w, [{ k: 'unwire', id: 'w11' }]).world; // remove the sensor supply P24 -> eye.L+
    expect(belt(w).inputs.Photoeye).toBe(false);
  });

  it('replacing the sensor restores correct sorting', () => {
    let w = tick(sortWorld(), [stuck('eye', true)]).world;
    w = tick(w, [{ k: 'repair', target: 'eye' }]).world;
    expect(w.project.faults).toBeUndefined();
    const plain = runParcel(belt(w), 'plain').w;
    expect([plain.plant.accepted, plain.plant.rejected]).toEqual([1, 0]);
  });
});

describe('P5 sensor faults: the level probe stuck at either value breaks the tank loop', () => {
  const run = (w: WorldState, n: number) => scans(tick(w, [{ k: 'run' }]).world, n);

  it('control: a healthy probe stops the pump near 750 ml and never overflows', () => {
    let w = tick(tankWorld(), [{ k: 'run' }]).world, peak = 0;
    for (let i = 0; i < 400; i++) { w = tick(w).world; peak = Math.max(peak, w.tank.levelMl); }
    expect(w.tank.spills).toBe(0);
    expect(peak).toBeLessThan(TANK_CAPACITY_ML);
  });

  it('stuck OFF: the PLC never sees HIGH, the pump never stops and the tank overflows', () => {
    let w = tick(tankWorld(), [stuck('probe', false)]).world, plcSawHigh = false, truthHigh = false;
    w = tick(w, [{ k: 'run' }]).world;
    for (let i = 0; i < 260; i++) {
      w = tick(w).world;
      plcSawHigh ||= w.inputs.TankHigh;
      truthHigh ||= w.tank.highLevel;
    }
    expect(truthHigh).toBe(true); // the real level did pass the switch point
    expect(plcSawHigh).toBe(false); // the PLC was never told
    expect(w.tank.levelMl).toBe(TANK_CAPACITY_ML);
    expect(w.tank.spills).toBeGreaterThan(0);
    expect(w.pumpOn).toBe(true);
  });

  it('stuck ON: the PLC thinks the tank is full, so it never fills and the drain stays open', () => {
    const w = run(tick(tankWorld(), [stuck('probe', true)]).world, 200);
    expect(w.tank.levelMl).toBe(0);
    expect(w.pumpOn).toBe(false);
    expect(w.drainOn).toBe(true);
    expect(w.inputs.TankHigh).toBe(true);
    expect(w.tank.highLevel).toBe(false); // the plant truth disagrees
  });
});

describe('P5 sensor faults: validation, seeding, hiding and persistence', () => {
  const err = (cmd: Command, w = sortWorld()) => tick(w, [cmd]).world.lastError ?? '';

  it('only photoeyes and level probes take this fault, and the state is required', () => {
    expect(err(stuck('belt', true))).toMatch(/missing or unsupported part/);
    expect(err(stuck('start', true))).toMatch(/missing or unsupported part/);
    expect(err({ k: 'injectFault', kind: 'sensor-stuck', target: 'eye', hidden: false })).toMatch(/needs a stuckActive state/);
    expect(err({ k: 'injectFault', kind: 'sensor-stuck', target: 'eye', stuckPressed: true, stuckActive: true, hidden: false }))
      .toMatch(/cannot set stuckPressed/);
    expect(err({ k: 'injectFault', kind: 'button-stuck', target: 'start', stuckPressed: true, stuckActive: true, hidden: false }))
      .toMatch(/cannot set stuckActive/);
    expect(err(stuck('probe', true), tankWorld())).toBe('');
  });

  it('adds exactly two seeded candidates per sensor, in a fixed order', () => {
    const sensor = (w: WorldState) => faultCandidates(w.project).filter(c => c.kind === 'sensor-stuck');
    expect(sensor(sortWorld())).toEqual([
      { kind: 'sensor-stuck', target: 'eye', stuckActive: true },
      { kind: 'sensor-stuck', target: 'eye', stuckActive: false },
    ]);
    expect(sensor(tankWorld()).map(c => `${c.target}:${c.stuckActive}`)).toEqual(['probe:true', 'probe:false']);
    expect(sensor(sortWorld())).toEqual(sensor(sortWorld()));
  });

  it('can be picked by seed, and every seeded pick still validates', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 150; seed++) {
      const f = pickSeededFault(sortWorld().project, seed)!;
      kinds.add(f.kind);
      const w = tick(sortWorld(), [{ k: 'injectSeededFault', seed, hidden: false }]).world;
      expect(() => validateProject(JSON.parse(JSON.stringify(w.project)))).not.toThrow();
    }
    expect(kinds.has('sensor-stuck')).toBe(true);
  });

  it('keeps a hidden sensor fault out of events and the snapshot, and describes it once revealed', () => {
    const r = tick(sortWorld(), [stuck('eye', true, true)]);
    expect(r.events.map(e => e.detail)).toEqual(['A fault was injected (hidden)']);
    const w = belt(r.world);
    expect(JSON.stringify(renderSnapshot(w))).not.toMatch(/sensor-stuck|stuckActive|output stuck/i);
    expect(tick(w, [{ k: 'revealFault', id: 'fault-1' }]).events.map(e => e.detail))
      .toEqual(['Fault revealed: Sensor eye output stuck ON']);
    expect(describeFault({ id: 'fault-9', kind: 'sensor-stuck', target: 'probe', stuckActive: false, hidden: false }))
      .toBe('Sensor probe output stuck OFF');
  });

  it('round-trips through the project file and keeps lying after reload', () => {
    const w = tick(sortWorld(), [stuck('eye', true, true)]).world;
    const reloaded = createWorld(validateProject(JSON.parse(JSON.stringify(w.project))));
    expect(reloaded.project.faults).toEqual(w.project.faults);
    expect(belt(reloaded).inputs.Photoeye).toBe(true);
    const bad = JSON.parse(JSON.stringify(w.project));
    bad.faults[0].stuckActive = 'yes';
    expect(() => validateProject(bad)).toThrow(/needs a stuckActive state/);
  });
});
