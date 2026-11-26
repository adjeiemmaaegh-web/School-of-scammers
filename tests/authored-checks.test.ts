import { describe, expect, it } from 'vitest';
import { parseAuthoredChecks, runAuthoredCheck, runAuthoredChecks, type AuthoredCheck } from '../src/exercises/authored-checks';
import { createWorld, tick } from '../src/sim/orchestrator';
import { DEMOS } from '../src/plant/demos';

const sorting = () => DEMOS.find(d => d.id === 'sorting-factory')!.build();
const starter = () => tick(createWorld(), [{ k: 'addPanel', template: 'motor-starter' }]).world.project;

describe('R10.2 authored checks run the learner project through the real tick()', () => {
  it('a plant counter check passes on the working sorting line and states what it saw', () => {
    const r = runAuthoredCheck(sorting(), { label: 'Cartons reach the good bin', afterMs: 20_000, target: { kind: 'signal', device: 'good-bin', signal: 'count', op: '>=', value: 2 } });
    expect(r.pass).toBe(true);
    expect(r.reason).toMatch(/good-bin\.count was \d+ after 20\.0 s/);
  });
  it('the same check fails when the line is broken (the belt motor wire removed)', () => {
    const p = sorting();
    const beltWire = p.wires.find(w => /main\./.test(w.from) || /main\./.test(w.to))!;
    const broken = { ...p, wires: p.wires.filter(w => w !== beltWire) };
    const r = runAuthoredCheck(broken, { label: 'Cartons reach the good bin', afterMs: 20_000, target: { kind: 'signal', device: 'good-bin', signal: 'count', op: '>=', value: 2 } });
    expect(r.pass).toBe(false);
  });
  it('a pushbutton press is held for the stated time: START runs the motor, and without the press it stays off', () => {
    const p = starter();
    const press: AuthoredCheck = { label: 'START runs the motor', press: 'start-1', pressMs: 200, afterMs: 1000, target: { kind: 'device-on', device: 'motor-1', expect: true } };
    expect(runAuthoredCheck(p, press).pass).toBe(true);
    const { press: _p, pressMs: _m, ...noPress } = press;
    expect(runAuthoredCheck(p, noPress).pass).toBe(false);
    // the latch holds after release; pressing STOP afterwards is a separate check on a fresh world
    expect(runAuthoredCheck(p, { label: 'off without start', afterMs: 500, target: { kind: 'device-on', device: 'motor-1', expect: false } }).pass).toBe(true);
  });
  it('checks are independent: each runs on a fresh copy, and missing devices fail with a clear reason', () => {
    const p = starter();
    const results = runAuthoredChecks(p, [
      { label: 'a', press: 'start-1', pressMs: 200, afterMs: 600, target: { kind: 'device-on', device: 'motor-1', expect: true } },
      { label: 'b', afterMs: 600, target: { kind: 'device-on', device: 'motor-1', expect: false } },
      { label: 'c', afterMs: 100, target: { kind: 'device-on', device: 'ghost', expect: true } },
      { label: 'd', press: 'ghost', afterMs: 100, target: { kind: 'device-on', device: 'motor-1', expect: true } },
    ]);
    expect(results.map(r => r.pass)).toEqual([true, true, false, false]);
    expect(results[2].reason).toMatch(/no device ghost/);
    expect(p.components.find(c => c.id === 'start-1')?.pressed).toBe(false);   // the learner's project is untouched
  });
  it('the package shape is strict data: unknown fields, code-like strings in names, bad ranges and too many checks are refused', () => {
    const good = { label: 'x', afterMs: 1000, target: { kind: 'device-on', device: 'm', expect: true } };
    expect(parseAuthoredChecks(undefined)).toEqual({ ok: true, checks: [] });
    expect(parseAuthoredChecks([good]).ok).toBe(true);
    for (const bad of [
      [{ ...good, script: 'x' }], [{ ...good, afterMs: 10 }], [{ ...good, afterMs: 200_000 }], [{ ...good, pressMs: 100 }],
      [{ ...good, target: { kind: 'signal', device: 'm', signal: 'count()', op: '>=', value: 1 } }],
      [{ ...good, target: { kind: 'signal', device: 'm', signal: 'count', op: '>', value: 1 } }],
      [{ ...good, target: { kind: 'signal', device: 'm', signal: 'count', op: 'on', value: 1 } }],
      [{ ...good, target: { kind: 'device-on', device: '../x', expect: true } }],
      [{ ...good, label: '' }], Array.from({ length: 13 }, () => good), 'nope',
    ]) expect(parseAuthoredChecks(bad).ok).toBe(false);
  });
});

import { buildScenePackage, parseScenePackage } from '../src/platform/scene-package';
import { validateProject } from '../src/sim/project-validation';
import { exportableDetails, normaliseDetails } from '../src/platform/scene-details';
describe('authored checks travel in scene packages and details', () => {
  const check: AuthoredCheck = { label: 'START runs the motor', press: 'start-1', pressMs: 200, afterMs: 1000, target: { kind: 'device-on', device: 'motor-1', expect: true } };
  it('a package built with checks parses back with the same checks, and a package without checks keeps its old shape', () => {
    const text = buildScenePackage({ title: 'Starter', description: 'd', level: 'beginner', objectives: ['o'], hints: [], project: starter(), checks: [check] }, validateProject);
    const parsed = parseScenePackage(text, validateProject);
    expect(parsed.ok && parsed.pkg.checks).toEqual([check]);
    const plain = buildScenePackage({ title: 'Starter', description: 'd', level: 'beginner', objectives: ['o'], hints: [], project: starter() }, validateProject);
    expect(JSON.parse(plain).checks).toBeUndefined();
    const bad = JSON.parse(text); bad.checks[0].target.kind = 'eval';
    expect(parseScenePackage(JSON.stringify(bad), validateProject).ok).toBe(false);
  });
  it('details keep valid checks, drop invalid ones, and export them', () => {
    expect(normaliseDetails({ checks: [check] }).checks).toEqual([check]);
    expect(normaliseDetails({ checks: [{ nope: 1 }] }).checks).toBeUndefined();
    expect(exportableDetails({ description: '', level: 'beginner', objectives: '', hints: '', checks: [check] }, 't').checks).toEqual([check]);
  });
});
