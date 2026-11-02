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
  const diagnostics: string[] = [];
  const graph = new Map<string, Set<string>>();
  const edge = (a: string, b: string) => { if (!graph.has(a)) graph.set(a, new Set()); if (!graph.has(b)) graph.set(b, new Set()); graph.get(a)!.add(b); graph.get(b)!.add(a); };
  for (const [a,b] of circuit.wires) edge(a,b);
  for (const d of circuit.devices) if (d.kind === 'switch' && d.closed) edge(d.a,d.b);
  const reach = (start: string): Set<string> => { const seen = new Set([start]); const todo = [start]; while(todo.length) for(const next of graph.get(todo.pop()!) ?? []) if(!seen.has(next)){seen.add(next);todo.push(next);} return seen; };
  const supplies = circuit.devices.filter((d): d is Extract<Device,{kind:'supply'}> => d.kind === 'supply');
  if (supplies.length !== 1) diagnostics.push('Exactly one 24V supply is required');
  const voltage: Record<string, number | null> = {};
  const energizedLoads: string[] = [];
  if (supplies.length !== 1) return { voltage, energizedLoads, diagnostics };
  const supply = supplies[0];
  const high = reach(supply.positive), low = reach(supply.negative);
  if ([...high].some(t => low.has(t))) diagnostics.push('Supply short circuit: power must be isolated');
  const terminals = new Set([...high,...low,...circuit.devices.flatMap(d => d.kind === 'supply' ? [d.positive,d.negative] : d.kind === 'load' ? [d.positive,d.negative] : [d.a,d.b])]);
  for (const t of terminals) voltage[t] = high.has(t) && low.has(t) ? null : high.has(t) ? 24 : low.has(t) ? 0 : null;
  if (!diagnostics.some(x=>x.startsWith('Supply short'))) for (const d of circuit.devices) {
    if (d.kind === 'load' && high.has(d.positive) && low.has(d.negative)) energizedLoads.push(d.id);
  }
  return { voltage, energizedLoads, diagnostics };
}
