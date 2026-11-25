import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { COMPONENTS } from '../src/components/registry';
import type { Command, WorldState } from '../src/sim/signals';
import type { LadderDocument } from '../src/engineering/ladder';

const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x: number): Command => ({ k: 'place', id, kind, at: { x, y: 10 } });
const wire = (id: string, from: string, to: string): Command => ({ k: 'wire', id, from, to });
const scan = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const on = (w: WorldState, id: string) => renderSnapshot(w).deviceOn[id] === true;

/** supply -> selector -> alarm device -> supply common. */
function selectorCircuit(device: 'buzzer' | 'siren'): WorldState {
  const w = tick(createWorld(), [place('ps', 'supply', 10), place('sel', 'selector', 90), place('alarm', device, 170),
    wire('w1', 'ps.P24', 'sel.A'), wire('w2', 'sel.B', 'alarm.L+'), wire('w3', 'alarm.M-', 'ps.M0')]).world;
  expect(w.lastError).toBeNull();
  return tick(w, [{ k: 'run' }]).world;
}

describe('R12 operator equipment: selector switch, buzzer and alarm siren', () => {
  it('are registered with real terminals and honest descriptions', () => {
    expect(COMPONENTS.selector.terminals.map(t => t.name)).toEqual(['A', 'B']);
    for (const kind of ['buzzer', 'siren'] as const) expect(COMPONENTS[kind].terminals.map(t => t.name)).toEqual(['L+', 'M-']);
    expect(COMPONENTS.buzzer.help).toMatch(/no audio hardware/);
    expect(COMPONENTS.selector.help).toMatch(/Educational/);
  });
  it('a maintained selector latches: position 2 closes its contact and the alarm sounds only through it', () => {
    for (const device of ['buzzer', 'siren'] as const) {
      let w = scan(selectorCircuit(device), 3);
      expect(on(w, 'alarm'), `${device} silent in position 1`).toBe(false);
      w = scan(tick(w, [{ k: 'operateToggle', id: 'sel' }]).world, 3);
      expect(w.project.components.find(c => c.id === 'sel')?.pressed).toBe(true);
      expect(on(w, 'alarm'), `${device} sounds in position 2`).toBe(true);
      w = scan(w, 20); // maintained: stays in position 2 without being held
      expect(on(w, 'alarm')).toBe(true);
      w = scan(tick(w, [{ k: 'operateToggle', id: 'sel' }]).world, 3);
      expect(on(w, 'alarm'), `${device} silent again in position 1`).toBe(false);
    }
  });
  it('the alarm follows ITS OWN terminals: reversed polarity or an open wire keeps it silent', () => {
    let w = scan(tick(selectorCircuit('buzzer'), [{ k: 'operateToggle', id: 'sel' }]).world, 3);
    expect(on(w, 'alarm')).toBe(true);
    w = scan(tick(w, [{ k: 'injectFault', kind: 'wire-open', target: 'w2', hidden: false }]).world, 3);
    expect(on(w, 'alarm'), 'open wire silences the buzzer').toBe(false);
    // A wiring mistake: both alarm terminals to the same net.
    const wrong = tick(createWorld(), [place('ps', 'supply', 10), place('sel', 'selector', 90), place('alarm', 'siren', 170),
      wire('w1', 'ps.P24', 'sel.A'), wire('w2', 'sel.B', 'alarm.L+'), wire('w3', 'alarm.M-', 'sel.B')]).world;
    const ran = scan(tick(tick(wrong, [{ k: 'run' }]).world, [{ k: 'operateToggle', id: 'sel' }]).world, 3);
    expect(on(ran, 'alarm'), 'miswired siren stays silent').toBe(false);
  });
  it('a PLC output can drive a buzzer: the ladder sounds it when Start is pressed', () => {
    const program: LadderDocument = { id: 'alarm', version: '1.0', symbols: {}, rungs: [{ id: 'r', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' }] };
    let w = tick(createWorld(), [place('ps', 'supply', 10), place('plc', 'plc', 90), place('go', 'start', 170), place('bz', 'buzzer', 250),
      wire('a', 'ps.P24', 'plc.L+'), wire('b', 'ps.M0', 'plc.M'), wire('c', 'ps.P24', 'go.A'), wire('d', 'go.B', 'plc.I0.0'),
      wire('e', 'plc.Q0.0', 'bz.L+'), wire('f', 'bz.M-', 'ps.M0')]).world;
    w = tick(w, [{ k: 'loadProgram', program }, { k: 'run' }]).world;
    w = scan(w, 3);
    expect(on(w, 'bz')).toBe(false);
    w = scan(tick(w, [{ k: 'operate', id: 'go', pressed: true }]).world, 4);
    expect(on(w, 'bz'), 'PLC output energises the buzzer').toBe(true);
    w = scan(tick(w, [{ k: 'operate', id: 'go', pressed: false }]).world, 4);
    expect(on(w, 'bz')).toBe(false);
  });
  it('survive save and reload, and removal cleans up their wires', () => {
    const w = tick(selectorCircuit('siren'), [{ k: 'pause' }, { k: 'operateToggle', id: 'sel' }]).world;
    const reloaded = validateProject(JSON.parse(JSON.stringify(w.project)));
    expect(reloaded.components.map(c => c.kind).sort()).toEqual(['selector', 'siren', 'supply']);
    expect(reloaded.components.find(c => c.id === 'sel')?.pressed).toBe(true);
    const removed = tick(w, [{ k: 'remove', id: 'alarm' }]).world;
    expect(removed.project.wires.map(x => x.id)).toEqual(['w1']);
  });
  it('only selectors and pushbuttons can be operated: other devices are refused with a clear message', () => {
    const w = tick(selectorCircuit('buzzer'), [{ k: 'operateToggle', id: 'alarm' }]).world;
    expect(w.lastError).toMatch(/selector switches/);
  });
});
