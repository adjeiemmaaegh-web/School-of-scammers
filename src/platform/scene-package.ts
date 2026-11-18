/**
 * Declarative scene package (roadmap R10.1): a shareable, local JSON file that bundles a project (the scene, wiring,
 * program) with a title, level, objectives and hints. It is DATA ONLY: no scripts, no URLs fetched, no code evaluated,
 * unknown fields rejected, every string bounded and rendered as plain text. Import is untrusted input and goes
 * through the same project validator as any other file.
 */
export const SCENE_PACKAGE_KIND = 'efo-scene-package';
export const MAX_PACKAGE_TEXT = 1_300_000;
export type SceneLevel = 'beginner' | 'intermediate' | 'advanced';
export type ScenePackage = {
  kind: typeof SCENE_PACKAGE_KIND; formatVersion: 1; title: string; description: string; level: SceneLevel;
  objectives: string[]; hints: string[]; project: unknown;
};
export type PackageResult = { ok: true; pkg: ScenePackage } | { ok: false; message: string };

const KEYS = new Set(['kind', 'formatVersion', 'title', 'description', 'level', 'objectives', 'hints', 'project']);
const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v) ? v : null;
const list = (v: unknown, count: number, max: number): string[] | null => {
  if (!Array.isArray(v) || v.length > count) return null;
  const out: string[] = [];
  for (const item of v) { const t = text(item, max); if (t === null || t.trim() === '') return null; out.push(t); }
  return out;
};

/** Parses and validates package text. `validate` is the project validator (throws on a bad project). */
export function parseScenePackage(raw: string, validate: (project: unknown) => unknown): PackageResult {
  if (typeof raw !== 'string' || raw.length > MAX_PACKAGE_TEXT) return { ok: false, message: 'The scene package is larger than the 1.3 MB limit.' };
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return { ok: false, message: 'The scene package is not valid JSON.' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, message: 'This is not a scene package.' };
  const obj = data as Record<string, unknown>;
  if (obj.kind !== SCENE_PACKAGE_KIND) return { ok: false, message: 'This is not a scene package.' };
  if (obj.formatVersion !== 1) return { ok: false, message: 'This scene package was made by a newer version and cannot be read.' };
  for (const key of Object.keys(obj)) if (!KEYS.has(key)) return { ok: false, message: `Unknown field "${key.slice(0, 40)}": scene packages contain data only.` };
  const title = text(obj.title, 80), description = text(obj.description, 600);
  if (!title || title.trim() === '') return { ok: false, message: 'The package needs a title of up to 80 characters.' };
  if (description === null) return { ok: false, message: 'The description must be plain text of up to 600 characters.' };
  if (obj.level !== 'beginner' && obj.level !== 'intermediate' && obj.level !== 'advanced') return { ok: false, message: 'The level must be beginner, intermediate or advanced.' };
  const objectives = list(obj.objectives, 12, 200), hints = list(obj.hints, 12, 300);
  if (!objectives) return { ok: false, message: 'Objectives must be at most 12 non-empty lines of up to 200 characters.' };
  if (!hints) return { ok: false, message: 'Hints must be at most 12 non-empty lines of up to 300 characters.' };
  let project: unknown;
  try { project = validate(obj.project); } catch (e) { return { ok: false, message: `The scene's project is not valid: ${e instanceof Error ? e.message : 'invalid'}` }; }
  return { ok: true, pkg: { kind: SCENE_PACKAGE_KIND, formatVersion: 1, title: title.trim(), description, level: obj.level, objectives, hints, project } };
}

export function buildScenePackage(input: Omit<ScenePackage, 'kind' | 'formatVersion'>, validate: (project: unknown) => unknown): string {
  const candidate = JSON.stringify({ kind: SCENE_PACKAGE_KIND, formatVersion: 1, ...input, project: validate(input.project) }, null, 2);
  const parsed = parseScenePackage(candidate, validate);
  if (!parsed.ok) throw new Error(parsed.message);
  return candidate;
}
