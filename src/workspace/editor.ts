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
  'breaker', 'overload', 'motor', 'revmotor', 'lamp', 'stacklight',
  // Orientation-aware Tier 1 material handling and square-footprint geometry sensing.
  'belt-conveyor', 'roller-conveyor', 'turntable', 'geometry-photoeye',
  'inductive-prox', 'capacitive-prox', 'light-curtain', 'weigh-cell',
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
  let result: ProjectFile = {
    ...project, components: [...project.components, ...components], wires: [...project.wires, ...wires],
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
  const parts = assertSelection(project.components, edit.ids);
  const ids = new Set(edit.ids);
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
      return { ...project, components: project.components.map(c => ids.has(c.id) ?
        { ...c, yawDeg: turn(c.yawDeg, edit.quarterTurns) } : c) };
    }
    case 'duplicate': {
      const anchor = { x: Math.min(...parts.map(c => c.x)) + edit.offset.x,
        y: Math.min(...parts.map(c => c.y)) + edit.offset.y };
      return insertFragment(project, makeFragment(project, edit.ids), anchor, edit.grid);
    }
    case 'delete': {
      let result = project;
      for (const id of edit.ids) {
        const next = removeComponent(result, id);
        if (!next) throw new Error('Selected device no longer exists: ' + id);
        result = next;
      }
      return result;
    }
    default: throw new TypeError('Unsupported workspace edit');
  }
}
