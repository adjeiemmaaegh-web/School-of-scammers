/** One place that answers "is this device live?" per component, so cards, 3D and inspector agree. */
import type { PlacedComponent, RenderSnapshot } from './signals';

/**
 * Live state of components that exist in several copies (PLC, contactor, relay, motor, lamp, conveyor, diverter, pump, valve, cylinder, breaker, overload). Falls back to the
 * legacy first-device flags before the first scan has populated the per-device maps. Undefined for
 * every other kind: those have their own single-instance state.
 */
export function perDeviceLive(snapshot: RenderSnapshot, c: Pick<PlacedComponent, 'id' | 'kind'>): boolean | undefined {
  switch (c.kind) {
    case 'plc':
    case 'plc16': return snapshot.plcs[c.id]?.powered ?? snapshot.io.PlcPowered;
    case 'three-phase-supply': return snapshot.threePhaseSources[c.id] !== false;
    case 'star-delta-drive': return snapshot.threePhase[c.id]?.mainClosed === true;
    case 'motor': return snapshot.deviceOn[c.id] ?? snapshot.motorOn;
    case 'contactor': return snapshot.deviceOn[c.id] ?? snapshot.contactorOn;
    case 'lamp': return snapshot.deviceOn[c.id] ?? snapshot.lampOn;
    case 'conveyor': return snapshot.deviceOn[c.id] ?? snapshot.conveyorOn;
    case 'relay':
    case 'timerelay': return snapshot.deviceOn[c.id] ?? false;
    case 'stacklight': return ['R', 'Y', 'G'].some(l => snapshot.deviceOn[`${c.id}-${l}`] === true);
    // A cylinder reads as "live" while its rod is anywhere but fully retracted.
    case 'cylinder': return (snapshot.cylinders[c.id]?.position ?? 0) > 0;
    case 'diverter': return snapshot.deviceOn[c.id] ?? snapshot.diverterOn;
    case 'pump': return snapshot.deviceOn[c.id] ?? snapshot.pumpOn;
    case 'drainvalve': return snapshot.deviceOn[c.id] ?? snapshot.drainOn;
    // A protection device is "live" (closed) until it has tripped.
    case 'breaker': return !(snapshot.tripped[c.id] ?? snapshot.breakerTripped);
    case 'overload': return !(snapshot.tripped[c.id] ?? snapshot.overloadTripped);
    default: return undefined;
  }
}
