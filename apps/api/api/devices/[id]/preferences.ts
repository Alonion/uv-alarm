import { devicePreferencesSchema } from '@uv-alarm/shared';
import { updateDevice } from '../../../src/db/repository.js';
import type { ApiRequest, ApiResponse } from '../../../src/http.js';
import { body, json, method, queryValue } from '../../../src/http.js';
import { rateLimit, requestIp } from '../../../src/rate-limit.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!method(req, res, ['PATCH'])) return;
  if (!rateLimit(`preferences:${requestIp(req.headers)}`, 30, 60_000))
    return json(res, 429, { error: 'Too many requests' });
  const id = queryValue(req.query?.id);
  if (!id) return json(res, 400, { error: 'Device ID is required' });
  const parsed = body(devicePreferencesSchema, req.body);
  if (!parsed.ok) return json(res, 400, { error: 'Invalid preferences', issues: parsed.issues });
  try {
    const row = await updateDevice(id, parsed.data);
    if (!row) return json(res, 404, { error: 'Device not found' });
    json(res, 200, { updated: true });
  } catch {
    json(res, 503, { error: 'Could not update alert settings' });
  }
}
