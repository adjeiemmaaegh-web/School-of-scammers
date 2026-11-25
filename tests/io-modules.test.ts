import { describe, expect, it } from 'vitest';
import { DemoBuilder } from '../src/plant/demos/builder';
import { COMPONENTS } from '../src/components/registry';
import { createWorld, tick } from '../src/sim/orchestrator';
import { removeComponent } from '../src/sim/panels';
import { ioOf, modulesOf } from '../src/sim/plc-io';
import type { Command, ProjectFile, WorldState } from '../src/sim/signals';

const ST = `VAR_INPUT M1In0 : BOOL; M1In1 : BOOL; END_VAR
VAR_OUTPUT M2Out0 : BOOL; M2Out1 : BOOL; END_VAR
M2Out0 := M1In0;
M2Out1 := NOT M1In1;`;
/** PLC + DI module (button on I0, switch on I1) + DO module (lamps on Q0, Q1), modules powered separately from the PLC. */
function rack(opts: { powerDi?: boolean; powerDo?: boolean; attach?: boolean } = {}): ProjectFile {
  const { powerDi = true, powerDo = true, attach = true } = opts;
  const b = new DemoBuilder();
  b.place('di', 'io-di8', -300, 0).place('do', 'io-do8', 300, 0).place('btn', 'start', -300, 200).place('sw', 'start', -200, 200)
    .place('l0', 'lamp', 300, 200).place('l1', 'lamp', 400, 200);
  if (powerDi) b.power('di');
  if (powerDo) b.power('do');
  b.wire('ps.P24', 'btn.A'); b.wire('btn.B', 'di.I0'); b.wire('ps.P24', 'sw.A'); b.wire('sw.B', 'di.I1');
  b.wire('do.Q0', 'l0.L+'); b.wire('l0.M-', 'ps.M0'); b.wire('do.Q1', 'l1.L+'); b.wire('l1.M-', 'ps.M0');
  const p = b.build(ST);
  return attach ? { ...p, ioModules: { di: { plc: 'plc', slot: 1 }, do: { plc: 'plc', slot: 2 } } } : p;
}
const load = (p: ProjectFile, extra: Command[] = []): WorldState => {
  let w = tick(createWorld(), [{ k: 'loadProject', project: p }, ...extra]).world;
  expect(w.lastError).toBeNull();
  return tick(w, [{ k: 'run' }]).world;
};
const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const lit = (w: WorldState, id: string) => (w.voltages[`${id}.L+`] ?? 0) > 20;

describe('R13 expansion I/O modules (DI8 / DO8)', () => {
  it('modules have 8 channels plus their own power pins', () => {
    expect(COMPONENTS['io-di8'].terminals.filter(t => t.role === 'input')).toHaveLength(8);
    expect(COMPONENTS['io-do8'].terminals.filter(t => t.role === 'output')).toHaveLength(8);
    expect(COMPONENTS['io-do8'].terminals.map(t => t.name)).toEqual(expect.arrayContaining(['L+', 'M']));
  });
  it('an attached module adds slot-numbered tags to its host and nothing to other PLCs', () => {
    const p = rack();
    const io = ioOf(p, p.components.find(c => c.id === 'plc')!);
    expect(Object.values(io.inputs)).toEqual(expect.arrayContaining(['In0', 'M1In0', 'M1In7']));
    expect(Object.values(io.outputs)).toEqual(expect.arrayContaining(['M2Out0', 'M2Out7']));
    expect(modulesOf(p, 'plc').map(m => [m.id, m.slot])).toEqual([['di', 1], ['do', 2]]);
  });
  it('real behaviour: a button on a DI module input reaches the program and lights a lamp on a DO module output', () => {
    let w = scans(load(rack()), 20);
    expect(lit(w, 'l0')).toBe(false);
    w = tick(w, [{ k: 'operate', id: 'btn', pressed: true }]).world;
    w = scans(w, 10);
    expect(w.plcs.plc!.tagValues.M1In0).toBe(true);
    expect(w.plcs.plc!.tagValues.M2Out0).toBe(true);
    expect(lit(w, 'l0')).toBe(true);
    w = tick(w, [{ k: 'operate', id: 'btn', pressed: false }]).world;
    w = scans(w, 10);
    expect(w.plcs.plc!.tagValues.M1In0).toBe(false);
  });
  it('an unpowered DI module reads false even with 24V on its input, and an unpowered DO module cannot light a lamp', () => {
    let w = scans(load(rack({ powerDi: false })), 5);
    w = tick(w, [{ k: 'operate', id: 'btn', pressed: true }]).world;
    w = scans(w, 10);
    expect(w.plcs.plc!.tagValues.M1In0).toBe(false);
    const dead = scans(load(rack({ powerDo: false })), 10);
    expect(lit(dead, 'l1')).toBe(false);          // M2Out1 := NOT M1In1 is TRUE, but the module has no supply
    const live = scans(load(rack()), 10);
    expect(live.plcs.plc!.tagValues.M2Out1).toBe(true);
    expect(lit(live, 'l1')).toBe(true);
  });
  it('a module with M wired but no L+ is unpowered: its inputs read false (power pins are checked on the module, not the PLC)', () => {
    const p = rack();
    const noL = { ...p, wires: p.wires.filter(w => w.to !== 'di.L+') };
    let w = scans(load(noL), 5);
    w = tick(w, [{ k: 'operate', id: 'btn', pressed: true }]).world;
    w = scans(w, 10);
    expect(w.plcs.plc!.tagValues.M1In0).toBe(false);
  });
  it('a module on its own isolated 24V supply reads against ITS return, not the PLC return', () => {
    const p = rack();
    const components = [...p.components, { id: 'ps2', kind: 'supply' as const, x: 700, y: 200, pressed: false }];
    const wires = p.wires.filter(w => !['di.L+', 'di.M', 'btn.A'].includes(w.to) && w.from !== 'ps.P24' || (w.from === 'ps.P24' && !['di.L+', 'btn.A'].includes(w.to)));
    const rewired = [...wires.filter(w => w.to !== 'di.M'), { id: 'x1', from: 'ps2.P24', to: 'di.L+' }, { id: 'x2', from: 'ps2.M0', to: 'di.M' }, { id: 'x3', from: 'ps2.P24', to: 'btn.A' }];
    let w = scans(load({ ...p, components, wires: rewired }), 5);
    w = tick(w, [{ k: 'operate', id: 'btn', pressed: true }]).world;
    w = scans(w, 10);
    expect(w.plcs.plc!.tagValues.M1In0).toBe(true);
  });
  it('an unattached module is inert: the program cannot name its tags', () => {
    const p = rack({ attach: false });
    const w = tick(createWorld(), [{ k: 'loadProject', project: p }]).world;
    expect(w.lastError).not.toBeNull();             // the ST program names M1In0 which does not exist yet
  });
  it('attachIoModule attaches, refuses a fifth slot, and refuses a detach that would break a program', () => {
    const b = new DemoBuilder();
    for (let i = 0; i < 5; i++) b.place(`m${i}`, 'io-di8', -400 + i * 100, 0);
    let w = tick(createWorld(), [{ k: 'loadProject', project: b.build('VAR_INPUT In0 : BOOL; END_VAR VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := In0;') }]).world;
    for (let i = 0; i < 4; i++) { w = tick(w, [{ k: 'attachIoModule', module: `m${i}`, plc: 'plc' }]).world; expect(w.lastError).toBeNull(); }
    expect(modulesOf(w.project, 'plc').map(m => m.slot)).toEqual([1, 2, 3, 4]);
    w = tick(w, [{ k: 'attachIoModule', module: 'm4', plc: 'plc' }]).world;
    expect(w.lastError).toMatch(/at most 4/);
    // A program that reads M1In0 stops the module from being detached.
    const st = 'VAR_INPUT M1In0 : BOOL; END_VAR VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := M1In0;';
    const w2 = tick(w, [{ k: 'loadST', source: st }]).world;
    expect(w2.lastError).toBeNull();
    {
      const w3 = tick(w2, [{ k: 'attachIoModule', module: 'm0', plc: null }]).world;
      expect(w3.lastError).toMatch(/Cannot change expansion modules/);
      expect(modulesOf(w3.project, 'plc')).toHaveLength(4);
    }
  });
  it('rejects a project whose module links are wrong (host not a PLC16, duplicate slot, bad slot)', () => {
    const p = rack();
    for (const bad of [{ di: { plc: 'ps', slot: 1 } }, { di: { plc: 'plc', slot: 1 }, do: { plc: 'plc', slot: 1 } }, { di: { plc: 'plc', slot: 9 } }, { btn: { plc: 'plc', slot: 1 } }]) {
      const w = tick(createWorld(), [{ k: 'loadProject', project: { ...p, ioModules: bad } as unknown as ProjectFile }]).world;
      expect(w.lastError).not.toBeNull();
    }
  });
  it('removing a module or its host drops the link', () => {
    const p = rack();
    expect(removeComponent(p, 'di')!.ioModules).toEqual({ do: { plc: 'plc', slot: 2 } });
    expect(removeComponent(p, 'plc')!.ioModules).toBeUndefined();
  });
});
