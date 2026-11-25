import { describe, expect, it } from 'vitest';
import { DemoBuilder } from '../src/plant/demos/builder';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';
import { ioOf, moduleDiagnostics } from '../src/sim/plc-io';
import type { Command, ProjectFile, WorldState } from '../src/sim/signals';

const ST = `VAR_INPUT M1In0 : BOOL; END_VAR
VAR_OUTPUT M2Out0 : BOOL; END_VAR
M2Out0 := M1In0;`;
function rack(opts: { powerDi?: boolean; powerDo?: boolean; attach?: boolean; st?: string } = {}): ProjectFile {
  const { powerDi = true, powerDo = true, attach = true, st = ST } = opts;
  const b = new DemoBuilder();
  b.place('di', 'io-di8', -300, 0).place('do', 'io-do8', 300, 0).place('btn', 'start', -300, 200).place('lamp', 'lamp', 300, 200);
  if (powerDi) b.power('di');
  if (powerDo) b.power('do');
  b.wire('ps.P24', 'btn.A'); b.wire('btn.B', 'di.I0'); b.wire('do.Q0', 'lamp.L+'); b.wire('lamp.M-', 'ps.M0');
  const p = b.build(st);
  return attach ? { ...p, ioModules: { di: { plc: 'plc', slot: 1 }, do: { plc: 'plc', slot: 2 } } } : p;
}
const load = (p: ProjectFile): WorldState => { const w = tick(createWorld(), [{ k: 'loadProject', project: p }]).world; expect(w.lastError).toBeNull(); return w; };
const send = (w: WorldState, ...c: Command[]) => tick(w, c).world;
const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };

describe('R13 module alarms', () => {
  it('an attached, powered module raises nothing', () => {
    const w = scans(send(load(rack()), { k: 'run' }), 5);
    expect(w.diagnostics.filter(d => /Expansion module/.test(d))).toEqual([]);
  });
  it('an unpowered module is reported with its host and slot, and only that module', () => {
    const w = scans(send(load(rack({ powerDi: false })), { k: 'run' }), 5);
    const alarms = w.diagnostics.filter(d => /Expansion module/.test(d));
    expect(alarms).toHaveLength(1);
    expect(alarms[0]).toMatch(/di \(slot 1 of plc\) is not powered/);
  });
  it('a module that is not attached to any PLC is reported', () => {
    const w = scans(send(load(rack({ attach: false, st: 'VAR_INPUT In0 : BOOL; END_VAR VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := In0;' })), { k: 'run' }), 5);
    expect(w.diagnostics.filter(d => /is not attached to a PLC/.test(d))).toHaveLength(2);
  });
  it('the diagnostic is a pure function of the project and the supply check', () => {
    const p = rack();
    expect(moduleDiagnostics(p, () => true)).toEqual([]);
    expect(moduleDiagnostics(p, id => id !== 'do')).toEqual([expect.stringMatching(/do \(slot 2 of plc\)/)]);
  });
});

describe('R13 module channel names', () => {
  const renamed = (w: WorldState) => ioOf(w.project, w.project.components.find(c => c.id === 'plc')!);
  it('a channel can be given your own name; the program uses it and the default name is gone', () => {
    let w: WorldState;
    w = load(rack());
    w = send(w, { k: 'renameModuleTag', module: 'di', tag: 'M1In0', name: 'StartBtn' });
    expect(w.lastError).toMatch(/break a program/);                                    // the running program still reads M1In0
    w = send(w, { k: 'loadST', source: 'VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := FALSE;' });                 // a program that does not read the channel
    w = send(w, { k: 'renameModuleTag', module: 'di', tag: 'M1In0', name: 'StartBtn' });
    expect(w.lastError).toBeNull();
    expect(Object.values(renamed(w).inputs)).toContain('StartBtn'); expect(Object.values(renamed(w).inputs)).not.toContain('M1In0');
    expect(w.project.ioModules!.di.names).toEqual({ M1In0: 'StartBtn' });
  });
  it('works end to end: a renamed input drives a renamed output through the real scan', () => {
    let w = load(rack({ st: 'VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := FALSE;' }));
    w = send(w, { k: 'renameModuleTag', module: 'di', tag: 'M1In0', name: 'StartBtn' }, { k: 'renameModuleTag', module: 'do', tag: 'M2Out0', name: 'Lamp' });
    expect(w.lastError).toBeNull();
    w = send(w, { k: 'loadST', source: 'VAR_INPUT StartBtn : BOOL; END_VAR VAR_OUTPUT Lamp : BOOL; END_VAR Lamp := StartBtn;' }, { k: 'run' });
    expect(w.lastError).toBeNull();
    w = scans(send(w, { k: 'operate', id: 'btn', pressed: true }), 5);
    expect(w.plcs.plc!.tagValues.StartBtn).toBe(true); expect(w.plcs.plc!.tagValues.Lamp).toBe(true);
    expect((w.voltages['lamp.L+'] ?? 0) > 20).toBe(true);
  });
  it('refuses bad names: invalid, reserved, duplicate of another tag, and not a channel of that module', () => {
    let w = send(load(rack({ st: 'VAR_INPUT M1In0 : BOOL; END_VAR VAR_OUTPUT M2Out0 : BOOL; END_VAR M2Out0 := FALSE;' })));
    const bad = (cmd: Command, re: RegExp) => { const r = send(w, cmd); expect(r.lastError).toMatch(re); expect(r.project.ioModules!.di.names).toBeUndefined(); };
    bad({ k: 'renameModuleTag', module: 'di', tag: 'M1In0', name: '1bad' }, /not a valid tag name/);
    bad({ k: 'renameModuleTag', module: 'di', tag: 'M1In0', name: 'TRUE' }, /not a valid tag name/);
    bad({ k: 'renameModuleTag', module: 'di', tag: 'M1In0', name: 'In0' }, /already used/);              // a tag of the PLC itself
    bad({ k: 'renameModuleTag', module: 'di', tag: 'M1In0', name: 'm1in1' }, /already used/);             // another channel, any case
    bad({ k: 'renameModuleTag', module: 'di', tag: 'M2Out0', name: 'X' }, /not a channel of di/);
    bad({ k: 'renameModuleTag', module: 'di', tag: 'Nope', name: 'X' }, /not a channel of di/);
    expect(send(w, { k: 'renameModuleTag', module: 'ghost', tag: 'M1In0', name: 'X' }).lastError).toMatch(/Attach the module/);
    w = send(w, { k: 'renameModuleTag', module: 'di', tag: 'M1In0', name: 'M1In0' });                       // renaming to the same name is a no-op, not an error
    expect(w.lastError).toBeNull();
  });
  it('null restores the default; a name can be reused after the channel is renamed away', () => {
    let w = load(rack({ st: 'VAR_INPUT M1In0 : BOOL; END_VAR VAR_OUTPUT M2Out0 : BOOL; END_VAR M2Out0 := FALSE;' }));
    w = send(w, { k: 'loadST', source: 'VAR_OUTPUT M2Out0 : BOOL; END_VAR M2Out0 := FALSE;' });
    w = send(w, { k: 'renameModuleTag', module: 'di', tag: 'M1In0', name: 'Go' });
    expect(w.lastError).toBeNull();
    w = send(w, { k: 'renameModuleTag', module: 'di', tag: 'M1In1', name: 'M1In0' });                      // the freed default name is available
    expect(w.lastError).toBeNull();
    w = send(w, { k: 'renameModuleTag', module: 'di', tag: 'M1In1', name: null });
    w = send(w, { k: 'renameModuleTag', module: 'di', tag: 'M1In0', name: null });
    expect(w.project.ioModules!.di.names).toBeUndefined();
    expect(Object.values(renamed(w).inputs)).toContain('M1In0');
  });
  it('names persist in the saved project and a duplicate saved name is rejected on load', () => {
    const p = rack({ st: 'VAR_INPUT Go : BOOL; END_VAR VAR_OUTPUT M2Out0 : BOOL; END_VAR M2Out0 := Go;' });
    p.ioModules!.di.names = { M1In0: 'Go' };
    const ok = validateProject(JSON.parse(JSON.stringify(p)));
    expect(ok.ioModules!.di.names).toEqual({ M1In0: 'Go' });
    const dup = rack(); dup.ioModules!.di.names = { M1In0: 'In0' };
    expect(() => validateProject(dup)).toThrow(/used twice/);
    const junk = rack(); (junk.ioModules!.di as { names: unknown }).names = ['x'];
    expect(() => validateProject(junk)).toThrow(/invalid channel names/);
  });
  it('analog channels can be renamed too, and the REAL tag type is kept', () => {
    const b = new DemoBuilder();
    b.place('ai', 'io-ai4', -300, 0).place('pot', 'potentiometer', -300, 200); b.power('ai').power('pot'); b.wire('pot.AN_volts', 'ai.AI0');
    const p: ProjectFile = { ...b.build('VAR_INPUT M1Ai0 : REAL; END_VAR VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := FALSE;'), ioModules: { ai: { plc: 'plc', slot: 1 } } };
    let w = load(p);
    w = send(w, { k: 'loadST', source: 'VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := FALSE;' }, { k: 'renameModuleTag', module: 'ai', tag: 'M1Ai0', name: 'Level' });
    expect(w.lastError).toBeNull();
    w = send(w, { k: 'loadST', source: 'VAR_INPUT Level : REAL; END_VAR VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := Level > 3.0;' }, { k: 'run' });
    expect(w.lastError).toBeNull();
    w = scans(send(w, { k: 'setOperator', id: 'pot', key: 'positionPct', value: 80 }), 200);
    expect(w.plcs.plc!.tagValues.Level as number).toBeGreaterThan(7); expect(w.plcs.plc!.tagValues.Out0).toBe(true);
  });
});
