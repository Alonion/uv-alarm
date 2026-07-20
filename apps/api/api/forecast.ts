import { cityIdSchema } from '@uv-alarm/shared';
import { getForecast } from '../src/forecast-service';
import type { ApiRequest, ApiResponse } from '../src/http';
import { json, method, queryValue } from '../src/http';
import { rateLimit, requestIp } from '../src/rate-limit';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!method(req, res, ['GET'])) return;
  if (!rateLimit(`forecast:${requestIp(req.headers)}`, 60, 60_000))
    return json(res, 429, { error: 'Too many requests' });
  const parsed = cityIdSchema.safeParse(queryValue(req.query?.cityId) ?? 'lod');
  if (!parsed.success) return json(res, 400, { error: 'Choose a supported forecast location' });
  try {
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=600');
    res.status(200).json(await getForecast(parsed.data));
  } catch {
    json(res, 503, { error: 'Forecast is temporarily unavailable' });
  }
}
