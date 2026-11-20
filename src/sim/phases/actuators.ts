/**
 * Tick phase (R3.3): the actuator image. From the solved circuit's energised loads this derives, in one place, every
 * legacy single-device flag (first contactor/motor/conveyor/pump/valve/lamp, the reversing pair) AND the per-instance
 * state (`deviceOn`, `motorAngles`, per-lane sorting plants). Extracted verbatim from `tick()`; behaviour is pinned by
 * `tests/r3-golden-tick.test.ts` and the scenario suites.
 */
import { freshPlant, stepPlant, type SortingPlant } from '../../plant/sorting-conveyor';
import { lanesOf } from '../stations';
import type { SimEvent, WorldState } from '../signals';

export function stepActuators(w: WorldState, energizedLoads: readonly string[], dtMs: number, events: SimEvent[]) {
  const contactor = w.project.components.find(c => c.kind === 'contactor');
  const motor = w.project.components.find(c => c.kind === 'motor');
  const conveyor = w.project.components.find(c => c.kind === 'conveyor');
  const diverter = w.project.components.find(c => c.kind === 'diverter');
  const pump = w.project.components.find(c => c.kind === 'pump');
  const drain = w.project.components.find(c => c.kind === 'drainvalve');
  const lamp = w.project.components.find(c => c.kind === 'lamp');
  const forwardContactor = w.project.components.find(c => c.kind === 'forwardcontactor');
  const reverseContactor = w.project.components.find(c => c.kind === 'reversecontactor');
  const reversibleMotor = w.project.components.find(c => c.kind === 'revmotor');
  // Coil currents come only from the resolved electrical graph, including
  // the opposite contactor's physically wired NC auxiliary. The simplified
  // mechanical interlock also inhibits both when simultaneous energized coils
  // are detected (e.g. user bypasses both NC auxiliaries).
  const forwardCoilOn = !!forwardContactor && energizedLoads.includes(forwardContactor.id);
  const reverseCoilOn = !!reverseContactor && energizedLoads.includes(reverseContactor.id);
  const interlockConflict = forwardCoilOn && reverseCoilOn;
  const forwardContactorOn = forwardCoilOn && !interlockConflict;
  const reverseContactorOn = reverseCoilOn && !interlockConflict;
  const forwardMotorPowered = !!reversibleMotor &&
    energizedLoads.includes(`${reversibleMotor.id}-F`);
  const reverseMotorPowered = !!reversibleMotor &&
    energizedLoads.includes(`${reversibleMotor.id}-R`);
  const opposingDrives = forwardMotorPowered && reverseMotorPowered;
  const motorDirection: 'stopped' | 'forward' | 'reverse' =
    interlockConflict || opposingDrives ? 'stopped' :
      forwardMotorPowered ? 'forward' : reverseMotorPowered ? 'reverse' : 'stopped';
  // The simple modeled shaft follows only worker-owned scan time and observed
  // 24V motor terminal energization. Reverse rotates in the negative direction.
  const reverseMotorAngleRad = motorDirection === 'stopped' ? w.reverseMotorAngleRad :
    (w.reverseMotorAngleRad + (motorDirection === 'forward' ? 1 : -1) * dtMs * 0.02 +
      2 * Math.PI * 100) % (2 * Math.PI);
  const contactorOn = !!contactor && energizedLoads.includes(contactor.id);
  // 7. Advance P1 plant: ideal DC motor load, no fake animation or invented motion physics.
  const motorOn = !!motor && energizedLoads.includes(motor.id);
  // Idealized shaft indicator rotation comes from the authoritative simulation clock,
  // not requestAnimationFrame or visual-only animation. Speed is illustrative, not calibrated.
  const motorAngleRad = motorOn ? (w.motorAngleRad + dtMs * 0.02) % (2 * Math.PI) : w.motorAngleRad;
  // P3 plant movement derives from the actual powered conveyor, never Run/3D animation.
  const conveyorOn = !!conveyor && energizedLoads.includes(conveyor.id);
  const diverterOn = !!diverter && energizedLoads.includes(diverter.id);
  // Every conveyor is its own lane: the photoeye and diverter positioned along it, and its own parcel.
  const nextLanes: Record<string, SortingPlant> = {};
  for (const lane of lanesOf(w.project.components)) {
    const belt = energizedLoads.includes(lane.conveyor.id);
    const gate = lane.diverters.some(d => energizedLoads.includes(d.id));
    const parts = [lane.conveyor, ...lane.eyes.slice(0, 1), ...lane.diverters.slice(0, 1)];
    const change = stepPlant(w.lanes[lane.conveyor.id] ?? freshPlant(), parts, belt, gate, dtMs);
    nextLanes[lane.conveyor.id] = change.plant;
    for (const detail of change.events) events.push({ tick: w.tick + 1, kind: 'plant', detail });
  }
  const pumpOn = !!pump && energizedLoads.includes(pump.id);
  const drainOn = !!drain && energizedLoads.includes(drain.id);
  const lampOn = !!lamp && energizedLoads.includes(lamp.id);
  // Every contactor, motor and lamp has its own energised state (the legacy booleans mirror the first).
  const deviceOn: Record<string, boolean> = {};
  const motorAngles: Record<string, number> = {};
  for (const c of w.project.components) {
    if (!['contactor', 'motor', 'lamp', 'conveyor', 'diverter', 'pump', 'drainvalve', 'relay', 'stacklight', 'buzzer', 'siren'].includes(c.kind)) continue;
    const on = energizedLoads.includes(c.id);
    deviceOn[c.id] = on;
    // A stack light has three lamps, each its own load: record every lamp by `<id>-R`, `-Y` and `-G`.
    if (c.kind === 'stacklight') for (const lamp of ['R', 'Y', 'G']) deviceOn[`${c.id}-${lamp}`] = energizedLoads.includes(`${c.id}-${lamp}`);
    if (c.kind === 'motor') {
      const prev = w.motorAngles[c.id] ?? (c.id === motor?.id ? w.motorAngleRad : 0);
      motorAngles[c.id] = on ? (prev + dtMs * 0.02) % (2 * Math.PI) : prev;
      if (c.id !== motor?.id && on !== (w.deviceOn[c.id] === true))
        events.push({ tick: w.tick + 1, kind: 'motor', detail: `Motor ${c.id} ${on ? 'running' : 'stopped'}` });
    } else if (c.kind === 'contactor' && c.id !== contactor?.id && on !== (w.deviceOn[c.id] === true)) {
      events.push({ tick: w.tick + 1, kind: 'contactor', detail: `Contactor ${c.id} ${on ? 'energised' : 'released'}` });
    }
  }
  return { contactor, motor, conveyor, diverter, pump, drain, lamp, forwardContactor, reverseContactor, reversibleMotor, forwardCoilOn, reverseCoilOn, interlockConflict, forwardContactorOn, reverseContactorOn, forwardMotorPowered, reverseMotorPowered, opposingDrives, motorDirection, reverseMotorAngleRad, contactorOn, motorOn, motorAngleRad, conveyorOn, diverterOn, nextLanes, pumpOn, drainOn, lampOn, deviceOn, motorAngles };
}
