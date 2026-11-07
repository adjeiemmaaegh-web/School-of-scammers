/**
 * Starter plants for the scenario catalogue. Built by replaying ordinary commands through the real
 * orchestrator, so every starter is, by construction, a project the worker would accept.
 */
import { blankProgram, createWorld, latchProgram, tick } from '../sim/orchestrator';
import type { Command, ProjectFile } from '../sim/signals';
import type { LadderDocument } from '../engineering/ladder';

type Place = [kind: Extract<Command, { k: 'place' }>['kind'], id: string, x: number, y: number];
type Link = [from: string, to: string];

export function projectFrom(places: Place[], links: Link[], program: LadderDocument = blankProgram()): ProjectFile {
  const world = tick(createWorld(), [
    ...places.map(([kind, id, x, y]): Command => ({ k: 'place', kind, id, at: { x, y } })),
    ...links.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to })),
    { k: 'loadProgram', program },
  ]).world;
  if (world.lastError) throw new Error(`Scenario starter is invalid: ${world.lastError}`);
  return world.project;
}

/* ---- 24V start/stop motor: PLC, two pushbuttons, contactor, motor ---- */
export const MOTOR_PLACES: Place[] = [
  ['supply', 'ps', 10, 10], ['plc', 'plc', 280, 10], ['start', 'start', 10, 240],
  ['stop', 'stop', 280, 240], ['contactor', 'con', 560, 10], ['motor', 'motor', 800, 10],
];
export const MOTOR_LINKS: Link[] = [
  ['ps.P24', 'plc.L+'], ['ps.M0', 'plc.M'],
  ['ps.P24', 'start.A'], ['start.B', 'plc.I0.0'],
  ['ps.P24', 'stop.A'], ['stop.B', 'plc.I0.1'],
  ['plc.Q0.0', 'con.A1'], ['ps.M0', 'con.A2'],
  ['ps.P24', 'con.13'], ['con.14', 'motor.L+'], ['ps.M0', 'motor.M-'],
];

/* ---- sorting workcell (same geometry the P3 sorting tests use) ---- */
export const SORTING_PLACES: Place[] = [
  ['supply', 'ps', 25, 25], ['plc', 'plc', 315, 25], ['contactor', 'con', 555, 25],
  ['conveyor', 'belt', 610, 280], ['start', 'start', 60, 245], ['stop', 'stop', 325, 245],
  ['photoeye', 'eye', 690, 380], ['diverter', 'gate', 750, 170],
];
export const SORTING_LINKS: Link[] = [
  ['ps.P24', 'plc.L+'], ['ps.M0', 'plc.M'],
  ['ps.P24', 'start.A'], ['start.B', 'plc.I0.0'],
  ['ps.P24', 'stop.A'], ['stop.B', 'plc.I0.1'],
  ['ps.P24', 'con.13'], ['ps.M0', 'con.A2'], ['plc.Q0.0', 'con.A1'],
  ['con.14', 'belt.L+'], ['ps.M0', 'belt.M-'],
  ['ps.P24', 'eye.L+'], ['ps.M0', 'eye.M'], ['eye.OUT', 'plc.I0.2'],
  ['plc.Q0.1', 'gate.A1'], ['ps.M0', 'gate.A2'],
];

/* ---- tank process ---- */
export const TANK_PLACES: Place[] = [
  ['supply', 'supply', 25, 25], ['plc', 'plc', 310, 25], ['stop', 'stop', 225, 245],
  ['tank', 'tank', 680, 290], ['pump', 'pump', 525, 280], ['levelprobe', 'probe', 700, 360],
  ['drainvalve', 'drain', 840, 360],
];
export const TANK_LINKS: Link[] = [
  ['supply.P24', 'plc.L+'], ['supply.M0', 'plc.M'],
  ['supply.P24', 'stop.A'], ['stop.B', 'plc.I0.1'],
  ['supply.P24', 'probe.L+'], ['supply.M0', 'probe.M'], ['probe.OUT', 'plc.I0.3'],
  ['plc.Q0.2', 'pump.L+'], ['supply.M0', 'pump.M-'],
  ['plc.Q0.3', 'drain.A1'], ['supply.M0', 'drain.A2'],
];

export const motorWorking = (): ProjectFile => projectFrom(MOTOR_PLACES, MOTOR_LINKS, latchProgram());
