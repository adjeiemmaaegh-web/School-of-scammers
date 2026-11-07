import type { EvidenceEvent } from '../platform/types';
import type { Command } from '../sim/signals';

/** Evidence-trail entry for a learner command, or null for commands that are not learner actions. */
export function evidenceFromCommand(cmd: Command): { action: string; detail: string } | null {
  switch (cmd.k) {
    case 'place': return { action: 'place', detail: `Placed ${cmd.kind} ${cmd.id}` };
    case 'move': return { action: 'move', detail: `Moved ${cmd.id}` };
    case 'wire': return { action: 'wire', detail: `Wired ${cmd.from} to ${cmd.to}` };
    case 'unwire': return { action: 'unwire', detail: `Removed wire ${cmd.id}` };
    case 'loadProgram': return { action: 'program', detail: 'Edited the Ladder program' };
    case 'loadST': return { action: 'program', detail: 'Edited the Structured Text program' };
    case 'activateLanguage': return { action: 'program', detail: `Switched to ${cmd.language}` };
    case 'run': return { action: 'run', detail: 'Started the PLC' };
    case 'pause': return { action: 'pause', detail: 'Paused the simulation' };
    case 'step': return { action: 'step', detail: 'Stepped one scan' };
    case 'reset': return { action: 'reset', detail: 'Reset scan state' };
    case 'operate': return { action: 'operate', detail: `${cmd.pressed ? 'Pressed' : 'Released'} ${cmd.id}` };
    case 'operateToggle': return { action: 'operate', detail: `Operated ${cmd.id}` };
    case 'operateProtection': return { action: 'operate', detail: `${cmd.action} ${cmd.id}` };
    case 'feedParcel': return { action: 'feed', detail: `Fed a ${cmd.kind} parcel` };
    case 'setMeterProbe': return {
      action: 'setMeterProbe',
      detail: `Meter ${cmd.lead === 'positive' ? 'red' : 'black'} probe ${cmd.terminal ? `on ${cmd.terminal}` : 'disconnected'}`,
    };
    default: return null;
  }
}

/** Actions that are folded into the previous entry when repeated back to back. */
const COALESCE = new Set(['move', 'program', 'step']);
const MAX_EVIDENCE = 400;

/** Append an entry, coalescing noisy repeats and bounding the trail. Pure. */
export function appendEvidence(
  log: readonly EvidenceEvent[], at: number, action: string, detail: string, accepted = true,
): EvidenceEvent[] {
  const last = log[log.length - 1];
  if (last && COALESCE.has(action) && last.action === action && last.accepted === accepted && at - last.at < 4000) {
    return [...log.slice(0, -1), { ...last, at, detail }];
  }
  const next = [...log, { index: (last?.index ?? 0) + 1, at, action, detail, accepted }];
  return next.length > MAX_EVIDENCE ? next.slice(next.length - MAX_EVIDENCE) : next;
}

/** True once the learner has put both meter probes on terminals (before `beforeIndex`, if given). */
export function usedMultimeter(log: readonly EvidenceEvent[], beforeIndex = Infinity): boolean {
  const probes = log.filter(e => e.action === 'setMeterProbe' && e.index < beforeIndex && / on \S/.test(e.detail));
  return probes.some(e => e.detail.startsWith('Meter red')) && probes.some(e => e.detail.startsWith('Meter black'));
}
