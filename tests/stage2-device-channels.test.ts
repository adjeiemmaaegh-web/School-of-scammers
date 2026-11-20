import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot } from '../src/sim/orchestrator';
import { MAX_DEVICE_CHANNELS, readDeviceChannels } from '../src/sim/device-channels';
import type { ProjectFile, RenderSnapshot } from '../src/sim/signals';

const component = (id: string, kind: ProjectFile['components'][number]['kind']) =>
  ({ id, kind, x: 0, y: 0, pressed: false });

describe('Stage 2 per-device signal contract', () => {
  it('does not invent signals or electrical power on a blank workbench', () => {
    const world = createWorld();
    const image = readDeviceChannels(world.project, renderSnapshot(world));
    expect(image).toEqual({ channels: [], truncated: false });
    expect(world.tick).toBe(0);
  });

  it('retains independent plant boolean/numeric semantics and per-device identity', () => {
    const snapshot = renderSnapshot(createWorld());
    snapshot.plantWorld.signals['sensor-a'] = { Presence: true, DistanceMm: 125.5 };
    snapshot.plantWorld.signals['sensor-b'] = { Presence: false, DistanceMm: 45 };
    const project = { components: [
      component('sensor-a', 'motor'), component('sensor-b', 'motor'),
    ] } as Pick<ProjectFile, 'components'>;
    const image = readDeviceChannels(project, snapshot);
    expect(image.channels).toEqual([
      { kind: 'digital', source: 'plant', deviceId: 'sensor-a', endpoint: 'sensor-a.Presence', tag: 'Presence', value: true, snapshotTick: 0 },
      { kind: 'numeric', source: 'plant', deviceId: 'sensor-a', endpoint: 'sensor-a.DistanceMm', tag: 'DistanceMm', value: 125.5, connected: true, snapshotTick: 0 },
      { kind: 'digital', source: 'plant', deviceId: 'sensor-b', endpoint: 'sensor-b.Presence', tag: 'Presence', value: false, snapshotTick: 0 },
      { kind: 'numeric', source: 'plant', deviceId: 'sensor-b', endpoint: 'sensor-b.DistanceMm', tag: 'DistanceMm', value: 45, connected: true, snapshotTick: 0 },
    ]);
    expect(image.truncated).toBe(false);
  });

  it('represents disconnected analog as null (never 0 V, false or powered)', () => {
    const snapshot = renderSnapshot(createWorld());
    snapshot.plcs['plc-a'] = {
      powered: true, language: 'ladder', kind: 'plc16',
      io: { inputs: [{ terminal: 'I0.0', tag: 'Start', on: true }],
        outputs: [{ terminal: 'Q0.0', tag: 'Run', on: false }],
        analogInputs: [
          { terminal: 'AI0', tag: 'Level', value: 0, unit: 'ml', connected: false, source: null },
          { terminal: 'AI1', tag: 'Temperature', value: 23.5, unit: '°C', connected: true, source: 'probe.TEMP' },
        ] },
      inputs: { Start: true, StopOK: false, Photoeye: false, TankHigh: false, ReverseRequest: false },
      coils: {}, outputs: {}, tagValues: {}, ladderSteps: [], ladderMemory: [], fbdSteps: [], debugForces: {},
    } as unknown as RenderSnapshot['plcs'][string];
    const image = readDeviceChannels({ components: [component('plc-a', 'plc16')] }, snapshot);
    expect(image.channels.map(c => c.kind)).toEqual(['digital', 'digital', 'numeric', 'numeric']);
    const analog = image.channels.filter(c => c.kind === 'numeric');
    expect(analog[0]).toMatchObject({ value: null, connected: false, unit: 'ml' });
    expect(analog[1]).toMatchObject({ value: 23.5, connected: true, unit: '°C', origin: 'probe.TEMP' });
  });

  it('bounds a large incoming equipment image to prevent unbounded diagnostics rendering', () => {
    const snapshot = renderSnapshot(createWorld());
    snapshot.plantWorld.signals['conveyor-a'] = Object.fromEntries(
      Array.from({ length: MAX_DEVICE_CHANNELS + 40 }, (_, i) => ['S' + i, i]));
    const image = readDeviceChannels(
      { components: [component('conveyor-a', 'motor')] }, snapshot);
    expect(image.channels).toHaveLength(MAX_DEVICE_CHANNELS);
    expect(image.truncated).toBe(true);
    expect(image.channels[0].endpoint).toBe('conveyor-a.S0');
  });
});
