import { describe, expect, it } from 'vitest';
import { createWorld, tick } from '../src/sim/orchestrator';
import { REJECT_REWORK_PARTS, rejectReworkDemo } from '../src/plant/demos/reject-rework';
import type { WorldState } from '../src/sim/signals';

const load = (project = rejectReworkDemo()): WorldState => {
  const w = tick(createWorld(), [{ k: 'loadProject', project }, { k: 'run' }]).world;
  expect(w.lastError).toBeNull();
  return w;
};
/** Runs the line and records, per part, every stage/flag it showed and the trace it ended with. */
function runLine(w: WorldState, scans: number) {
  const defective = new Set<string>(), traces = new Map<string, string>(), reworked = new Set<string>();
  for (let i = 0; i < scans; i++) {
    w = tick(w).world;
    for (const b of w.plantWorld.world.bodies) {
      if (b.tags.defect === true) defective.add(b.id);
      if (b.tags.reworked === true) reworked.add(b.id);
      if (typeof b.tags.trace === 'string') traces.set(b.id, b.tags.trace);
    }
  }
  return { w, defective, reworked, traces };
}
const model = (w: WorldState, id: string) => w.plantWorld.world.model[id];

describe('Demonstration G: reject / rework branch (real PLC, wiring and physics)', () => {
  it('loads cleanly with a powered PLC', () => {
    let w = load();
    for (let i = 0; i < 4; i++) w = tick(w).world;
    expect(w.plcs.plc?.powered).toBe(true);
    expect(w.project.components.filter(c => c.kind === 'process-station')).toHaveLength(3);   // machine, inspect, rework
  });
  it('every defective part takes the rework branch and comes out repaired; no defective part reaches the good bin', () => {
    const { w, defective, reworked, traces } = runLine(load(), 1700);
    expect(defective.size).toBeGreaterThan(0);                            // the defect rate really produced bad parts ...
    expect(defective.size).toBeLessThan(REJECT_REWORK_PARTS);             // ... and some good ones
    expect(model(w, 'rework-bin').count).toBe(defective.size);            // exactly the defective ones were collected from the rework branch
    expect(model(w, 'good-bin').count).toBe(REJECT_REWORK_PARTS - defective.size);
    expect(model(w, 'rework').count).toBe(defective.size);                // the rework station worked once per defective part
    expect(reworked.size).toBe(defective.size);
    // the trace tells the story of each branch
    for (const id of defective) expect(traces.get(id)).toMatch(/^M:machine>I:inspect>R:rework$/);
    const clean = [...traces].filter(([id]) => !defective.has(id));
    expect(clean.length).toBe(REJECT_REWORK_PARTS - defective.size);
    for (const [, t] of clean) expect(t).toBe('M:machine>I:inspect');
    expect(w.plantWorld.world.bodies).toHaveLength(0);                    // nothing left on the floor
    expect(w.plantWorld.world.spawnedCount).toBe(REJECT_REWORK_PARTS);    // conservation: all spawned parts are accounted for
  });
  it('with no defects nothing is diverted: the rework branch stays idle', () => {
    const { w } = runLine(load(rejectReworkDemo(0)), 1700);
    expect(model(w, 'good-bin').count).toBe(REJECT_REWORK_PARTS);
    expect(model(w, 'rework-bin').count).toBe(0);
    expect(model(w, 'rework').count).toBe(0);
  });
  it('with every part defective all of them are reworked and none reach the good bin', () => {
    const { w } = runLine(load(rejectReworkDemo(100)), 1700);
    expect(model(w, 'good-bin').count).toBe(0);
    expect(model(w, 'rework-bin').count).toBe(REJECT_REWORK_PARTS);
  });
  it('a stuck-offline inspection (broken station) halts the line rather than passing unchecked parts', () => {
    let w = tick(createWorld(), [{ k: 'loadProject', project: rejectReworkDemo() }, { k: 'setPlantFault', id: 'inspect', fault: 'station-stuck' }]).world;
    w = tick(w, [{ k: 'run' }]).world;
    for (let i = 0; i < 900; i++) w = tick(w).world;
    expect(model(w, 'good-bin').count).toBe(0);                           // nothing was passed uninspected
    expect(model(w, 'inspect').count).toBe(0);
  });
  it('the rework station only accepts defective parts (a clean part held there is left alone)', () => {
    const { w } = runLine(load(rejectReworkDemo(0)), 600);
    expect(model(w, 'rework').count).toBe(0);
  });
});
