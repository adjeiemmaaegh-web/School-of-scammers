/**
 * Data-driven electrical behaviour for equipment that is not part of the original hand-coded set.
 *
 * Instead of another block in the orchestrator's `buildCircuit` for every new device, a kind that appears here is described
 * as the loads and switches it contributes to the 24 V circuit, given a small context (is its coil energised, which faults
 * does it carry, where is its cylinder). Adding such a device is a registry entry plus an entry here; only devices that also
 * MOVE (like the cylinder) need a plant model on top. Pure and deterministic.
 */
import type { Device } from '../engineering/electrical';
import type { FaultKind, PlacedComponent } from '../sim/signals';
import type { CylinderState } from '../plant/cylinder';
import type { StarterPanelState } from '../electrical/three-phase-types';

export type ElectricalContext = {
  /** The device's coil/actuator was energised on the previous scan (the one-scan delay every relay has). */
  on: boolean;
  hasFault: (kind: FaultKind) => boolean;
  cylinder?: CylinderState;
  threePhase?: StarterPanelState;
};

const t = (id: string, pin: string) => `${id}.${pin}`;
const sw = (id: string, a: string, b: string, closed: boolean): Device => ({ id, kind: 'switch', a, b, closed });
const load = (id: string, positive: string, negative: string): Device => ({ id, kind: 'load', positive, negative, nominalVolts: 24 });

type Def = (c: PlacedComponent, ctx: ElectricalContext) => Device[];

const DEFS: Partial<Record<PlacedComponent['kind'], Def>> = {
  // A coil that switches two NO contacts and one NC contact. An open coil never pulls in; welded contacts stay in the
  // energised state whatever the coil does (the NC contact opens with them, as the contacts are mechanically linked).
  relay: (c, ctx) => {
    const energised = ctx.on || ctx.hasFault('contactor-welded');
    return [
      ...(ctx.hasFault('contactor-coil-open') ? [] : [load(c.id, t(c.id, 'A1'), t(c.id, 'A2'))]),
      sw(`${c.id}-NO1`, t(c.id, '13'), t(c.id, '14'), energised),
      sw(`${c.id}-NO2`, t(c.id, '23'), t(c.id, '24'), energised),
      sw(`${c.id}-NC`, t(c.id, '21'), t(c.id, '22'), !energised),
    ];
  },
  // An on-delay relay: the coil is a load like any relay's, but the contacts follow the timer (`on` = contacts transferred),
  // not the coil. An open coil never starts the timer; welded contacts stay transferred.
  timerelay: (c, ctx) => {
    const transferred = ctx.on || ctx.hasFault('contactor-welded');
    return [
      ...(ctx.hasFault('contactor-coil-open') ? [] : [load(c.id, t(c.id, 'A1'), t(c.id, 'A2'))]),
      sw(`${c.id}-NO`, t(c.id, '13'), t(c.id, '14'), transferred),
      sw(`${c.id}-NC`, t(c.id, '21'), t(c.id, '22'), !transferred),
    ];
  },
  // Virtual three-phase motor's 24V *control-coil* domain, completely
  // separate from L1/L2/L3. All four coils have real DC return conductors.
  'star-delta-drive': (c, ctx) => {
    const state=ctx.threePhase;
    return [
      ...['MAIN','STAR','DELTA','RESET'].map(name=>load(c.id+'-'+name,
        t(c.id,name+'+'),t(c.id,'M-'))),
      ...(['READY','TRIP','STAR','DELTA'] as const).map(signal=>sw(
        c.id+'-'+signal+'-FB',t(c.id,'L+'),t(c.id,signal+'_OUT'),
        signal==='READY'?state?.ready===true:signal==='TRIP'?state?.motor.tripped===true:
          signal==='STAR'?state?.starClosed===true:state?.deltaClosed===true)),
    ];
  },
  // Three signal lamps on one column, each its own load to the common return.
  stacklight: c => ['R', 'Y', 'G'].map(lamp => load(`${c.id}-${lamp}`, t(c.id, lamp), t(c.id, 'M-'))),
  // Two solenoid coils to a common return, and two limit switches that close when the rod is at that end.
  cylinder: (c, ctx) => {
    const rod = ctx.cylinder;
    return [
      load(`${c.id}-E`, t(c.id, 'EXT+'), t(c.id, 'M-')),
      load(`${c.id}-R`, t(c.id, 'RET+'), t(c.id, 'M-')),
      sw(`${c.id}-LSE`, t(c.id, 'L+'), t(c.id, 'EXT_LS'), rod?.extendLimit === true),
      sw(`${c.id}-LSR`, t(c.id, 'L+'), t(c.id, 'RET_LS'), rod ? rod.retractLimit : true),
    ];
  },
};

/** The circuit devices a data-driven kind contributes, or null when the kind is still hand-coded in the orchestrator. */
export const electricalDevices = (c: PlacedComponent, ctx: ElectricalContext): Device[] | null => DEFS[c.kind]?.(c, ctx) ?? null;
