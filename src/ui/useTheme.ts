import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
const KEY = 'skills-lab:theme';

function readStored(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  // The open industrial engineering workbench defaults to its owner-approved
  // dark interface. This is only a default: explicit user-selected light/dark
  // preferences always take priority, and other routes retain system theme.
  if (typeof window !== 'undefined' && window.location.pathname === '/sandbox')
    return 'dark';
  return 'system';
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** Per-viewer theme toggle (light ⇄ dark). Falls back to system. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readStored());

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const resolved: 'light' | 'dark' =
    theme === 'system'
      ? typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  const toggle = useCallback(() => {
    setTheme((t) => {
      const current =
        t === 'system'
          ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : t;
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { theme: resolved, toggle };
}
