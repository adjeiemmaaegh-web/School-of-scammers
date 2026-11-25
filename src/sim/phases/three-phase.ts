/**
 * R3 / Stage 2: one deterministic three-phase plant phase.
 * Runs AFTER the 24 V output image has been solved. Neither Three.js nor a
 * client-side control may set these states. The 400 V virtual teaching domain
 * remains separate from the 24 V signal circuit.
 *
 * Behaviour deliberately matches the former inline tick() implementation:
 * same fault-filtered netlist, same coil demand, same event order and same
 * next-scan device image. No physical safety claims are implied.
 */
import { threePhaseConnections } from '../../electrical/three-phase-netlist';
import { freshStarterPanel } from '../../electrical/three-phase-types';
import { stepWiredStarter } from '../../electrical/wired-star-delta';
import { faultsOf } from '../faults';
import type { SimEvent, WorldState } from '../signals';

export function stepThreePhase(
  w: WorldState,
  energizedLoads: readonly string[],
  dtMs: number,
  deviceOn: Record<string, boolean>,
  events: SimEvent[],
): WorldState['threePhase'] {
  const openWires = new Set(faultsOf(w.project)
    .filter(f => f.kind === 'wire-open').map(f => f.target));
  const connectedThreePhase = threePhaseConnections(
    w.project.components,
    w.project.wires.filter(wire => !openWires.has(wire.id)),
  );
  const nextThreePhase: WorldState['threePhase'] = {};
  for (const part of w.project.components.filter(c => c.kind === 'star-delta-drive')) {
    const wired = connectedThreePhase[part.id] ?? null;
    const live = wired && w.threePhasePower[wired.supplyId] !== false ? wired : null;
    const coils = {
      main: energizedLoads.includes(part.id + '-MAIN'),
      star: energizedLoads.includes(part.id + '-STAR'),
      delta: energizedLoads.includes(part.id + '-DELTA'),
      reset: energizedLoads.includes(part.id + '-RESET'),
    };
    const previous = w.threePhase[part.id] ?? freshStarterPanel();
    const next = stepWiredStarter(previous, live, coils, dtMs);
    nextThreePhase[part.id] = next;
    deviceOn[part.id] = next.mainClosed && (next.starClosed || next.deltaClosed);
    if (next.motor.mode !== previous.motor.mode || next.motor.tripped !== previous.motor.tripped)
      events.push({
        tick: w.tick + 1, kind: 'three-phase',
        detail: part.id + ': ' + next.motor.mode + (next.motor.tripped ? ' (thermal trip)' : ''),
      });
    if (next.conflict && !previous.conflict)
      events.push({
        tick: w.tick + 1, kind: 'interlock',
        detail: part.id + ': STAR/DELTA control conflict; motor inhibited',
      });
  }
  return nextThreePhase;
}
