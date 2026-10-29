// Light / dark / follow-the-phone. Stored per device; tokens.css reads
// <html data-theme>, and with no attribute it follows prefers-color-scheme.

export type Theme = 'system' | 'light' | 'dark';
export const THEMES: Theme[] = ['system', 'light', 'dark'];
const STORAGE_KEY = 'dineamite.theme';
// Keep in sync with --c-paper in tokens.css.
const PAPER = { light: '#F8F5F0', dark: '#191614' } as const;

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage unavailable
  }
  return 'system';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  // The status bar colour comes from the media-scoped theme-color metas; pin
  // both to the chosen paper so the bar matches the app, not the phone.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.media.includes('dark') ? 'dark' : 'light';
    m.content = PAPER[theme === 'system' ? scheme : theme];
  });
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable
  }
}
