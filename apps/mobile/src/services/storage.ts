import { Preferences } from '@capacitor/preferences';
import {
  forecastResponseSchema,
  getCity,
  thresholdSchema,
  themeSchema,
  type UVForecastResponse,
} from '@uv-alarm/shared';
import type { BootstrapData, Settings } from '../models';

const KEYS = {
  city: 'selectedCityId',
  threshold: 'selectedThreshold',
  alarm: 'alarmEnabled',
  remote: 'remoteNotificationsEnabled',
  theme: 'themePreference',
  onboarding: 'onboardingCompleted',
  forecast: 'lastSuccessfulForecast',
  installation: 'installationId',
  device: 'deviceRegistrationId',
} as const;

async function get(key: string): Promise<string | null> {
  return (await Preferences.get({ key })).value;
}
function bool(value: string | null, fallback = false): boolean {
  return value === null ? fallback : value === 'true';
}

export async function loadBootstrap(): Promise<BootstrapData> {
  const [
    cityValue,
    thresholdValue,
    alarmValue,
    remoteValue,
    themeValue,
    onboardingValue,
    forecastValue,
    installationValue,
    deviceValue,
  ] = await Promise.all(Object.values(KEYS).map(get));
  const cityId = getCity(cityValue ?? '')?.id ?? 'lod';
  const thresholdParsed = thresholdSchema.safeParse(Number(thresholdValue));
  const themeParsed = themeSchema.safeParse(themeValue);
  const installationId =
    installationValue && /^[0-9a-f-]{36}$/i.test(installationValue)
      ? installationValue
      : crypto.randomUUID();
  if (installationId !== installationValue)
    await Preferences.set({ key: KEYS.installation, value: installationId });
  let cachedForecast: UVForecastResponse | undefined;
  try {
    const parsed = forecastResponseSchema.safeParse(JSON.parse(forecastValue ?? 'null'));
    if (parsed.success) cachedForecast = parsed.data;
  } catch {
    /* Ignore corrupted cache. */
  }
  return {
    settings: {
      cityId,
      threshold: thresholdParsed.success ? thresholdParsed.data : 6,
      alarmEnabled: bool(alarmValue),
      remoteEnabled: bool(remoteValue),
      theme: themeParsed.success ? themeParsed.data : 'system',
      onboardingCompleted: bool(onboardingValue),
      installationId,
      deviceId: deviceValue ?? undefined,
    },
    cachedForecast,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Promise.all([
    Preferences.set({ key: KEYS.city, value: settings.cityId }),
    Preferences.set({ key: KEYS.threshold, value: String(settings.threshold) }),
    Preferences.set({ key: KEYS.alarm, value: String(settings.alarmEnabled) }),
    Preferences.set({ key: KEYS.remote, value: String(settings.remoteEnabled) }),
    Preferences.set({ key: KEYS.theme, value: settings.theme }),
    Preferences.set({ key: KEYS.onboarding, value: String(settings.onboardingCompleted) }),
    Preferences.set({ key: KEYS.installation, value: settings.installationId }),
    settings.deviceId
      ? Preferences.set({ key: KEYS.device, value: settings.deviceId })
      : Preferences.remove({ key: KEYS.device }),
  ]);
}

export async function saveForecast(forecast: UVForecastResponse): Promise<void> {
  await Preferences.set({ key: KEYS.forecast, value: JSON.stringify(forecast) });
}
export async function resetStorage(): Promise<void> {
  await Preferences.clear();
}
