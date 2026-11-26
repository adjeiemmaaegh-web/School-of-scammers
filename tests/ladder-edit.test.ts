import { describe, expect, it } from 'vitest';
import type { LadderDocument } from '../src/engineering/ladder';
import { clearRungClipboard, clipboardRung, copyRung, duplicateRung, emptyLadderHistory, freshRungId, HISTORY_LIMIT, insertRungCopy,
  moveRung, recordEdit, redoEdit, undoEdit } from '../src/program/ladder-edit';
import { MAX_SANDBOX_RUNGS, validateSandboxProgram } from '../src/program/p2-contract';
import { createWorld, latchProgram, tick } from '../src/sim/orchestrator';
import { executeLadder } from '../src/engineering/ladder';

const doc = (): LadderDocument => ({ id: 'p', version: '1', rungs: [
  { id: 'rung-1', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' },
  { id: 'rung-2', elements: [{ type: 'contact', tag: 'Photoeye' }], coil: 'Sort' },
] });

describe('R4.1 ladder editing operations', () => {
  it('duplicate inserts a deep copy with a fresh id right after the original', () => {
    const d = duplicateRung(doc(), 'rung-1');
    expect(d.rungs.map(r => r.id)).toEqual(['rung-1', 'rung-3', 'rung-2']);
    expect(d.rungs[1].elements).toEqual(d.rungs[0].elements);
    expect(d.rungs[1].elements).not.toBe(d.rungs[0].elements);                  // not shared
    expect(duplicateRung(doc(), 'nope')).toEqual(doc());
  });
  it('fresh ids never collide and the rung limit is respected', () => {
    expect(freshRungId(doc())).toBe('rung-3');
    let d = doc();
    for (let i = 0; i < MAX_SANDBOX_RUNGS + 5; i++) d = duplicateRung(d, 'rung-1');
    expect(d.rungs).toHaveLength(MAX_SANDBOX_RUNGS);
    expect(new Set(d.rungs.map(r => r.id)).size).toBe(MAX_SANDBOX_RUNGS);
  });
  it('move swaps scan order and stops at the ends', () => {
    expect(moveRung(doc(), 'rung-2', -1).rungs.map(r => r.id)).toEqual(['rung-2', 'rung-1']);
    expect(moveRung(doc(), 'rung-1', -1)).toEqual(doc());
    expect(moveRung(doc(), 'rung-2', 1)).toEqual(doc());
  });
  it('copy then paste works across documents, and the pasted copy is independent of later clipboard changes', () => {
    clearRungClipboard();
    expect(clipboardRung()).toBeNull();
    expect(copyRung(doc(), 'rung-2')).toBe(true);
    const other: LadderDocument = { id: 'q', version: '1', rungs: [{ id: 'rung-1', elements: [], coil: 'Run' }] };
    const pasted = insertRungCopy(other, clipboardRung()!, 'rung-1');
    expect(pasted.rungs.map(r => r.coil)).toEqual(['Run', 'Sort']);
    expect(pasted.rungs[1].id).toBe('rung-2');
    (pasted.rungs[1].elements as unknown as { type: 'contact'; tag: string }[]).push({ type: 'contact', tag: 'Start' });
    expect(clipboardRung()!.elements).toHaveLength(1);
  });
  it('undo and redo walk the bounded history, and a new edit clears redo', () => {
    let h = emptyLadderHistory(), cur = doc();
    const a = duplicateRung(cur, 'rung-1'); h = recordEdit(h, cur); cur = a;
    const b = moveRung(cur, 'rung-2', -1); h = recordEdit(h, cur); cur = b;
    let u = undoEdit(h, cur)!; expect(u.doc).toEqual(a); h = u.history; cur = u.doc;
    u = undoEdit(h, cur)!; expect(u.doc).toEqual(doc()); h = u.history; cur = u.doc;
    expect(undoEdit(h, cur)).toBeNull();
    const r = redoEdit(h, cur)!; expect(r.doc).toEqual(a); h = r.history; cur = r.doc;
    h = recordEdit(h, cur); expect(h.future).toHaveLength(0);
    let big = emptyLadderHistory();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) big = recordEdit(big, doc());
    expect(big.past).toHaveLength(HISTORY_LIMIT);
  });
  it('a copied rung whose coil is already driven writes a new local tag, so the program stays valid', () => {
    const d = duplicateRung(doc(), 'rung-1');
    expect(d.rungs[1].coil).toBe('Aux1');
    expect(d.symbols?.Aux1).toBeDefined();
    expect(validateSandboxProgram(d, undefined)).toEqual([]);
    const w = tick(createWorld(), [{ k: 'loadProgram', program: { ...latchProgram(), ...d } }]).world;
    expect(w.lastError).toBeNull();
    // a SET rung pasted next to its RESET partner keeps the shared coil (the one allowed pair)
    const pair: LadderDocument = { id: 'p', version: '1', rungs: [{ id: 'rung-1', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run', operation: { kind: 'reset' } }] };
    const withSet = insertRungCopy(pair, { id: 'x', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run', operation: { kind: 'set' } });
    expect(withSet.rungs[1].coil).toBe('Run');
    expect(validateSandboxProgram(withSet, undefined)).toEqual([]);
  });
  it('moving a rung changes the real scan result: SET then RESET leaves Run off, RESET then SET leaves it on', () => {
    const always = [{ type: 'contact' as const, tag: 'Unused', normallyClosed: true }];
    const p: LadderDocument = { id: 'p', version: '1', rungs: [
      { id: 'rung-1', elements: always, coil: 'Run', operation: { kind: 'set' } },
      { id: 'rung-2', elements: always, coil: 'Run', operation: { kind: 'reset' } },
    ] };
    expect(validateSandboxProgram(p, undefined)).toEqual([]);
    // The scan executor the worker runs for every PLC (no powered panel is needed to show scan order).
    const runAfter = (program: LadderDocument) => executeLadder(program, { Unused: false }).outputs.Run;
    expect(runAfter(p)).toBe(false);
    expect(runAfter(moveRung(p, 'rung-2', -1))).toBe(true);
  });
});
