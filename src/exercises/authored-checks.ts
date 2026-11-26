/**
 * R10.2 / R9.4 authored checks: measurable objectives an instructor builds in the app and ships inside a scene package.
 * DATA ONLY (no code, no expressions): each check optionally holds one pushbutton for a time, runs the learner's own project
 * through the real `tick()` for a stated model time, then compares one published value. Any working design passes; nothing
 * looks at how the learner wired or programmed it. Educational self-check, not an authenticated assessment.
 */
import { createWorld, renderSnapshot, tick } from '../sim/orchestrator';
import { validateProject } from '../sim/project-validation';
import { scanMsOf } from '../sim/scan-config';
import type { ProjectFile, WorldState } from '../sim/signals';
import type { AuthoredCheck, CheckResult, CheckTarget } from './authored-checks-schema';
export * from './authored-checks-schema';

const describeTarget = (t: CheckTarget) => t.kind === 'device-on' ? `${t.device} ${t.expect ? 'on' : 'off'}`
  : t.op === 'on' || t.op === 'off' ? `${t.device}.${t.signal} ${t.op.toUpperCase()}` : `${t.device}.${t.signal} ${t.op} ${t.value}`;

/** Run one check on a fresh copy of the project (checks never affect each other or the learner's world). */
export function runAuthoredCheck(project: ProjectFile, check: AuthoredCheck): CheckResult {
  let w: WorldState;
  try { w = tick(createWorld(validateProject(project)), [{ k: 'run' }]).world; }
  catch (e) { return { label: check.label, pass: false, reason: `The project could not run: ${e instanceof Error ? e.message : 'invalid project'}` }; }
  if (w.lastError) return { label: check.label, pass: false, reason: `The project could not run: ${w.lastError}` };
  const ids = new Set(w.project.components.map(c => c.id));
  if (check.press && !ids.has(check.press)) return { label: check.label, pass: false, reason: `The project has no device ${check.press} to press.` };
  if (!ids.has(check.target.device)) return { label: check.label, pass: false, reason: `The project has no device ${check.target.device}.` };
  const scan = scanMsOf(w.project), scans = Math.ceil(check.afterMs / scan), pressScans = check.press ? Math.ceil((check.pressMs ?? check.afterMs) / scan) : 0;
  if (check.press) w = tick(w, [{ k: 'operate', id: check.press, pressed: true }]).world;
  for (let i = 1; i < scans; i++) {
    w = tick(w, check.press && i === pressScans ? [{ k: 'operate', id: check.press, pressed: false }] : []).world;
    if (!w.running) break;
  }
  const snap = renderSnapshot(w), t = check.target, at = `after ${(check.afterMs / 1000).toFixed(1)} s`;
  if (t.kind === 'device-on') {
    const on = snap.deviceOn[t.device] === true;
    return { label: check.label, pass: on === t.expect, reason: `${t.device} was ${on ? 'on' : 'off'} ${at} (expected ${t.expect ? 'on' : 'off'}).` };
  }
  const v = snap.plantWorld.signals[t.device]?.[t.signal];
  if (typeof v !== 'boolean' && typeof v !== 'number') return { label: check.label, pass: false, reason: `${t.device} publishes no signal ${t.signal}.` };
  const n = typeof v === 'boolean' ? (v ? 1 : 0) : v;
  const pass = t.op === 'on' ? n === 1 : t.op === 'off' ? n === 0 : t.op === '>=' ? n >= t.value! : t.op === '<=' ? n <= t.value! : n === t.value;
  return { label: check.label, pass, reason: `${t.device}.${t.signal} was ${typeof v === 'boolean' ? (v ? 'ON' : 'OFF') : Math.round(n * 1000) / 1000} ${at} (wanted ${describeTarget(t)}).` };
}
export const runAuthoredChecks = (project: ProjectFile, checks: readonly AuthoredCheck[]): CheckResult[] => checks.map(c => runAuthoredCheck(project, c));
