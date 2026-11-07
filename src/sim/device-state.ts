/** One place that answers "is this device live?" per component, so cards, 3D and inspector agree. */
import type { PlacedComponent, RenderSnapshot } from './signals';

/**
 * Live state of components that exist in several copies (PLC, contactor, motor, lamp). Falls back to the
 * legacy first-device flags before the first scan has populated the per-device maps. Undefined for
 * every other kind: those have their own single-instance state.
 */
export function perDeviceLive(snapshot: RenderSnapshot, c: Pick<PlacedComponent, 'id' | 'kind'>): boolean | undefined {
  switch (c.kind) {
    case 'plc': return snapshot.plcs[c.id]?.powered ?? snapshot.io.PlcPowered;
    case 'motor': return snapshot.deviceOn[c.id] ?? snapshot.motorOn;
    case 'contactor': return snapshot.deviceOn[c.id] ?? snapshot.contactorOn;
    case 'lamp': return snapshot.deviceOn[c.id] ?? snapshot.lampOn;
    default: return undefined;
  }
}
