/** Cross-branch proof: PR #29 physical numeric feedback executes P2 bounded ST
 * functions and loops in the same worker scan, driving a wired 24V load.
 * This is an educational process model, not an analog hardware interface. */
import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const commands: Command[] = [
  { k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } },
  { k: 'place', id: 'ctrl', kind: 'plc16', at: { x: 280, y: 10 } },
  { k: 'place', id: 'tank', kind: 'tank', at: { x: 800, y: 500 } },
  { k: 'place', id: 'pump', kind: 'pump', at: { x: 850, y: 550 } },
  { k: 'wire', id: 'ps+', from: 'ps.P24', to: 'ctrl.L+' },
  { k: 'wire', id: 'ps-', from: 'ps.M0', to: 'ctrl.M' },
  { k: 'wire', id: 'pump+', from: 'ctrl.Q0.0', to: 'pump.L+' },
  { k: 'wire', id: 'pump-', from: 'ps.M0', to: 'pump.M-' },
  { k: 'wire', id: 'numeric', from: 'tank.LEVEL', to: 'ctrl.AI0' },
];
const control = [
  'VAR_INPUT', ' Analog0 : REAL;', 'END_VAR',
  'VAR_OUTPUT', ' Out0 : BOOL;', 'END_VAR',
  'VAR', ' Steps : INT := 0;', ' Clamped : REAL := 0;', 'END_VAR',
  'Steps := 0;',
  'WHILE Steps < 3 DO',
  ' Steps := Steps + 1;',
  'END_WHILE;',
  'Clamped := LIMIT(0.0, MAX(0.0, ABS(Analog0)), 1000.0);',
  'Out0 := Clamped < 220.0 AND Steps = 3;',
].join('\n');

const start = (source = control): WorldState =>
  tick(createWorld(), [...commands, { k: 'loadST', source }, { k: 'run' }]).world;
const scan = (initial: WorldState, scans: number): WorldState => {
  let world = initial;
  for (let i = 0; i < scans; i++) world = tick(world).world;
  return world;
};

describe('combined PR #29 analog I/O and P2 bounded ST execution', () => {
  it('uses actual tank measurements, WHILE, ABS/MAX/LIMIT and wired pump in the worker', () => {
    let world = start();
    expect(world.lastError).toBeNull();
    expect(world.plcs.ctrl?.powered).toBe(true);
    expect(world.plcs.ctrl.coils.Out0).toBe(true);
    expect(world.vessels.tank.levelMl).toBe(0);
    world = scan(world, 75);
    expect(world.lastError).toBeNull();
    expect(world.vessels.tank.levelMl).toBeGreaterThanOrEqual(220);
    expect(world.vessels.tank.levelMl).toBeLessThan(300);
    expect(world.plcs.ctrl.coils.Out0).toBe(false);
    expect(world.deviceOn.pump).toBe(false);
    expect(world.plcs.ctrl.tagInputs.Analog0).toBeGreaterThanOrEqual(220);
    expect(renderSnapshot(world).plcs.ctrl.io.analogInputs?.[0]).toMatchObject({
      connected: true, source: 'tank.LEVEL', unit: 'ml',
    });
    const replay = scan(start(), 75);
    expect(JSON.stringify(renderSnapshot(replay))).toBe(JSON.stringify(renderSnapshot(world)));
  });

  it('fails closed if an in-use numeric link opens mid-program', () => {
    let world = scan(start(), 5);
    expect(world.deviceOn.pump).toBe(true);
    world = tick(world, [{ k: 'injectFault', kind: 'wire-open', target: 'numeric', hidden: false }]).world;
    expect(world.running).toBe(false);
    expect(world.lastError).toMatch(/Numeric input Analog0 has no connected source/);
    expect(world.deviceOn.pump).toBeUndefined();
  });

  it('does not treat an invalid LIMIT range as a valid physical output', () => {
    const source = control.replace('LIMIT(0.0, MAX(0.0, ABS(Analog0)), 1000.0)',
      'LIMIT(500.0, MAX(0.0, ABS(Analog0)), 100.0)');
    const world = start(source);
    expect(world.running).toBe(false);
    expect(world.lastError).toMatch(/LIMIT/);
    expect(world.deviceOn.pump).toBeUndefined();
  });
});
