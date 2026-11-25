/**
 * Live operator settings (R12/R19). Knobs, selectors and held buttons are turned while the simulation runs, so they cannot use
 * `setParam` (which needs the project paused). The value is kept in the running world and merged over the saved device
 * settings each scan; an operator can only touch the settings listed here, never an equipment parameter such as a bore.
 */
import type { ProjectFile } from './signals';

export const OPERATOR_KINDS: ReadonlySet<string> = new Set(['potentiometer', 'selector-3pos', 'operator-station']);
export const OPERATOR_KEYS: ReadonlySet<string> = new Set(['positionPct', 'position', 'startPressed', 'stopPressed', 'resetPressed']);

/** The project with live operator values laid over its saved settings (the same object when there are none). */
export function withOperatorValues(project: ProjectFile, live: Record<string, Record<string, number>> | undefined): ProjectFile {
  if (!live || !Object.keys(live).length) return project;
  const params = { ...(project.params ?? {}) };
  for (const [id, values] of Object.entries(live)) {
    if (!project.components.some(c => c.id === id)) continue;
    params[id] = { ...(params[id] ?? {}), ...values };
  }
  return { ...project, params };
}
