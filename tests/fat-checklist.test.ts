import { describe, expect, it } from 'vitest';
import { evaluateFat, fatComplete, normaliseManual, MAX_NOTE } from '../src/diagnostics/fat-checklist';
import { commissioningReportHtml } from '../src/diagnostics/commissioning-report';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { WorldState } from '../src/sim/signals';

const scan = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const starter = () => tick(createWorld(), [{ k: 'addPanel', template: 'motor-starter' }]).world;
const status = (w: WorldState, manual = {}) => Object.fromEntries(evaluateFat(w.project, renderSnapshot(w), normaliseManual(manual)).map(i => [i.id, i.status]));
const allManual = { 'trial-run': { done: true, note: '' }, 'expected-vs-observed': { done: true, note: 'none' }, 'fault-test': { done: true, note: '' }, restart: { done: true, note: '' } };

describe('R8.4 acceptance checklist', () => {
  it('is pending on an empty project', () => {
    const s = status(createWorld());
    expect(s['all-wired']).toBe('pending'); expect(s['rails-live']).toBe('pending');
  });
  it('automatic items follow the worker: a wired starter that runs passes them', () => {
    const w = scan(tick(starter(), [{ k: 'run' }]).world, 4);
    const s = status(w);
    expect(s).toMatchObject({ 'all-wired': 'pass', 'no-short': 'pass', 'rails-live': 'pass', 'plc-powered': 'pass', 'no-alarms': 'pass' });
  });
  it('flags unwired parts and a supply short, and never passes the run-time items while paused', () => {
    const w = tick(starter(), [{ k: 'place', id: 'spare', kind: 'lamp', at: { x: 700, y: 400 } }]).world;
    const s = status(w);
    expect(s['all-wired']).toBe('fail'); expect(s['no-short']).toBe('pending');
    const detail = evaluateFat(w.project, renderSnapshot(w), {}).find(i => i.id === 'all-wired')!.detail;
    expect(detail).toContain('spare');
    const shorted = tick(createWorld(), [{ k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } }, { k: 'wire', id: 'w', from: 'ps.P24', to: 'ps.M0' }]).world;
    expect(status(scan(tick(shorted, [{ k: 'run' }]).world, 2))['no-short']).toBe('fail');
  });
  it('manual items need their checkbox, and the comparison needs a note', () => {
    const w = scan(tick(starter(), [{ k: 'run' }]).world, 4);
    expect(status(w, { 'expected-vs-observed': { done: true, note: '  ' } })['expected-vs-observed']).toBe('pending');
    expect(status(w, { 'expected-vs-observed': { done: true, note: 'lamp 1 s late' } })['expected-vs-observed']).toBe('pass');
    const items = evaluateFat(w.project, renderSnapshot(w), normaliseManual(allManual));
    expect(fatComplete(items)).toBe(true);
    expect(fatComplete(evaluateFat(w.project, renderSnapshot(w), {}))).toBe(false);
  });
  it('normalises hostile saved state: unknown keys dropped, notes bounded and cleaned', () => {
    const n = normaliseManual({ 'trial-run': { done: 'yes', note: 'a\u0000b'.repeat(400) }, evil: { done: true, note: 'x' }, __proto__: { polluted: true } });
    expect(n['trial-run'].done).toBe(false); expect(n['trial-run'].note.length).toBe(MAX_NOTE); expect(n['trial-run'].note).not.toContain('\u0000');
    expect(Object.keys(n)).toEqual(['trial-run']); expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    for (const junk of [null, 7, 'x', [], undefined]) expect(normaliseManual(junk)).toEqual({});
  });
  it('appears in the commissioning report, escaped', () => {
    const w = scan(tick(starter(), [{ k: 'run' }]).world, 4);
    const checklist = evaluateFat(w.project, renderSnapshot(w), normaliseManual({ 'fault-test': { done: true, note: '<b>x</b>' } }));
    const html = commissioningReportHtml({ title: 't', project: w.project, snapshot: renderSnapshot(w), events: [], generatedAt: 'now', checklist });
    expect(html).toContain('<h2>Acceptance checklist</h2>'); expect(html).not.toContain('<b>x</b>'); expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
