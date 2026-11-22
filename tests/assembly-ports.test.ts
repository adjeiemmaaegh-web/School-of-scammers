import { describe, expect, it } from 'vitest';
import { editWorkspace } from '../src/workspace/editor';
import { portTerminal, pruneGroups, setGroupPort, validateGroups, wireToPort } from '../src/workspace/groups';
import { removeComponent } from '../src/sim/panels';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';
import { makeFragment } from '../src/workspace/clipboard';
import type { Command, ProjectFile } from '../src/sim/signals';

const comp = (id: string, kind: string, x: number, y: number) => ({ id, kind, x, y, pressed: false } as ProjectFile['components'][number]);
/** A tiny "lamp station" assembly: a start button wired in series to a lamp, with the two outer terminals free. */
const station = (): ProjectFile => ({
  formatVersion: 1, program: { id: 'p', version: '1', rungs: [{ id: 'r', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' }] } as never,
  components: [comp('btn', 'start', 100, 100), comp('lamp', 'lamp', 200, 100), comp('ps', 'supply', 100, 300), comp('other', 'lamp', 400, 100)],
  wires: [{ id: 'w0', from: 'btn.B', to: 'lamp.L+' }],
});
const grouped = (p = station()) => editWorkspace(p, { kind: 'group', ids: ['btn', 'lamp'], name: 'lamp station' });
const withPorts = (p = grouped()) => {
  p = editWorkspace(p, { kind: 'groupPort', group: 'group-1', name: 'FEED', terminal: 'btn.A' });
  return editWorkspace(p, { kind: 'groupPort', group: 'group-1', name: 'RETURN', terminal: 'lamp.M-' });
};

describe('R14 exposed I/O of assemblies (named ports on groups)', () => {
  it('a group can publish named ports that stand for terminals of devices inside it', () => {
    const p = withPorts();
    expect(p.groups![0].ports).toEqual([{ name: 'FEED', terminal: 'btn.A' }, { name: 'RETURN', terminal: 'lamp.M-' }]);
    expect(portTerminal(p, 'group-1', 'feed')).toBe('btn.A');            // names are case-insensitive
    expect(portTerminal(p, 'group-1', 'NOPE')).toBeUndefined();
  });
  it('wiring to a port by NAME lands the wire on the internal terminal, and the project stays valid', () => {
    let p = withPorts();
    p = editWorkspace(p, { kind: 'wirePort', group: 'group-1', port: 'FEED', to: 'ps.P24' });
    p = editWorkspace(p, { kind: 'wirePort', group: 'group-1', port: 'RETURN', to: 'ps.M0' });
    expect(p.wires.slice(1).map(w => [w.from, w.to])).toEqual([['ps.P24', 'btn.A'], ['ps.M0', 'lamp.M-']]);
    expect(() => validateProject(p)).not.toThrow();
  });
  it('a wired assembly really works end to end: pressing the button lights the lamp through the ports', () => {
    let p = withPorts();
    p = editWorkspace(p, { kind: 'wirePort', group: 'group-1', port: 'FEED', to: 'ps.P24' });
    p = editWorkspace(p, { kind: 'wirePort', group: 'group-1', port: 'RETURN', to: 'ps.M0' });
    let w = tick(createWorld(), [{ k: 'loadProject', project: p }]).world;
    expect(w.lastError).toBeNull();
    w = tick(w, [{ k: 'run' }]).world;
    for (let i = 0; i < 5; i++) w = tick(w).world;
    expect(w.voltages['lamp.L+'] ?? 0).toBeLessThan(5);
    w = tick(w, [{ k: 'operate', id: 'btn', pressed: true } as Command]).world;
    for (let i = 0; i < 5; i++) w = tick(w).world;
    expect(w.voltages['lamp.L+'] ?? 0).toBeGreaterThan(20);
  });
  it('refuses a bad port: unknown terminal, a device outside the group, a bad name, a duplicate', () => {
    const g = grouped();
    const port = (name: string, terminal: string) => () => editWorkspace(g, { kind: 'groupPort', group: 'group-1', name, terminal });
    expect(port('X', 'btn.NOPE')).toThrow(/unknown terminal/);
    expect(port('X', 'other.L+')).toThrow(/inside the group/);
    expect(port('1bad', 'btn.A')).toThrow(/invalid port/);
    expect(port('bad name', 'btn.A')).toThrow(/invalid port/);
    expect(() => setGroupPort(setGroupPort(g, 'group-1', 'A', 'btn.A'), 'group-1', 'a', 'btn.B')).not.toThrow();   // same name replaces
    expect(() => validateGroups([{ id: 'g', name: 'g', members: ['btn', 'lamp'], ports: [{ name: 'A', terminal: 'btn.A' }, { name: 'a', terminal: 'btn.B' }] }], new Set(['btn', 'lamp']))).toThrow(/twice/);
    expect(() => editWorkspace(g, { kind: 'groupPort', group: 'ghost', name: 'X', terminal: 'btn.A' })).toThrow(/Unknown group/);
  });
  it('wirePort refuses to wire inside the group, to an unknown terminal, or to a missing port', () => {
    const p = withPorts();
    expect(() => wireToPort(p, 'group-1', 'FEED', 'lamp.L+')).toThrow(/OUTSIDE/);
    expect(() => wireToPort(p, 'group-1', 'FEED', 'ps.NOPE')).toThrow(/Unknown terminal/);
    expect(() => wireToPort(p, 'group-1', 'GHOST', 'ps.P24')).toThrow(/no port/);
  });
  it('removing a port, deleting its device or dissolving the group removes the port with it', () => {
    let p = withPorts();
    expect(setGroupPort(p, 'group-1', 'FEED', null).groups![0].ports).toEqual([{ name: 'RETURN', terminal: 'lamp.M-' }]);
    expect(setGroupPort(setGroupPort(p, 'group-1', 'FEED', null), 'group-1', 'RETURN', null).groups![0].ports).toBeUndefined();
    const removed = removeComponent(p, 'lamp')!;                         // the group falls below two members and dissolves
    expect(removed.groups).toBeUndefined();
    const three = editWorkspace(station(), { kind: 'group', ids: ['btn', 'lamp', 'other'], name: 'trio' });
    const set = setGroupPort(three, 'group-1', 'P', 'lamp.L+');
    const after = removeComponent(set, 'lamp')!;
    expect(after.groups![0].ports).toBeUndefined();                      // lamp is gone, so is its port; the group lives on
    expect(pruneGroups(after).groups![0].members).toEqual(['btn', 'other']);
  });
  it('copying a group copies its ports onto the fresh devices', () => {
    const p = withPorts();
    const fragment = makeFragment(p, ['btn', 'lamp']);
    expect(fragment.groups![0].ports).toHaveLength(2);
    const pasted = editWorkspace(p, { kind: 'paste', fragment, at: { x: 500, y: 300 }, grid: 1 });
    expect(pasted.groups).toHaveLength(2);
    const copy = pasted.groups![1];
    expect(copy.ports).toHaveLength(2);
    const members = new Set(copy.members);
    for (const port of copy.ports!) {
      const owner = port.terminal.slice(0, port.terminal.indexOf('.'));
      expect(members.has(owner)).toBe(true);                             // points at the COPY's devices ...
      expect(['btn', 'lamp']).not.toContain(owner);                      // ... not the originals
    }
    expect(copy.ports!.map(x => x.name)).toEqual(['FEED', 'RETURN']);
    expect(() => validateProject(pasted)).not.toThrow();
  });
  it('ports survive save and load unchanged', () => {
    const p = withPorts();
    const w = tick(createWorld(), [{ k: 'loadProject', project: JSON.parse(JSON.stringify(p)) }]).world;
    expect(w.lastError).toBeNull();
    expect(w.project.groups![0].ports).toEqual(p.groups![0].ports);
  });
});
