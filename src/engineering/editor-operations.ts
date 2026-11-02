import type { LadderDocument, RungElement } from './ladder';

/** Immutable, deterministic editing commands. Invalid coordinates never mutate the program. */
export function moveElement(doc: LadderDocument, rungIndex: number, from: number, to: number): LadderDocument {
  const rung = doc.rungs[rungIndex];
  if (!rung || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= rung.elements.length || to >= rung.elements.length || from === to) return doc;
  const elements = [...rung.elements];
  const [item] = elements.splice(from, 1);
  elements.splice(to, 0, item);
  return { ...doc, rungs: doc.rungs.map((r, i) => i === rungIndex ? { ...r, elements } : r) };
}
export function insertElement(doc: LadderDocument, rungIndex: number, at: number, element: RungElement): LadderDocument {
  const rung = doc.rungs[rungIndex];
  if (!rung || !Number.isInteger(at) || at < 0 || at > rung.elements.length) return doc;
  const elements = [...rung.elements]; elements.splice(at, 0, element);
  return { ...doc, rungs: doc.rungs.map((r, i) => i === rungIndex ? { ...r, elements } : r) };
}
export function moveRung(doc: LadderDocument, from: number, to: number): LadderDocument {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= doc.rungs.length || to >= doc.rungs.length || from === to) return doc;
  const rungs = [...doc.rungs]; const [item] = rungs.splice(from, 1); rungs.splice(to, 0, item);
  return { ...doc, rungs };
}
