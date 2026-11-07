/**
 * P5 supervisory alarms. Pure and DOM-free.
 *
 * These model what an HMI/SCADA supervision layer would report: a SYMPTOM seen from the
 * controller's side (commanded vs. observed). They never state a cause, so a hidden fault cannot
 * leak through alarm text. Finding the cause is the learner's job (multimeter, I/O, scan trace).
 *
 * This is a training supervision rule computed by the worker from authoritative plant state, not
 * a PLC-scanned alarm: the sandbox has no motor feedback input wired to the PLC.
 */
import type { AlarmCode, AlarmRecord, AlarmWatch } from '../sim/signals';

/** Scan period is 50 ms, so 20 scans is 1 s. The commanded motor needs ~2-3 scans to respond. */
export const START_FAILURE_SCANS = 20;
export const UNCOMMANDED_RUN_SCANS = 6;
export const MAX_ALARM_HISTORY = 40;

export const freshAlarmWatch = (): AlarmWatch => ({ noResponse: 0, uncommanded: 0, nextId: 1 });

export type AlarmInput = {
  scan: number;
  /** A motor exists and the PLC is powered, so commanded-vs-observed means something. */
  monitored: boolean;
  runCommanded: boolean;
  motorEnergized: boolean;
  alarms: readonly AlarmRecord[];
  watch: AlarmWatch;
};
export type AlarmUpdate = {
  alarms: AlarmRecord[]; watch: AlarmWatch; raised: AlarmRecord[]; cleared: AlarmRecord[];
};

const RULES: Record<AlarmCode, { severity: AlarmRecord['severity']; message: string }> = {
  START_FAILURE: { severity: 'warning',
    message: 'Run output Q0.0 has been ON for 1 s but the motor is not energized. Trace the path from the output through the coil and contacts to the motor.' },
  UNCOMMANDED_RUN: { severity: 'fault',
    message: 'The motor is energized while the Run output Q0.0 is OFF.' },
};

export function updateAlarms(input: AlarmInput): AlarmUpdate {
  const startFailing = input.monitored && input.runCommanded && !input.motorEnergized;
  const uncommanded = input.monitored && !input.runCommanded && input.motorEnergized;
  const watch: AlarmWatch = {
    noResponse: startFailing ? input.watch.noResponse + 1 : 0,
    uncommanded: uncommanded ? input.watch.uncommanded + 1 : 0,
    nextId: input.watch.nextId,
  };
  const alarms = input.alarms.map(a => ({ ...a }));
  const raised: AlarmRecord[] = [];
  const cleared: AlarmRecord[] = [];
  const apply = (code: AlarmCode, condition: boolean, count: number, threshold: number) => {
    const active = alarms.find(a => a.code === code && a.clearedAtScan === null);
    if (!active && count >= threshold) {
      const record: AlarmRecord = { id: watch.nextId++, code, ...RULES[code],
        raisedAtScan: input.scan, clearedAtScan: null };
      alarms.push(record);
      raised.push(record);
    } else if (active && !condition) {
      active.clearedAtScan = input.scan;
      cleared.push(active);
    }
  };
  apply('START_FAILURE', startFailing, watch.noResponse, START_FAILURE_SCANS);
  apply('UNCOMMANDED_RUN', uncommanded, watch.uncommanded, UNCOMMANDED_RUN_SCANS);
  // Keep the history bounded: drop the oldest cleared records first, never an active alarm.
  while (alarms.length > MAX_ALARM_HISTORY) {
    const oldest = alarms.findIndex(a => a.clearedAtScan !== null);
    if (oldest < 0) break;
    alarms.splice(oldest, 1);
  }
  return { alarms, watch, raised, cleared };
}
