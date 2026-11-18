/**
 * Tick phase (R3.3): per-instance equipment whose state advances from the solved circuit each scan: on-delay relays,
 * pneumatic cylinders and tank vessels. Extracted verbatim from `tick()`; behaviour is pinned by
 * `tests/r3-golden-tick.test.ts`. Pure apart from appending to `events` and writing `deviceOn` for timer relays
 * (`deviceOn` for a timer relay means "contacts transferred", which the circuit reads one scan later).
 */
import { paramSpecsOf, paramValue } from '../../components/params';
import { engineFault, freshCylinder, stepCylinder, type CylinderState } from '../../plant/cylinder';
import { freshTank, stepTank, type TankProcess } from '../../plant/tank-process';
import { faultsOf } from '../faults';
import { vesselsOf } from '../stations';
import type { PlacedComponent, SimEvent, WorldState } from '../signals';

export type EquipmentStep = {
  nextTimers: Record<string, number>;
  nextCylinders: Record<string, CylinderState>;
  nextVessels: Record<string, TankProcess>;
};

export function stepEquipmentState(
  w: WorldState, energizedLoads: readonly string[], dtMs: number,
  deviceOn: Record<string, boolean>, events: SimEvent[],
): EquipmentStep {
  // Every on-delay relay times its own coil: elapsed grows while the coil is energised and resets the moment it drops.
  // `deviceOn` for these means "contacts transferred", which the circuit reads on the next scan (the usual one-scan delay).
  const nextTimers: Record<string, number> = {};
  for (const c of w.project.components.filter(x => x.kind === 'timerelay')) {
    const delayMs = paramValue(w.project.params, c.id, paramSpecsOf('timerelay')[0]);
    const coil = energizedLoads.includes(c.id);
    const elapsed = coil ? Math.min((w.timers[c.id] ?? 0) + dtMs, delayMs) : 0;
    nextTimers[c.id] = elapsed;
    const done = elapsed >= delayMs;
    deviceOn[c.id] = done;
    if (done !== (w.deviceOn[c.id] === true))
      events.push({ tick: w.tick + 1, kind: 'relay', detail: `${c.id}: ${done ? 'delay elapsed, contacts transferred' : 'released'}` });
  }
  // Every tank is its own vessel: the pumps, drain valves and level switches mounted beside it.
  // Every pneumatic cylinder moves from its two solenoid coils, as solved from the wiring.
  const nextCylinders: Record<string, CylinderState> = {};
  for (const c of w.project.components.filter(x => x.kind === 'cylinder')) {
    const fault = engineFault(faultsOf(w.project).find(f => f.target === c.id && f.kind.startsWith('cylinder-'))?.kind);
    const step = stepCylinder(w.cylinders[c.id] ?? freshCylinder(), energizedLoads.includes(`${c.id}-E`), energizedLoads.includes(`${c.id}-R`), dtMs, fault);
    nextCylinders[c.id] = step.state;
    for (const detail of step.events) events.push({ tick: w.tick + 1, kind: 'cylinder', detail: `${c.id}: ${detail}` });
  }
  const nextVessels: Record<string, TankProcess> = {};
  for (const vessel of vesselsOf(w.project.components)) {
    const live = (parts: PlacedComponent[]) => parts.some(p => energizedLoads.includes(p.id));
    const parts = [vessel.tank, ...vessel.pumps.slice(0, 1), ...vessel.valves.slice(0, 1), ...vessel.probes.slice(0, 1)];
    const change = stepTank(w.vessels[vessel.tank.id] ?? freshTank(), parts, live(vessel.pumps), live(vessel.valves), dtMs);
    nextVessels[vessel.tank.id] = change.tank;
    for (const detail of change.events) events.push({ tick: w.tick + 1, kind: 'tank', detail });
  }
  return { nextTimers, nextCylinders, nextVessels };
}
