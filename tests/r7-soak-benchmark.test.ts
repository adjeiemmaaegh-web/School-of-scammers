/**
 * R7.5 / R11.8 bounded soak and benchmark. A maximal supported project (4 starter panels, two 16/16 PLCs running
 * Structured Text with timers and counters, ~58 parts and ~108 wires) runs 10 simulated minutes (12,000 scans) with
 * scripted operator actions and a fault, twice, and must replay byte-identically with no non-finite number anywhere.
 * Scan cost is measured and reported; the asserted ceilings are deliberately generous (CI machines vary) and are NOT
 * a claim about low-spec hardware, which needs the physical test in the release gates.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick, MAX_COMPONENTS, MAX_WIRES } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const nodeProcess = (globalThis as unknown as { process?: { stderr?: { write: (s: string) => void } } }).process;
const fnv = (text: string): string => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x: number, y: number): Command => ({ k: 'place', id, kind, at: { x, y } });

const ST = ['VAR_INPUT', '  Go : BOOL;', '  Part : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Blink : BOOL;', '  Done : BOOL;', 'END_VAR', 'VAR', '  tm : TON;', '  cnt : CTU;', '  edge : R_TRIG;', 'END_VAR',
  'tm(IN := Go AND NOT tm.Q, PT := T#1s);', 'Blink := Go AND NOT tm.Q;', 'edge(CLK := Part);', 'cnt(CU := edge.Q, R := NOT Go, PV := 5);', 'Done := cnt.Q;'].join('\n');

/** Builds a project close to the supported maximum. */
const maximal = (): WorldState => {
  let w = tick(createWorld(), Array.from({ length: 4 }, () => ({ k: 'addPanel', template: 'motor-starter' }) as Command)).world;
  for (const [n, y] of [['pa', 20], ['pb', 300]] as const) {
    const cmds: Command[] = [
      place(`s${n}`, 'supply', 640, y), place(n, 'plc16', 760, y), place(`go${n}`, 'start', 640, y + 60), place(`pt${n}`, 'start', 640, y + 120),
      place(`bl${n}`, 'lamp', 900, y), place(`dn${n}`, 'lamp', 900, y + 60),
      { k: 'wire', id: `${n}w1`, from: `s${n}.P24`, to: `${n}.L+` }, { k: 'wire', id: `${n}w2`, from: `s${n}.M0`, to: `${n}.M` },
      { k: 'wire', id: `${n}w3`, from: `s${n}.P24`, to: `go${n}.A` }, { k: 'wire', id: `${n}w4`, from: `go${n}.B`, to: `${n}.I0.0` },
      { k: 'wire', id: `${n}w5`, from: `s${n}.P24`, to: `pt${n}.A` }, { k: 'wire', id: `${n}w6`, from: `pt${n}.B`, to: `${n}.I0.1` },
      { k: 'wire', id: `${n}w7`, from: `${n}.Q0.0`, to: `bl${n}.L+` }, { k: 'wire', id: `${n}w8`, from: `bl${n}.M-`, to: `s${n}.M0` },
      { k: 'wire', id: `${n}w9`, from: `${n}.Q0.1`, to: `dn${n}.L+` }, { k: 'wire', id: `${n}w10`, from: `dn${n}.M-`, to: `s${n}.M0` },
      { k: 'configureIo', plc: n, io: { inputs: { 'I0.0': 'Go', 'I0.1': 'Part' }, outputs: { 'Q0.0': 'Blink', 'Q0.1': 'Done' } } },
      { k: 'loadST', source: ST, plc: n }];
    w = tick(w, cmds).world;
    expect(w.lastError, `build ${n}`).toBeNull();
  }
  // Fill towards the limits with lamps hung on the first panel's supply.
  const supply = w.project.components.find(c => c.kind === 'supply')!.id;
  const fill: Command[] = [];
  let n = 0;
  while (w.project.components.length + fill.filter(c => c.k === 'place').length < 58) {
    const id = `fl${n++}`;
    fill.push(place(id, 'lamp', 20 + (n % 12) * 80, 420 + Math.floor(n / 12) * 60),
      { k: 'wire', id: `${id}a`, from: `${supply}.P24`, to: `${id}.L+` }, { k: 'wire', id: `${id}b`, from: `${id}.M-`, to: `${supply}.M0` });
  }
  w = tick(w, fill).world;
  expect(w.lastError).toBeNull();
  return w;
};

const script = (w: WorldState): { w: WorldState; digests: string[]; nonFinite: number; ms: number[] } => {
  const ms: number[] = []; const digests: string[] = []; let nonFinite = 0;
  const starts = w.project.components.filter(c => c.kind === 'start').map(c => c.id);
  w = tick(w, [{ k: 'run' }]).world;
  for (let i = 1; i <= 12000; i++) {
    const cmds: Command[] = [];
    if (i % 400 === 0) cmds.push({ k: 'operateToggle', id: starts[(i / 400) % starts.length] });
    if (i === 6000) cmds.push({ k: 'injectFault', kind: 'contactor-coil-open', target: w.project.components.find(c => c.kind === 'contactor')!.id, hidden: true });
    const t0 = performance.now();
    w = tick(w, cmds).world;
    ms.push(performance.now() - t0);
    if (i % 1000 === 0) {
      const text = JSON.stringify(renderSnapshot(w));
      if (/NaN|Infinity/.test(text)) nonFinite++;
      digests.push(fnv(text));
    }
  }
  return { w, digests, nonFinite, ms };
};

describe('R7.5 / R11.8 maximal-project soak', () => {
  it('stays near the supported limits, replays byte-identically over 10 simulated minutes and never produces a non-finite number', () => {
    const start = maximal();
    expect(start.project.components.length).toBeGreaterThanOrEqual(58);
    expect(start.project.components.length).toBeLessThanOrEqual(MAX_COMPONENTS);
    expect(start.project.wires.length).toBeGreaterThan(100); // the 250-wire cap is not reached by this fixture
    expect(start.project.wires.length).toBeLessThanOrEqual(MAX_WIRES);
    expect(Object.keys(renderSnapshot(start).plcs).length).toBeGreaterThanOrEqual(6);
    const a = script(start), b = script(maximal());
    expect(b.digests).toEqual(a.digests);
    expect(a.nonFinite).toBe(0);
    expect(a.w.lastError).toBeNull();
    const sorted = [...a.ms].sort((x, y) => x - y);
    const p50 = sorted[Math.floor(sorted.length * 0.5)], p95 = sorted[Math.floor(sorted.length * 0.95)], p99 = sorted[Math.floor(sorted.length * 0.99)];
    nodeProcess?.stderr?.write(`SOAK comps=${start.project.components.length} wires=${start.project.wires.length} scans=12000 p50=${p50.toFixed(3)}ms p95=${p95.toFixed(3)}ms p99=${p99.toFixed(3)}ms max=${sorted[sorted.length - 1].toFixed(2)}ms\n`);
    // half of the 50 ms scan budget on a CI machine; the coverage job (PLC_COVERAGE_RUN) instruments every line, so it gets more room
    const coverageRun = !!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PLC_COVERAGE_RUN;
    expect(p95).toBeLessThan(coverageRun ? 125 : 25);
  }, 180000);
});
