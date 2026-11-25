import { describe, expect, it } from 'vitest';
import { createWorld, tick } from '../src/sim/orchestrator';
import { SORTING_PARTS_PER_KIND, sortingFactoryDemo } from '../src/plant/demos/sorting-factory';
import type { WorldState } from '../src/sim/signals';

const run = (scans: number, mutate?: (p: ReturnType<typeof sortingFactoryDemo>) => void, fault?: { id: string; fault: string }) => {
  const project = sortingFactoryDemo(); mutate?.(project);
  let w: WorldState = tick(createWorld(), [{ k: 'loadProject', project }, ...(fault ? [{ k: 'setPlantFault' as const, ...fault }] : [])]).world;
  expect(w.lastError).toBeNull();
  w = tick(w, [{ k: 'run' }]).world;
  for (let i = 0; i < scans; i++) w = tick(w).world;
  return w;
};
const model = (w: WorldState, id: string) => w.plantWorld.world.model[id];

describe('Demonstration A: automated sorting factory (mixed materials, powered transfer, real PLC)', () => {
  it('every metal part is diverted to the reject bin and every carton reaches the good bin; nothing is lost or misrouted', () => {
    const w = run(1500);
    expect(w.plantWorld.world.spawnedCount).toBe(2 * SORTING_PARTS_PER_KIND);
    expect(model(w, 'reject-bin').count).toBe(SORTING_PARTS_PER_KIND);
    expect(model(w, 'good-bin').count).toBe(SORTING_PARTS_PER_KIND);
    expect(w.plantWorld.world.bodies).toHaveLength(0);
  });
  it('the diversion is the PLC acting on the sensor: with the sensor dead (stuck off) the metal goes the wrong way and stays on the floor', () => {
    const w = run(1500, undefined, { id: 'sense', fault: 'sensor-stuck-off' });
    expect(model(w, 'reject-bin').count).toBe(0);
    expect(model(w, 'good-bin').count).toBe(SORTING_PARTS_PER_KIND);          // cartons are unaffected
    expect(w.plantWorld.world.bodies.filter(b => b.tags.material === 'metal-workpiece').length).toBe(SORTING_PARTS_PER_KIND);   // uncollected metal pieces
  });
  it('a stuck-on sensor diverts everything: the good bin gets nothing', () => {
    const w = run(1500, undefined, { id: 'sense', fault: 'sensor-stuck-on' });
    expect(model(w, 'good-bin').count).toBe(0);
  });
  it('is deterministic: two runs end in the same state', () => {
    const a = run(900), b = run(900);
    expect(JSON.stringify(a.plantWorld.world.bodies)).toBe(JSON.stringify(b.plantWorld.world.bodies));
    expect(model(a, 'good-bin').count).toBe(model(b, 'good-bin').count);
  });
});
