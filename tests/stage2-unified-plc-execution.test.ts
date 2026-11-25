import { describe, expect, it } from 'vitest';
import { createWorld, SCAN_MS, tick } from '../src/sim/orchestrator';
import { LEGACY_IO, defaultIo, namesOf } from '../src/sim/plc-io';
import { defaultProgramFor, freshPlcRuntime, programOf, scanPlc, type PlcExecution } from '../src/sim/plcs';
import type { PlcRuntime, WorldState } from '../src/sim/signals';

const idle = {
  Start: false, StopOK: true, Photoeye: false, TankHigh: false, ReverseRequest: false,
};
const priorOf = (w: WorldState): PlcRuntime => ({
  powered: w.powered, inputs: w.inputs, tagInputs: { ...w.inputs }, analogInputs: [],
  coils: w.coils, tagValues: w.tagValues, ladderMemory: w.ladderMemory,
  ladderNumeric: w.ladderNumeric, ladderSteps: w.ladderSteps,
  stCompiled: w.stCompiled, stMemory: w.stMemory,
  fbdMemory: w.fbdMemory, fbdSteps: w.fbdSteps,
});

describe('Stage 2 one PLC execution path for classic and configurable controllers', () => {
  it('the authoritative first classic PLC mirrors the same Ladder scan result as scanPlc', () => {
    let before = tick(createWorld(), [{ k: 'addPanel', template: 'motor-starter' }]).world;
    const first = before.project.components.find(c => c.kind === 'plc')!;
    const start = before.project.components.find(c => c.kind === 'start')!;
    before = tick(before, [{ k: 'run' }]).world;
    const active = tick(before, [{ k: 'operate', id: start.id, pressed: true }]).world;
    const executed: PlcExecution[] = [];
    const independent = scanPlc(programOf(before.project, first.id), LEGACY_IO, priorOf(before),
      { ...active.inputs }, true, SCAN_MS, [], before.debugForces[first.id] ?? {},
      result => executed.push(result));
    expect(active.inputs.Start).toBe(true);
    expect(active.coils.Run).toBe(true);
    expect(independent.coils).toEqual(active.coils);
    expect(independent.ladderMemory).toEqual(active.ladderMemory);
    expect(independent.ladderNumeric).toEqual(active.ladderNumeric);
    expect(independent.ladderSteps).toEqual(active.ladderSteps);
    expect(executed).toHaveLength(1);
    expect(executed[0].language).toBe('ladder');
  });

  it('exposes the executed result for all three interpreters without scanning twice', () => {
    for (const language of ['ladder', 'st', 'fbd'] as const) {
      const cfg = { ...defaultProgramFor('plc'), language };
      const execution: PlcExecution[] = [];
      const runtime = scanPlc(cfg, LEGACY_IO, freshPlcRuntime(cfg, namesOf(LEGACY_IO)),
        { ...idle, Start: true }, true, SCAN_MS, [], {},
        result => execution.push(result));
      expect(runtime.powered).toBe(true);
      expect(execution.map(x => x.language)).toEqual([language]);
      expect(execution[0].result).toBeDefined();
    }
  });

  it('does not fire interpreter callbacks for an unpowered controller', () => {
    const cfg = defaultProgramFor('plc');
    const execution: PlcExecution[] = [];
    const runtime = scanPlc(cfg, LEGACY_IO, freshPlcRuntime(cfg), idle,
      false, SCAN_MS, [], {}, result => execution.push(result));
    expect(runtime.coils).toEqual({});
    expect(execution).toEqual([]);
  });

  it('still runs a configurable PLC16 through the same scan without borrowing classic tag names', () => {
    const io = defaultIo('plc16');
    const cfg = defaultProgramFor('plc16', io);
    const execution: PlcExecution[] = [];
    const runtime = scanPlc(cfg, io, freshPlcRuntime(cfg, namesOf(io)),
      { In0: true }, true, SCAN_MS, [], {}, result => execution.push(result));
    expect(runtime.coils.Out0).toBe(true);
    expect(runtime.coils.Run).toBeUndefined();
    expect(execution.map(x => x.language)).toEqual(['ladder']);
  });
});
