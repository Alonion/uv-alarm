import {
  forecastResponseSchema,
  getCity,
  zonedLocalToIso,
  type UVForecastResponse,
} from '@uv-alarm/shared';
import { decodeIMSXml, IMS_RADIATION_URL, parseIMSXml } from './ims.js';

const CACHE_MS = 15 * 60 * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { storedAt: number; value: UVForecastResponse }>();

async function fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/xml,text/xml' },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchIMSXml(): Promise<string> {
  const response = await fetchWithTimeout(IMS_RADIATION_URL);
  if (!response.ok) throw new Error(`IMS responded with ${response.status}`);
  return decodeIMSXml(await response.arrayBuffer());
}

async function fetchFallback(cityId: string): Promise<UVForecastResponse> {
  const city = getCity(cityId);
  if (!city) throw new Error('Unknown city');
  const params = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    hourly: 'uv_index',
    timezone: city.timezone,
    forecast_days: '3',
  });
  const response = await fetchWithTimeout(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
  );
  if (!response.ok) throw new Error(`Fallback responded with ${response.status}`);
  const payload = (await response.json()) as {
    generationtime_ms?: number;
    hourly?: { time?: unknown; uv_index?: unknown };
  };
  const times = Array.isArray(payload.hourly?.time) ? payload.hourly.time : [];
  const values = Array.isArray(payload.hourly?.uv_index) ? payload.hourly.uv_index : [];
  const hourly = times.flatMap((time, index) => {
    const uv = Number(values[index]);
    if (typeof time !== 'string' || !Number.isFinite(uv) || uv < 0 || uv > 30) return [];
    try {
      const local =
        time.length === 16 ? time.replace('T', ' ') : time.slice(0, 16).replace('T', ' ');
      return [{ time: zonedLocalToIso(local), uv }];
    } catch {
      return [];
    }
  });
  return forecastResponseSchema.parse({
    location: city,
    source: 'fallback',
    updatedAt: new Date().toISOString(),
    stale: false,
    hourly,
  });
}

async function fallbackOrPrevious(
  cityId: string,
  existing?: { storedAt: number; value: UVForecastResponse },
): Promise<UVForecastResponse> {
  try {
    if (process.env.OPEN_METEO_FALLBACK_ENABLED !== 'false') {
      const value = await fetchFallback(cityId);
      cache.set(cityId, { value, storedAt: Date.now() });
      return value;
    }
  } catch (error) {
    console.error(
      `UV fallback refresh failed for ${cityId}:`,
      error instanceof Error ? error.message : 'unknown error',
    );
  }
  if (existing && Date.now() - existing.storedAt < STALE_MS)
    return { ...existing.value, stale: true };
  const city = getCity(cityId);
  if (!city) throw new Error('Unknown city');
  return {
    location: city,
    source: 'unavailable',
    updatedAt: new Date().toISOString(),
    stale: true,
    hourly: [],
  };
}

export async function getForecasts(
  cityIds: string[],
  force = false,
): Promise<Map<string, UVForecastResponse>> {
  const unique = [...new Set(cityIds)];
  const results = new Map<string, UVForecastResponse>();
  const refresh: string[] = [];
  for (const cityId of unique) {
    if (!getCity(cityId)) throw new Error('Unknown city');
    const existing = cache.get(cityId);
    if (!force && existing && Date.now() - existing.storedAt < CACHE_MS)
      results.set(cityId, existing.value);
    else refresh.push(cityId);
  }
  if (!refresh.length) return results;

  let xml: string | undefined;
  try {
    xml = await fetchIMSXml();
  } catch (error) {
    console.error('IMS refresh failed:', error instanceof Error ? error.message : 'unknown error');
  }

  for (const cityId of refresh) {
    if (xml) {
      try {
        const value = parseIMSXml(xml, cityId);
        cache.set(cityId, { value, storedAt: Date.now() });
        results.set(cityId, value);
        continue;
      } catch (error) {
        console.error(
          `IMS parse failed for ${cityId}:`,
          error instanceof Error ? error.message : 'unknown error',
        );
      }
    }
    results.set(cityId, await fallbackOrPrevious(cityId, cache.get(cityId)));
  }
  return results;
}

export async function getForecast(cityId: string, force = false): Promise<UVForecastResponse> {
  return (await getForecasts([cityId], force)).get(cityId)!;
}

export function clearForecastCache(): void {
  cache.clear();
}
