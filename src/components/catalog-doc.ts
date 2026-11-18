/**
 * Generates the device catalogue document from the executable registries (roadmap R6.1/R10.3), so the documentation
 * of every placeable kind (terminals, plant model, settings, injectable faults) cannot drift from the code.
 * `UPDATE_DEVICE_CATALOG=1 npx vitest run tests/device-catalog-doc.test.ts` rewrites docs/product/DEVICE_CATALOG.md; a unit test fails if the committed file is stale.
 */
import { COMPONENTS, type ComponentKind } from './registry';
import { paramSpecsOf } from './params';
import { EQUIPMENT } from '../plant/equipment';
import { FAULT_KINDS, FAULT_LABEL, faultTargetOptions } from '../sim/faults';
import type { FaultKind, ProjectFile } from '../sim/signals';

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function deviceCatalogMarkdown(): string {
  const plant = new Map(EQUIPMENT.map(e => [e.kind, e]));
  const rows: string[] = [];
  const kinds = Object.keys(COMPONENTS).sort() as ComponentKind[];
  for (const kind of kinds) {
    const def = COMPONENTS[kind];
    const project = { formatVersion: 1, components: [{ id: 'x', kind, x: 0, y: 0, pressed: false }], wires: [], program: { id: 'p', version: '1', rungs: [] } } as unknown as ProjectFile;
    const electricalFaults = FAULT_KINDS.filter(k => k !== 'wire-open' && faultTargetOptions(project, k as FaultKind).length > 0).map(k => FAULT_LABEL[k as FaultKind]);
    const model = plant.get(kind);
    const settings = [...paramSpecsOf(kind), ...(model?.params ?? [])].map(p => `${p.label} (${p.min}–${p.max} ${p.unit}, default ${p.default})`);
    const terminals = def.terminals.map(t => t.name).join(' ');
    rows.push(`| \`${kind}\` | ${esc(def.label)} | ${def.terminals.length ? esc(terminals) : '—'} | ${model ? 'yes' : 'no'} | ${esc(settings.join('; ') || '—')} | ${esc([...electricalFaults, ...(model?.faults ?? [])].join('; ') || '—')} |`);
  }
  const withModel = kinds.filter(k => plant.has(k)).length;
  return [
    '# Device catalogue (generated)',
    '',
    '**Generated from the code (`UPDATE_DEVICE_CATALOG=1 npx vitest run tests/device-catalog-doc.test.ts`); do not edit by hand.** A unit test fails when this file is stale.',
    'Educational simplifications only: nothing here is a calibrated, certified or safety-rated model. See `DEVICE_CONTRACT.md` for how a device is built.',
    '',
    `${kinds.length} placeable kinds; ${withModel} have a plant (motion/sensing) model, ${kinds.length - withModel} are electrical or legacy only.`,
    '',
    '| Kind | Label | Terminals | Plant model | Settings | Injectable faults |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
