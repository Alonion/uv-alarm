import type { ThemePreference } from '../models';

export function applyTheme(theme: ThemePreference): void {
  document.documentElement.dataset.theme = theme;
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0b1220' : '#f4f7fb');
}
