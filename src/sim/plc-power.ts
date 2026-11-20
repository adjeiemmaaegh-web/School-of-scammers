/**
 * Stage 2 / R3.4: per-controller power image for the settled 24 V circuit.
 *
 * The electrical solver is the only authority: a PLC is powered only when
 * its own L+ terminal is at 24 V relative to its own M return. Controller
 * order, a neighboring powered PLC and a second isolated supply cannot
 * energize a different PLC by accident.
 */
import { plcComponents } from './plcs';
import type { ProjectFile } from './signals';

type PowerCircuit = { reads24: (positive: string, negative: string) => boolean };

/** Immutable-by-convention map, stable in project component order. */
export function controllerPowerImage(
  project: Pick<ProjectFile, 'components'>,
  circuit: PowerCircuit,
  shorted: boolean,
): Record<string, boolean> {
  return Object.fromEntries(plcComponents(project).map(plc => [
    plc.id, !shorted && circuit.reads24(plc.id + '.L+', plc.id + '.M'),
  ]));
}

/** This reports virtual controller availability across a bench. It does NOT
 * identify which PLC is wired to a particular conveyor or actuator.
 */
export const anyControllerPowered = (image: Readonly<Record<string, boolean>>): boolean =>
  Object.values(image).some(Boolean);
