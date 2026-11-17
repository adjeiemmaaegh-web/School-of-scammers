/** Pure educational DC voltage probe. All readings come from the Worker-owned
 * 24V reachability solver; this is not a calibrated multimeter or safe test tool.
 */
export type MeterReading = {
  positive: string | null;
  negative: string | null;
  volts: number | null;
  status: 'select' | 'measured' | 'floating' | 'short' | 'conductor' | 'through-load' | 'open' | 'energised';
  /** Present only in continuity mode (R5.5); absent means the default DC voltage mode. */
  mode?: 'continuity';
};
export const emptyMeter = (): MeterReading => ({
  positive: null, negative: null, volts: null, status: 'select',
});
export function measureDC24(
  voltages: Readonly<Record<string, number | null>>,
  diagnostics: readonly string[], positive: string | null, negative: string | null,
  /** With several isolated supplies, a differential reading only exists within one supply's nets. */
  sameSupply?: (a: string, b: string) => boolean,
): MeterReading {
  if (!positive || !negative)
    return { positive, negative, volts: null, status: 'select' };
  if (diagnostics.some(d => d.startsWith('Supply short')))
    return { positive, negative, volts: null, status: 'short' };
  if (sameSupply && !sameSupply(positive, negative))
    return { positive, negative, volts: null, status: 'floating' };
  const hi = voltages[positive], lo = voltages[negative];
  if (hi === null || lo === null || hi === undefined || lo === undefined ||
      !Number.isFinite(hi) || !Number.isFinite(lo))
    return { positive, negative, volts: null, status: 'floating' };
  return { positive, negative, volts: hi - lo, status: 'measured' };
}
