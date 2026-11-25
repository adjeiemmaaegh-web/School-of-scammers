/**
 * Simulated PLC scan period and simulation-time pacing (R09, R23). Pure and DOM-free.
 *
 * Two independent ideas, deliberately kept apart:
 *  - the SCAN PERIOD is project data: how much model time one PLC scan represents (10-500 ms, multiples of the 10 ms plant
 *    substep, default 50 ms). Every timer, the plant physics and the electrical image advance by exactly this much per scan;
 *  - the TIME SCALE is a runtime pacing choice: how fast model time passes against the wall clock. It decides only HOW MANY
 *    scans run per real second, never what a scan does, so PLC logic and machine behaviour are identical at every speed.
 * Educational simulation: scan times are simulated, not a prediction of any real controller's cycle time.
 */
export const DEFAULT_SCAN_MS = 50;
export const MIN_SCAN_MS = 10;
export const MAX_SCAN_MS = 500;
export const SCAN_STEP_MS = 10;
/** The plant physics advances in fixed substeps; a scan is always a whole number of them. */
export const PLANT_SUBSTEP_MS = 10;

export const SCAN_PRESETS_MS: readonly number[] = [10, 20, 50, 100, 200, 500];
export const TIME_SCALES: readonly number[] = [0.1, 0.25, 0.5, 1, 2, 5, 10];

export const isValidScanMs = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= MIN_SCAN_MS && v <= MAX_SCAN_MS && v % SCAN_STEP_MS === 0;
export const isTimeScale = (v: unknown): v is number => typeof v === 'number' && TIME_SCALES.includes(v);

/** The scan period a project asks for, or the default. */
export const scanMsOf = (project: { scanMs?: number }): number => (isValidScanMs(project.scanMs) ? project.scanMs : DEFAULT_SCAN_MS);

export type ClockState = Readonly<{
  /** Model milliseconds owed but not yet simulated (always < one scan after a pump). */
  owedModelMs: number;
  /** Scans dropped because the machine could not keep up (model time is NOT skipped silently: see `behind`). */
  droppedScans: number;
}>;
export const freshClock = (): ClockState => ({ owedModelMs: 0, droppedScans: 0 });

/**
 * Converts elapsed wall time into a whole number of scans to run now. Deterministic: the same sequence of wall intervals gives
 * the same scan counts, and the total model time simulated is always scans x scanMs, whatever the scale.
 * `maxScans` bounds the work per pump so a slow machine degrades gracefully instead of freezing; scans that do not fit are
 * counted as dropped (the displayed speed falls behind the requested speed, and the diagnostics say so).
 */
export function pumpClock(state: ClockState, wallElapsedMs: number, scanMs: number, scale: number, maxScans: number):
  { state: ClockState; scans: number; behind: boolean } {
  if (!isValidScanMs(scanMs)) throw new RangeError('Invalid scan period');
  if (!isTimeScale(scale)) throw new RangeError('Invalid time scale');
  if (!Number.isFinite(wallElapsedMs) || wallElapsedMs < 0) throw new RangeError('Invalid elapsed time');
  const owed = state.owedModelMs + wallElapsedMs * scale;
  const due = Math.floor(owed / scanMs);
  const cap = Math.max(1, Math.floor(maxScans));
  const scans = Math.min(due, cap);
  const dropped = due - scans;
  // Dropped scans are forgiven so the backlog cannot grow without bound; `behind` tells the UI the requested speed was not met.
  const remaining = owed - due * scanMs;
  return { state: { owedModelMs: remaining, droppedScans: state.droppedScans + dropped }, scans, behind: dropped > 0 };
}

export type ScanTiming = Readonly<{
  scanMs: number;
  timeScale: number;
  /** Mean and worst wall-clock cost of one scan over the recent window, in milliseconds. */
  meanComputeMs: number;
  maxComputeMs: number;
  /** Compute cost as a share of the scan period at the CURRENT speed (above 100 the simulator cannot keep up). */
  loadPercent: number;
  droppedScans: number;
  behind: boolean;
}>;

/** Rolling scan-cost window (fixed size, no allocation per scan). */
export function createTimingWindow(size = 40) {
  const samples: number[] = [];
  return {
    add(ms: number) { samples.push(Math.max(0, ms)); if (samples.length > size) samples.shift(); },
    stats(): { mean: number; max: number } {
      if (!samples.length) return { mean: 0, max: 0 };
      let sum = 0, max = 0;
      for (const s of samples) { sum += s; if (s > max) max = s; }
      return { mean: sum / samples.length, max };
    },
  };
}

export function scanTiming(scanMs: number, scale: number, mean: number, max: number, dropped: number, behind: boolean): ScanTiming {
  // Per wall second the simulator must run (1000 * scale / scanMs) scans; each costs `mean` ms.
  const loadPercent = Math.round(((1000 * scale / scanMs) * mean) / 10 * 10) / 10;
  return { scanMs, timeScale: scale, meanComputeMs: Math.round(mean * 100) / 100, maxComputeMs: Math.round(max * 100) / 100,
    loadPercent, droppedScans: dropped, behind };
}
