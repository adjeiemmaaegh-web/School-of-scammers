import { describe, expect, it } from 'vitest';
import { appendSample, MAX_TREND_SAMPLES, readSource, seriesRange, seriesSegments, trendCsv, trendSources } from '../src/diagnostics/trend';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import { DEMOS } from '../src/plant/demos';
import type { RenderSnapshot } from '../src/sim/signals';

/** A real running demonstration, so the trend reads genuine worker snapshots. */
function runningDemo(id: string): { w: ReturnType<typeof createWorld> } {
  const demo = DEMOS.find(d => d.id === id)!;
  let w = tick(createWorld(), [{ k: 'loadProject', project: demo.build() }]).world;
  w = tick(w, [{ k: 'run' }]).world;
  return { w };
}

describe('R5.5 process trend from real snapshots', () => {
  it('lists PLC I/O and plant signals of a running plant and reads them from the snapshot', () => {
    let { w } = runningDemo(DEMOS[0].id);
    for (let i = 0; i < 10; i++) w = tick(w).world;
    const snap = renderSnapshot(w);
    const sources = trendSources(snap);
    expect(sources.some(s => s.id.startsWith('plc:'))).toBe(true);
    expect(sources.some(s => s.id.startsWith('plant:'))).toBe(true);
    for (const s of sources.slice(0, 20)) {
      const v = readSource(snap, s.id);
      expect(v === null || Number.isFinite(v)).toBe(true);
      if (s.kind === 'bool' && v !== null) expect([0, 1]).toContain(v);
    }
    // a plant source reads exactly the published signal
    const plant = sources.find(s => s.id.startsWith('plant:'))!;
    const [, dev, name] = plant.id.split(':');
    const raw = snap.plantWorld.signals[dev][name];
    expect(readSource(snap, plant.id)).toBe(typeof raw === 'boolean' ? (raw ? 1 : 0) : raw);
    expect(readSource(snap, 'plant:nope:x')).toBeNull();
    expect(readSource(snap, 'plc:nope:in:I0.0')).toBeNull();
  });
  it('records one sample per new scan at model time, ignores repeats, restarts on a reset world and stays bounded', () => {
    let { w } = runningDemo(DEMOS[0].id);
    const ids = trendSources(renderSnapshot(w)).slice(0, 2).map(s => s.id);
    let buf = appendSample([], renderSnapshot(w), 50, ids);
    expect(buf).toHaveLength(1);
    expect(appendSample(buf, renderSnapshot(w), 50, ids)).toBe(buf);              // same scan again: unchanged
    w = tick(w).world;
    buf = appendSample(buf, renderSnapshot(w), 50, ids);
    expect(buf).toHaveLength(2);
    expect(buf[1].timeMs - buf[0].timeMs).toBe(50);
    expect(appendSample(buf, renderSnapshot(createWorld()), 50, ids)).toEqual([]);  // tick went backwards
    let big = buf;
    for (let i = 0; i < MAX_TREND_SAMPLES + 30; i++) { w = tick(w).world; big = appendSample(big, renderSnapshot(w), 50, ids); }
    expect(big).toHaveLength(MAX_TREND_SAMPLES);
    expect(big[big.length - 1].tick).toBe(w.tick);
  });
  it('draws segments split at gaps, and exports CSV with empty cells for unavailable values', () => {
    const fake = (tick: number, v: number | null) => ({ tick, timeMs: tick * 50, values: { a: v } });
    const buf = [fake(1, 0), fake(2, 1), fake(3, null), fake(4, 1), fake(5, 0)];
    expect(seriesRange(buf, 'a')).toEqual({ min: 0, max: 1 });
    expect(seriesRange([fake(1, 3), fake(2, 3)], 'a')).toEqual({ min: 2.5, max: 3.5 });
    expect(seriesRange([fake(1, null)], 'a')).toBeNull();
    const seg = seriesSegments(buf, 'a', 200, 100);
    expect(seg).toHaveLength(2);
    expect(seg[0].split(' ')[0]).toBe('0.0,100.0');
    const csv = trendCsv(buf, [{ id: 'a', label: 'tank, level', unit: 'ml', kind: 'number' }]);
    expect(csv.split('\n')[0]).toBe('time_ms,scan,"tank, level (ml)"');
    expect(csv.split('\n')[3]).toBe('150,3,');
  });
  it('does not expose a hidden fault: with a hidden seeded fault active, no source names the fault', () => {
    let { w } = runningDemo(DEMOS[0].id);
    w = tick(w, [{ k: 'pause' }]).world;
    w = tick(w, [{ k: 'injectSeededFault', seed: 7, hidden: true }]).world;
    const hidden = (w.project.faults ?? []).filter(f => f.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    const text = JSON.stringify(trendSources(renderSnapshot(w)));
    for (const f of hidden) { expect(text).not.toContain(f.kind); expect(text).not.toContain(f.id); }
  });
});
