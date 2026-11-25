import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot } from '../src/sim/orchestrator';
import { MAX_DEVICE_CHANNELS, channelSemantics, readDeviceChannels } from '../src/sim/device-channels';
import { sampleAnalogInputs } from '../src/sim/analog';
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

  it('reports physical expansion pins and an unpowered analog module as unavailable, not live zero', () => {
    const project = { components: [component('host', 'plc16'), component('di', 'io-di8'),
      component('ai', 'io-ai4'), component('tank', 'tank')],
      wires: [{ id: 'numeric', from: 'tank.LEVEL', to: 'ai.AI0' }] };
    const io = { inputs: {}, outputs: {}, analogInputs: { 'ai:AI0': 'Level' } };
    const readings = sampleAnalogInputs(project, { tank: { levelMl: 123 } }, 'host', io, true);
    expect(readings.points[0]).toMatchObject({ connected: true, sampled: false, value: 0 });
    const powered = sampleAnalogInputs(project, { tank: { levelMl: 123 } }, 'host', io, true,
      new Set(), undefined, id => id === 'ai');
    expect(powered.points[0]).toMatchObject({ connected: true, sampled: true, value: 123 });
    const snapshot = renderSnapshot(createWorld());
    snapshot.plcs.host = { powered: true, io: {
      inputs: [{ terminal: 'I0.0', tag: 'In0', on: true }, { terminal: 'di:I0', tag: 'Expanded', on: true }],
      outputs: [], analogInputs: readings.points,
    } } as RenderSnapshot['plcs'][string];
    const digital = readDeviceChannels(project, snapshot, 'di').channels;
    expect(digital).toHaveLength(1);
    expect(digital[0]).toMatchObject({ deviceId: 'di', controllerId: 'host', endpoint: 'di.I0', value: true });
    expect(channelSemantics(digital[0]).powerReference).toBe('module-L+-to-M');
    expect(readDeviceChannels(project, snapshot, 'host').channels).toHaveLength(3);
    const unpowered = readDeviceChannels(project, snapshot, 'ai').channels[0];
    expect(unpowered).toMatchObject({ endpoint: 'ai.AI0', connected: true, sampled: false, value: null });
    snapshot.plcs.host.io.analogInputs = powered.points;
    expect(readDeviceChannels(project, snapshot, 'ai').channels[0]).toMatchObject({ sampled: true, value: 123, unit: 'ml' });
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
