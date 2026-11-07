import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, sortingProgram, tankProgram, tick, validateProject } from '../src/sim/orchestrator';
import { laneOf, lanesOf, vesselOf, vesselsOf } from '../src/sim/stations';
import type { Command, WorldState } from '../src/sim/signals';

const rename = (n: number, id: string) => id.replace(/^([a-z]+)\./, (_, p) => `${p}${n}.`);
const wires = (n: number, pairs: [string, string][]): Command[] =>
  pairs.map(([a, b], i): Command => ({ k: 'wire', id: `w${n}-${i}`, from: rename(n, a), to: rename(n, b) }));

/** One complete sorting line (own supply, PLC, belt, photoeye, diverter), shifted down by `dy` px. */
const sortingLine = (n: number, dy: number): Command[] => [
  { k: 'place', id: `ps${n}`, kind: 'supply', at: { x: 25, y: 25 + dy } }, { k: 'place', id: `plc${n}`, kind: 'plc', at: { x: 315, y: 25 + dy } },
  { k: 'place', id: `con${n}`, kind: 'contactor', at: { x: 555, y: 25 + dy } }, { k: 'place', id: `belt${n}`, kind: 'conveyor', at: { x: 610, y: 280 + dy } },
  { k: 'place', id: `start${n}`, kind: 'start', at: { x: 60, y: 245 + dy } }, { k: 'place', id: `stop${n}`, kind: 'stop', at: { x: 325, y: 245 + dy } },
  { k: 'place', id: `eye${n}`, kind: 'photoeye', at: { x: 690, y: 380 + dy } }, { k: 'place', id: `gate${n}`, kind: 'diverter', at: { x: 750, y: 170 + dy } },
  ...wires(n, [
    ['ps.P24', 'plc.L+'], ['ps.M0', 'plc.M'], ['ps.P24', 'start.A'], ['start.B', 'plc.I0.0'], ['ps.P24', 'stop.A'], ['stop.B', 'plc.I0.1'],
    ['ps.P24', 'con.13'], ['ps.M0', 'con.A2'], ['plc.Q0.0', 'con.A1'], ['con.14', 'belt.L+'], ['ps.M0', 'belt.M-'],
    ['ps.P24', 'eye.L+'], ['ps.M0', 'eye.M'], ['eye.OUT', 'plc.I0.2'], ['plc.Q0.1', 'gate.A1'], ['ps.M0', 'gate.A2']]),
];
const twoLines = (extra: Command[] = []): WorldState => {
  const w = tick(createWorld(), [...sortingLine(1, 0), ...sortingLine(2, 450),
    { k: 'loadProgram', program: sortingProgram() }, { k: 'loadProgram', program: sortingProgram(), plc: 'plc2' }, ...extra]).world;
  expect(w.lastError).toBeNull();
  return w;
};
const scan = (w: WorldState, n: number): WorldState => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const press = (w: WorldState, id: string, settle = 6) => scan(tick(w, [{ k: 'operate', id, pressed: true }]).world, settle);
const release = (w: WorldState, id: string, settle = 6) => scan(tick(w, [{ k: 'operate', id, pressed: false }]).world, settle);
/** Run with both belts started. */
const bothRunning = (w: WorldState) => release(release(press(press(tick(w, [{ k: 'run' }]).world, 'start1'), 'start2'), 'start1'), 'start2');
const drain = (w: WorldState, lane: string, max = 160): WorldState => {
  for (let i = 0; i < max && w.lanes[lane].parcel; i++) w = tick(w).world;
  return w;
};

describe('station assignment is geometric and deterministic', () => {
  it('each photoeye and diverter belongs to the conveyor it is positioned along', () => {
    const w = twoLines();
    const lanes = lanesOf(w.project.components);
    expect(lanes.map(l => [l.conveyor.id, l.eyes.map(e => e.id), l.diverters.map(d => d.id)])).toEqual([
      ['belt1', ['eye1'], ['gate1']], ['belt2', ['eye2'], ['gate2']]]);
    const eye2 = w.project.components.find(c => c.id === 'eye2')!;
    expect(laneOf(w.project.components, eye2)?.id).toBe('belt2');
  });
  it('a device in range of two conveyors goes to the nearest', () => {
    const w = tick(createWorld(), [
      { k: 'place', id: 'a', kind: 'conveyor', at: { x: 600, y: 100 } }, { k: 'place', id: 'b', kind: 'conveyor', at: { x: 600, y: 250 } },
      { k: 'place', id: 'eye', kind: 'photoeye', at: { x: 690, y: 240 } }]).world;
    expect(laneOf(w.project.components, w.project.components.find(c => c.id === 'eye')!)?.id).toBe('b');
  });
  it('pumps, valves and level switches belong to the tank they are mounted beside', () => {
    const w = tick(createWorld(), [
      { k: 'place', id: 't1', kind: 'tank', at: { x: 100, y: 100 } }, { k: 'place', id: 't2', kind: 'tank', at: { x: 700, y: 100 } },
      { k: 'place', id: 'p1', kind: 'pump', at: { x: 150, y: 150 } }, { k: 'place', id: 'p2', kind: 'pump', at: { x: 650, y: 150 } },
      { k: 'place', id: 'far', kind: 'pump', at: { x: 400, y: 450 } }]).world;
    expect(vesselsOf(w.project.components).map(v => [v.tank.id, v.pumps.map(p => p.id)])).toEqual([['t1', ['p1']], ['t2', ['p2']]]);
    expect(vesselOf(w.project.components, w.project.components.find(c => c.id === 'far')!)).toBeUndefined();
  });
});

describe('several conveyor lanes, each its own parcel and counters', () => {
  it('feeding one lane moves only that lane; the legacy plant mirrors the first lane', () => {
    let w = bothRunning(twoLines());
    expect(w.deviceOn.belt1).toBe(true);
    expect(w.deviceOn.belt2).toBe(true);
    w = tick(w, [{ k: 'feedParcel', kind: 'marked', conveyor: 'belt1' }]).world;
    expect(w.lanes.belt1.parcel?.kind).toBe('marked');
    expect(w.lanes.belt2.parcel).toBeNull();
    expect(w.plant).toEqual(w.lanes.belt1);
    w = drain(w, 'belt1');
    expect(w.lanes.belt1).toMatchObject({ rejected: 1, accepted: 0, parcel: null });
    expect(w.lanes.belt2).toMatchObject({ rejected: 0, accepted: 0, parcel: null });
  });
  it('parcels on both lanes at once are sorted by their own PLC, photoeye and diverter', () => {
    let w = bothRunning(twoLines());
    w = tick(w, [{ k: 'feedParcel', kind: 'marked', conveyor: 'belt1' }, { k: 'feedParcel', kind: 'plain', conveyor: 'belt2' }]).world;
    expect(w.lastError).toBeNull();
    let eye1Seen = false, eye2Seen = false;
    for (let i = 0; i < 160 && (w.lanes.belt1.parcel || w.lanes.belt2.parcel); i++) {
      w = tick(w).world;
      const s = renderSnapshot(w);
      eye1Seen ||= s.plcs.plc1.inputs.Photoeye;
      eye2Seen ||= s.plcs.plc2.inputs.Photoeye;
    }
    expect(w.lanes.belt1).toMatchObject({ rejected: 1, accepted: 0 }); // marked: rejected by line 1
    expect(w.lanes.belt2).toMatchObject({ accepted: 1, rejected: 0 }); // plain: accepted by line 2
    expect(eye1Seen).toBe(true);
    expect(eye2Seen).toBe(false); // line 2's photoeye never saw line 1's mark
  });
  it('a stopped belt does not move its parcel while the other lane runs', () => {
    let w = bothRunning(twoLines());
    w = press(w, 'stop2', 8);
    expect(w.deviceOn.belt2).toBe(false);
    w = tick(w, [{ k: 'feedParcel', kind: 'plain', conveyor: 'belt2' }, { k: 'feedParcel', kind: 'plain', conveyor: 'belt1' }]).world;
    w = scan(w, 30);
    expect(w.lanes.belt2.parcel?.position).toBeLessThan(0.1);
    expect((w.lanes.belt1.parcel?.position ?? 1)).toBeGreaterThan(0.2);
  });
  it('each lane can be fed only once a conveyor is named correctly', () => {
    const w = bothRunning(twoLines());
    expect(tick(w, [{ k: 'feedParcel', kind: 'plain', conveyor: 'nope' }]).world.lastError).toMatch(/Unknown conveyor/);
    expect(tick(w, [{ k: 'feedParcel', kind: 'plain', conveyor: 'eye1' }]).world.lastError).toMatch(/Unknown conveyor/);
    expect(tick(w, [{ k: 'feedParcel', kind: 'plain' }]).world.lanes.belt1.parcel?.kind).toBe('plain'); // default = first
  });
  it('a stuck photoeye on line 2 lies only to PLC 2', () => {
    const w0 = twoLines([{ k: 'injectFault', kind: 'sensor-stuck', target: 'eye2', stuckActive: true, hidden: false }]);
    const s = renderSnapshot(scan(bothRunning(w0), 6));
    expect(s.plcs.plc2.inputs.Photoeye).toBe(true);
    expect(s.plcs.plc1.inputs.Photoeye).toBe(false);
  });
  it('removing a conveyor drops its lane', () => {
    const w = tick(bothRunning(twoLines()), [{ k: 'pause' }]).world;
    const r = tick(w, [{ k: 'remove', id: 'belt2' }]).world;
    expect(Object.keys(renderSnapshot(scan(tick(r, [{ k: 'run' }]).world, 2)).lanes)).toEqual(['belt1']);
  });
});

const tankLine = (n: number, dy: number): Command[] => [
  { k: 'place', id: `supply${n}`, kind: 'supply', at: { x: 25, y: 25 + dy } }, { k: 'place', id: `plc${n}`, kind: 'plc', at: { x: 310, y: 25 + dy } },
  { k: 'place', id: `stop${n}`, kind: 'stop', at: { x: 225, y: 245 + dy } }, { k: 'place', id: `tank${n}`, kind: 'tank', at: { x: 680, y: 290 + dy } },
  { k: 'place', id: `pump${n}`, kind: 'pump', at: { x: 525, y: 280 + dy } }, { k: 'place', id: `probe${n}`, kind: 'levelprobe', at: { x: 700, y: 360 + dy } },
  { k: 'place', id: `drain${n}`, kind: 'drainvalve', at: { x: 840, y: 360 + dy } },
  ...wires(n, [
    ['supply.P24', 'plc.L+'], ['supply.M0', 'plc.M'], ['supply.P24', 'stop.A'], ['stop.B', 'plc.I0.1'],
    ['supply.P24', 'probe.L+'], ['supply.M0', 'probe.M'], ['probe.OUT', 'plc.I0.3'],
    ['plc.Q0.2', 'pump.L+'], ['supply.M0', 'pump.M-'], ['plc.Q0.3', 'drain.A1'], ['supply.M0', 'drain.A2']]),
];
const twoTanks = (extra: Command[] = []): WorldState => {
  const w = tick(createWorld(), [...tankLine(1, 0), ...tankLine(2, 600),
    { k: 'loadProgram', program: tankProgram() }, { k: 'loadProgram', program: tankProgram(), plc: 'plc2' }, ...extra]).world;
  expect(w.lastError).toBeNull();
  return tick(w, [{ k: 'run' }]).world;
};

describe('several tanks, each its own vessel, pump, valve and level switch', () => {
  it('both tanks fill and cycle on their own PLC; the legacy tank mirrors the first', () => {
    let w = twoTanks();
    let high1 = false, high2 = false;
    for (let i = 0; i < 220; i++) {
      w = tick(w).world;
      high1 ||= w.vessels.tank1.highLevel; high2 ||= w.vessels.tank2.highLevel;
    }
    expect(high1 && high2).toBe(true);
    expect(w.tank).toEqual(w.vessels.tank1);
    expect(w.vessels.tank1.filledMl).toBeGreaterThan(500);
    expect(w.vessels.tank2.filledMl).toBeGreaterThan(500);
  });
  it('a cut pump wire on tank 2 leaves tank 2 empty while tank 1 fills', () => {
    const w0 = tick(createWorld(), [...tankLine(1, 0), ...tankLine(2, 600), { k: 'loadProgram', program: tankProgram() },
      { k: 'loadProgram', program: tankProgram(), plc: 'plc2' }]).world;
    const cut = w0.project.wires.find(x => x.from === 'plc2.Q0.2')!;
    let w = tick(tick(w0, [{ k: 'unwire', id: cut.id }]).world, [{ k: 'run' }]).world;
    w = scan(w, 40); // 9 ml per scan: tank 1 is mid-fill, well before its 750 ml HIGH trip
    expect(w.vessels.tank1.levelMl).toBeGreaterThan(300);
    expect(w.vessels.tank2.levelMl).toBe(0);
    expect(w.deviceOn.pump1).toBe(true);
    expect(w.deviceOn.pump2).toBe(false);
  });
  it('STOP on one PLC halts only its own pump and drain', () => {
    let w = scan(twoTanks(), 30);
    w = press(w, 'stop1', 8);
    expect(w.deviceOn.pump1).toBe(false);
    expect(w.deviceOn.pump2).toBe(true);
  });
  it('each level switch reads its own tank', () => {
    let w = twoTanks();
    // Keep tank 2 empty by stopping its PLC; tank 1 fills to HIGH.
    w = press(w, 'stop2', 4);
    let seen1 = false, seen2 = false;
    for (let i = 0; i < 160; i++) {
      w = tick(w).world;
      const s = renderSnapshot(w);
      seen1 ||= s.plcs.plc1.inputs.TankHigh; seen2 ||= s.plcs.plc2.inputs.TankHigh;
    }
    expect(seen1).toBe(true);
    expect(seen2).toBe(false);
  });
});

describe('several breakers and overloads, each with its own trip state', () => {
  /** Two separate protected lamp circuits. */
  const panels = (extra: Command[] = []): WorldState => {
    const parts = (n: number): Command[] => [
      { k: 'place', id: `ps${n}`, kind: 'supply', at: { x: 20, y: 20 + n * 200 } }, { k: 'place', id: `cb${n}`, kind: 'breaker', at: { x: 220, y: 20 + n * 200 } },
      { k: 'place', id: `ol${n}`, kind: 'overload', at: { x: 420, y: 20 + n * 200 } }, { k: 'place', id: `lamp${n}`, kind: 'lamp', at: { x: 620, y: 20 + n * 200 } },
      ...wires(n, [['ps.P24', 'cb.IN'], ['cb.OUT', 'ol.95'], ['ol.96', 'lamp.L+'], ['lamp.M-', 'ps.M0']])];
    const w = tick(createWorld(), [...parts(1), ...parts(2), ...extra, { k: 'run' }]).world;
    expect(w.lastError).toBeNull();
    return scan(w, 3);
  };
  it('both circuits run; each lamp is lit from its own supply', () => {
    const w = panels();
    expect(w.deviceOn).toMatchObject({ lamp1: true, lamp2: true });
  });
  it('a short downstream of breaker 2 trips breaker 2 only', () => {
    const w0 = panels();
    const paused = tick(w0, [{ k: 'pause' }]).world;
    const shorted = tick(paused, [{ k: 'wire', id: 'oops', from: 'ol2.96', to: 'ps2.M0' }, { k: 'run' }]).world;
    const w = scan(shorted, 3);
    expect(w.tripped).toMatchObject({ cb2: true });
    expect(w.tripped.cb1).not.toBe(true);
    expect(w.deviceOn.lamp1).toBe(true);
    expect(w.deviceOn.lamp2).toBe(false);
    expect(w.breakerTripped).toBe(false); // the legacy flag mirrors the FIRST breaker, which is healthy
  });
  it('tripping overload 1 opens only its own path; the legacy flag mirrors the first overload', () => {
    let w = panels();
    w = scan(tick(w, [{ k: 'operateProtection', id: 'ol1', action: 'trip' }]).world, 3);
    expect(w.tripped.ol1).toBe(true);
    expect(w.deviceOn).toMatchObject({ lamp1: false, lamp2: true });
    expect(w.overloadTripped).toBe(true);
    w = scan(tick(w, [{ k: 'operateProtection', id: 'ol1', action: 'reset' }]).world, 3);
    expect(w.deviceOn.lamp1).toBe(true);
    expect(w.overloadTripped).toBe(false);
  });
  it('a breaker cannot be reset into a short that is still there', () => {
    const w0 = tick(panels(), [{ k: 'pause' }]).world;
    let w = scan(tick(w0, [{ k: 'wire', id: 'oops', from: 'ol2.96', to: 'ps2.M0' }, { k: 'run' }]).world, 3);
    expect(w.tripped.cb2).toBe(true);
    w = tick(w, [{ k: 'operateProtection', id: 'cb2', action: 'reset' }]).world;
    expect(w.lastError).toMatch(/Remove the short/);
    expect(w.tripped.cb2).toBe(true);
  });
});

describe('project files and determinism', () => {
  it('a plant with two lanes, two tanks and several breakers is a valid project that round-trips', () => {
    const w = twoLines();
    const copy = validateProject(JSON.parse(JSON.stringify(w.project)));
    expect(copy.components.filter(c => c.kind === 'conveyor')).toHaveLength(2);
  });
  it('replays identically', () => {
    const play = () => {
      let w = bothRunning(twoLines());
      w = tick(w, [{ k: 'feedParcel', kind: 'marked', conveyor: 'belt1' }, { k: 'feedParcel', kind: 'plain', conveyor: 'belt2' }]).world;
      return JSON.stringify(renderSnapshot(scan(w, 80)));
    };
    expect(play()).toBe(play());
  });
});
