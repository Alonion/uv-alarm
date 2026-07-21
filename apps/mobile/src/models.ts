import type { UVForecastResponse } from '@uv-alarm/shared';

export type ThemePreference = 'system' | 'light' | 'dark';
export type AccentPreference = 'ocean' | 'lagoon' | 'coral' | 'sunset';
export type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';

export type Settings = {
  cityId: string;
  threshold: number;
  alarmEnabled: boolean;
  remoteEnabled: boolean;
  theme: ThemePreference;
  accent: AccentPreference;
  onboardingCompleted: boolean;
  installationId: string;
  deviceId?: string;
};

export type BootstrapData = { settings: Settings; cachedForecast?: UVForecastResponse };
