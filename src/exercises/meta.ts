/**
 * Light scenario metadata for pages that only list or assign scenarios (ladder, employer, candidate
 * intro). Deliberately imports nothing from the simulator: the grading code and starter projects live
 * in `catalogue.ts`, which only the lazy workbench chunk loads, so the landing bundle stays small.
 */
import type { Rank, TradeId } from '../platform/types';

export interface ScenarioMeta {
  id: string;
  trade: TradeId;
  rank: Rank;
  version: string;
  title: string;
  estMinutes: number;
  summary: string;
  /** Work-order-style brief. */
  scenario: string;
}

export const SCENARIO_META: ScenarioMeta[] = [
  {
    id: 'plc-sbx-startstop', trade: 'plc', rank: 2, version: '1.0',
    title: 'Build a start/stop motor starter',
    estMinutes: 20,
    summary: 'Wire a 24 V PLC, two pushbuttons, a contactor and a motor, then write the seal-in logic.',
    scenario:
    'Work order: the devices for a small 24 V motor starter are mounted but nothing is connected and the PLC runs a placeholder program.\n' +
    'Wire the power, the START button (input I0.0), the STOP button (input I0.1) and the contactor coil (output Q0.0). Feed the motor through the contactor\'s power contact. ' +
    'Then program the PLC so START latches the motor on and STOP always drops it. You are graded on how the finished starter behaves, not on how you built it.',
  },
  {
    id: 'plc-sbx-find-fault', trade: 'plc', rank: 4, version: '1.0',
    title: 'Find and repair the motor-starter fault',
    estMinutes: 25,
    summary: 'A working starter has been sabotaged. Diagnose it with the meter and replace only the faulty part.',
    scenario:
    'Work order: the 24 V motor starter on this bench stopped working. Wiring and program were checked last month and are believed correct.\n' +
    'Operate the starter, read the I/O lamps and alarms, and use the multimeter to locate the fault. Pause the simulation, replace only the part you have proven faulty, ' +
    'and confirm the starter works again. Replacing healthy parts, rebuilding the circuit or editing the program counts against you. Nothing tells you what is wrong: replacing a part never says whether it was the cause.',
  },
  {
    id: 'plc-sbx-sorting', trade: 'plc', rank: 5, version: '1.0',
    title: 'Program the sorting conveyor',
    estMinutes: 30,
    summary: 'The line is wired. Write the Ladder so it runs the belt and diverts only marked parcels.',
    scenario:
    'Work order: a single-lane conveyor with a mark-detecting photoeye (input I0.2) and a reject diverter (output Q0.1) has been wired. The belt contactor is on Q0.0, START is I0.0 and STOP is I0.1. ' +
    'The PLC still holds a placeholder program.\n' +
    'Program it so START runs the belt until STOP, marked parcels are pushed off the belt by the diverter, and plain parcels pass. Use the "Feed parcel" buttons to test. ' +
    'You are graded on what the line does with real parcels.',
  },
  {
    id: 'plc-sbx-tank', trade: 'plc', rank: 6, version: '1.0',
    title: 'Program the tank level control',
    estMinutes: 30,
    summary: 'Fill to the high-level switch, then drain until it clears, then repeat. Never overflow; STOP halts everything.',
    scenario:
    'Work order: a 1000 ml demonstration tank has an inlet pump (output Q0.2), a drain valve (Q0.3), a level switch (input I0.3) and a STOP button (I0.1), all wired. The PLC still holds a placeholder program.\n' +
    'Program the cycle: fill until the level switch reports HIGH (it trips at 750 ml and clears below 600 ml), then drain until it clears, then fill again. ' +
    'The pump must never run while the tank is HIGH, the tank must never overflow, and STOP must halt the pump and the drain valve at once.',
  },
];
export const getScenarioMeta = (id: string): ScenarioMeta | undefined => SCENARIO_META.find(s => s.id === id);
