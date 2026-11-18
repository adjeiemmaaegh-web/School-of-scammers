/**
 * Factory-acceptance-style checklist (roadmap R8.4). Automatic items are evaluated from the worker's own snapshot and
 * the project (never from the drawing); manual items record what the learner observed and a short note. Pure and
 * bounded. A learning record, not a certified acceptance test.
 */
import { COMPONENTS } from '../components/registry';
import type { ProjectFile, RenderSnapshot } from '../sim/signals';
import { summarizeDiagnostics } from './summary';

export type FatStatus = 'pass' | 'fail' | 'pending';
export type FatItem = { id: string; title: string; kind: 'auto' | 'manual'; status: FatStatus; detail: string };
export type ManualState = Record<string, { done: boolean; note: string }>;
export const MANUAL_ITEMS: readonly { id: string; title: string }[] = [
  { id: 'trial-run', title: 'Trial run observed: the machine did what the specification says' },
  { id: 'expected-vs-observed', title: 'Expected and observed behaviour compared (write the difference or "none")' },
  { id: 'fault-test', title: 'A fault was injected or simulated and the response was observed' },
  { id: 'restart', title: 'Stop, power down and restart checked (nothing starts unexpectedly)' },
];
export const MAX_NOTE = 300;

export function normaliseManual(raw: unknown): ManualState {
  const out: ManualState = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const { id } of MANUAL_ITEMS) {
    const v = (raw as Record<string, unknown>)[id];
    if (v && typeof v === 'object') {
      const { done, note } = v as { done?: unknown; note?: unknown };
      out[id] = { done: done === true, note: typeof note === 'string' ? note.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, MAX_NOTE) : '' };
    }
  }
  return out;
}

export function evaluateFat(project: ProjectFile, snapshot: RenderSnapshot, manual: ManualState): FatItem[] {
  const s = summarizeDiagnostics(project, snapshot);
  const wired = new Set(project.wires.flatMap(w => [w.from.split('.')[0], w.to.split('.')[0]]));
  const needsWire = project.components.filter(c => COMPONENTS[c.kind]?.terminals.length > 0 && !wired.has(c.id)).map(c => c.id);
  const items: FatItem[] = [];
  items.push(project.components.length === 0
    ? { id: 'all-wired', title: 'Every part is connected', kind: 'auto', status: 'pending', detail: 'Place and wire some parts first.' }
    : { id: 'all-wired', title: 'Every part is connected', kind: 'auto', status: needsWire.length ? 'fail' : 'pass', detail: needsWire.length ? `Not wired: ${needsWire.slice(0, 8).join(', ')}${needsWire.length > 8 ? '…' : ''}` : 'Every part with terminals has at least one wire.' });
  items.push({ id: 'no-short', title: 'No supply short', kind: 'auto', status: s.shortCircuit ? 'fail' : s.running ? 'pass' : 'pending', detail: s.shortCircuit ? 'A direct supply short is reported.' : s.running ? 'No short while running.' : 'Run the simulation to check.' });
  items.push(s.rails.length === 0
    ? { id: 'rails-live', title: 'Every supply rail is live while running', kind: 'auto', status: 'pending', detail: 'No supply placed.' }
    : { id: 'rails-live', title: 'Every supply rail is live while running', kind: 'auto', status: !s.running ? 'pending' : s.rails.every(r => r.state === 'live') ? 'pass' : 'fail', detail: s.running ? s.rails.map(r => `${r.supply}: ${r.state}`).join(', ') : 'Run the simulation to check.' });
  items.push(s.controllers.length === 0
    ? { id: 'plc-powered', title: 'Every controller is powered while running', kind: 'auto', status: 'pending', detail: 'No controller placed.' }
    : { id: 'plc-powered', title: 'Every controller is powered while running', kind: 'auto', status: !s.running ? 'pending' : s.controllers.every(c => c.powered) ? 'pass' : 'fail', detail: s.running ? s.controllers.map(c => `${c.id}: ${c.powered ? 'powered' : 'no power'}`).join(', ') : 'Run the simulation to check.' });
  items.push({ id: 'no-alarms', title: 'No active alarms', kind: 'auto', status: !s.running ? 'pending' : s.activeAlarms.length ? 'fail' : 'pass', detail: s.activeAlarms.length ? s.activeAlarms.map(a => a.message).slice(0, 3).join(' · ') : s.running ? 'None active.' : 'Run the simulation to check.' });
  for (const m of MANUAL_ITEMS) {
    const state = manual[m.id];
    const needsNote = m.id === 'expected-vs-observed';
    const done = !!state?.done && (!needsNote || (state.note ?? '').trim().length > 0);
    items.push({ id: m.id, title: m.title, kind: 'manual', status: done ? 'pass' : 'pending', detail: state?.note ?? '' });
  }
  return items;
}
export const fatComplete = (items: readonly FatItem[]): boolean => items.every(i => i.status === 'pass');
