/**
 * Headless operator harness for grading. Everything goes through the same `tick()` the worker uses,
 * so a check observes exactly what the learner would have seen on the bench.
 */
import { createWorld, tick } from '../sim/orchestrator';
import type { Command, ProjectFile, WorldState } from '../sim/signals';

export interface Bench { world: WorldState; loadError: string | null }

/**
 * Fresh world holding `project`, with every operator control released: a learner who leaves STOP held
 * or the E-stop latched when they submit must be graded on their circuit, not on that leftover state.
 * A project the worker would reject yields `loadError`.
 */
export function loadBench(project: ProjectFile): Bench {
  const released: ProjectFile = {
    ...project,
    components: Array.isArray(project.components)
      ? project.components.map(c => (c && c.pressed ? { ...c, pressed: false } : c)) : project.components,
  };
  const world = tick(createWorld(), [{ k: 'loadProject', project: released }]).world;
  return { world, loadError: world.lastError };
}

export const scan = (w: WorldState, n = 1): WorldState => {
  for (let i = 0; i < n; i++) w = tick(w).world;
  return w;
};
export const send = (w: WorldState, ...commands: Command[]): WorldState => tick(w, commands).world;
/** Start the PLC with every operator control released. */
export const run = (w: WorldState): WorldState => send(w, { k: 'run' });
export const press = (w: WorldState, id: string, settle = 12): WorldState =>
  scan(send(w, { k: 'operate', id, pressed: true }), settle);
export const release = (w: WorldState, id: string, settle = 12): WorldState =>
  scan(send(w, { k: 'operate', id, pressed: false }), settle);
export const feed = (w: WorldState, kind: 'plain' | 'marked'): WorldState =>
  send(w, { k: 'feedParcel', kind });
/** Scan until `done` or `max` scans pass; returns the world and every state it passed through. */
export function until(w: WorldState, done: (w: WorldState) => boolean, max: number):
  { world: WorldState; trace: WorldState[]; reached: boolean } {
  const trace: WorldState[] = [];
  for (let i = 0; i < max; i++) {
    w = tick(w).world;
    trace.push(w);
    if (done(w)) return { world: w, trace, reached: true };
  }
  return { world: w, trace, reached: false };
}
