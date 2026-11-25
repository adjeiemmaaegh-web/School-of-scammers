import { describe, expect, it } from 'vitest';
import { editWorkspace } from '../src/workspace/editor';
import { expandSelection, leafDevices, pruneGroups, rootGroupOf, validateGroups } from '../src/workspace/groups';
import { createWorld, tick, validateProject } from '../src/sim/orchestrator';
import { removeComponent } from '../src/sim/panels';
import type { ProjectFile } from '../src/sim/signals';

const comp = (id: string, x: number, y: number, kind = 'belt-conveyor') => ({ id, kind, x, y, pressed: false } as ProjectFile['components'][number]);
const project = (extra: Partial<ProjectFile> = {}): ProjectFile => ({
  formatVersion: 1, program: { id: 'p', version: '1', rungs: [{ id: 'r', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' }] } as never,
  components: [comp('a', 100, 100), comp('b', 200, 100), comp('c', 100, 200), comp('d', 300, 300), comp('e', 400, 100)], wires: [], ...extra,
});
const group = (p: ProjectFile, ids: string[], name = 'cell') => editWorkspace(p, { kind: 'group', ids, name });
const at = (p: ProjectFile, id: string) => { const c = p.components.find(x => x.id === id)!; return [c.x, c.y]; };

describe('R22 true grouping, hierarchy and group-wide transforms', () => {
  it('grouping records a named group; selecting any member selects the whole group', () => {
    const g = group(project(), ['a', 'b']);
    expect(g.groups).toEqual([{ id: 'group-1', name: 'cell', members: ['a', 'b'] }]);
    expect(expandSelection(g, ['a'])).toEqual(['a', 'b']);
    expect(expandSelection(g, ['c'])).toEqual(['c']);
    expect(rootGroupOf(g.groups, 'b')?.id).toBe('group-1');
  });
  it('moving one member moves the whole group, and ungrouped devices stay put', () => {
    const g = group(project(), ['a', 'b']);
    const moved = editWorkspace(g, { kind: 'translate', ids: ['a'], delta: { x: 50, y: 20 }, grid: 1 });
    expect(at(moved, 'a')).toEqual([150, 120]); expect(at(moved, 'b')).toEqual([250, 120]); expect(at(moved, 'c')).toEqual([100, 200]);
  });
  it('rotating a group turns it as one body about its centre: positions swing and each yaw turns; four turns come home', () => {
    const g = group(project(), ['a', 'b']);                           // centre (150,100), a left of b
    const once = editWorkspace(g, { kind: 'rotate', ids: ['a'], quarterTurns: 1 });
    expect(at(once, 'a')).toEqual([150, 50]); expect(at(once, 'b')).toEqual([150, 150]);
    expect(once.components.find(c => c.id === 'a')!.yawDeg).toBe(90); expect(once.components.find(c => c.id === 'b')!.yawDeg).toBe(90);
    let p = g; for (let i = 0; i < 4; i++) p = editWorkspace(p, { kind: 'rotate', ids: ['b'], quarterTurns: 1 });
    expect(at(p, 'a')).toEqual([100, 100]); expect(at(p, 'b')).toEqual([200, 100]);
    expect(editWorkspace(once, { kind: 'rotate', ids: ['a'], quarterTurns: -1 }).components.map(c => [c.x, c.y])).toEqual(g.components.map(c => [c.x, c.y]));
  });
  it('a rotation near the floor edge is shifted back onto the floor as one body, keeping the shape; a group too big to fit is refused', () => {
    const edge = project({ components: [comp('a', 0, 5), comp('b', 100, 5)] });
    const turned = editWorkspace(group(edge, ['a', 'b']), { kind: 'rotate', ids: ['a'], quarterTurns: 1 });
    for (const c of turned.components) { expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0); }
    expect(Math.abs(turned.components[0].y - turned.components[1].y)).toBe(100);          // still 100 apart, now vertically
    expect(turned.components[0].x).toBe(turned.components[1].x);
    const fits = project({ components: [comp('a', 0, 200), comp('b', 400, 200)] });
    expect(() => editWorkspace(group(fits, ['a', 'b']), { kind: 'rotate', ids: ['a'], quarterTurns: 1 })).not.toThrow();      // 400 turned is 400 tall: fits the 450 floor
    const wide = project({ components: [comp('a', 0, 200), comp('b', 900, 200)] });
    expect(() => editWorkspace(group(wide, ['a', 'b']), { kind: 'rotate', ids: ['a'], quarterTurns: 1 })).toThrow(/not fit/);   // 900 turned is 900 tall
  });
  it('groups nest: grouping a group with another device builds a hierarchy that moves and rotates together', () => {
    const inner = group(project(), ['a', 'b'], 'inner');
    const outer = group(inner, ['a', 'c'], 'outer');                  // a is in "inner": the member is the inner group itself
    expect(outer.groups!.find(g => g.name === 'outer')!.members.sort()).toEqual(['c', 'group-1']);
    expect(leafDevices(outer.groups!, 'group-2', outer.components)).toEqual(['a', 'b', 'c']);
    const moved = editWorkspace(outer, { kind: 'translate', ids: ['c'], delta: { x: 10, y: 10 }, grid: 1 });
    expect(at(moved, 'a')).toEqual([110, 110]); expect(at(moved, 'b')).toEqual([210, 110]); expect(at(moved, 'c')).toEqual([110, 210]);
    expect(at(moved, 'd')).toEqual([300, 300]);
  });
  it('ungroup dissolves only the top-level group, leaving the inner group intact', () => {
    const outer = group(group(project(), ['a', 'b'], 'inner'), ['a', 'c'], 'outer');
    const freed = editWorkspace(outer, { kind: 'ungroup', ids: ['c'] });
    expect(freed.groups).toEqual([{ id: 'group-1', name: 'inner', members: ['a', 'b'] }]);
    expect(editWorkspace(freed, { kind: 'ungroup', ids: ['a'] }).groups).toBeUndefined();
    expect(() => editWorkspace(project(), { kind: 'ungroup', ids: ['a'] })).toThrow(/not grouped/);
  });
  it('align, duplicate and delete act on the whole group too', () => {
    const g = group(project(), ['a', 'c']);
    const aligned = editWorkspace(g, { kind: 'align', ids: ['c'], mode: 'left' as never });
    expect(at(aligned, 'a')[0]).toBe(at(aligned, 'c')[0]);
    const deleted = editWorkspace(g, { kind: 'delete', ids: ['a'] });
    expect(deleted.components.map(c => c.id)).toEqual(['b', 'd', 'e']);
    expect(deleted.groups).toBeUndefined();                           // the group dissolved with its members
  });
  it('removing a device from a group of three keeps the other two grouped; removing one of two dissolves the group', () => {
    const three = group(project(), ['a', 'b', 'c']);
    const less = removeComponent(three, 'c')!;
    expect(less.groups).toEqual([{ id: 'group-1', name: 'cell', members: ['a', 'b'] }]);
    expect(removeComponent(less, 'b')!.groups).toBeUndefined();
    const nested = group(group(project(), ['a', 'b'], 'inner'), ['a', 'c'], 'outer');
    const after = removeComponent(nested, 'b')!;                      // inner group dissolves; its last member a joins the outer group
    expect(after.groups).toEqual([{ id: 'group-2', name: 'outer', members: ['a', 'c'] }]);
    expect(pruneGroups(project())).toEqual(project());
  });
  it('validation rejects cycles, unknown members, shared members, tiny groups, duplicate ids and over-deep nesting', () => {
    const ids = new Set(['a', 'b', 'c', 'd']);
    const bad = (groups: unknown) => () => validateGroups(groups, ids);
    expect(bad([{ id: 'g1', name: 'x', members: ['a'] }])).toThrow();
    expect(bad([{ id: 'g1', name: 'x', members: ['a', 'zz'] }])).toThrow(/unknown member/);
    expect(bad([{ id: 'g1', name: 'x', members: ['a', 'b'] }, { id: 'g2', name: 'y', members: ['b', 'c'] }])).toThrow(/more than one/);
    expect(bad([{ id: 'g1', name: 'x', members: ['g2', 'a'] }, { id: 'g2', name: 'y', members: ['g1', 'b'] }])).toThrow(/cycle/);
    expect(bad([{ id: 'a', name: 'x', members: ['b', 'c'] }])).toThrow();
    expect(bad([{ id: 'g1', name: 'x', members: ['a', 'b'] }, { id: 'g1', name: 'y', members: ['c', 'd'] }])).toThrow();
    const deep = [{ id: 'g1', name: '1', members: ['a', 'b'] }, { id: 'g2', name: '2', members: ['g1', 'c'] }, { id: 'g3', name: '3', members: ['g2', 'd'] }];
    expect(bad(deep)).not.toThrow();
    const ids6 = new Set(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(() => validateGroups([...deep, { id: 'g4', name: '4', members: ['g3', 'e'] }, { id: 'g5', name: '5', members: ['g4', 'f'] }], ids6)).toThrow(/at most/);
  });
  it('through the real worker: group, move, undo-able project JSON round trip, and the project validates', () => {
    let w = tick(createWorld(), [{ k: 'loadProject', project: project() }]).world;
    expect(w.lastError).toBeNull();
    w = tick(w, [{ k: 'editWorkspace', edit: { kind: 'group', ids: ['a', 'b'], name: 'cell' } }]).world;
    expect(w.lastError).toBeNull();
    expect(w.project.groups).toHaveLength(1);
    w = tick(w, [{ k: 'editWorkspace', edit: { kind: 'translate', ids: ['b'], delta: { x: 10, y: 0 }, grid: 1 } }]).world;
    expect(at(w.project, 'a')).toEqual([110, 100]);
    const reloaded = validateProject(JSON.parse(JSON.stringify(w.project)));
    expect(reloaded.groups).toEqual(w.project.groups);
    expect(() => validateProject({ ...w.project, groups: [{ id: 'g', name: 'x', members: ['a', 'nope'] }] })).toThrow();
  });
  it('duplicating or copying a group rebuilds the whole structure over new ids, nested groups included', () => {
    const nested = group(group(project(), ['a', 'b'], 'inner'), ['a', 'c'], 'outer');
    const dup = editWorkspace(nested, { kind: 'duplicate', ids: ['a'], offset: { x: 30, y: 30 }, grid: 1 });
    expect(dup.components).toHaveLength(8);                            // a, b, c copied together with d, e left alone
    expect(dup.groups).toHaveLength(4);
    const fresh = dup.groups!.filter(g => !nested.groups!.some(o => o.id === g.id));
    expect(fresh.map(g => g.name).sort()).toEqual(['inner', 'outer']);
    for (const g of fresh) for (const m of g.members) expect([...dup.components.map(c => c.id), ...dup.groups!.map(x => x.id)]).toContain(m);
    // the originals and the copies are independent: moving a copy leaves the original alone
    const copyId = dup.components.find(c => c.id.includes('copy'))!.id;
    const moved = editWorkspace(dup, { kind: 'translate', ids: [copyId], delta: { x: 40, y: 0 }, grid: 1 });
    expect(at(moved, 'a')).toEqual(at(dup, 'a'));
    expect(() => validateProject(JSON.parse(JSON.stringify(moved)))).not.toThrow();
  });
  it('a partly copied group is not copied as a group (only whole groups travel)', () => {
    const g = group(project(), ['a', 'b', 'c']);
    const fragment = editWorkspace(g, { kind: 'duplicate', ids: ['a'], offset: { x: 0, y: 0 }, grid: 1 });
    expect(fragment.groups).toHaveLength(2);                           // selecting a selects the whole group, so the whole group is copied
  });
});
