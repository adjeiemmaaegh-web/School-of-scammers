import { describe, expect, it } from 'vitest';
import { DemoBuilder } from '../src/plant/demos/builder';
import { COMPONENTS } from '../src/components/registry';
import { createWorld, tick } from '../src/sim/orchestrator';
import { ioOf } from '../src/sim/plc-io';
import type { Command, ProjectFile, WorldState } from '../src/sim/signals';

const ST = `VAR_INPUT M1Ai0 : REAL; M1Ai1 : REAL; END_VAR
VAR_OUTPUT M2Ao0 : REAL; M2Ao1 : REAL; END_VAR
M2Ao0 := SCALE(M1Ai0, 0.0, 10.0, 0.0, 100.0);
M2Ao1 := M1Ai1 * 10.0;`;
/** PLC16 + AI4 module (slot 1) + AO2 module (slot 2). A potentiometer feeds AI0, a second one AI1; AO0 drives a valve, AO1 a display. */
function rack(opts: { powerAi?: boolean; powerAo?: boolean } = {}): ProjectFile {
  const { powerAi = true, powerAo = true } = opts;
  const b = new DemoBuilder();
  b.place('ai', 'io-ai4', -400, 200).place('ao', 'io-ao2', 400, 200).place('pot', 'potentiometer', -400, 0).place('pot2', 'potentiometer', -300, 0)
    .place('valve', 'proportional-valve', 400, 0).place('disp', 'numeric-display', 500, 0, { decimals: 1, fullScale: 100 });
  b.power('pot').power('pot2').power('valve');
  if (powerAi) b.power('ai');
  if (powerAo) b.power('ao');
  b.wire('pot.AN_volts', 'ai.AI0'); b.wire('pot2.AN_volts', 'ai.AI1');
  b.wire('ao.AO0', 'valve.SET_openingPct'); b.wire('ao.AO1', 'disp.SET_value');
  return { ...b.build(ST), ioModules: { ai: { plc: 'plc', slot: 1 }, ao: { plc: 'plc', slot: 2 } } };
}
const load = (p: ProjectFile, extra: Command[] = []): WorldState => {
  let w = tick(createWorld(), [{ k: 'loadProject', project: p }, ...extra]).world;
  expect(w.lastError).toBeNull();
  return tick(w, [{ k: 'run' }]).world;
};
const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const sig = (w: WorldState, id: string, name: string) => w.plantWorld.signals[id]?.[name];
const turn = (w: WorldState, id: string, pct: number) => tick(w, [{ k: 'setOperator', id, key: 'positionPct', value: pct }]).world;

describe('R13 analog expansion modules (AI4 / AO2)', () => {
  it('terminals: AI4 has four analog inputs, AO2 two analog outputs, both with their own power pins', () => {
    expect(COMPONENTS['io-ai4'].terminals.filter(t => t.role === 'analog-input').map(t => t.name)).toEqual(['AI0', 'AI1', 'AI2', 'AI3']);
    expect(COMPONENTS['io-ao2'].terminals.filter(t => t.role === 'analog-output').map(t => t.name)).toEqual(['AO0', 'AO1']);
    for (const k of ['io-ai4', 'io-ao2'] as const) expect(COMPONENTS[k].terminals.map(t => t.name)).toEqual(expect.arrayContaining(['L+', 'M']));
  });
  it('attached modules add slot-numbered REAL tags to the host PLC', () => {
    const p = rack();
    const io = ioOf(p, p.components.find(c => c.id === 'plc')!);
    expect(Object.values(io.analogInputs!)).toEqual(expect.arrayContaining(['Analog0', 'Analog1', 'M1Ai0', 'M1Ai3']));
    expect(Object.values(io.analogOutputs!)).toEqual(expect.arrayContaining(['AnalogOut0', 'M2Ao0', 'M2Ao1']));
  });
  it('real behaviour: a knob through an AI module, the program, and an AO module drives a valve and a display live', () => {
    let w = scans(load(rack()), 60);
    expect(sig(w, 'valve', 'openingPct')).toBe(0);
    w = turn(w, 'pot', 60); w = turn(w, 'pot2', 40);
    w = scans(w, 250);
    expect(w.plcs.plc!.tagValues.M1Ai0 as number).toBeCloseTo(6, 0);           // 60 % of 10 V
    expect(w.plcs.plc!.tagValues.M1Ai1 as number).toBeCloseTo(4, 0);
    expect(sig(w, 'valve', 'openingPct') as number).toBeGreaterThan(58);        // SCALE(6 V, 0..10 -> 0..100)
    expect(sig(w, 'disp', 'shown') as number).toBeCloseTo(40, 0);               // 4 V x 10 through AO1
  });
  it('an unpowered AI module reads 0 V even with the knob turned, so the valve stays shut', () => {
    let w = scans(load(rack({ powerAi: false })), 20);
    w = turn(w, 'pot', 80); w = scans(w, 250);
    expect(w.plcs.plc!.tagValues.M1Ai0).toBe(0);
    expect(sig(w, 'valve', 'openingPct')).toBe(0);
  });
  it('an unpowered AO module cannot drive its load, even though the program computes a value', () => {
    let w = scans(load(rack({ powerAo: false })), 20);
    w = turn(w, 'pot', 80); w = scans(w, 250);
    expect(w.plcs.plc!.tagValues.M1Ai0 as number).toBeGreaterThan(7);           // the input side works ...
    expect(w.plcs.plc!.tagValues.M2Ao0 as number).toBeGreaterThan(70);          // ... and the program computes the output ...
    expect(sig(w, 'valve', 'openingPct')).toBe(0);                             // ... but the module has no supply
  });
  it('the PLC\'s own analog channels still work alongside the modules', () => {
    const b = new DemoBuilder();
    b.place('ai', 'io-ai4', -400, 200).place('pot', 'potentiometer', -400, 0).place('own', 'potentiometer', -300, 0);
    b.power('pot').power('own').power('ai');
    b.wire('pot.AN_volts', 'ai.AI0'); b.wire('own.AN_volts', 'plc.AI0');
    const p: ProjectFile = { ...b.build('VAR_INPUT Analog0 : REAL; M1Ai0 : REAL; END_VAR\nVAR_OUTPUT Out0 : BOOL; END_VAR\nOut0 := Analog0 > 5.0 AND M1Ai0 < 5.0;'), ioModules: { ai: { plc: 'plc', slot: 1 } } };
    let w = scans(load(p), 20);
    w = turn(w, 'own', 80); w = turn(w, 'pot', 20); w = scans(w, 200);
    expect(w.plcs.plc!.tagValues.Analog0 as number).toBeGreaterThan(7);
    expect(w.plcs.plc!.tagValues.M1Ai0 as number).toBeLessThan(3);
    expect(w.plcs.plc!.tagValues.Out0).toBe(true);
  });
});
