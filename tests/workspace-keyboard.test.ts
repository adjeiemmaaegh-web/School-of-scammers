import { describe, expect, it } from 'vitest';
import { workspaceShortcut, type ShortcutEvent } from '../src/workspace/keyboard';
const event = (key: string, more: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...more,
});
describe('P1 workspace shortcuts', () => {
  it('routes undo/redo/copy/paste/duplicate/group select with Ctrl and Meta', () => {
    expect(workspaceShortcut(event('z', { ctrlKey: true }))).toBe('undo');
    expect(workspaceShortcut(event('Z', { metaKey: true, shiftKey: true }))).toBe('redo');
    expect(workspaceShortcut(event('c', { metaKey: true }))).toBe('copy');
    expect(workspaceShortcut(event('v', { ctrlKey: true }))).toBe('paste');
    expect(workspaceShortcut(event('d', { ctrlKey: true }))).toBe('duplicate');
    expect(workspaceShortcut(event('a', { ctrlKey: true }))).toBe('select-all');
  });
  it('supports arrows and orientation while ignoring text editor keystrokes', () => {
    expect(workspaceShortcut(event('ArrowRight'))).toBe('nudge-right');
    expect(workspaceShortcut(event('['))).toBe('rotate-left');
    expect(workspaceShortcut(event('Delete'))).toBe('delete');
    expect(workspaceShortcut(event('Delete', { targetTag: 'TEXTAREA' }))).toBeNull();
    expect(workspaceShortcut(event('v', { ctrlKey: true, targetTag: 'INPUT' }))).toBeNull();
    expect(workspaceShortcut(event('a', { ctrlKey: true, isContentEditable: true }))).toBeNull();
    expect(workspaceShortcut(event('c', { ctrlKey: true, altKey: true }))).toBeNull();
  });
});
