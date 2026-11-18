/**
 * Commissioning report (roadmap R8.4): a bounded, local, self-contained HTML record of what the simulated panel looked
 * like at one moment: parts, wiring, controller I/O, program summary, live device states, alarms and recent events.
 * Everything is escaped, nothing is fetched, and hidden faults are never listed. It is a learning artefact built from
 * the worker's own snapshot, not a certified commissioning or safety document.
 */
import type { ProjectFile, RenderSnapshot } from '../sim/signals';

export const REPORT_MAX_BYTES = 400_000;
const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const clip = (value: unknown, n: number): string => { const s = String(value ?? ''); return s.length > n ? s.slice(0, n) + '…' : s; };
const table = (head: string[], rows: string[][]): string =>
  `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

export type ReportInput = { title: string; project: ProjectFile; snapshot: RenderSnapshot; events: readonly string[]; generatedAt: string };

export function commissioningReportHtml(input: ReportInput): string {
  const { project, snapshot } = input;
  const hiddenCount = (project.faults ?? []).filter(f => f.hidden).length;
  const visibleFaults = (project.faults ?? []).filter(f => !f.hidden);
  const parts = project.components.slice(0, 60).map(c => [c.id, c.kind, `${Math.round(c.x)}, ${Math.round(c.y)}`, snapshot.deviceOn[c.id] === undefined ? '—' : snapshot.deviceOn[c.id] ? 'on' : 'off']);
  const wires = project.wires.slice(0, 250).map(w => [w.id, w.from, w.to]);
  const plcRows = Object.entries(snapshot.plcs).flatMap(([id, view]) => [
    ...view.io.inputs.map(p => [id, 'input', p.terminal, p.tag, p.on ? '1' : '0']),
    ...view.io.outputs.map(p => [id, 'output', p.terminal, p.tag, p.on ? '1' : '0']),
  ]).slice(0, 200);
  const program = `${project.language ?? 'ladder'}${project.language === 'st' ? `, ${(project.stSource ?? '').length} characters` : `, ${project.program.rungs.length} rung(s)`}`;
  const alarms = snapshot.alarms.slice(0, 50).map(a => [String(a.id), a.severity, clip(a.message, 200)]);
  const body = [
    `<h1>${esc(clip(input.title, 80))}: commissioning snapshot</h1>`,
    `<p>Generated ${esc(input.generatedAt)} · scan ${esc(snapshot.tick)} · ${snapshot.running ? 'simulation running' : 'paused'} · ${esc(project.components.length)} part(s), ${esc(project.wires.length)} wire(s).</p>`,
    `<p class="note">Educational simulation record built from the simulator's own state. Not a certified commissioning, electrical or safety document.</p>`,
    '<h2>Parts</h2>', table(['Id', 'Kind', 'Position', 'Live state'], parts),
    '<h2>Wiring</h2>', table(['Wire', 'From', 'To'], wires),
    `<h2>Controller I/O (program: ${esc(program)})</h2>`, plcRows.length ? table(['PLC', 'Direction', 'Terminal', 'Tag', 'State'], plcRows) : '<p>No controller placed.</p>',
    '<h2>Alarms</h2>', alarms.length ? table(['Id', 'Severity', 'Message'], alarms) : '<p>None active.</p>',
    '<h2>Faults</h2>',
    visibleFaults.length ? table(['Kind', 'Target'], visibleFaults.map(f => [f.kind, f.target])) : '<p>No revealed faults.</p>',
    hiddenCount ? `<p class="note">${esc(hiddenCount)} hidden fault(s) are not listed: diagnose them with the instruments.</p>` : '',
    '<h2>Recent events</h2>', input.events.length ? `<ul>${input.events.slice(-24).map(e => `<li>${esc(clip(e, 300))}</li>`).join('')}</ul>` : '<p>None.</p>',
  ].join('\n');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${esc(clip(input.title, 80))} commissioning snapshot</title><style>body{font:14px system-ui,sans-serif;margin:24px;max-width:960px}table{border-collapse:collapse;width:100%;margin:6px 0 18px}th,td{border:1px solid #bbb;padding:3px 6px;text-align:left;font-size:12px}.note{color:#555}</style></head><body>\n${body}\n</body></html>`;
  if (html.length > REPORT_MAX_BYTES) throw new RangeError('Report exceeds the size limit');
  return html;
}
