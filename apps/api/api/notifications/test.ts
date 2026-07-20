import { createEventKey, getCity, localHour, testNotificationSchema } from '@uv-alarm/shared';
import { findDeviceByInstallation } from '../../src/db/repository';
import { sendUVPush } from '../../src/firebase';
import type { ApiRequest, ApiResponse } from '../../src/http';
import { body, json, method } from '../../src/http';
import { rateLimit, requestIp } from '../../src/rate-limit';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!method(req, res, ['POST'])) return;
  if (!rateLimit(`test:${requestIp(req.headers)}`, 3, 10 * 60_000))
    return json(res, 429, { error: 'Please wait before sending another test' });
  const parsed = body(testNotificationSchema, req.body);
  if (!parsed.ok)
    return json(res, 400, { error: 'Invalid test notification request', issues: parsed.issues });
  const device = await findDeviceByInstallation(parsed.data.installationId);
  if (!device) return json(res, 404, { error: 'Register this device first' });
  const city = getCity(parsed.data.cityId)!;
  const time = new Date().toISOString();
  try {
    await sendUVPush(
      device.fcmToken,
      'UV Alarm',
      `Test alert for UV ${parsed.data.threshold} in ${city.name} at ${localHour(time)}.`,
      {
        cityId: city.id,
        threshold: String(parsed.data.threshold),
        forecastTime: time,
        uv: String(parsed.data.threshold),
        eventKey: createEventKey(city.id, parsed.data.threshold, time),
      },
    );
    json(res, 200, { sent: true });
  } catch (error) {
    console.error('Test notification failed:', error instanceof Error ? error.message : 'unknown');
    json(res, 503, { error: 'Could not send the test notification' });
  }
}
