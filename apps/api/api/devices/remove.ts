import { z } from 'zod';
import { removeDevice } from '../../src/db/repository.js';
import type { ApiRequest, ApiResponse } from '../../src/http.js';
import { body, json, method } from '../../src/http.js';
import { rateLimit, requestIp } from '../../src/rate-limit.js';

const removeDeviceSchema = z.object({ deviceId: z.uuid() });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!method(req, res, ['POST'])) return;
  if (!rateLimit(`remove:${requestIp(req.headers)}`, 10, 60_000))
    return json(res, 429, { error: 'Too many removal attempts' });
  const parsed = body(removeDeviceSchema, req.body);
  if (!parsed.ok)
    return json(res, 400, { error: 'Invalid device registration', issues: parsed.issues });
  try {
    const removed = await removeDevice(parsed.data.deviceId);
    if (!removed) return json(res, 404, { error: 'Device registration not found' });
    json(res, 200, { removed: true });
  } catch {
    json(res, 503, { error: 'Could not remove device registration' });
  }
}
