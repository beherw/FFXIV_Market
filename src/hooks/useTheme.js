import { useCallback, useSyncExternalStore } from 'react';

// The initial value is applied by the inline script in index.html before first
// paint, so the page never flashes the wrong theme. This hook only reads and
// updates <html data-theme>.
export const THEME_STORAGE_KEY = 'ffxiv-theme';

const THEME_COLORS = { dark: '#0f172a', light: '#f8fafc' };

function readTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function subscribe(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark');
  const toggleTheme = useCallback(() => {
    applyTheme(readTheme() === 'light' ? 'dark' : 'light');
  }, []);
  return { theme, setTheme: applyTheme, toggleTheme };
}
