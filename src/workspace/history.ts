/** Bounded, immutable project history. Records only worker-ACKNOWLEDGED document changes. */
import type { ProjectFile } from '../sim/signals';
import type { WorkspaceHistory } from './types';

export const HISTORY_LIMIT = 40;
export const emptyHistory = (): WorkspaceHistory => ({ undo: [], redo: [] });
export function recordChange(history: WorkspaceHistory, before: ProjectFile, after: ProjectFile): WorkspaceHistory {
  if (JSON.stringify(before) === JSON.stringify(after)) return history;
  return { undo: [...history.undo, before].slice(-HISTORY_LIMIT), redo: [] };
}
export type HistoryStep = { history: WorkspaceHistory; project: ProjectFile } | null;
export function undoHistory(history: WorkspaceHistory, current: ProjectFile): HistoryStep {
  if (!history.undo.length) return null;
  const previous = history.undo[history.undo.length - 1];
  return { project: previous, history: {
    undo: history.undo.slice(0, -1),
    redo: [...history.redo, current].slice(-HISTORY_LIMIT),
  } };
}
export function redoHistory(history: WorkspaceHistory, current: ProjectFile): HistoryStep {
  if (!history.redo.length) return null;
  const next = history.redo[history.redo.length - 1];
  return { project: next, history: {
    undo: [...history.undo, current].slice(-HISTORY_LIMIT),
    redo: history.redo.slice(0, -1),
  } };
}
