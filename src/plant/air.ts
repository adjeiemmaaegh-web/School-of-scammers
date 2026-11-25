/**
 * R06 compressed-air supply model. Pure and DOM-free.
 *
 * A COMPRESSOR owns a receiver tank: while its motor coil is energised it pumps (with cut-in / cut-out hysteresis) at a fixed
 * fill rate; every moving cylinder draws from the tank, and an air-leak fault bleeds it. A REGULATOR passes pressure one way
 * (inlet to outlet) and never above its set point. AIR LINES are ordinary wires between air ports; a cylinder's working
 * pressure is whatever reaches its AIR port through them, so an unplumbed or mis-plumbed cylinder genuinely gets no air.
 * Pneumatic mode is on only when the project contains a compressor: projects without one keep the original "air is
 * available" behaviour, so nothing saved earlier changes.
 * Educational model: lumped parameters (bar per second), not a flow, volume or force design tool.
 */
import type { PlacedComponent, Wire } from '../sim/signals';

export const AIR_PINS: Readonly<Record<string, readonly string[]>> = {
  compressor: ['AIR'], 'air-regulator': ['AIR_IN', 'AIR_OUT'], cylinder: ['AIR'], 'pressure-sensor': ['AIR'],
};
/** How fast a moving cylinder drains its supply, and how fast a leak bleeds the receiver (bar per second). */
export const AIR_DRAW_BAR_PER_S = 0.25;
export const AIR_LEAK_BAR_PER_S = 0.4;

export const isAirPin = (kind: string, pin: string): boolean => AIR_PINS[kind]?.includes(pin) === true;
const split = (terminalId: string): [string, string] => {
  const dot = terminalId.indexOf('.');
  return dot < 0 ? [terminalId, ''] : [terminalId.slice(0, dot), terminalId.slice(dot + 1)];
};
/** An air line may only join two air ports; mixing it with an electrical terminal is refused (null when the wire is fine). */
export function airWireError(from: string, to: string, components: readonly PlacedComponent[]): string | null {
  const kindOf = (id: string) => components.find(c => c.id === split(id)[0])?.kind ?? '';
  const a = isAirPin(kindOf(from), split(from)[1]), b = isAirPin(kindOf(to), split(to)[1]);
  return a === b ? null : 'An air line joins air ports only: it cannot be connected to an electrical terminal';
}

export type Receiver = { pressureBar: number; pumping: boolean };
export const freshReceiver = (): Receiver => ({ pressureBar: 0, pumping: false });
export type CompressorSettings = { cutInBar: number; cutOutBar: number; fillBarPerS: number };

/** One scan of a receiver tank. `drawBarPerS` is the total drain from the cylinders it feeds. */
export function stepReceiver(prior: Receiver, motorOn: boolean, motorFault: boolean, leaking: boolean, drawBarPerS: number,
  settings: CompressorSettings, dtMs: number): Receiver {
  let pumping = prior.pumping;
  if (!motorOn || motorFault) pumping = false;
  else if (prior.pressureBar <= settings.cutInBar) pumping = true;
  else if (prior.pressureBar >= settings.cutOutBar) pumping = false;
  const rate = (pumping ? settings.fillBarPerS : 0) - drawBarPerS - (leaking ? AIR_LEAK_BAR_PER_S : 0);
  const pressureBar = Math.round(Math.max(0, Math.min(settings.cutOutBar + 0.3, prior.pressureBar + rate * dtMs / 1000)) * 1e6) / 1e6;
  return { pressureBar, pumping };
}

export type AirSolution = {
  /** Working pressure (bar) at an air terminal id; 0 for an unconnected or unsupplied port. */
  pressureAt: (terminalId: string) => number;
  /** The compressors whose receivers supply the net a terminal sits on (through any regulators). */
  suppliersOf: (terminalId: string) => readonly string[];
};

/**
 * Propagate pressure from the receivers through the air lines and regulators. `setpoints` maps a regulator id to its outlet
 * limit in bar. Deterministic: nets are found by union-find and regulators are relaxed to a fixed point.
 */
export function solveAir(components: readonly PlacedComponent[], wires: readonly Wire[],
  receivers: Readonly<Record<string, Receiver>>, setpoints: Readonly<Record<string, number>>): AirSolution {
  const parent = new Map<string, string>();
  const find = (x: string): string => { let r = x; while ((parent.get(r) ?? r) !== r) r = parent.get(r)!; parent.set(x, r); return r; };
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const portsOf = (c: PlacedComponent) => (AIR_PINS[c.kind] ?? []).map(pin => `${c.id}.${pin}`);
  for (const c of components) for (const p of portsOf(c)) parent.set(p, p);
  const kindById = new Map(components.map(c => [c.id, c.kind]));
  for (const w of wires) {
    const [fa, fp] = split(w.from), [ta, tp] = split(w.to);
    if (isAirPin(kindById.get(fa) ?? '', fp) && isAirPin(kindById.get(ta) ?? '', tp)) union(w.from, w.to);
  }
  const pressure = new Map<string, number>(), suppliers = new Map<string, Set<string>>();
  const raise = (net: string, bar: number, from: Iterable<string>) => {
    if (bar <= (pressure.get(net) ?? 0)) { if (bar > 0 && bar === pressure.get(net)) for (const s of from) (suppliers.get(net) ?? suppliers.set(net, new Set()).get(net)!).add(s); return; }
    pressure.set(net, bar); suppliers.set(net, new Set(from));
  };
  for (const c of components) if (c.kind === 'compressor') {
    const bar = receivers[c.id]?.pressureBar ?? 0;
    if (bar > 0) raise(find(`${c.id}.AIR`), bar, [c.id]);
  }
  const regulators = components.filter(c => c.kind === 'air-regulator');
  for (let pass = 0; pass <= regulators.length; pass++) {
    for (const r of regulators) {
      const inNet = find(`${r.id}.AIR_IN`), outNet = find(`${r.id}.AIR_OUT`);
      const inBar = pressure.get(inNet) ?? 0;
      if (inBar > 0) raise(outNet, Math.min(setpoints[r.id] ?? 4, inBar), suppliers.get(inNet) ?? []);
    }
  }
  return {
    pressureAt: id => (parent.has(id) ? pressure.get(find(id)) ?? 0 : 0),
    suppliersOf: id => (parent.has(id) ? [...(suppliers.get(find(id)) ?? [])].sort() : []),
  };
}
