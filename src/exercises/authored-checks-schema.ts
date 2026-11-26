/**
 * R10.2 authored-check schema: the data-only shape an instructor's measurable objectives take inside a scene package, and
 * its strict parser. No engine imports here (the page parses packages); the evaluator is in `authored-checks.ts`.
 */
export type CheckTarget =
  | { kind: 'device-on'; device: string; expect: boolean }
  | { kind: 'signal'; device: string; signal: string; op: '>=' | '<=' | '==' | 'on' | 'off'; value?: number };
export type AuthoredCheck = { label: string; press?: string; pressMs?: number; afterMs: number; target: CheckTarget };
export type CheckResult = { label: string; pass: boolean; reason: string };
export const MAX_AUTHORED_CHECKS = 12;
export const MAX_CHECK_MS = 120_000;

const idOk = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,45}$/.test(v);
const nameOk = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(v);
const msOk = (v: unknown, min: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= MAX_CHECK_MS;

/** Strict shape check for untrusted package data. Returns the cleaned checks or an error message. */
export function parseAuthoredChecks(raw: unknown): { ok: true; checks: AuthoredCheck[] } | { ok: false; message: string } {
  if (raw === undefined) return { ok: true, checks: [] };
  if (!Array.isArray(raw) || raw.length > MAX_AUTHORED_CHECKS) return { ok: false, message: `Checks must be a list of at most ${MAX_AUTHORED_CHECKS}.` };
  const out: AuthoredCheck[] = [];
  for (const [i, c] of (raw as unknown[]).entries()) {
    const n = `Check ${i + 1}`;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { ok: false, message: `${n} is not an object.` };
    const o = c as Record<string, unknown>;
    for (const k of Object.keys(o)) if (!['label', 'press', 'pressMs', 'afterMs', 'target'].includes(k)) return { ok: false, message: `${n}: unknown field "${k.slice(0, 30)}".` };
    if (typeof o.label !== 'string' || !o.label.trim() || o.label.length > 120 || /[\u0000-\u001f\u007f]/.test(o.label)) return { ok: false, message: `${n}: the label must be plain text of up to 120 characters.` };
    if (o.press !== undefined && !idOk(o.press)) return { ok: false, message: `${n}: the button to press must be a device id.` };
    if (o.pressMs !== undefined && (!msOk(o.pressMs, 50) || o.press === undefined)) return { ok: false, message: `${n}: press time is 50 to ${MAX_CHECK_MS} ms and needs a button.` };
    if (!msOk(o.afterMs, 50)) return { ok: false, message: `${n}: run time is 50 to ${MAX_CHECK_MS} ms of model time.` };
    const t = o.target as Record<string, unknown> | null;
    if (!t || typeof t !== 'object' || Array.isArray(t)) return { ok: false, message: `${n}: missing target.` };
    let target: CheckTarget;
    if (t.kind === 'device-on' && idOk(t.device) && typeof t.expect === 'boolean' && Object.keys(t).every(k => ['kind', 'device', 'expect'].includes(k)))
      target = { kind: 'device-on', device: t.device, expect: t.expect };
    else if (t.kind === 'signal' && idOk(t.device) && nameOk(t.signal) && ['>=', '<=', '==', 'on', 'off'].includes(t.op as string) &&
        Object.keys(t).every(k => ['kind', 'device', 'signal', 'op', 'value'].includes(k)) &&
        ((t.op === 'on' || t.op === 'off') ? t.value === undefined : typeof t.value === 'number' && Number.isFinite(t.value) && Math.abs(t.value) <= 1e9))
      target = { kind: 'signal', device: t.device, signal: t.signal, op: t.op as '>=', ...(t.value !== undefined ? { value: t.value as number } : {}) };
    else return { ok: false, message: `${n}: the target must be a device on/off or a signal comparison.` };
    out.push({ label: o.label.trim(), ...(o.press !== undefined ? { press: o.press as string } : {}), ...(o.pressMs !== undefined ? { pressMs: o.pressMs as number } : {}), afterMs: o.afterMs as number, target });
  }
  return { ok: true, checks: out };
}

