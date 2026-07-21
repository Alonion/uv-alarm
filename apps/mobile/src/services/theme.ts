import type { AccentPreference, ThemePreference } from '../models';

export function applyTheme(theme: ThemePreference, accent: AccentPreference = 'ocean'): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0b1220' : '#f4f7fb');
}
