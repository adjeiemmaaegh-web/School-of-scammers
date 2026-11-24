import { describe, expect, it, vi } from 'vitest';
// Heavy deterministic runs: allow for a busy machine (they timed out at the 5 s default while a browser suite ran alongside).
vi.setConfig({ testTimeout: 30_000 });
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import { FACTORY_PARTS, multiPlcFactoryDemo } from '../src/plant/demos/multi-plc-factory';
import type { WorldState } from '../src/sim/signals';

const start = (fault?: { id: string; fault: string }): WorldState => {
  let w = tick(createWorld(), [{ k: 'loadProject', project: multiPlcFactoryDemo() }, ...(fault ? [{ k: 'setPlantFault' as const, ...fault }] : [])]).world;
  expect(w.lastError).toBeNull();
  return tick(w, [{ k: 'run' }]).world;
};
const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const tags = (w: WorldState, plc: string) => renderSnapshot(w).plcs[plc].tagValues;
const model = (w: WorldState, id: string) => w.plantWorld.world.model[id];

describe('Demonstration D: two PLCs, two cells, one 24V handshake', () => {
  it('both controllers are powered, run their own program and keep their own tags', () => {
    const w = scans(start(), 6);
    const snap = renderSnapshot(w);
    expect(snap.plcs.plc.powered).toBe(true); expect(snap.plcs.plc2.powered).toBe(true);
    expect(Object.keys(tags(w, 'plc'))).toContain('DownstreamReady');
    expect(Object.keys(tags(w, 'plc2'))).toContain('Ready');
    expect(Object.keys(tags(w, 'plc2'))).not.toContain('DownstreamReady');
  });
  it('every part is machined by cell 1, handed over, inspected by cell 2 and collected, in order', () => {
    const w = scans(start(), 2000);
    expect(model(w, 'cutter').count).toBe(FACTORY_PARTS);
    expect(model(w, 'inspector').count).toBe(FACTORY_PARTS);
    expect(model(w, 'bin').count).toBe(FACTORY_PARTS);
    expect(w.plantWorld.world.spawnedCount).toBe(FACTORY_PARTS);
    expect(w.plantWorld.world.bodies).toHaveLength(0);
  });
  it('the handshake is real: PLC 2 reports Ready on a wire that PLC 1 reads as DownstreamReady', () => {
    const w = scans(start(), 4);
    expect(tags(w, 'plc2').Ready).toBe(true);
    expect(tags(w, 'plc').DownstreamReady).toBe(true);
  });
  it('a stalled downstream cell backs the upstream cell up: parts wait at stopper 1 and nothing is collected until the fault is cleared', () => {
    let w = start({ id: 'inspector', fault: 'station-stuck' });
    w = scans(w, 1500);
    expect(model(w, 'bin').count).toBe(0);
    expect(tags(w, 'plc2').Ready).toBe(false);                        // the inspected part never finishes, so cell 2 never frees up
    expect(tags(w, 'plc').DownstreamReady).toBe(false);
    expect(w.plantWorld.world.bodies.length).toBeGreaterThanOrEqual(2);       // one blocked at cell 2, the next waiting upstream
    w = tick(w, [{ k: 'pause' }, { k: 'setPlantFault', id: 'inspector', fault: null }, { k: 'run' }]).world;
    w = scans(w, 2500);
    expect(model(w, 'bin').count).toBe(FACTORY_PARTS);
  });
  it('is deterministic across runs', () => {
    const a = scans(start(), 700), b = scans(start(), 700);
    expect(JSON.stringify(a.plantWorld.world.bodies)).toBe(JSON.stringify(b.plantWorld.world.bodies));
  });
});
