import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import { humanInteractionDemo } from '../src/plant/demos/human-interaction';
import type { Command, WorldState } from '../src/sim/signals';

const start = (faults: { id: string; fault: string }[] = []): WorldState => {
  let w = tick(createWorld(), [{ k: 'loadProject', project: humanInteractionDemo() }, ...faults.map(f => ({ k: 'setPlantFault' as const, ...f }))]).world;
  expect(w.lastError).toBeNull();
  return tick(w, [{ k: 'run' }]).world;
};
const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const send = (w: WorldState, ...cmds: Command[]) => { const r = tick(w, cmds).world; expect(r.lastError).toBeNull(); return r; };
const model = (w: WorldState, id: string) => w.plantWorld.world.model[id];
const tags = (w: WorldState) => renderSnapshot(w).plcs.plc.tagValues;
const person = (w: WorldState) => w.plantWorld.world.trainingOperator!.pos;
const place = (w: WorldState) => send(w, { k: 'setTrainingOperator', enabled: true, xMm: 0, yMm: -2000, feetMm: 0 });
const walkTo = (w: WorldState, x: number, y: number, n = 60) => scans(send(w, { k: 'walkOperator', xMm: x, yMm: y }), n);

describe('Demonstration F: human interaction and troubleshooting (safety-training cell)', () => {
  it('production runs normally with nobody around: the belt moves and the collector counts', () => {
    const w = scans(start(), 400);
    expect(model(w, 'belt').engaged).toBe(true);
    expect(model(w, 'bin').count).toBeGreaterThan(3);
    expect(tags(w).DoorClosed).toBe(true); expect(tags(w).ZoneOccupied).toBe(false);
  });
  it('a closed guard door physically stops the operator, and production continues untouched', () => {
    let w = scans(place(start()), 10);
    const before = model(w, 'bin').count;
    w = walkTo(w, 0, -700, 100);
    expect(person(w).y).toBeLessThan(-1200);                           // never got through the door
    expect(model(w, 'zone').engaged).toBe(false);
    w = scans(w, 200);
    expect(model(w, 'bin').count).toBeGreaterThan(before);
  });
  it('requesting access stops the line, the door opens after the coast delay, and the operator can then enter; the line stays stopped while they are inside', () => {
    let w = scans(place(start()), 10);
    w = scans(send(w, { k: 'setOperator', id: 'hmi', key: 'startPressed', value: 1 }), 6);
    expect(tags(w).Belt).toBe(false);                                  // stopped at once
    expect(model(w, 'door').progress).toBe(0);                         // not open yet: coast-down delay
    w = scans(w, 80);
    expect(model(w, 'door').progress).toBeGreaterThan(0.99);
    w = walkTo(w, 0, -700, 120);
    expect(person(w).y).toBeGreaterThan(-1000);                        // inside the fence
    expect(model(w, 'zone').engaged).toBe(true);
    expect(tags(w).ZoneOccupied).toBe(true);
    const count = model(w, 'bin').count;
    w = scans(w, 200);
    expect(model(w, 'belt').engaged).toBe(false);
    expect(model(w, 'bin').count).toBe(count);                         // nothing moved while a person was in the cell
  });
  it('after leaving and releasing the request, the door closes, the intrusion clears, and the line restarts by itself', () => {
    let w = scans(place(start()), 10);
    w = scans(send(w, { k: 'setOperator', id: 'hmi', key: 'startPressed', value: 1 }), 90);
    w = walkTo(w, 0, -700, 120);
    w = walkTo(w, 0, -2000, 160);                                      // back out through the open door
    expect(person(w).y).toBeLessThan(-1400);
    expect(tags(w).ZoneOccupied).toBe(false);
    expect(tags(w).ZoneIntrusion).toBe(true);                          // latched until the cell is made safe
    w = scans(send(w, { k: 'setOperator', id: 'hmi', key: 'startPressed', value: 0 }), 200);
    expect(tags(w).ZoneIntrusion).toBe(false);
    expect(model(w, 'door').progress).toBeLessThan(0.01);
    const count = model(w, 'bin').count;
    w = scans(w, 300);
    expect(model(w, 'belt').engaged).toBe(true);
    expect(model(w, 'bin').count).toBeGreaterThan(count);
  });
  it('troubleshooting: a welded door interlock alone is still caught by the zone sensor, but with the zone sensor dead as well the line runs with a person inside', () => {
    // Door opened by the operator request; the interlock contact is welded (reports closed with the door open).
    const trial = (faults: { id: string; fault: string }[]) => {
      let w = scans(place(start(faults)), 10);
      w = scans(send(w, { k: 'setOperator', id: 'hmi', key: 'startPressed', value: 1 }), 90);
      w = walkTo(w, 0, -700, 120);
      w = scans(send(w, { k: 'setOperator', id: 'hmi', key: 'startPressed', value: 0 }), 150);     // operator releases the request but stays inside
      return { moving: model(w, 'belt').engaged, inside: person(w).y > -1000 };
    };
    const interlockOnly = trial([{ id: 'door', fault: 'interlock-stuck-closed' }]);
    expect(interlockOnly.inside).toBe(true); expect(interlockOnly.moving).toBe(false);
    const bothFaults = trial([{ id: 'door', fault: 'interlock-stuck-closed' }, { id: 'zone', fault: 'zone-sensor-dead' }]);
    expect(bothFaults.inside).toBe(true); expect(bothFaults.moving).toBe(true);      // the hazard the training scenario exists to show
  });
});
