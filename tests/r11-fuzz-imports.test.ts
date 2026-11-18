/**
 * R11.1 hostile-input fuzz: every untrusted entry point must answer a mutated or random input with an Error, a
 * validation failure or a valid result, never with a crash, a non-Error throw, a hang or a polluted prototype.
 * Seeded and bounded so it is reproducible in CI (not a substitute for an independent security review).
 */
import { describe, expect, it } from 'vitest';
import { createLibrary, createMemoryStore } from '../src/platform/project-library';
import { parseScenePackage } from '../src/platform/scene-package';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';
import { decodeAssignment, decodeResult } from '../src/platform/persistence';
import { normaliseManual } from '../src/diagnostics/fat-checklist';

const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const JUNK: unknown[] = [null, undefined, 0, -1, 1e308, NaN, Infinity, '', 'x'.repeat(5000), '__proto__', '<script>', [], {}, [[]], { __proto__: { polluted: 1 } }, true, false, 2 ** 53];

/** Randomly replaces, deletes or duplicates values anywhere inside a JSON-like value. */
function mutate(value: unknown, r: () => number, depth = 0, rate = 1): unknown {
  const roll = r();
  if (roll < 0.12) return JUNK[Math.floor(r() * JUNK.length)];
  if (Array.isArray(value)) {
    const copy = value.map(v => mutate(v, r, depth + 1));
    if (roll > 0.9 && copy.length) copy.splice(Math.floor(r() * copy.length), 1);
    if (roll > 0.8 && roll <= 0.9 && copy.length) copy.push(copy[0]);
    return copy;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (r() < 0.06) continue;
      out[r() < 0.03 ? '__proto__x' : k] = depth < 8 ? mutate(v, r, depth + 1) : v;
    }
    if (r() < 0.05) out['constructor'] = JUNK[Math.floor(r() * JUNK.length)];
    return out;
  }
  if (typeof value === 'string' && roll > 0.9) return value + '\u0000' + 'y'.repeat(200);
  if (typeof value === 'number' && roll > 0.9) return value * -1e9;
  return value;
}

/** A mild edit that often stays valid: moves parts (sometimes off the floor), drops wires, tweaks a field. */
function gentle(seed: { components: { x: number; y: number }[]; wires: unknown[] }, r: () => number): unknown {
  const copy = JSON.parse(JSON.stringify(seed)) as typeof seed & Record<string, unknown>;
  for (const c of copy.components) if (r() < 0.4) { c.x = Math.floor(r() * 1400) - 100; c.y = Math.floor(r() * 800) - 100; }
  copy.wires = copy.wires.filter(() => r() > 0.15);
  return copy;
}
const base = () => tick(createWorld(), [{ k: 'addPanel', template: 'motor-starter' }]).world.project;
const isError = (e: unknown) => e instanceof Error;

describe('R11.1 fuzz: untrusted imports fail closed', () => {
  it('validateProject: mutated saved projects either validate or throw an Error (never anything else)', () => {
    const r = rng(1); const seed = JSON.parse(JSON.stringify(base()));
    let rejected = 0, accepted = 0;
    for (let i = 0; i < 3000; i++) {
      const m = mutate(seed, r);
      try { validateProject(m); accepted++; } catch (e) { expect(isError(e), `non-Error thrown: ${String(e)}`).toBe(true); rejected++; }
    }
    expect(rejected).toBeGreaterThan(1000); // the mutator really produces hostile input
    expect(accepted + rejected).toBe(3000);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('a project that validates also loads into the worker without throwing or a non-finite snapshot', () => {
    const r = rng(2); const seed = JSON.parse(JSON.stringify(base()));
    let loaded = 0;
    for (let i = 0; i < 400; i++) {
      let valid: unknown; try { valid = validateProject(gentle(seed, r)); } catch { continue; }
      let w = tick(createWorld(), [{ k: 'loadProject', project: valid }]).world;
      w = tick(tick(w, [{ k: 'run' }]).world).world;
      expect(/NaN|Infinity/.test(JSON.stringify(w.voltages))).toBe(false);
      loaded++;
    }
    expect(loaded).toBeGreaterThan(20);
  });
  it('scene package parser never throws on mutated packages', () => {
    const r = rng(3);
    const pkg = JSON.parse(JSON.stringify({ kind: 'efo-scene-package', formatVersion: 1, title: 'T', description: 'd', level: 'beginner', objectives: ['o'], hints: ['h'], project: base() }));
    let ok = 0;
    for (let i = 0; i < 3000; i++) {
      const res = parseScenePackage(JSON.stringify(mutate(pkg, r)), validateProject);
      if (res.ok) ok++;
    }
    expect(ok).toBeLessThan(3000);
    for (const junk of ['{', '[', 'null', '"\\u0000"', '{"kind":"efo-scene-package","formatVersion":1}', 'x'.repeat(2_000_000)]) expect(parseScenePackage(junk, validateProject).ok).toBe(false);
  });
  it('library import/bundle/legacy-migration never throw on mutated or random text', async () => {
    const r = rng(4);
    const lib = createLibrary({ store: createMemoryStore(), validate: validateProject, now: () => '2026-01-01T00:00:00.000Z', newId: (() => { let n = 0; return () => `id${++n}`; })() });
    const project = JSON.parse(JSON.stringify(base()));
    const bundle = { kind: 'efo-project-bundle', formatVersion: 1, exportedAt: 'x', projects: [{ title: 'a', archived: false, project }, { title: 'b', project }] };
    const single = { kind: 'efo-project', formatVersion: 1, title: 't', project };
    for (let i = 0; i < 400; i++) {
      for (const doc of [bundle, single, project]) {
        const text = JSON.stringify(mutate(doc, r));
        await expect(lib.importProject(text)).resolves.toBeTypeOf('object');
        await expect(lib.importBundle(text)).resolves.toBeTypeOf('object');
        await expect(lib.migrateLegacy(text)).resolves.toBeTypeOf('object');
      }
    }
    for (const junk of ['\u0000', '{"__proto__":{"polluted":1}}', '9'.repeat(100000), '[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[']) {
      await expect(lib.importProject(junk)).resolves.toBeTypeOf('object');
      await expect(lib.importBundle(junk)).resolves.toBeTypeOf('object');
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  }, 60000);
  it('assessment codes and saved checklist state reject garbage with an Error and never crash', () => {
    const r = rng(5);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=+/%';
    for (let i = 0; i < 1500; i++) {
      const code = Array.from({ length: Math.floor(r() * 80) }, () => alphabet[Math.floor(r() * alphabet.length)]).join('');
      for (const fn of [decodeAssignment, decodeResult]) { try { fn(code); } catch (e) { expect(isError(e)).toBe(true); } }
      expect(() => normaliseManual(mutate({ 'trial-run': { done: true, note: 'x' } }, r))).not.toThrow();
    }
  });
});
