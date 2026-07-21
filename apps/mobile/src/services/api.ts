import {
  forecastResponseSchema,
  type DevicePreferences,
  type DeviceRegistration,
  type UVForecastResponse,
} from '@uv-alarm/shared';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

async function request(path: string, init?: RequestInit): Promise<Response> {
  if (!API_BASE && window.location.protocol === 'capacitor:')
    throw new Error('API is not configured');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchForecast(cityId: string): Promise<UVForecastResponse> {
  const response = await request(`/api/forecast?cityId=${encodeURIComponent(cityId)}`);
  if (!response.ok) throw new Error('Forecast request failed');
  return forecastResponseSchema.parse(await response.json());
}

export async function registerDevice(input: DeviceRegistration): Promise<string> {
  const response = await request('/api/devices/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Registration failed');
  return String(((await response.json()) as { deviceId: string }).deviceId);
}

export async function updateDevice(deviceId: string, input: DevicePreferences): Promise<void> {
  const response = await request('/api/devices/preferences', {
    method: 'POST',
    body: JSON.stringify({ deviceId, preferences: input }),
  });
  if (!response.ok) throw new Error('Preference sync failed');
}

export async function removeDevice(deviceId: string): Promise<void> {
  const response = await request('/api/devices/remove', {
    method: 'POST',
    body: JSON.stringify({ deviceId }),
  });
  if (!response.ok) throw new Error('Removal failed');
}

export async function sendTestPush(
  installationId: string,
  cityId: string,
  threshold: number,
): Promise<void> {
  const response = await request('/api/notifications/test', {
    method: 'POST',
    body: JSON.stringify({ installationId, cityId, threshold }),
  });
  if (!response.ok) throw new Error('Test push failed');
}
