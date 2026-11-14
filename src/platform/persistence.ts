/**
 * Persistence boundary.
 *
 * The experience layer never talks to storage directly — it goes through this
 * module. v1 is local-only: assignments and results are encoded into shareable
 * strings (for links/files) and small conveniences live in localStorage.
 *
 * A later phase swaps the implementation behind these same functions for a real
 * backend (accounts, stored assignments/results) without touching the UI flows.
 */
import type { Assignment, AttemptResult } from './types';

/** Offline result codes are untrusted input, not authenticated credentials.
 * Bound every external parse BEFORE atob/JSON allocation, then validate the
 * complete versioned shape before a React component can dereference it.
 */
const MAX_ASSIGNMENT_CODE = 16_384;
const MAX_RESULT_CODE = 1_000_000;
const MAX_EVIDENCE = 400;
const isRecord = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const text = (x: unknown, max: number, allowEmpty = false): x is string =>
  typeof x === 'string' && x.length <= max && (allowEmpty || x.length > 0);
const finite = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const integer = (x: unknown, min: number, max: number): x is number =>
  Number.isSafeInteger(x) && finite(x, min, max);
const validDate = (x: unknown): x is string =>
  text(x, 45) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(x) &&
  Number.isFinite(Date.parse(x));
const validTrade = (x: unknown): boolean =>
  x === 'plc' || x === 'cctv' || x === 'bms' ||
  x === 'phone-pc' || x === 'electronics';

/** URL-safe base64 of a UTF-8 JSON payload. */
function encode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(s: string, limit: number): unknown {
  // No whitespace, mixed alphabets or illegal base64 lengths; otherwise an
  // attacker could supply large opaque text and defer failure until allocation.
  if (typeof s !== 'string' || !s.length || s.length > limit ||
      !/^[A-Za-z0-9_-]+={0,2}$/.test(s) || s.length % 4 === 1)
    throw new Error('Malformed or oversized shared code.');
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error('Shared code contains invalid encoded JSON.');
  }
}

function validAssignment(value: unknown): value is Assignment {
  if (!isRecord(value)) return false;
  return value.kind === 'skills-lab-assignment' &&
    value.formatVersion === 1 && validTrade(value.trade) &&
    text(value.exerciseId, 120) &&
    /^[A-Za-z0-9_-]+$/.test(value.exerciseId) &&
    text(value.exerciseVersion, 40) &&
    (value.mode === 'learning' || value.mode === 'assessment') &&
    integer(value.seed, 0, 1_000_000_000) &&
    (value.label === undefined || text(value.label, 250, true)) &&
    validDate(value.createdAt);
}

function validResult(value: unknown): value is AttemptResult {
  if (!isRecord(value) || value.kind !== 'skills-lab-result' ||
      value.formatVersion !== 1 || !validAssignment(value.assignment) ||
      !validDate(value.startedAt) || !validDate(value.finishedAt) ||
      Date.parse(value.finishedAt) < Date.parse(value.startedAt) ||
      !integer(value.durationMs, 0, 365 * 24 * 60 * 60 * 1000) ||
      !Array.isArray(value.evidence) || value.evidence.length > MAX_EVIDENCE ||
      !isRecord(value.rubric)) return false;
  if (!value.evidence.every((entry: unknown) =>
    isRecord(entry) && integer(entry.index, 0, 1_000_000) &&
    finite(entry.at, 0, 365 * 24 * 60 * 60 * 1000) &&
    text(entry.action, 120) && text(entry.detail, 2000, true) &&
    typeof entry.accepted === 'boolean')) return false;
  const rubric = value.rubric;
  return finite(rubric.max, 1, 100_000) &&
    finite(rubric.score, 0, rubric.max) &&
    typeof rubric.passed === 'boolean' &&
    typeof rubric.safetyHold === 'boolean' &&
    Array.isArray(rubric.criteria) && rubric.criteria.length <= 100 &&
    rubric.criteria.every((entry: unknown) =>
      isRecord(entry) && text(entry.id, 120) && text(entry.label, 250) &&
      finite(entry.max, 0, 100_000) && finite(entry.earned, 0, entry.max) &&
      text(entry.reason, 2000, true));
}

export function encodeAssignment(a: Assignment): string { return encode(a); }

export function decodeAssignment(s: string): Assignment {
  const a = decode(s.trim(), MAX_ASSIGNMENT_CODE);
  if (!validAssignment(a)) throw new Error('Not a valid EFO Skill Lab assignment.');
  return a;
}

export function encodeResult(r: AttemptResult): string { return encode(r); }

export function decodeResult(s: string): AttemptResult {
  const r = decode(s.trim(), MAX_RESULT_CODE);
  if (!validResult(r)) throw new Error('Not a valid EFO Skill Lab result.');
  return r;
}

/** Build a shareable assignment link that opens the candidate experience. */
export function assignmentLink(a: Assignment): string {
  const base =
    typeof window !== 'undefined' ? `${window.location.origin}/take` : '/take';
  return `${base}#a=${encodeAssignment(a)}`;
}

/* --- local progress (per-viewer convenience only) --- */

const PROGRESS_KEY = 'skills-lab:progress:v1';

export type ProgressMap = Record<string, { bestScore: number; attempts: number; passed: boolean }>;

export function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw || raw.length > 100_000) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    // Discard malformed entries, and never import "__proto__" as an
    // ordinary object key. Local storage may have been edited or corrupted.
    const valid: ProgressMap = Object.create(null) as ProgressMap;
    for (const [id, entry] of Object.entries(parsed)) {
      if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id) || id === '__proto__' ||
          !isRecord(entry) || !finite(entry.bestScore, 0, 100_000) ||
          !integer(entry.attempts, 0, 1_000_000) ||
          typeof entry.passed !== 'boolean') continue;
      valid[id] = { bestScore: entry.bestScore, attempts: entry.attempts, passed: entry.passed };
    }
    return valid;
  } catch {
    return {};
  }
}

export function recordProgress(exerciseId: string, score: number, passed: boolean): ProgressMap {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(exerciseId) || exerciseId === '__proto__' ||
      !finite(score, 0, 100_000)) throw new Error('Invalid exercise progress data');
  const map = loadProgress();
  const prev = map[exerciseId] ?? { bestScore: 0, attempts: 0, passed: false };
  map[exerciseId] = {
    bestScore: Math.max(prev.bestScore, score),
    attempts: prev.attempts + 1,
    passed: prev.passed || passed,
  };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — progress is a convenience, ignore */
  }
  return map;
}
