/**
 * A pneumatic cylinder as a simulator device. The motion, limit switches, valve interlock and timeout alarm come from the
 * deterministic cylinder engine that already backs the pneumatics lab (`engineering/pneumatic-cylinder`); this wrapper
 * only maps the two solenoid coils (energised or not, as solved from the user's wiring) onto that engine.
 * Educational model: air is assumed available, not a pressure or force design tool, not safety-rated.
 */
import { initialPneumatic, stepPneumatic, type PneumaticState } from '../engineering/pneumatic-cylinder';

/** The engine's state plus whether both solenoids were energised last scan (so the conflict is reported once). */
export type CylinderState = PneumaticState & { conflict: boolean };
export const freshCylinder = (): CylinderState => ({ ...initialPneumatic(), events: [], conflict: false });

export type CylinderStep = { state: CylinderState; events: string[] };

/**
 * One scan. `extendOn` / `retractOn` are whether each solenoid coil is energised. Both at once is a valve conflict: the
 * spring-centred valve holds the rod where it is, and the conflict is reported once when it starts.
 */
export function stepCylinder(prior: CylinderState, extendOn: boolean, retractOn: boolean, dtMs: number): CylinderStep {
  const conflict = extendOn && retractOn;
  const command = conflict ? 'neutral' : extendOn ? 'extend' : retractOn ? 'retract' : 'neutral';
  const next = stepPneumatic({ ...prior, events: [] }, { command, airOn: true, guardClosed: true, emergencyStop: false, fault: 'none' }, dtMs);
  const events: string[] = [];
  if (conflict && !prior.conflict) events.push('Both solenoids energised: valve holds the rod in place');
  if (!prior.extendLimit && next.extendLimit) events.push('Cylinder reached the EXTENDED limit');
  if (!prior.retractLimit && next.retractLimit) events.push('Cylinder reached the RETRACTED limit');
  if (next.alarm && next.alarm !== prior.alarm) events.push(`Cylinder alarm: ${next.alarm}`);
  return { state: { ...next, events: [], conflict }, events };
}
