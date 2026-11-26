/**
 * R4.1 Ladder editing operations: duplicate, copy/paste, move and a bounded undo/redo history. Pure functions over the
 * `LadderDocument` the worker validates; nothing here executes logic. A pasted rung keeps its tags: if a tag does not exist on
 * the target PLC, the worker's normal program validation refuses the edit with the usual message.
 */
import type { LadderDocument, Rung } from '../engineering/ladder';
import { MAX_SANDBOX_RUNGS } from './p2-contract';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A rung id not used by the document (`rung-N`). */
export function freshRungId(doc: LadderDocument): string {
  let n = 1;
  while (doc.rungs.some(r => r.id === `rung-${n}`)) n++;
  return `rung-${n}`;
}
/** True when one more rung writing `coil` with `kind` would break the one-writer rule (only a single SET/RESET pair may share). */
export function coilTaken(doc: LadderDocument, coil: string, kind: string): boolean {
  const others = doc.rungs.filter(r => r.coil === coil).map(r => r.operation?.kind ?? 'coil');
  if (!others.length) return false;
  return !(others.length === 1 && (kind === 'set' || kind === 'reset') && (others[0] === 'set' || others[0] === 'reset') && others[0] !== kind);
}
/** A local BOOL tag name not used anywhere in the document (`AuxN`). */
function freshAuxTag(doc: LadderDocument): string {
  const used = new Set<string>([...Object.keys(doc.symbols ?? {}), ...doc.rungs.map(r => r.coil),
    ...doc.rungs.flatMap(r => r.elements.flatMap(e => e.type === 'contact' ? [e.tag] : e.alternatives.flat().map(c => c.tag)))]);
  let n = 1;
  while (used.has(`Aux${n}`)) n++;
  return `Aux${n}`;
}
/**
 * Insert a copy of `rung` (with a fresh id) after `afterId`, or at the end. Unchanged when the rung limit is reached.
 * When the copy's coil is already written by another rung, the copy writes a new local BOOL tag instead, so the program
 * stays valid (two rungs may not drive the same output) and the learner re-targets it deliberately.
 */
export function insertRungCopy(doc: LadderDocument, rung: Rung, afterId?: string): LadderDocument {
  if (doc.rungs.length >= MAX_SANDBOX_RUNGS) return doc;
  const copy: Rung = { ...clone(rung), id: freshRungId(doc) };
  if (coilTaken(doc, copy.coil, copy.operation?.kind ?? 'coil')) {
    const aux = freshAuxTag(doc);
    copy.coil = aux;
    doc = { ...doc, symbols: { ...doc.symbols, [aux]: { description: 'Local BOOL output of a copied rung' } } };
  }
  const at = afterId === undefined ? doc.rungs.length : doc.rungs.findIndex(r => r.id === afterId) + 1;
  const index = at <= 0 ? doc.rungs.length : at;
  return { ...doc, rungs: [...doc.rungs.slice(0, index), copy, ...doc.rungs.slice(index)] };
}
export const duplicateRung = (doc: LadderDocument, id: string): LadderDocument => {
  const rung = doc.rungs.find(r => r.id === id);
  return rung ? insertRungCopy(doc, rung, id) : doc;
};
/** Move a rung one place up (-1) or down (+1); scan order is rung order, so this changes behaviour. */
export function moveRung(doc: LadderDocument, id: string, direction: -1 | 1): LadderDocument {
  const i = doc.rungs.findIndex(r => r.id === id), j = i + direction;
  if (i < 0 || j < 0 || j >= doc.rungs.length) return doc;
  const rungs = [...doc.rungs];
  [rungs[i], rungs[j]] = [rungs[j], rungs[i]];
  return { ...doc, rungs };
}

/** One shared rung clipboard, so a rung copied on one PLC can be pasted into another PLC's program. */
let clipboard: Rung | null = null;
export const copyRung = (doc: LadderDocument, id: string): boolean => {
  const rung = doc.rungs.find(r => r.id === id);
  if (rung) clipboard = clone(rung);
  return !!rung;
};
export const clipboardRung = (): Rung | null => clipboard ? clone(clipboard) : null;
export const clearRungClipboard = (): void => { clipboard = null; };

/** Bounded undo/redo history of whole documents. */
export const HISTORY_LIMIT = 50;
export interface LadderHistory { past: LadderDocument[]; future: LadderDocument[] }
export const emptyLadderHistory = (): LadderHistory => ({ past: [], future: [] });
/** Record `current` before an edit replaces it. */
export const recordEdit = (h: LadderHistory, current: LadderDocument): LadderHistory =>
  ({ past: [...h.past, current].slice(-HISTORY_LIMIT), future: [] });
export function undoEdit(h: LadderHistory, current: LadderDocument): { history: LadderHistory; doc: LadderDocument } | null {
  const doc = h.past[h.past.length - 1];
  return doc ? { history: { past: h.past.slice(0, -1), future: [current, ...h.future].slice(0, HISTORY_LIMIT) }, doc } : null;
}
export function redoEdit(h: LadderHistory, current: LadderDocument): { history: LadderHistory; doc: LadderDocument } | null {
  const doc = h.future[0];
  return doc ? { history: { past: [...h.past, current].slice(-HISTORY_LIMIT), future: h.future.slice(1) }, doc } : null;
}
