/**
 * Authoring details for exporting a project as a scene package (roadmap R10.2): description, level, objectives and
 * hints typed by the author, stored per project in this browser. Pure normalisation with the same bounds the package
 * parser enforces, so an export built from saved details always parses.
 */
import { parseAuthoredChecks, type AuthoredCheck } from '../exercises/authored-checks-schema';
export type SceneDetails = { description: string; level: 'beginner' | 'intermediate' | 'advanced'; objectives: string; hints: string; checks?: AuthoredCheck[] };
export const EMPTY_DETAILS: SceneDetails = { description: '', level: 'beginner', objectives: '', hints: '' };
const clean = (s: unknown, max: number): string => typeof s === 'string' ? s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').slice(0, max) : '';

export function normaliseDetails(raw: unknown): SceneDetails {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_DETAILS };
  const o = raw as Record<string, unknown>;
  return {
    description: clean(o.description, 600),
    level: o.level === 'intermediate' || o.level === 'advanced' ? o.level : 'beginner',
    objectives: clean(o.objectives, 12 * 201), hints: clean(o.hints, 12 * 301),
    // Invalid stored checks are dropped rather than breaking the form.
    ...(() => { const c = parseAuthoredChecks(o.checks); return c.ok && c.checks.length ? { checks: c.checks } : {}; })(),
  };
}
const lines = (text: string, count: number, max: number): string[] =>
  text.split('\n').map(l => l.trim().slice(0, max)).filter(Boolean).slice(0, count);

/** Details ready for `exportScenePackage`. A package needs at least one objective, so a default is supplied when empty. */
export function exportableDetails(d: SceneDetails, title: string) {
  const objectives = lines(d.objectives, 12, 200);
  return {
    description: d.description.trim() || `Scene "${title.slice(0, 60)}".`,
    level: d.level,
    objectives: objectives.length ? objectives : ['Describe the goal of this scene here'],
    hints: lines(d.hints, 12, 300),
    ...(d.checks?.length ? { checks: d.checks } : {}),
  };
}
const key = (id: string) => `efo-scene-details-v1:${id}`;
export const loadDetails = (id: string): SceneDetails => { try { return normaliseDetails(JSON.parse(localStorage.getItem(key(id)) ?? 'null')); } catch { return { ...EMPTY_DETAILS }; } };
export const saveDetails = (id: string, d: SceneDetails): void => { try { localStorage.setItem(key(id), JSON.stringify(normaliseDetails(d))); } catch { /* the form still works in memory */ } };
