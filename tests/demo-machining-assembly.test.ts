import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import { machiningAssemblyDemo } from '../src/plant/demos/machining-assembly';
import type { WorldState } from '../src/sim/signals';

const load = (project = machiningAssemblyDemo()): WorldState => {
  const w = tick(createWorld(), [{ k: 'loadProject', project }, { k: 'run' }]).world;
  expect(w.lastError).toBeNull();
  return w;
};
const bodies = (w: WorldState) => w.plantWorld.world.bodies;
const stagesSeen = (w: WorldState, scans: number) => {
  const seen = new Set<string>(), traces = new Set<string>();
  for (let i = 0; i < scans; i++) {
    w = tick(w).world;
    for (const b of bodies(w)) { if (typeof b.tags.stage === 'string') seen.add(b.tags.stage); if (typeof b.tags.trace === 'string') traces.add(b.tags.trace); }
  }
  return { w, seen, traces };
};

describe('Demonstration B: machining and assembly cell (real PLC, real wiring, real physics)', () => {
  it('loads as an ordinary project with no errors and a powered PLC', () => {
    const w = load();
    expect(w.project.components.some(c => c.kind === 'process-station')).toBe(true);
    for (let i = 0; i < 3; i++) tick(w);
    expect(renderSnapshot(tick(w).world).plcs.plc.powered).toBe(true);
  });
  it('a raw workpiece is machined, joined with a lid, and collected, in that order', () => {
    const { w, seen, traces } = stagesSeen(load(), 700);
    expect([...seen]).toEqual(expect.arrayContaining(['raw', 'machined', 'assembled']));
    expect([...traces].some(t => t === 'M:machine>A:assembly')).toBe(true);
    expect(w.plantWorld.world.model.machine.count).toBe(1);
    expect(w.plantWorld.world.model.assembly.count).toBe(1);
    expect(w.plantWorld.world.model.bin.count).toBe(1);                 // the assembled part reached the collector
    // conservation: 2 spawned (workpiece + lid), the lid was consumed by assembly, the assembled part collected
    expect(w.plantWorld.world.spawnedCount).toBe(2);
    expect(bodies(w)).toHaveLength(0);
  });
  it('the machine cycle really takes its time: the part is still raw halfway through', () => {
    let w = load();
    let atMachine = -1;
    for (let i = 0; i < 400 && atMachine < 0; i++) { w = tick(w).world; if (w.plantWorld.world.model.machine.engaged) atMachine = i; }
    expect(atMachine).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) w = tick(w).world;                      // 0.5 s of a 1.5 s cycle
    expect(bodies(w).find(b => b.tags.stage === 'raw')).toBeTruthy();
    expect(w.plantWorld.world.model.machine.count).toBe(0);
  });
  it('a broken tool halts the cell at the machine: nothing is machined or collected, and clearing the fault resumes production', () => {
    let w = tick(createWorld(), [{ k: 'loadProject', project: machiningAssemblyDemo() }, { k: 'setPlantFault', id: 'machine', fault: 'tool-broken' }]).world;
    expect(w.lastError).toBeNull();
    w = tick(w, [{ k: 'run' }]).world;
    for (let i = 0; i < 500; i++) w = tick(w).world;
    expect(w.plantWorld.world.model.machine.count).toBe(0);
    expect(w.plantWorld.world.model.bin.count).toBe(0);
    expect(bodies(w).some(b => b.tags.stage === 'raw' && b.tags.jammed === true)).toBe(true);
    w = tick(w, [{ k: 'pause' }, { k: 'setPlantFault', id: 'machine', fault: null }, { k: 'run' }]).world;
    for (let i = 0; i < 600; i++) w = tick(w).world;
    expect(w.plantWorld.world.model.bin.count).toBe(1);
  });
  it('a worn tool makes a defective part that is carried through (traceable) rather than silently fixed', () => {
    const project = machiningAssemblyDemo();
    project.params!.machine = { ...project.params!.machine, defectPct: 100 };
    const { w } = stagesSeen(tick(createWorld(), [{ k: 'loadProject', project }, { k: 'run' }]).world, 700);
    expect(w.plantWorld.world.model.bin.count).toBe(1);
    expect(w.plantWorld.world.model.machine.count).toBe(1);
    let defective = false;
    let probe = tick(createWorld(), [{ k: 'loadProject', project }, { k: 'run' }]).world;
    for (let i = 0; i < 700; i++) { probe = tick(probe).world; if (bodies(probe).some(b => b.tags.defect === true)) defective = true; }
    expect(defective).toBe(true);
  });
});
