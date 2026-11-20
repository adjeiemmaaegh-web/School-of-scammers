/** Per-instance authority for live equipment indicators shown in cards, 3D and inspector.
 *
 * Legacy snapshot singleton flags are compatibility mirrors of the FIRST device
 * of their kind. Using them for a second device would make an unrelated motor,
 * PLC, conveyor or protection device appear live when it is not.
 */
import type { PlacedComponent, RenderSnapshot } from './signals';

/** Fall back to a legacy mirror only for its owner, never for other instances.
 * Current worker snapshots expose per-device state; this guard also keeps the
 * initial / imported v1 snapshot honest before the first complete scan.
 */
function firstId(snapshot: RenderSnapshot, kinds: readonly string[]): string | undefined {
  return snapshot.components.find(part => kinds.includes(part.kind))?.id;
}
function legacyFor(
  snapshot: RenderSnapshot, c: Pick<PlacedComponent, 'id'>,
  kinds: readonly string[], legacy: boolean,
): boolean {
  return firstId(snapshot, kinds) === c.id ? legacy : false;
}

export function perDeviceLive(snapshot: RenderSnapshot, c: Pick<PlacedComponent, 'id' | 'kind'>): boolean | undefined {
  switch (c.kind) {
    case 'plc':
    case 'plc16':
      return snapshot.plcs[c.id]?.powered ??
        // Only the first *classic* PLC owns the historical io.PlcPowered flag.
        (firstId(snapshot, ['plc', 'plc16']) === c.id && c.kind === 'plc' ? snapshot.io.PlcPowered : false);
    case 'three-phase-supply': return snapshot.threePhaseSources[c.id] !== false;
    case 'star-delta-drive': return snapshot.threePhase[c.id]?.mainClosed === true;
    case 'motor': return snapshot.deviceOn[c.id] ?? legacyFor(snapshot, c, ['motor'], snapshot.motorOn);
    case 'contactor': return snapshot.deviceOn[c.id] ?? legacyFor(snapshot, c, ['contactor'], snapshot.contactorOn);
    case 'lamp': return snapshot.deviceOn[c.id] ?? legacyFor(snapshot, c, ['lamp'], snapshot.lampOn);
    case 'conveyor': return snapshot.deviceOn[c.id] ?? legacyFor(snapshot, c, ['conveyor'], snapshot.conveyorOn);
    case 'relay':
    case 'timerelay': return snapshot.deviceOn[c.id] ?? false;
    case 'stacklight': return ['R', 'Y', 'G'].some(l => snapshot.deviceOn[`${c.id}-${l}`] === true);
    case 'cylinder': return (snapshot.cylinders[c.id]?.position ?? 0) > 0;
    case 'diverter': return snapshot.deviceOn[c.id] ?? legacyFor(snapshot, c, ['diverter'], snapshot.diverterOn);
    case 'pump': return snapshot.deviceOn[c.id] ?? legacyFor(snapshot, c, ['pump'], snapshot.pumpOn);
    case 'drainvalve': return snapshot.deviceOn[c.id] ?? legacyFor(snapshot, c, ['drainvalve'], snapshot.drainOn);
    case 'breaker':
      return !(snapshot.tripped[c.id] ??
        legacyFor(snapshot, c, ['breaker'], snapshot.breakerTripped));
    case 'overload':
      return !(snapshot.tripped[c.id] ??
        legacyFor(snapshot, c, ['overload'], snapshot.overloadTripped));
    default: return undefined;
  }
}
