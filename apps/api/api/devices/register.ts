import { deviceRegistrationSchema } from '@uv-alarm/shared';
import { registerDevice } from '../../src/db/repository.js';
import type { ApiRequest, ApiResponse } from '../../src/http.js';
import { body, json, method } from '../../src/http.js';
import { rateLimit, requestIp } from '../../src/rate-limit.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!method(req, res, ['POST'])) return;
  if (!rateLimit(`register:${requestIp(req.headers)}`, 10, 60_000))
    return json(res, 429, { error: 'Too many registration attempts' });
  const parsed = body(deviceRegistrationSchema, req.body);
  if (!parsed.ok)
    return json(res, 400, { error: 'Invalid device settings', issues: parsed.issues });
  try {
    const row = await registerDevice(parsed.data);
    json(res, 200, { deviceId: row.id, registered: true });
  } catch (error) {
    console.error(
      'Device registration failed:',
      error instanceof Error ? error.message : 'unknown',
    );
    json(res, 503, { error: 'Could not register this device for alerts' });
  }
}
