import { devicePreferencesSchema } from '@uv-alarm/shared';
import { z } from 'zod';
import { updateDevice } from '../../src/db/repository.js';
import type { ApiRequest, ApiResponse } from '../../src/http.js';
import { body, json, method } from '../../src/http.js';
import { rateLimit, requestIp } from '../../src/rate-limit.js';

const updatePreferencesSchema = z.object({
  deviceId: z.uuid(),
  preferences: devicePreferencesSchema,
});

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!method(req, res, ['POST'])) return;
  if (!rateLimit(`preferences:${requestIp(req.headers)}`, 30, 60_000))
    return json(res, 429, { error: 'Too many requests' });
  const parsed = body(updatePreferencesSchema, req.body);
  if (!parsed.ok) return json(res, 400, { error: 'Invalid preferences', issues: parsed.issues });
  try {
    const row = await updateDevice(parsed.data.deviceId, parsed.data.preferences);
    if (!row) return json(res, 404, { error: 'Device not found' });
    json(res, 200, { updated: true });
  } catch {
    json(res, 503, { error: 'Could not update alert settings' });
  }
}
