import { describe, expect, it } from 'vitest';
import { createWorld, newProject } from '../src/sim/orchestrator';
import { LEGACY_IO, defaultIo } from '../src/sim/plc-io';
import { samplePlcDigitalInputs } from '../src/sim/plc-input-image';
import { haltedSimulationWorld } from '../src/sim/phases/fail-closed';

const circuit = (...poweredTerminals: string[]) => {
  const allowed = new Set(poweredTerminals);
  return { reads24: (positive: string, negative: string) => allowed.has(positive + '|' + negative) };
};
const sensorPower = { photoeye: true, levelprobe: true };

describe('Stage 2 canonical per-controller input sampling', () => {
  it('preserves the five historic PLC input tags in fixed terminal order', () => {
    const image = samplePlcDigitalInputs('classic', LEGACY_IO, true,
      circuit('classic.I0.0|classic.M', 'classic.I0.1|classic.M', 'classic.I0.2|classic.M'), sensorPower);
    expect(image).toEqual({
      Start: true, StopOK: true, Photoeye: true, TankHigh: false, ReverseRequest: false,
    });
  });

  it('retains a positional legacy I/O mirror beside the first PLC16 mapped runtime', () => {
    const high = circuit('first.I0.0|first.M');
    const legacyMirror = samplePlcDigitalInputs('first', LEGACY_IO, true, high, sensorPower);
    const independentProgramInputs = samplePlcDigitalInputs('first', defaultIo('plc16'), true, high, sensorPower);
    expect(legacyMirror.Start).toBe(true);
    expect(independentProgramInputs.In0).toBe(true);
    expect(independentProgramInputs.Start).toBeUndefined();
  });

  it('requires a powered physical sensor even when the named input terminal is high', () => {
    const high = circuit('p.I0.2|p.M', 'p.I0.3|p.M');
    expect(samplePlcDigitalInputs('p', LEGACY_IO, true, high,
      { photoeye: false, levelprobe: false })).toMatchObject({
      Photoeye: false, TankHigh: false,
    });
    expect(samplePlcDigitalInputs('p', LEGACY_IO, true, high, sensorPower)).toMatchObject({
      Photoeye: true, TankHigh: true,
    });
  });

  it('never borrows another controller return or power, including on an isolated supply', () => {
    const inputs = { ...defaultIo('plc16'), inputs: { 'I0.0': 'Start', 'I0.1': 'Enable' } };
    const powered = circuit('p.I0.0|other.M', 'other.I0.0|other.M', 'p.I0.1|p.M');
    expect(samplePlcDigitalInputs('p', inputs, true, powered, sensorPower))
      .toEqual({ Start: false, Enable: true });
    expect(samplePlcDigitalInputs('other', inputs, false, powered, sensorPower))
      .toEqual({ Start: false, Enable: false });
  });

  it('reads expansion DI pins only against the powered module and host references', () => {
    const io = { ...defaultIo('plc16'), inputs: { 'module:I0': 'Expanded' } };
    const live = circuit('module.L+|module.M', 'module.I0|module.M');
    expect(samplePlcDigitalInputs('host', io, true, live, sensorPower)).toEqual({ Expanded: true });
    expect(samplePlcDigitalInputs('host', io, false, live, sensorPower)).toEqual({ Expanded: false });
    expect(samplePlcDigitalInputs('host', io, true, circuit('module.I0|module.M'), sensorPower)).toEqual({ Expanded: false });
    expect(samplePlcDigitalInputs('host', io, true, circuit('module.L+|module.M', 'module.I0|host.M'), sensorPower)).toEqual({ Expanded: false });
  });

  it('keeps independently renamed I/O tag identities', () => {
    const io = { ...defaultIo('plc16'), inputs: { 'I0.0': 'ConveyorReady', 'I0.5': 'MotorStop' } };
    expect(samplePlcDigitalInputs('secondary', io, true,
      circuit('secondary.I0.5|secondary.M'), sensorPower))
      .toEqual({ ConveyorReady: false, MotorStop: true });
  });
});

describe('Stage 2 one virtual fail-closed world boundary', () => {
  it('deenergizes every legacy output and secondary controller without losing the project or inputs', () => {
    const project = { ...newProject(), components: [
      { id: 'p2', kind: 'plc16' as const, x: 0, y: 0, pressed: false },
    ] };
    const world = createWorld(project);
    world.coils = { Run: true, Fill: true, Custom: true };
    world.tagValues = { ...world.tagValues, Run: true, Fill: true, Counter: 23 };
    world.plcs.p2.coils = { Out0: true };
    world.plcs.p2.tagValues = { Out0: true, Count: 7, AnalogOut0: 321 };
    world.running = true;
    world.motorOn = true;
    world.voltages = { 'p2.L+': 24 };
    world.diagnostics = ['previous'];
    const stopped = haltedSimulationWorld(world, 'simulation stopped',
      'PLC scan interrupted; simulated outputs deenergized');
    expect(stopped.running).toBe(false);
    expect(stopped.motorOn).toBe(false);
    expect(stopped.coils).toMatchObject({
      Run: false, Fill: false, Sort: false, Drain: false, Forward: false, Reverse: false,
      Custom: true,
    });
    expect(stopped.tagValues).toMatchObject({ Run: false, Fill: false, Counter: 23 });
    expect(stopped.plcs.p2.coils).toEqual({});
    expect(stopped.plcs.p2.tagValues).toMatchObject({ Out0: false, Count: 7, AnalogOut0: 0 });
    expect(stopped.voltages).toEqual({});
    expect(stopped.project).toBe(project);
    expect(stopped.diagnostics).toEqual(['previous', 'PLC scan interrupted; simulated outputs deenergized']);
    expect(world.running).toBe(true);
    expect(world.plcs.p2.coils.Out0).toBe(true);
  });

  it('retains the Worker diagnostic bound without altering historical diagnostics', () => {
    const world = createWorld();
    world.diagnostics = Array.from({ length: 40 }, (_, n) => 'message-' + n);
    const stopped = haltedSimulationWorld(world, 'worker failure', 'Worker tick interrupted; simulated outputs deenergized', 30);
    expect(stopped.diagnostics).toHaveLength(30);
    expect(stopped.diagnostics[0]).toBe('message-11');
    expect(stopped.diagnostics.at(-1)).toBe('Worker tick interrupted; simulated outputs deenergized');
    expect(world.diagnostics).toHaveLength(40);
  });
});
