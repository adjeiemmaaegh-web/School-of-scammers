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
      unit?: string; connected: boolean; sampled?: boolean; origin?: string;
      source: 'plc-analog-input' | 'plant'; snapshotTick: number };

export type ChannelSemantics = {
  /** Direction is relative to the observed equipment, not a network packet. */
  readonly direction: 'input' | 'output' | 'measurement' | 'status';
  /** Signal domain is explicit so numbers cannot accidentally energize a 24 V path. */
  readonly domain: 'dc24' | 'numeric-process' | 'plant-model' | 'actuator-state';
  /** Exact provenance of this sample. A value is not inferred from 3D animation. */
  readonly provenance: 'plc-input-image' | 'plc-output-image' | 'analog-input-image' |
    'plant-model-snapshot' | 'actuator-output-image';
  /** The plant's prior settled state is sampled by PLC numeric inputs. */
  readonly timing: 'plc-scan' | 'prior-settled-plant' | 'plant-snapshot' | 'actuator-snapshot';
  readonly powerReference?: 'plc-L+-to-M';
  /** Unknown ranges and fault mechanisms stay unspecified: hidden faults must not be revealed. */
  readonly unit?: string;
};

/** Stable truthful metadata for live, read-only worker channels.
 * No custom device heuristics, safety claims, inferred electrical current or
 * hidden fault details. This metadata never affects execution or persistence.
 */
export function channelSemantics(channel: DeviceChannel): ChannelSemantics {
  switch (channel.source) {
    case 'plc-input':
      return { direction: 'input', domain: 'dc24', provenance: 'plc-input-image',
        timing: 'plc-scan', powerReference: 'plc-L+-to-M' };
    case 'plc-output':
      return { direction: 'output', domain: 'dc24', provenance: 'plc-output-image',
        timing: 'plc-scan', powerReference: 'plc-L+-to-M' };
    case 'plc-analog-input':
      return { direction: 'input', domain: 'numeric-process', provenance: 'analog-input-image',
        timing: 'prior-settled-plant', ...(channel.unit ? { unit: channel.unit } : {}) };
    case 'plant':
      return { direction: 'measurement', domain: 'plant-model', provenance: 'plant-model-snapshot',
        timing: 'plant-snapshot', ...(channel.kind === 'numeric' && channel.unit ?
          { unit: channel.unit } : {}) };
    case 'actuator':
      return { direction: 'status', domain: 'actuator-state', provenance: 'actuator-output-image',
        timing: 'actuator-snapshot' };
  }
}

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
        // The wire can remain present while the PLC is unpowered, but a
        // numeric value is not a live sample in that condition.
        value: plc.powered && io.connected && Number.isFinite(io.value) ? io.value : null,
        unit: io.unit, connected: io.connected && Number.isFinite(io.value),
        sampled: plc.powered,
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
