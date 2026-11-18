import { describe, expect, it } from 'vitest';
import coverage from '../docs/product/COVERAGE_R5_R7.md?raw';
import journeys from '../docs/product/JOURNEYS.md?raw';

const tests = Object.keys(import.meta.glob('./*.test.ts')).map(p => p.replace('./', 'tests/'));
const scripts = Object.keys(import.meta.glob('../scripts/*.cjs')).map(p => p.replace('../', ''));
const sources = Object.keys(import.meta.glob('../src/**/*.{ts,tsx}')).map(p => p.replace('../', ''));
const known = new Set([...tests, ...scripts, ...sources, 'tests/coverage-map.test.ts']); // Vite's glob excludes the importing file itself
const referenced = (doc: string) => [...doc.matchAll(/`((?:tests|scripts|src)\/[A-Za-z0-9_./-]+)`/g)].map(m => m[1]);

describe('R5/R7 coverage map and journeys name only files that exist', () => {
  it('coverage map references real tests, scripts and sources', () => {
    const refs = referenced(coverage);
    expect(refs.length).toBeGreaterThan(30);
    for (const r of refs) expect(known.has(r), `COVERAGE_R5_R7.md references missing file ${r}`).toBe(true);
  });
  it('journeys reference real scripts', () => {
    const refs = referenced(journeys);
    expect(refs.length).toBeGreaterThan(18);
    for (const r of refs) expect(known.has(r), `JOURNEYS.md references missing file ${r}`).toBe(true);
  });
});
