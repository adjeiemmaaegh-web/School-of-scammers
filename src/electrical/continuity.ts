/**
 * Continuity mode of the virtual meter (roadmap R5.5). Like a real meter it only means something with the circuit
 * de-energised: it asks "is there a conductive path between these two terminals?" through wires and CLOSED switches
 * (ideal conductors), and separately "only through a load" (a coil or lamp: resistive, not a clean conductor).
 * Supplies are treated as open. Read from the same netlist the solver uses, never from drawn state.
 */
import type { Device } from '../engineering/electrical';
import type { MeterReading } from './panel-meter';

export type ContinuityPath = 'conductor' | 'through-load' | 'open';

export function continuityPath(devices: readonly Device[], wires: readonly (readonly [string, string])[], a: string, b: string): ContinuityPath {
  const conductors = new Map<string, string[]>(), withLoads = new Map<string, string[]>();
  const link = (m: Map<string, string[]>, x: string, y: string) => { (m.get(x) ?? m.set(x, []).get(x)!).push(y); (m.get(y) ?? m.set(y, []).get(y)!).push(x); };
  for (const [x, y] of wires) { link(conductors, x, y); link(withLoads, x, y); }
  for (const d of devices) {
    if (d.kind === 'switch' && d.closed) { link(conductors, d.a, d.b); link(withLoads, d.a, d.b); }
    else if (d.kind === 'load') link(withLoads, d.positive, d.negative);
  }
  const reach = (graph: Map<string, string[]>): boolean => {
    const seen = new Set([a]); const queue = [a];
    while (queue.length) { const at = queue.pop()!; if (at === b) return true; for (const next of graph.get(at) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); } }
    return a === b;
  };
  return reach(conductors) ? 'conductor' : reach(withLoads) ? 'through-load' : 'open';
}

/** Continuity reading. Refused while the simulation runs: a continuity test on a live circuit is the classic way to damage a meter or yourself. */
export function measureContinuity(
  devices: readonly Device[], wires: readonly (readonly [string, string])[],
  positive: string | null, negative: string | null, energised: boolean,
): MeterReading {
  if (!positive || !negative) return { positive, negative, volts: null, status: 'select', mode: 'continuity' };
  if (energised) return { positive, negative, volts: null, status: 'energised', mode: 'continuity' };
  return { positive, negative, volts: null, status: continuityPath(devices, wires, positive, negative), mode: 'continuity' };
}
