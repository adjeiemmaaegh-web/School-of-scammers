/** Deliberately bounded 24 V DC discrete circuit model, not a general SPICE solver. */
export type TerminalId = string;
export type Device =
  | { id: string; kind: 'supply'; positive: TerminalId; negative: TerminalId; volts: 24 }
  | { id: string; kind: 'switch'; a: TerminalId; b: TerminalId; closed: boolean }
  | { id: string; kind: 'load'; positive: TerminalId; negative: TerminalId; nominalVolts: number };
export type Circuit = { devices: readonly Device[]; wires: readonly (readonly [TerminalId, TerminalId])[] };
export type CircuitResult = { voltage: Record<TerminalId, number | null>; energizedLoads: string[]; diagnostics: string[] };
/** Graph reachability approximates an ideal switched 24V loop; shorts are flagged, not simulated thermally. */
export function solveDiscrete24V(circuit: Circuit): CircuitResult {
  return solve(circuit).result;
}
/** Per-supply connectivity, for readings that must be taken relative to a specific reference. */
export type NetAwareResult = CircuitResult & {
  /** True when `terminal` is at +24 V relative to `reference` through ONE supply's nets. */
  reads24: (terminal: TerminalId, reference: TerminalId) => boolean;
  /** True when both terminals lie on nets of the same supply (a differential reading is meaningful). */
  sameSupply: (a: TerminalId, b: TerminalId) => boolean;
};
export function solveNetAware(circuit: Circuit): NetAwareResult {
  const { result, nets } = solve(circuit);
  return {
    ...result,
    reads24: (t, ref) => nets.some(n => n.high.has(t) && n.low.has(ref) && !n.low.has(t)),
    sameSupply: (a, b) => nets.some(n => (n.high.has(a) || n.low.has(a)) && (n.high.has(b) || n.low.has(b))),
  };
}
type Nets = { high: Set<string>; low: Set<string> }[];
function solve(circuit: Circuit): { result: CircuitResult; nets: Nets } {
  const diagnostics: string[] = [];
  const graph = new Map<string, Set<string>>();
  const edge = (a: string, b: string) => { if (!graph.has(a)) graph.set(a, new Set()); if (!graph.has(b)) graph.set(b, new Set()); graph.get(a)!.add(b); graph.get(b)!.add(a); };
  for (const [a,b] of circuit.wires) edge(a,b);
  for (const d of circuit.devices) if (d.kind === 'switch' && d.closed) edge(d.a,d.b);
  const reach = (start: string): Set<string> => { const seen = new Set([start]); const todo = [start]; while(todo.length) for(const next of graph.get(todo.pop()!) ?? []) if(!seen.has(next)){seen.add(next);todo.push(next);} return seen; };
  const supplies = circuit.devices.filter((d): d is Extract<Device,{kind:'supply'}> => d.kind === 'supply');
  const voltage: Record<string, number | null> = {};
  const energizedLoads: string[] = [];
  if (supplies.length === 0) {
    diagnostics.push('A 24V supply is required');
    return { result: { voltage, energizedLoads, diagnostics }, nets: [] };
  }
  // Each supply is an ideal source with its own positive and negative nets. Several supplies (separate
  // panels) are independent unless the user wires them together; a single supply behaves exactly as it
  // always did. Supplies tied in opposition (one's positive net reaching another's negative net) are
  // flagged as a short, because series or opposed sources are outside this bounded model.
  const nets = supplies.map(s => ({ s, high: reach(s.positive), low: reach(s.negative) }));
  const highAll = new Set<string>(), lowAll = new Set<string>();
  for (const n of nets) { for (const t of n.high) highAll.add(t); for (const t of n.low) lowAll.add(t); }
  const shorted = nets.some(n => [...n.high].some(t => n.low.has(t)));
  const opposed = !shorted && nets.some(a => nets.some(b => a !== b && [...a.high].some(t => b.low.has(t))));
  if (shorted) diagnostics.push('Supply short circuit: power must be isolated');
  else if (opposed) diagnostics.push('Supply short circuit: two supplies are connected in opposition');
  const terminals = new Set([...highAll,...lowAll,...circuit.devices.flatMap(d => d.kind === 'supply' ? [d.positive,d.negative] : d.kind === 'load' ? [d.positive,d.negative] : [d.a,d.b])]);
  for (const t of terminals) voltage[t] = highAll.has(t) && lowAll.has(t) ? null : highAll.has(t) ? 24 : lowAll.has(t) ? 0 : null;
  if (!diagnostics.some(x=>x.startsWith('Supply short'))) for (const d of circuit.devices) {
    if (d.kind === 'load' && nets.some(n => n.high.has(d.positive) && n.low.has(d.negative))) energizedLoads.push(d.id);
  }
  return { result: { voltage, energizedLoads, diagnostics }, nets };
}
