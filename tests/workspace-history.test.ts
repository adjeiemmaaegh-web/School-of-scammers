import { describe, expect, it } from 'vitest';
import { newProject } from '../src/sim/orchestrator';
import { HISTORY_LIMIT, emptyHistory, recordChange, undoHistory, redoHistory } from '../src/workspace/history';

describe('P1 source-only worker-acknowledged history', () => {
  const blank = newProject();
  const one = { ...blank, components: [{ id: 'm', kind: 'motor' as const, x: 10, y: 10, pressed: false }] };
  const two = { ...one, components: [...one.components, { id: 'l', kind: 'lamp' as const, x: 180, y: 10, pressed: false }] };
  it('records only real changes; undo/redo preserve exact documents', () => {
    expect(recordChange(emptyHistory(), blank, blank)).toEqual(emptyHistory());
    const history = recordChange(recordChange(emptyHistory(), blank, one), one, two);
    const undo = undoHistory(history, two)!;
    expect(undo.project).toEqual(one);
    const again = undoHistory(undo.history, one)!;
    expect(again.project).toEqual(blank);
    const redo = redoHistory(again.history, blank)!;
    expect(redo.project).toEqual(one);
    expect(recordChange(undo.history, one, two).redo).toEqual([]);
  });
  it('caps history and refuses undo/redo on empty stacks', () => {
    let h = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 12; i++) {
      const a = { ...blank, components: [...blank.components], params: { a: { delay: i } } };
      const b = { ...blank, components: [...blank.components], params: { a: { delay: i + 1 } } };
      h = recordChange(h, a, b);
    }
    expect(h.undo).toHaveLength(HISTORY_LIMIT);
    expect(undoHistory(emptyHistory(), blank)).toBeNull();
    expect(redoHistory(emptyHistory(), blank)).toBeNull();
  });
});
