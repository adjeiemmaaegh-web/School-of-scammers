import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCAN_MS, TIME_SCALES, SCAN_PRESETS_MS, createTimingWindow, freshClock, isTimeScale, isValidScanMs, pumpClock, scanMsOf, scanTiming,
} from '../src/sim/scan-config';
import { compileStructuredText, executeStructuredText, type STValue } from '../src/engineering/structured-text';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement } from '../src/plant/world/types';
import type { Command, WorldState } from '../src/sim/signals';

describe('R09 scan period validation', () => {
  it('accepts 10-500 ms in steps of 10 and rejects everything else', () => {
    for (const ok of [10, 20, 50, 100, 250, 500]) expect(isValidScanMs(ok), String(ok)).toBe(true);
    for (const bad of [0, 5, 15, 55, 510, 1000, -50, 50.5, NaN, Infinity, '50', null, undefined])
      expect(isValidScanMs(bad), String(bad)).toBe(false);
    expect(SCAN_PRESETS_MS.every(isValidScanMs)).toBe(true);
    expect(scanMsOf({})).toBe(DEFAULT_SCAN_MS);
    expect(scanMsOf({ scanMs: 20 })).toBe(20);
    expect(scanMsOf({ scanMs: 33 })).toBe(DEFAULT_SCAN_MS);
  });
});

describe('R23 clock: speed changes pacing only, never what a scan does', () => {
  it('conserves model time: scans x period tracks wall x scale to within one scan, for every speed and period', () => {
    for (const scanMs of [10, 50, 200]) for (const scale of TIME_SCALES) {
      let clock = freshClock(), scans = 0;
      const wall = 10_000; // ten wall seconds in 7 ms pump intervals (an uneven interval on purpose)
      for (let t = 0; t < wall; t += 7) scans += pumpClock(clock, 7, scanMs, scale, 1000).scans, clock = pumpClock(clock, 7, scanMs, scale, 1000).state;
      const model = scans * scanMs, expected = wall * scale;
      expect(Math.abs(model - expected), `${scanMs}ms x${scale}`).toBeLessThanOrEqual(scanMs + 7 * scale);
    }
  });
  it('is deterministic: the same wall intervals always give the same scan counts', () => {
    const run = () => { let c = freshClock(); const out: number[] = []; for (const dt of [3, 17, 9, 40, 1, 25, 60, 12]) { const r = pumpClock(c, dt, 20, 2, 50); c = r.state; out.push(r.scans); } return out; };
    expect(run()).toEqual(run());
  });
  it('bounds work per pump, counts dropped scans and flags that it fell behind', () => {
    const r = pumpClock(freshClock(), 200, 10, 10, 20); // 2000 model ms = 200 scans due, only 20 allowed
    expect(r.scans).toBe(20); expect(r.behind).toBe(true); expect(r.state.droppedScans).toBe(180);
    expect(r.state.owedModelMs).toBeLessThan(10);
    const ok = pumpClock(freshClock(), 100, 50, 1, 20);
    expect(ok.scans).toBe(2); expect(ok.behind).toBe(false); expect(ok.state.droppedScans).toBe(0);
  });
  it('rejects invalid arguments instead of guessing', () => {
    expect(() => pumpClock(freshClock(), 10, 33, 1, 5)).toThrow(/scan period/);
    expect(() => pumpClock(freshClock(), 10, 50, 3, 5)).toThrow(/time scale/);
    expect(() => pumpClock(freshClock(), -1, 50, 1, 5)).toThrow(/elapsed/);
    expect(isTimeScale(1) && isTimeScale(0.25) && !isTimeScale(3)).toBe(true);
  });
  it('reports load honestly: cost per scan times scans per wall second', () => {
    const w = createTimingWindow(4); [2, 4, 6, 8].forEach(v => w.add(v));
    const { mean, max } = w.stats();
    expect(mean).toBe(5); expect(max).toBe(8);
    expect(scanTiming(50, 1, 5, 8, 0, false).loadPercent).toBe(10);   // 20 scans/s x 5 ms = 100 ms/s
    expect(scanTiming(10, 10, 5, 8, 3, true).loadPercent).toBe(500);  // 1000 scans/s x 5 ms: cannot keep up
  });
});

describe('R09 timers keep correct model time at every scan period', () => {
  const st = (decl: string, body: string) => compileStructuredText(['VAR_INPUT', '  Go : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Q : BOOL;', '  ET : DINT;', 'END_VAR', 'VAR', decl, 'END_VAR', body].join('\n'));
  it('ST TON with PT T#1s turns on after exactly one model second, whatever the period', () => {
    const p = st('  tm : TON;', 'tm(IN := Go, PT := T#1s);\nQ := tm.Q;\nET := tm.ET;');
    for (const scanMs of SCAN_PRESETS_MS) {
      let memory: Record<string, STValue> = {}, modelMs = 0, onAt = -1;
      for (let i = 0; i < 2000 / scanMs && onAt < 0; i++) {
        const r = executeStructuredText(p, { Go: true }, memory, scanMs); memory = r.memory; modelMs += scanMs;
        if (r.outputs.Q === true) onAt = modelMs;
      }
      expect(onAt, `${scanMs} ms`).toBe(1000);
    }
  });
  it('ST counters and edges depend on scans, not on time, so they are identical at every period', () => {
    const p = compileStructuredText('VAR_INPUT\n  Pulse : BOOL;\nEND_VAR\nVAR_OUTPUT\n  N : INT;\nEND_VAR\nVAR\n  c : CTU;\nEND_VAR\nc(CU := Pulse, R := FALSE, PV := 99);\nN := c.CV;');
    const counts = SCAN_PRESETS_MS.map(scanMs => { let m: Record<string, STValue> = {}, last = 0; for (let i = 0; i < 20; i++) { const r = executeStructuredText(p, { Pulse: i % 2 === 0 }, m, scanMs); m = r.memory; last = Number(r.outputs.N); } return last; });
    expect(new Set(counts).size).toBe(1); expect(counts[0]).toBe(10);
  });
  it('rejects an invalid period', () => {
    const p = st('  tm : TON;', 'tm(IN := Go, PT := T#1s);\nQ := tm.Q;');
    expect(() => executeStructuredText(p, { Go: true }, {}, 0)).toThrow(/scan period/);
  });
});

describe('R09 the whole engine at a configured scan period', () => {
  const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x: number): Command => ({ k: 'place', id, kind, at: { x, y: 10 } });
  /** START -> on-delay relay (1000 ms) -> LATE lamp on the delayed contact: the lamp must light after one MODEL second. */
  function timerBench(scanMs: number): WorldState {
    let w = tick(createWorld(), [{ k: 'setScanPeriod', ms: scanMs }]).world;
    w = tick(w, [place('ps', 'supply', 10), place('go', 'start', 90), place('t', 'timerelay', 170), place('lamp', 'lamp', 250),
      { k: 'wire', id: 'w1', from: 'ps.P24', to: 'go.A' }, { k: 'wire', id: 'w2', from: 'go.B', to: 't.A1' }, { k: 'wire', id: 'w3', from: 't.A2', to: 'ps.M0' },
      { k: 'wire', id: 'w4', from: 'ps.P24', to: 't.13' }, { k: 'wire', id: 'w5', from: 't.14', to: 'lamp.L+' }, { k: 'wire', id: 'w6', from: 'lamp.M-', to: 'ps.M0' },
      { k: 'setParam', id: 't', key: 'delayMs', value: 1000 }]).world;
    expect(w.lastError).toBeNull();
    return w;
  }
  it('the delayed contact closes after one model second at every period (within one scan)', () => {
    for (const scanMs of SCAN_PRESETS_MS) {
      let w = tick(timerBench(scanMs), [{ k: 'run' }, { k: 'operate', id: 'go', pressed: true }]).world;
      let modelMs = scanMs, onAt = -1;
      for (let i = 0; i < 3000 / scanMs && onAt < 0; i++) { w = tick(w).world; modelMs += scanMs; if (renderSnapshot(w).deviceOn.lamp) onAt = modelMs; }
      expect(onAt, `${scanMs} ms`).toBeGreaterThanOrEqual(1000);
      expect(onAt, `${scanMs} ms`).toBeLessThanOrEqual(1000 + 3 * scanMs + 20);
    }
  });
  it('setScanPeriod is validated, paused-only, never stored at the default, and survives export and import', () => {
    const w0 = createWorld();
    expect(tick(w0, [{ k: 'setScanPeriod', ms: 33 }]).world.lastError).toMatch(/10-500/);
    expect(tick(w0, [{ k: 'setScanPeriod', ms: 1000 }]).world.lastError).toMatch(/10-500/);
    const w20 = tick(w0, [{ k: 'setScanPeriod', ms: 20 }]).world;
    expect(w20.project.scanMs).toBe(20);
    expect(tick(w20, [{ k: 'setScanPeriod', ms: 50 }]).world.project.scanMs).toBeUndefined();
    const running = tick(tick(w20, [{ k: 'run' }]).world, [{ k: 'setScanPeriod', ms: 100 }]).world;
    expect(running.project.scanMs).toBe(20); expect(running.lastError).toMatch(/Pause/);
    const reloaded = validateProject(JSON.parse(JSON.stringify(w20.project)));
    expect(reloaded.scanMs).toBe(20);
    expect(() => validateProject({ ...JSON.parse(JSON.stringify(w0.project)), scanMs: 35 })).toThrow(/scan period/);
    expect('scanMs' in validateProject(JSON.parse(JSON.stringify(w0.project)))).toBe(false);
  });
  it('a project loaded in the same call is scanned at its own period, and a bad override is refused', () => {
    const loaded = tick(createWorld(), [{ k: 'loadProject', project: tick(createWorld(), [{ k: 'setScanPeriod', ms: 100 }]).world.project } as Command]);
    expect(loaded.world.project.scanMs).toBe(100);
    expect(() => tick(createWorld(), [], 0)).toThrow(/timestep/);
    expect(() => tick(createWorld(), [], 5000)).toThrow(/timestep/);
  });
});

describe('R09 plant physics is identical at every scan period (10 ms substeps, whole scans)', () => {
  const belts: EquipmentPlacement[] = [
    { id: 'a', kind: 'belt-conveyor', originMm: vec(0, 0, 0), yawDeg: 0, params: { lengthMm: 600, widthMm: 150, speedMmS: 250, zoneSensorMode: 1, zoneCapacity: 1 } },
    { id: 'b', kind: 'belt-conveyor', originMm: vec(600, 0, 0), yawDeg: 0, params: { lengthMm: 600, widthMm: 150, speedMmS: 250, zoneSensorMode: 1, zoneCapacity: 1 } },
  ];
  const start = () => spawnBody(freshWorld(), 'feeder', { size: vec(160, 128, 96), massKg: 8, pos: vec(250, 0, 120), supportedBy: 'a', tags: { origin: 'feeder', material: 'cardboard' } });
  it('a carton carried across two belts for two model seconds ends in the same place and state for every period', () => {
    const results = SCAN_PRESETS_MS.map(scanMs => {
      let r = freshRuntime(start(), belts, PLANT_EQUIPMENT);
      for (let i = 0; i < 2000 / scanMs; i++) r = stepScene(r, belts, PLANT_EQUIPMENT, { a: { run: true }, b: { run: true } }, {}, scanMs);
      const body = r.world.bodies[0];
      return { t: r.world.timeMs, x: body.pos.x, y: body.pos.y, z: body.pos.z, on: body.supportedBy };
    });
    for (const r of results) { expect(r.t).toBe(2000); expect(r).toEqual(results[0]); }
    expect(results[0].x).toBeGreaterThan(600); // it really did travel onto the second belt
  });
  it('refuses a scan that is not a whole number of plant substeps', () => {
    expect(() => stepScene(freshRuntime(start(), belts, PLANT_EQUIPMENT), belts, PLANT_EQUIPMENT, {}, {}, 15)).toThrow(/substeps/);
    expect(() => stepScene(freshRuntime(start(), belts, PLANT_EQUIPMENT), belts, PLANT_EQUIPMENT, {}, {}, 0)).toThrow(/substeps/);
  });
});
