/** An in-memory copy of a selection. Nothing touches the OS clipboard or external storage. */
import type { ProjectFile } from '../sim/signals';
import { assertSelection } from './selection';
import type { WorkspaceFragment } from './types';
import { isPlcKind } from '../components/registry';
import { leafDevices } from './groups';
import { programOf } from '../sim/plcs';

const owner = (pin: string): string => pin.slice(0, pin.indexOf('.'));
export function makeFragment(project: ProjectFile, ids: readonly string[]): WorkspaceFragment {
  const selected = assertSelection(project.components, ids);
  const chosen = new Set(ids);
  const components = selected.map(c => ({ ...c }));
  const wires = project.wires.filter(w => chosen.has(owner(w.from)) && chosen.has(owner(w.to)))
    .map(w => ({ ...w }));
  const params = Object.fromEntries(ids.filter(id => project.params?.[id]).map(id => [id, { ...project.params![id] }]));
  const plcPrograms = Object.fromEntries(selected.filter(c => isPlcKind(c.kind))
    .map(c => [c.id, programOf(project, c.id)]));
  const plcIo = Object.fromEntries(ids.filter(id => project.plcIo?.[id])
    .map(id => [id, {
      inputs: { ...project.plcIo![id].inputs },
      outputs: { ...project.plcIo![id].outputs },
    }]));
  // Groups copy whole: a group is kept only when every device it contains is in the selection.
  const groups = (project.groups ?? []).filter(g => leafDevices(project.groups!, g.id, project.components).every(id => chosen.has(id)))
    .map(g => ({ id: g.id, name: g.name, members: [...g.members], ...(g.ports ? { ports: g.ports.map(p => ({ ...p })) } : {}) }));
  return { version: 1, components, wires,
    ...(groups.length ? { groups } : {}),
    ...(Object.keys(params).length ? { params } : {}),
    ...(Object.keys(plcPrograms).length ? { plcPrograms } : {}),
    ...(Object.keys(plcIo).length ? { plcIo } : {}),
  };
}
