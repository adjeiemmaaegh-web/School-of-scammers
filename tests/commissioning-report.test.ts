import { describe, expect, it } from 'vitest';
import { commissioningReportHtml, REPORT_MAX_BYTES } from '../src/diagnostics/commissioning-report';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';

const build = () => {
  let w = tick(createWorld(), [{ k: 'addPanel', template: 'motor-starter' }]).world;
  w = tick(w, [{ k: 'injectFault', kind: 'contactor-coil-open', target: w.project.components.find(c => c.kind === 'contactor')!.id, hidden: true }]).world;
  w = tick(w, [{ k: 'run' }]).world;
  for (let i = 0; i < 5; i++) w = tick(w).world;
  return w;
};
describe('R8.4 commissioning report', () => {
  it('lists parts, wiring, I/O and recent events and is deterministic', () => {
    const w = build();
    const input = { title: 'Starter', project: w.project, snapshot: renderSnapshot(w), events: ['Scan 1: PLC powered'], generatedAt: '2026-11-17T00:00:00.000Z' };
    const html = commissioningReportHtml(input);
    expect(html).toContain('<h2>Parts</h2>'); expect(html).toContain('Controller I/O'); expect(html).toContain('PLC powered');
    expect(html).toContain('contactor'); expect(html).toContain('PLC powered');
    expect(commissioningReportHtml(input)).toBe(html);
  });
  it('never names a hidden fault, only that some exist', () => {
    const w = build();
    const html = commissioningReportHtml({ title: 'S', project: w.project, snapshot: renderSnapshot(w), events: [], generatedAt: 'now' });
    expect(html).not.toContain('contactor-coil-open'); expect(html).not.toMatch(/coil open/i);
    expect(html).toMatch(/1 hidden fault\(s\) are not listed/);
    const revealed = tick(w, [{ k: 'revealFault', id: w.project.faults![0].id }]).world;
    expect(commissioningReportHtml({ title: 'S', project: revealed.project, snapshot: renderSnapshot(revealed), events: [], generatedAt: 'now' })).toContain('contactor-coil-open');
  });
  it('escapes every user-controlled string and is locked down by a CSP', () => {
    const w = build();
    const evil = '<img src=x onerror=alert(1)>"\'&';
    const html = commissioningReportHtml({ title: evil, project: w.project, snapshot: renderSnapshot(w), events: [evil], generatedAt: evil });
    expect(html).not.toContain('<img'); expect(html).not.toContain('onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain("default-src 'none'");
  });
  it('is bounded', () => {
    const w = build();
    const events = Array.from({ length: 500 }, (_, i) => 'x'.repeat(2000) + i);
    const html = commissioningReportHtml({ title: 'S', project: w.project, snapshot: renderSnapshot(w), events, generatedAt: 'now' });
    expect(html.length).toBeLessThan(REPORT_MAX_BYTES);
    expect(html.match(/<li>/g)!.length).toBe(24);
  });
});
