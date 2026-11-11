import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { sampleAnalogInputs, analogWireError } from '../src/sim/analog';
import { solverWires } from '../src/sim/faults';
import { ioOf } from '../src/sim/plc-io';
import { compileSandboxST } from '../src/program/p2-contract';
import { namesFor } from '../src/sim/plcs';
import type { Command, WorldState } from '../src/sim/signals';

const ST = [
  'VAR_INPUT', '  Analog0 : REAL;', 'END_VAR',
  'VAR_OUTPUT', '  Out0 : BOOL;', 'END_VAR',
  'Out0 := Analog0 < 250.0;',
].join('\n');

const parts: Command[] = [
  { k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } },
  { k: 'place', id: 'ctrl', kind: 'plc16', at: { x: 280, y: 10 } },
  { k: 'place', id: 'tank', kind: 'tank', at: { x: 800, y: 500 } },
  { k: 'place', id: 'pump', kind: 'pump', at: { x: 850, y: 550 } },
];
const links: Command[] = [
  { k: 'wire', id: 'power1', from: 'ps.P24', to: 'ctrl.L+' },
  { k: 'wire', id: 'power2', from: 'ps.M0', to: 'ctrl.M' },
  { k: 'wire', id: 'power3', from: 'ctrl.Q0.0', to: 'pump.L+' },
  { k: 'wire', id: 'power4', from: 'ps.M0', to: 'pump.M-' },
  { k: 'wire', id: 'analog', from: 'tank.LEVEL', to: 'ctrl.AI0' },
];

function plant(): WorldState {
  const w = tick(createWorld(), [...parts, ...links, { k: 'loadST', source: ST }, { k: 'run' }]).world;
  expect(w.lastError).toBeNull();
  expect(w.plcs.ctrl?.powered).toBe(true);
  return w;
}
function step(w: WorldState, count: number): WorldState {
  for (let i = 0; i < count; i++) w = tick(w).world;
  return w;
}

describe('numeric process signal -> PLC16 ST input -> physical 24V output', () => {
  it('distinguishes analog terminals from 24V and stores valid links in ordinary project JSON', () => {
    const w = plant();
    expect(validateProject(w.project).wires).toEqual(w.project.wires);
    expect(solverWires(w.project)).not.toContainEqual(['tank.LEVEL', 'ctrl.AI0']);
    expect(solverWires(w.project)).toContainEqual(['ps.P24', 'ctrl.L+']);
    expect(w.project.wires.find(wire => wire.id === 'analog')).toEqual({
      id: 'analog', from: 'tank.LEVEL', to: 'ctrl.AI0',
    });
    expect(renderSnapshot(w).plcs.ctrl.io.analogInputs).toEqual([{
      terminal: 'AI0', tag: 'Analog0', value: 0, unit: 'ml', connected: true, source: 'tank.LEVEL',
    }, {
      terminal: 'AI1', tag: 'Analog1', value: 0, unit: '', connected: false, source: null,
    }]);
  });

  it('rejects numeric-to-24V wiring and a second analog driver both at edit time and on import', () => {
    const w = plant();
    const badVoltage = tick(w, [{ k: 'pause' }, { k: 'wire', id: 'wrong', from: 'ps.P24', to: 'ctrl.AI1' }]).world;
    expect(badVoltage.lastError).toMatch(/24V and numeric wires cannot mix/);
    expect(badVoltage.project.wires.some(wire => wire.id === 'wrong')).toBe(false);
    expect(() => validateProject({ ...w.project, wires: [...w.project.wires,
      { id: 'wrong', from: 'ps.P24', to: 'ctrl.AI1' }] })).toThrow(/24V and numeric wires cannot mix/);
    const more = tick(badVoltage, [{ k: 'place', id: 'tank2', kind: 'tank', at: { x: 1200, y: 500 } }]).world;
    const conflict = tick(more, [{ k: 'wire', id: 'duplicate', from: 'tank2.LEVEL', to: 'ctrl.AI0' }]).world;
    expect(conflict.lastError).toMatch(/one signal source/);
    expect(() => validateProject({ ...more.project, wires: [...more.project.wires,
      { id: 'duplicate', from: 'tank2.LEVEL', to: 'ctrl.AI0' }] })).toThrow(/one signal source/);
    expect(analogWireError('tank.LEVEL', 'ctrl.AI1', more.project.components, more.project.wires)).toBeNull();
  });

  it('accepts numeric REAL in ST but not BOOL, and never changes the digital output types', () => {
    const w = plant();
    const names = namesFor(w.project, 'ctrl');
    expect(names.numericInputs).toEqual(['Analog0', 'Analog1']);
    expect(compileSandboxST(ST, names).declarations.find(d => d.name === 'Analog0')?.type).toBe('REAL');
    expect(() => compileSandboxST(ST.replace('Analog0 : REAL', 'Analog0 : BOOL'), names))
      .toThrow(/must be REAL or LREAL/);
    expect(() => compileSandboxST(ST.replace('Out0 : BOOL', 'Out0 : REAL'), names)).toThrow(/BOOL/);
  });

  it('executes real numeric feedback: the simulated tank is filled then pump output switches off', () => {
    let w = plant();
    expect(w.plcs.ctrl.coils.Out0).toBe(true);
    expect(w.vessels.tank.levelMl).toBe(0); // process updates after PLC output scan
    w = step(w, 65);
    const level = w.vessels.tank.levelMl;
    expect(level).toBeGreaterThanOrEqual(250);
    expect(level).toBeLessThan(280);
    expect(w.plcs.ctrl.coils.Out0).toBe(false);
    expect(w.deviceOn.pump).toBe(false);
    expect(w.plcs.ctrl.tagValues.Analog0).toBeGreaterThanOrEqual(250);
    const previousLevel = level;
    w = tick(w).world;
    expect(w.plcs.ctrl.tagInputs.Analog0).toBe(previousLevel); // previous settled plant state
    expect(renderSnapshot(w).plcs.ctrl.io.analogInputs?.[0]).toMatchObject({
      tag: 'Analog0', unit: 'ml', connected: true,
    });
  });

  it('an opened numeric wire does not silently substitute a real 0 ml reading: outputs fail closed', () => {
    let w = step(plant(), 12);
    expect(w.deviceOn.pump).toBe(true);
    w = tick(w, [{ k: 'injectFault', kind: 'wire-open', target: 'analog', hidden: false }]).world;
    expect(w.running).toBe(false);
    expect(w.lastError).toMatch(/Numeric input Analog0 has no connected source/);
    expect(w.deviceOn.pump).toBeUndefined();
    expect(w.plcs.ctrl.coils.Out0).toBeUndefined();
  });

  it('two identical scan runs replay byte-identical numerical snapshots; no wall time involved', () => {
    const a = renderSnapshot(step(plant(), 75));
    const b = renderSnapshot(step(plant(), 75));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a second isolated PLC input does not get a phantom reading from another tank', () => {
    const w = plant();
    const input = sampleAnalogInputs(w.project, w.vessels, 'ctrl',
      ioOf(w.project, { id: 'ctrl', kind: 'plc16' }), true);
    expect(input.values).toEqual({ Analog0: 0, Analog1: 0 });
    expect(input.points[0].connected).toBe(true);
    expect(input.points[1].connected).toBe(false);
  });
});
