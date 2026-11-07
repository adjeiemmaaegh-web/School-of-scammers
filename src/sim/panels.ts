/**
 * Editing a plant like a bench: remove a device, or drop in a ready-made starter panel.
 * Pure functions over a `ProjectFile`; the orchestrator applies them (paused only) and resets runtime.
 */
import type { LadderDocument } from '../engineering/ladder';
import { isPlcKind } from '../components/registry';
import { MAX_PLCS, extraPlcs, plcComponents, primaryPlcId, programOf, withProgramOf } from './plcs';
import type { PlacedComponent, ProjectFile, Wire, XY } from './signals';

export const MAX_COMPONENTS = 60;
export const MAX_WIRES = 250;
export const MAX_SUPPLIES = 6;

const ownsTerminal = (terminal: string, id: string) => terminal.startsWith(`${id}.`);

/**
 * Project with `id` removed, and everything that depended on it removed too: wires on its terminals,
 * faults on it or on those wires, and its PLC program. Removing the FIRST PLC promotes the next PLC:
 * its program moves into the legacy top-level fields, because those always belong to the first PLC.
 * Returns null when there is no such component.
 */
export function removeComponent(project: ProjectFile, id: string): ProjectFile | null {
  const target = project.components.find(c => c.id === id);
  if (!target) return null;
  const goneWires = new Set(project.wires.filter(w => ownsTerminal(w.from, id) || ownsTerminal(w.to, id)).map(w => w.id));
  let next: ProjectFile = {
    ...project,
    components: project.components.filter(c => c.id !== id),
    wires: project.wires.filter(w => !goneWires.has(w.id)),
  };
  if (project.faults) {
    const faults = project.faults.filter(f => f.target !== id && !(f.kind === 'wire-open' && goneWires.has(f.target)));
    const { faults: _old, ...rest } = next;
    next = faults.length ? { ...rest, faults } : rest;
  }
  if (isPlcKind(target.kind)) {
    const wasFirst = primaryPlcId(project) === id;
    const promoted = wasFirst ? extraPlcs(project)[0] : undefined;
    const remaining = { ...(project.plcPrograms ?? {}) };
    delete remaining[id];
    if (promoted) {
      const cfg = programOf(project, promoted.id);
      delete remaining[promoted.id];
      next = { ...next, program: cfg.program, language: cfg.language, stSource: cfg.stSource };
    }
    const { plcPrograms: _old, plcIo: _oldIo, ...rest } = next;
    const io = { ...(project.plcIo ?? {}) };
    delete io[id];
    next = { ...rest, ...(Object.keys(remaining).length ? { plcPrograms: remaining } : {}), ...(Object.keys(io).length ? { plcIo: io } : {}) };
  }
  return next;
}

/**
 * Panel slots on the 1080 x 580 floor: 2 columns x 2 rows. A device footprint is 170 x 130 (see
 * render/scene-coordinates), a panel is three columns by two rows of devices, so a slot is 520 x 270.
 */
const SLOT_ORIGINS: XY[] = [{ x: 10, y: 10 }, { x: 545, y: 10 }, { x: 10, y: 300 }, { x: 545, y: 300 }];
const SLOT_W = 525, SLOT_H = 270, DEVICE_W = 170, DEVICE_H = 130;
const overlaps = (c: PlacedComponent, o: XY) =>
  c.x < o.x + SLOT_W && c.x + DEVICE_W > o.x && c.y < o.y + SLOT_H && c.y + DEVICE_H > o.y;

/** Layout of one panel relative to its origin: three columns, two rows. */
export const PANEL_PARTS: readonly (readonly [PlacedComponent['kind'], number, number])[] = [
  ['supply', 0, 0], ['plc', 1, 0], ['contactor', 2, 0], ['start', 0, 1], ['stop', 1, 1], ['motor', 2, 1],
] as const;
const COLUMN_X = [0, 175, 350], ROW_Y = [0, 140];
/** The wiring of a start/stop starter, as [fromPin, toPin] pairs of `<part>.<pin>`. */
export const PANEL_LINKS: readonly (readonly [string, string])[] = [
  ['supply.P24', 'plc.L+'], ['supply.M0', 'plc.M'], ['supply.P24', 'start.A'], ['start.B', 'plc.I0.0'],
  ['supply.P24', 'stop.A'], ['stop.B', 'plc.I0.1'], ['plc.Q0.0', 'contactor.A1'], ['supply.M0', 'contactor.A2'],
  ['supply.P24', 'contactor.13'], ['contactor.14', 'motor.L+'], ['supply.M0', 'motor.M-'],
];

export type PanelPlan =
  | { ok: true; components: PlacedComponent[]; wires: Wire[]; plcId: string }
  | { ok: false; error: string };

/**
 * Plan a ready-made, pre-wired start/stop starter panel: fresh ids, a free slot on the floor (or `at`),
 * and a check against every limit. Does not touch the project.
 */
export function planStarterPanel(project: ProjectFile, at?: XY): PanelPlan {
  if (project.components.length + PANEL_PARTS.length > MAX_COMPONENTS) return { ok: false, error: 'Not enough room in the project for another panel' };
  if (project.wires.length + PANEL_LINKS.length > MAX_WIRES) return { ok: false, error: 'Not enough wire capacity for another panel' };
  if (plcComponents(project).length >= MAX_PLCS) return { ok: false, error: `At most ${MAX_PLCS} PLCs fit on this workbench` };
  if (project.components.filter(c => c.kind === 'supply').length >= MAX_SUPPLIES)
    return { ok: false, error: `At most ${MAX_SUPPLIES} 24V supplies fit on this workbench` };
  let origin = at;
  if (!origin) origin = SLOT_ORIGINS.find(o => !project.components.some(c => overlaps(c, o)));
  if (!origin) return { ok: false, error: 'No free space on the floor for another panel: remove or move a device first' };
  const taken = new Set([...project.components.map(c => c.id), ...project.wires.map(w => w.id)]);
  let n = 1;
  const idsFor = (k: number) => [...PANEL_PARTS.map(([kind]) => `${kind}-${k}`), ...PANEL_LINKS.map((_, i) => `p${k}-w${i}`)];
  while (idsFor(n).some(id => taken.has(id))) n++;
  const id = (kind: string) => `${kind}-${n}`;
  const components = PANEL_PARTS.map(([kind, col, row]): PlacedComponent => ({
    id: id(kind), kind, x: origin!.x + COLUMN_X[col], y: origin!.y + ROW_Y[row], pressed: false }));
  const wires = PANEL_LINKS.map(([from, to], i): Wire => {
    const named = (t: string) => { const [part, ...pin] = t.split('.'); return `${id(part)}.${pin.join('.')}`; };
    return { id: `p${n}-w${i}`, from: named(from), to: named(to) };
  });
  return { ok: true, components, wires, plcId: id('plc') };
}

/** Apply a plan: add the parts, the wiring and the starter program to the new PLC. */
export function withStarterPanel(project: ProjectFile, plan: Extract<PanelPlan, { ok: true }>, program: LadderDocument): ProjectFile {
  const added: ProjectFile = {
    ...project, components: [...project.components, ...plan.components], wires: [...project.wires, ...plan.wires],
  };
  return withProgramOf(added, plan.plcId, { program, language: 'ladder' });
}
