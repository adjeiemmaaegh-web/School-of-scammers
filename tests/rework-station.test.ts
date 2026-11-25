import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { materialById, materialSpawn } from '../src/plant/world/materials';
import type { EquipmentPlacement, World } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, params: Record<string, number> = {}): EquipmentPlacement => ({ id, kind, originMm: vec(x, 0, 0), yawDeg: 0, params });
const part = (w: World, tags: Record<string, string | number | boolean>): World =>
  spawnBody(w, 't', materialSpawn(materialById('metal-workpiece')!, vec(0, 0, 120), { supportedBy: 'belt', tags }));
type Inputs = Record<string, Record<string, boolean | number>>;
const run = (items: EquipmentPlacement[], world: World, inputs: Inputs, scans: number) => {
  let r = freshRuntime(world, items, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, inputs);
  return r;
};
const belt = P('belt', 'belt-conveyor', 0, { lengthMm: 1000 });
const rework = P('rw', 'process-station', 0, { operation: 5, cycleMs: 1000 });
const inspect = P('in', 'process-station', 0, { operation: 4, cycleMs: 500 });
const bad = { stage: 'machined', defect: true, inspected: true, inspectedBy: 'in', inspectResult: 'fail', rejected: true, trace: 'M:m>I:in' };

describe('R25 rework station operation', () => {
  it('removes the defect after the full cycle, not before, and records the rework in the trace', () => {
    const w = part(freshWorld(), bad);
    const early = run([belt, rework], w, { rw: { run: true } }, 10);                 // 0.5 s of a 1 s cycle
    expect(early.world.bodies[0].tags.defect).toBe(true);
    expect(early.world.model.rw.count).toBe(0);
    const done = run([belt, rework], w, { rw: { run: true } }, 30);
    const tags = done.world.bodies[0].tags;
    expect(tags.defect).toBe(false); expect(tags.reworked).toBe(true); expect(tags.reworkedBy).toBe('rw');
    expect(tags.trace).toBe('M:m>I:in>R:rw');
    expect(tags.stage).toBe('machined');                                              // rework repairs, it does not change the stage
    expect(done.signals.rw.cycleDone).toBe(true); expect(done.world.model.rw.count).toBe(1);
  });
  it('does nothing until run is commanded, and ignores a part that is not defective', () => {
    const w = part(freshWorld(), bad);
    expect(run([belt, rework], w, {}, 60).world.bodies[0].tags.defect).toBe(true);
    const clean = part(freshWorld(), { stage: 'machined', inspected: true });
    const r = run([belt, rework], clean, { rw: { run: true } }, 60);
    expect(r.world.model.rw.count).toBe(0);
    expect(r.world.bodies[0].tags.reworked).toBeUndefined();
    expect(r.signals.rw.busy).toBe(false);
  });
  it('forgets the old verdict so the part can be inspected again, and a second inspection passes it', () => {
    const w = part(freshWorld(), bad);
    const reworked = run([belt, rework], w, { rw: { run: true } }, 30).world;
    const tags = reworked.bodies[0].tags;
    expect(tags.inspected).toBeUndefined(); expect(tags.inspectResult).toBeUndefined(); expect(tags.rejected).toBeUndefined();
    const again = run([belt, inspect], reworked, { in: { run: true } }, 30);
    expect(again.world.bodies[0].tags.inspectResult).toBe('pass');                    // no defect left to find
    expect(again.signals.in.fail).toBe(false);
  });
  it('a broken station cannot rework, and an unfixed part still fails inspection', () => {
    const w = part(freshWorld(), { ...bad, inspected: undefined as never });
    let r = freshRuntime(w, [belt, inspect], PLANT_EQUIPMENT);
    for (let i = 0; i < 30; i++) r = stepScene(r, [belt, inspect], PLANT_EQUIPMENT, { in: { run: true } });
    expect(r.world.bodies[0].tags.inspectResult).toBe('fail');
    expect(r.signals.in.fail).toBe(true);
    let broken = freshRuntime(part(freshWorld(), bad), [belt, rework], PLANT_EQUIPMENT);
    for (let i = 0; i < 40; i++) broken = stepScene(broken, [belt, rework], PLANT_EQUIPMENT, { rw: { run: true } }, { rw: 'station-stuck' });
    expect(broken.world.bodies[0].tags.defect).toBe(true);
  });
});

describe('R16 finish operation completes the stage chain', () => {
  const finish = P('fin', 'process-station', 0, { operation: 6, cycleMs: 600 });
  it('turns a machined or assembled part into a finished one after the cycle, with a trace', () => {
    for (const stage of ['machined', 'assembled']) {
      const w = part(freshWorld(), { stage, trace: 'M:m' });
      const early = run([belt, finish], w, { fin: { run: true } }, 5);
      expect(early.world.bodies[0].tags.stage).toBe(stage);                           // not before the cycle ends
      const done = run([belt, finish], w, { fin: { run: true } }, 20);
      expect(done.world.bodies[0].tags.stage).toBe('finished');
      expect(done.world.bodies[0].tags.finishedBy).toBe('fin');
      expect(done.world.bodies[0].tags.trace).toBe('M:m>F:fin');
      expect(done.signals.fin.cycleDone).toBe(true); expect(done.world.model.fin.count).toBe(1);
    }
  });
  it('leaves a raw part and a defective part alone, and does nothing without the run command', () => {
    expect(run([belt, finish], part(freshWorld(), { stage: 'raw' }), { fin: { run: true } }, 30).world.bodies[0].tags.stage).toBe('raw');
    expect(run([belt, finish], part(freshWorld(), { stage: 'machined', defect: true }), { fin: { run: true } }, 30).world.bodies[0].tags.stage).toBe('machined');
    expect(run([belt, finish], part(freshWorld(), { stage: 'machined' }), {}, 30).world.bodies[0].tags.stage).toBe('machined');
  });
  it('a reworked part can then be finished: machine -> inspect fail -> rework -> finish', () => {
    const reworked = run([belt, rework], part(freshWorld(), bad), { rw: { run: true } }, 30).world;
    expect(reworked.bodies[0].tags.defect).toBe(false);
    const done = run([belt, finish], reworked, { fin: { run: true } }, 20);
    expect(done.world.bodies[0].tags.stage).toBe('finished');
    expect(done.world.bodies[0].tags.trace).toBe('M:m>I:in>R:rw>F:fin');
  });
  it('a finished part is not worked on again', () => {
    const w = part(freshWorld(), { stage: 'finished', finishedBy: 'other' });
    const r = run([belt, finish], w, { fin: { run: true } }, 30);
    expect(r.world.model.fin.count).toBe(0);
  });
});
