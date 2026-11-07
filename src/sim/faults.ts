/**
 * P5 fault model. Pure and DOM-free.
 *
 * A fault never sets a UI flag or a symptom. It changes what the authoritative circuit solver is
 * given (the wire list, a device's presence, or a contact's state), so every consequence is
 * produced by the same netlist the learner measures with the multimeter:
 *
 *   wire-open            the wire stays in the project (and in the wire list) but conducts nothing
 *   contactor-coil-open  the coil is not part of the circuit: it never pulls in, yet A1-A2 still
 *                        measures the full 24 V
 *   contactor-welded     the NO contacts are stuck closed (and the linked NC contacts stuck open)
 *   motor-open-winding   the winding is not part of the circuit: 24 V at the terminals, no motion
 *   button-stuck         the contact state ignores the operator
 *
 * These are educational abstractions of idealised 24 V parts, not failure physics.
 */
import { COMPONENTS, type ComponentKind } from '../components/registry';
import type { FaultKind, FaultSpec, PlacedComponent, ProjectFile, Wire } from './signals';

export const MAX_FAULTS = 8;
export const FAULT_KINDS: readonly FaultKind[] = [
  'wire-open', 'contactor-coil-open', 'contactor-welded', 'motor-open-winding', 'button-stuck',
];
const COMPONENT_TARGETS: Record<Exclude<FaultKind, 'wire-open'>, readonly ComponentKind[]> = {
  'contactor-coil-open': ['contactor', 'forwardcontactor', 'reversecontactor'],
  'contactor-welded': ['contactor', 'forwardcontactor', 'reversecontactor'],
  'motor-open-winding': ['motor', 'revmotor', 'conveyor', 'pump'],
  // The training E-stop is deliberately not fault-injectable here.
  'button-stuck': ['start', 'stop', 'reversebutton'],
};
export const FAULT_LABEL: Record<FaultKind, string> = {
  'wire-open': 'Open conductor (broken wire)',
  'contactor-coil-open': 'Contactor coil open',
  'contactor-welded': 'Contactor contacts welded',
  'motor-open-winding': 'Motor winding open',
  'button-stuck': 'Pushbutton contact stuck',
};
const ID = /^[A-Za-z0-9_-]{1,45}$/;

export const faultsOf = (project: ProjectFile): readonly FaultSpec[] => project.faults ?? [];
export const hasFault = (project: ProjectFile, kind: FaultKind, target: string): boolean =>
  faultsOf(project).some(f => f.kind === kind && f.target === target);

export function targetIsValid(
  kind: FaultKind, target: string, components: readonly PlacedComponent[], wires: readonly Wire[],
): boolean {
  if (kind === 'wire-open') return wires.some(w => w.id === target);
  const allowed = COMPONENT_TARGETS[kind];
  return components.some(c => c.id === target && allowed.includes(c.kind));
}

export type TargetOption = { id: string; label: string };
const partLabel = (c: PlacedComponent) => `${COMPONENTS[c.kind].label} (${c.id})`;

/** Parts this fault kind can be injected into, for UI pickers. Same rule as validateFaults. */
export function faultTargetOptions(project: ProjectFile, kind: FaultKind): TargetOption[] {
  if (kind === 'wire-open') return project.wires.map(w => ({ id: w.id, label: `${w.id}: ${w.from} → ${w.to}` }));
  return project.components.filter(c => COMPONENT_TARGETS[kind].includes(c.kind))
    .map(c => ({ id: c.id, label: partLabel(c) }));
}

/** Every part a technician could replace or re-terminate: all devices, then all conductors. */
export function repairTargetOptions(project: ProjectFile): TargetOption[] {
  return [
    ...project.components.map(c => ({ id: c.id, label: partLabel(c) })),
    ...project.wires.map(w => ({ id: w.id, label: `Wire ${w.id}: ${w.from} → ${w.to}` })),
  ];
}

/** The contact state the circuit sees: a stuck button ignores what the operator did. */
export function effectivePressed(project: ProjectFile, c: PlacedComponent): boolean {
  const stuck = faultsOf(project).find(f => f.kind === 'button-stuck' && f.target === c.id);
  return stuck ? stuck.stuckPressed === true : c.pressed;
}

/** Wires as the solver sees them: open conductors are present but conduct nothing. */
export function solverWires(project: ProjectFile): ReadonlyArray<readonly [string, string]> {
  const open = new Set(faultsOf(project).filter(f => f.kind === 'wire-open').map(f => f.target));
  return project.wires.filter(w => !open.has(w.id)).map(w => [w.from, w.to] as const);
}

export function describeFault(f: FaultSpec): string {
  switch (f.kind) {
    case 'wire-open': return `Open conductor in wire ${f.target}`;
    case 'contactor-coil-open': return `Open coil in ${f.target}`;
    case 'contactor-welded': return `Welded contacts in ${f.target}`;
    case 'motor-open-winding': return `Open winding in ${f.target}`;
    case 'button-stuck': return `Pushbutton ${f.target} contact stuck as if ${f.stuckPressed ? 'pressed' : 'released'}`;
  }
}

export function validateFaults(
  raw: unknown, components: readonly PlacedComponent[], wires: readonly Wire[],
): FaultSpec[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_FAULTS) throw new Error('Invalid fault list');
  const ids = new Set<string>();
  const parts = new Set<string>();
  return raw.map((item): FaultSpec => {
    if (!item || typeof item !== 'object') throw new Error('Invalid fault');
    const f = item as Record<string, unknown>;
    if (typeof f.id !== 'string' || !ID.test(f.id) || ids.has(f.id)) throw new Error('Invalid or duplicate fault id');
    if (typeof f.kind !== 'string' || !FAULT_KINDS.includes(f.kind as FaultKind)) throw new Error('Unknown fault kind');
    const kind = f.kind as FaultKind;
    if (typeof f.target !== 'string' || !targetIsValid(kind, f.target, components, wires))
      throw new Error(`Fault ${f.id} targets a missing or unsupported part`);
    if (typeof f.hidden !== 'boolean') throw new Error(`Fault ${f.id} needs a boolean hidden flag`);
    if (kind === 'button-stuck') {
      if (typeof f.stuckPressed !== 'boolean') throw new Error(`Fault ${f.id} needs a stuckPressed state`);
    } else if (f.stuckPressed !== undefined) throw new Error(`Fault ${f.id} cannot set stuckPressed`);
    const key = `${kind}:${f.target}`;
    if (parts.has(key)) throw new Error('Duplicate fault on the same part');
    ids.add(f.id);
    parts.add(key);
    return { id: f.id, kind, target: f.target, hidden: f.hidden,
      ...(kind === 'button-stuck' ? { stuckPressed: f.stuckPressed as boolean } : {}) };
  });
}

export function nextFaultId(faults: readonly FaultSpec[]): string {
  let max = 0;
  for (const f of faults) {
    const m = /^fault-(\d+)$/.exec(f.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `fault-${max + 1}`;
}

export type FaultCandidate = Omit<FaultSpec, 'id' | 'hidden'>;

/** Every fault that could be injected into this project, in a fixed, reproducible order. */
export function faultCandidates(project: ProjectFile): FaultCandidate[] {
  const taken = new Set(faultsOf(project).map(f => `${f.kind}:${f.target}`));
  const out: FaultCandidate[] = [];
  const push = (c: FaultCandidate) => { if (!taken.has(`${c.kind}:${c.target}`)) out.push(c); };
  for (const kind of FAULT_KINDS) {
    if (kind === 'wire-open') {
      for (const w of project.wires) push({ kind, target: w.id });
      continue;
    }
    for (const c of project.components) {
      if (!COMPONENT_TARGETS[kind].includes(c.kind)) continue;
      if (kind === 'button-stuck') {
        push({ kind, target: c.id, stuckPressed: true });
        push({ kind, target: c.id, stuckPressed: false });
      } else push({ kind, target: c.id });
    }
  }
  return out;
}

/** mulberry32: a small, well-known seeded PRNG. Same seed, same sequence, on every platform. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same project + same seed always yields the same fault, or null when nothing can be injected. */
export function pickSeededFault(project: ProjectFile, seed: number): FaultCandidate | null {
  const candidates = faultCandidates(project);
  if (!candidates.length) return null;
  return candidates[Math.floor(mulberry32(seed)() * candidates.length)];
}
