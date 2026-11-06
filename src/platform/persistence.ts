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

/** URL-safe base64 of a UTF-8 JSON payload. */
function encode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode<T>(s: string): T {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

export function encodeAssignment(a: Assignment): string {
  return encode(a);
}

export function decodeAssignment(s: string): Assignment {
  const a = decode<Assignment>(s.trim());
  if (a?.kind !== 'skills-lab-assignment') throw new Error('Not a valid EFO Skill Lab assignment.');
  return a;
}

export function encodeResult(r: AttemptResult): string {
  return encode(r);
}

export function decodeResult(s: string): AttemptResult {
  const r = decode<AttemptResult>(s.trim());
  if (r?.kind !== 'skills-lab-result') throw new Error('Not a valid EFO Skill Lab result.');
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
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function recordProgress(exerciseId: string, score: number, passed: boolean): ProgressMap {
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
