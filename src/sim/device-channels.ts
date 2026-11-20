/**
 * Stage 2 / R3.5: read-only, per-device typed signal image.
 *
 * This is an adapter over authoritative worker snapshots, NOT an independent
 * I/O simulator. In particular, analog process values remain numeric with a
 * connected/disconnected state: they are never coerced into 24 V booleans.
 * Unknown plant engineering units are intentionally not guessed.
 */
import type { ProjectFile, RenderSnapshot } from './signals';
import { deviceIntegrationContract } from './device-contract';

export const MAX_DEVICE_CHANNELS = 512;
export type DeviceChannel =
  | { kind: 'digital'; deviceId: string; endpoint: string; tag: string; value: boolean;
      source: 'plc-input' | 'plc-output' | 'plant' | 'actuator'; snapshotTick: number }
  | { kind: 'numeric'; deviceId: string; endpoint: string; tag: string; value: number | null;
      unit?: string; connected: boolean; origin?: string; source: 'plc-analog-input' | 'plant'; snapshotTick: number };

export type ChannelImage = { channels: DeviceChannel[]; truncated: boolean };

/** One stable, bounded signal list in component order and channel order.
 * No project mutation, runtime stepping, electrical inference or clock reads. */
export function readDeviceChannels(
  project: Pick<ProjectFile, 'components'>,
  snapshot: Pick<RenderSnapshot, 'tick' | 'plcs' | 'deviceOn' | 'plantWorld'>,
  /** Optional selected equipment scope; prevents global channel caps hiding later devices. */
  deviceId?: string,
): ChannelImage {
  const channels: DeviceChannel[] = [];
  let truncated = false;
  const append = (item: DeviceChannel) => {
    if (channels.length < MAX_DEVICE_CHANNELS) channels.push(item);
    else truncated = true;
  };
  for (const part of project.components) {
    if (deviceId !== undefined && part.id !== deviceId) continue;
    const plc = snapshot.plcs[part.id];
    if ((part.kind === 'plc' || part.kind === 'plc16') && plc) {
      for (const io of plc.io.inputs) append({
        kind: 'digital', source: 'plc-input', deviceId: part.id, endpoint: part.id + '.' + io.terminal,
        tag: io.tag, value: io.on, snapshotTick: snapshot.tick,
      });
      for (const io of plc.io.outputs) append({
        kind: 'digital', source: 'plc-output', deviceId: part.id, endpoint: part.id + '.' + io.terminal,
        tag: io.tag, value: io.on, snapshotTick: snapshot.tick,
      });
      for (const io of plc.io.analogInputs ?? []) append({
        kind: 'numeric', source: 'plc-analog-input', deviceId: part.id,
        endpoint: part.id + '.' + io.terminal, tag: io.tag,
        value: io.connected && Number.isFinite(io.value) ? io.value : null,
        unit: io.unit, connected: io.connected && Number.isFinite(io.value),
        ...(io.source ? { origin: io.source } : {}), snapshotTick: snapshot.tick,
      });
    }
    // These readings are the physical equipment model's actual reported image,
    // not a fabricated sensor state derived from an animation or a PLC command.
    const plant = snapshot.plantWorld.signals[part.id];
    if (plant) for (const [tag, reading] of Object.entries(plant)) {
      if (typeof reading === 'boolean') append({
        kind: 'digital', source: 'plant', deviceId: part.id, endpoint: part.id + '.' + tag,
        tag, value: reading, snapshotTick: snapshot.tick,
      });
      else if (typeof reading === 'number' && Number.isFinite(reading)) {
        // Plant engineering units come ONLY from its registered signal definition.
        // Do not guess units from signal names or treat numeric readings as 24V.
        const spec = deviceIntegrationContract(part.kind).plant?.signals.find(signal =>
          signal.name === tag && signal.kind === 'number');
        append({
          kind: 'numeric', source: 'plant', deviceId: part.id, endpoint: part.id + '.' + tag,
          tag, value: reading, connected: true,
          ...(spec?.unit ? { unit: spec.unit } : {}), snapshotTick: snapshot.tick,
        });
      }
    }
    if (Object.prototype.hasOwnProperty.call(snapshot.deviceOn, part.id)) append({
      kind: 'digital', source: 'actuator', deviceId: part.id, endpoint: part.id + '.energized',
      tag: 'Energized', value: snapshot.deviceOn[part.id] === true, snapshotTick: snapshot.tick,
    });
  }
  return { channels, truncated };
}
