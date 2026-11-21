/**
 * Pure workspace document transformations. No DOM, timers, Date or random IDs.
 * The orchestrator validates the resulting ProjectFile and commits it atomically
 * while paused; rejected edits never change the world or project history.
 */
import { isPlcKind } from '../components/registry';
import { removeComponent, MAX_COMPONENTS, MAX_SUPPLIES, MAX_WIRES } from '../sim/panels';
import { MAX_PLCS, plcComponents, withProgramOf } from '../sim/plcs';
import type { PlacedComponent, ProjectFile, Wire, XY } from '../sim/signals';
import { assertSelection } from './selection';
import { makeFragment } from './clipboard';
import { boundedGroupDelta, clampPlacement, MAX_POSITION, turn } from './geometry';
import { createGroup, expandSelection, ungroup } from './groups';
import { alignedPositions } from './align';
import type { WorkspaceEdit, WorkspaceFragment } from './types';

const NONREPEATABLE = new Set(['reversebutton', 'forwardcontactor', 'reversecontactor', 'revmotor']);
/**
 * Only equipment whose worker-owned geometry and motion honor yaw may be rotated.
 * Tier 1 conveyors and turntables have orientation-aware carry/footprints; later
 * robot and process models stay locked until their dynamics support rotation.
 */
export const ROTATABLE = new Set([
  'plc', 'plc16', 'supply', 'start', 'stop', 'estop', 'reversebutton',
  'contactor', 'forwardcontactor', 'reversecontactor', 'relay', 'timerelay',
  'breaker', 'overload', 'motor', 'revmotor', 'lamp', 'stacklight', 'selector', 'buzzer', 'siren',
  // Orientation-aware Tier 1 material handling and square-footprint geometry sensing.
  'belt-conveyor', 'roller-conveyor', 'turntable', 'curved-conveyor', 'transfer-unit', 'geometry-photoeye',
  'inductive-prox', 'capacitive-prox', 'weigh-cell',
  // P8 fixed opaque solids now have worker-validated yaw-aware intersection.
  // Unlike a moving robot, a stationary rack/vessel has no orientation-sensitive kinematics.
  'shelf', 'process-tank',
]);
const pinOwner = (pin: string): string => pin.slice(0, pin.indexOf('.'));
const remapPin = (pin: string, mapped: Map<string, string>): string =>
  mapped.get(pinOwner(pin))! + pin.slice(pin.indexOf('.'));
const uniformFit = (parts: readonly PlacedComponent[], target: XY): XY => {
  const xs = parts.map(c => c.x), ys = parts.map(c => c.y);
  const dx = target.x - Math.min(...xs), dy = target.y - Math.min(...ys);
  return boundedGroupDelta(parts, { x: dx, y: dy }, 1);
};

function insertFragment(project: ProjectFile, fragment: WorkspaceFragment, at: XY, grid: 1|5|10|25|50): ProjectFile {
  if (!fragment || fragment.version !== 1 || !Array.isArray(fragment.components) || !Array.isArray(fragment.wires))
    throw new TypeError('Invalid workspace clipboard');
  if (fragment.components.length < 1 || fragment.components.length > MAX_COMPONENTS ||
      fragment.wires.length > MAX_WIRES) throw new RangeError('Clipboard exceeds workspace capacity');
  const originalIds = fragment.components.map(c => c.id);
  if (new Set(originalIds).size !== originalIds.length) throw new Error('Duplicate clipboard device ID');
  if (project.components.length + fragment.components.length > MAX_COMPONENTS ||
      project.wires.length + fragment.wires.length > MAX_WIRES)
    throw new RangeError('Project capacity exceeded');
  const plcs = fragment.components.filter(c => isPlcKind(c.kind)).length;
  const supplies = fragment.components.filter(c => c.kind === 'supply').length;
  if (plcComponents(project).length + plcs > MAX_PLCS) throw new RangeError('Too many PLCs');
  if (project.components.filter(c => c.kind === 'supply').length + supplies > MAX_SUPPLIES)
    throw new RangeError('Too many power supplies');
  for (const kind of NONREPEATABLE) {
    if (fragment.components.filter(c => c.kind === kind).length +
      project.components.filter(c => c.kind === kind).length > 1)
      throw new Error('Only one ' + kind + ' is supported in this teaching model');
  }
  const placement = clampPlacement(at, grid);
  const delta = uniformFit(fragment.components, placement);
  const used = new Set([...project.components.map(c => c.id), ...project.wires.map(w => w.id)]);
  let next = 1;
  const freshId = (prefix: string): string => {
    let id: string;
    do { id = prefix + '-copy-' + next++; } while (used.has(id));
    used.add(id);
    return id;
  };
  const map = new Map<string, string>();
  const components = fragment.components.map(c => {
    const id = freshId(c.kind);
    map.set(c.id, id);
    return { ...c, id, x: c.x + delta.x, y: c.y + delta.y, pressed: false };
  });
  const wires: Wire[] = fragment.wires.map(w => {
    if (!map.has(pinOwner(w.from)) || !map.has(pinOwner(w.to)))
      throw new Error('Copied connections must be internal to the selection');
    return { id: freshId('wire'), from: remapPin(w.from, map), to: remapPin(w.to, map) };
  });
  const params = { ...(project.params ?? {}) };
  const plcIo = { ...(project.plcIo ?? {}) };
  for (const [old, id] of map) {
    if (fragment.params?.[old]) params[id] = { ...fragment.params[old] };
    if (fragment.plcIo?.[old]) plcIo[id] = {
      inputs: { ...fragment.plcIo[old].inputs }, outputs: { ...fragment.plcIo[old].outputs },
    };
  }
  // Copied groups are rebuilt over the fresh device ids (and fresh group ids), so a pasted structure stays one structure.
  const groupMap = new Map<string, string>();
  for (const g of fragment.groups ?? []) {
    let n = 1; const taken = new Set([...(project.groups ?? []).map(x => x.id), ...project.components.map(c => c.id), ...components.map(c => c.id), ...groupMap.values()]);
    while (taken.has('group-' + n)) n++;
    groupMap.set(g.id, 'group-' + n);
  }
  const groups = [...(project.groups ?? []), ...(fragment.groups ?? []).map(g => ({
    id: groupMap.get(g.id)!, name: g.name, members: g.members.map(m => map.get(m) ?? groupMap.get(m)!),
  }))];
  let result: ProjectFile = {
    ...project, components: [...project.components, ...components], wires: [...project.wires, ...wires],
    ...(groups.length ? { groups } : {}),
    ...(Object.keys(params).length ? { params } : {}),
    ...(Object.keys(plcIo).length ? { plcIo } : {}),
  };
  for (const original of fragment.components.filter(c => isPlcKind(c.kind))) {
    const cfg = fragment.plcPrograms?.[original.id];
    if (!cfg) throw new Error('Copied PLC is missing its program');
    result = withProgramOf(result, map.get(original.id)!, cfg);
  }
  return result;
}

export function editWorkspace(project: ProjectFile, edit: WorkspaceEdit): ProjectFile {
  if (!edit || typeof edit !== 'object') throw new TypeError('Invalid workspace edit');
  if (edit.kind === 'paste') return insertFragment(project, edit.fragment, edit.at, edit.grid);
  if (edit.kind === 'group') { assertSelection(project.components, edit.ids); return createGroup(project, edit.ids, edit.name); }
  if (edit.kind === 'ungroup') { assertSelection(project.components, edit.ids); return ungroup(project, edit.ids); }
  // Selecting any member of a group selects the whole group: every other edit acts on all of it.
  const selected = expandSelection(project, edit.ids);
  const parts = assertSelection(project.components, selected);
  const ids = new Set(selected);
  switch (edit.kind) {
    case 'translate': {
      const delta = boundedGroupDelta(parts, edit.delta, edit.grid);
      if (!delta.x && !delta.y) return project;
      return { ...project, components: project.components.map(c =>
        ids.has(c.id) ? { ...c, x: c.x + delta.x, y: c.y + delta.y } : c) };
    }
    case 'rotate': {
      if (parts.some(c => !ROTATABLE.has(c.kind)))
        throw new Error('Selected plant equipment has orientation-locked physics. Rotation is not yet supported.');
      if (edit.quarterTurns !== -1 && edit.quarterTurns !== 1) throw new RangeError('Invalid rotation');
      // A multi-device selection (a group) turns as one body: positions swing about its centre as each yaw turns.
      if (parts.length > 1) {
        const cx = (Math.min(...parts.map(c => c.x)) + Math.max(...parts.map(c => c.x))) / 2;
        const cy = (Math.min(...parts.map(c => c.y)) + Math.max(...parts.map(c => c.y))) / 2;
        const swung = new Map(parts.map(c => {
          const dx = c.x - cx, dy = c.y - cy;
          return [c.id, edit.quarterTurns === 1 ? { x: Math.round(cx - dy), y: Math.round(cy + dx) } : { x: Math.round(cx + dy), y: Math.round(cy - dx) }] as const;
        }));
        const turned = project.components.map(c => ids.has(c.id) ? { ...c, ...swung.get(c.id)!, yawDeg: turn(c.yawDeg, edit.quarterTurns) } : c);
        // Near an edge the turned group is shifted back onto the floor as one body (its shape is preserved).
        const placed = turned.filter(c => ids.has(c.id));
        const width = Math.max(...placed.map(c => c.x)) - Math.min(...placed.map(c => c.x));
        const height = Math.max(...placed.map(c => c.y)) - Math.min(...placed.map(c => c.y));
        if (width > 910 || height > 450) throw new Error('The rotated group would not fit on the floor');
        const shiftX = Math.min(0, 910 - Math.max(...placed.map(c => c.x))) + Math.max(0, -Math.min(...placed.map(c => c.x)));
        const shiftY = Math.min(0, 450 - Math.max(...placed.map(c => c.y))) + Math.max(0, -Math.min(...placed.map(c => c.y)));
        return { ...project, components: turned.map(c => ids.has(c.id) ? { ...c, x: c.x + shiftX, y: c.y + shiftY } : c) };
      }
      return { ...project, components: project.components.map(c => ids.has(c.id) ?
        { ...c, yawDeg: turn(c.yawDeg, edit.quarterTurns) } : c) };
    }
    case 'align': {
      const targets = alignedPositions(parts, edit.mode);
      if (parts.every(c => targets.get(c.id)!.x === c.x && targets.get(c.id)!.y === c.y)) return project;
      return { ...project, components: project.components.map(c => ids.has(c.id) ? { ...c, ...targets.get(c.id)! } : c) };
    }
    case 'duplicate': {
      const anchor = { x: Math.min(...parts.map(c => c.x)) + edit.offset.x,
        y: Math.min(...parts.map(c => c.y)) + edit.offset.y };
      return insertFragment(project, makeFragment(project, selected), anchor, edit.grid);
    }
    case 'delete': {
      let result = project;
      for (const id of selected) {
        const next = removeComponent(result, id);
        if (!next) throw new Error('Selected device no longer exists: ' + id);
        result = next;
      }
      return result;
    }
    default: throw new TypeError('Unsupported workspace edit');
  }
}
