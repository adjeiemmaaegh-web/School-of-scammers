import type { LadderDocument } from './ladder';
export type DocumentHistory = { past: readonly LadderDocument[]; present: LadderDocument; future: readonly LadderDocument[] };
export const createHistory = (document: LadderDocument): DocumentHistory => ({past: [], present: document, future: []});
export function commitDocument(history: DocumentHistory, document: LadderDocument): DocumentHistory {
  if (JSON.stringify(document) === JSON.stringify(history.present)) return history;
  return {past: [...history.past.slice(-99), history.present], present: document, future: []};
}
export function undoDocument(history: DocumentHistory): DocumentHistory {
  if (!history.past.length) return history;
  return {past: history.past.slice(0,-1), present: history.past[history.past.length-1], future: [history.present,...history.future]};
}
export function redoDocument(history: DocumentHistory): DocumentHistory {
  if (!history.future.length) return history;
  return {past: [...history.past,history.present], present: history.future[0], future: history.future.slice(1)};
}
