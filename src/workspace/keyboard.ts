/** Pure shortcut routing; never hijack typing in ST/LD editors or dialog controls. */
export type WorkspaceShortcut =
  | 'undo' | 'redo' | 'copy' | 'paste' | 'duplicate' | 'delete'
  | 'select-all' | 'clear-selection' | 'nudge-left' | 'nudge-right'
  | 'nudge-up' | 'nudge-down' | 'rotate-left' | 'rotate-right' | null;
export type ShortcutEvent = {
  key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean;
  targetTag?: string; isContentEditable?: boolean;
};
export function workspaceShortcut(event: ShortcutEvent): WorkspaceShortcut {
  const tag = event.targetTag?.toLowerCase();
  if (event.isContentEditable || ['input', 'textarea', 'select', 'option'].includes(tag ?? '')) return null;
  const cmd = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (cmd && !event.altKey) {
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (key === 'y') return 'redo';
    if (key === 'c') return 'copy';
    if (key === 'v') return 'paste';
    if (key === 'd') return 'duplicate';
    if (key === 'a') return 'select-all';
  }
  if (cmd || event.altKey) return null;
  if (key === 'delete' || key === 'backspace') return 'delete';
  if (key === 'escape') return 'clear-selection';
  if (key === '[') return 'rotate-left';
  if (key === ']') return 'rotate-right';
  if (key === 'arrowleft') return 'nudge-left';
  if (key === 'arrowright') return 'nudge-right';
  if (key === 'arrowup') return 'nudge-up';
  if (key === 'arrowdown') return 'nudge-down';
  return null;
}
