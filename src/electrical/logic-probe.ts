/**
 * R5.5 digital logic probe: reads the solver's potential at one terminal, referenced to the 0 V of the 24 V supply that drives
 * that net, and classifies it with the educational thresholds of an IEC 61131-2 type 1 24 V digital input (ON at 15 V or more,
 * OFF at 5 V or less, undefined between). A terminal on no driven net reads FLOATING. It never invents a value: the
 * classification is only of what the worker published. Educational instrument, not a calibrated device.
 */
export type ProbeState = 'select' | 'unsolved' | 'high' | 'low' | 'undefined' | 'floating' | 'short';
export type ProbeReading = { terminal: string | null; state: ProbeState; volts: number | null };
export const PROBE_HIGH_MIN_V = 15;
export const PROBE_LOW_MAX_V = 5;

export function probeTerminal(voltages: Readonly<Record<string, number | null>>, diagnostics: readonly string[], terminal: string | null): ProbeReading {
  if (!terminal) return { terminal, state: 'select', volts: null };
  // No circuit has been solved yet (a freshly loaded, paused project): say so rather than call every terminal floating.
  if (!Object.keys(voltages).length) return { terminal, state: 'unsolved', volts: null };
  if (diagnostics.some(d => d.startsWith('Supply short'))) return { terminal, state: 'short', volts: null };
  const v = voltages[terminal];
  if (v === null || v === undefined || !Number.isFinite(v)) return { terminal, state: 'floating', volts: null };
  return { terminal, state: v >= PROBE_HIGH_MIN_V ? 'high' : v <= PROBE_LOW_MAX_V ? 'low' : 'undefined', volts: v };
}
export const PROBE_TEXT: Readonly<Record<ProbeState, string>> = {
  select: 'Choose a terminal', unsolved: 'NO READING YET (press Run or Step scan to solve the circuit)', high: 'HIGH (ON)', low: 'LOW (OFF)', undefined: 'UNDEFINED (between 5 V and 15 V)',
  floating: 'FLOATING (not on a powered net)', short: 'SUPPLY SHORT: no reading',
};
