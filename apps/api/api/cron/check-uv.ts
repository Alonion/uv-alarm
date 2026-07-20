import { createEventKey, firstThresholdCrossing, getCity, localHour } from '@uv-alarm/shared';
import {
  disableDevice,
  enabledDevices,
  finishEvent,
  reserveEvent,
} from '../../src/db/repository.js';
import { getForecasts } from '../../src/forecast-service.js';
import { isInvalidTokenError, sendUVPush } from '../../src/firebase.js';
import type { ApiRequest, ApiResponse } from '../../src/http.js';
import { json, method } from '../../src/http.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!method(req, res, ['GET'])) return;
  const authorization = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`)
    return json(res, 401, { error: 'Unauthorized' });
  const leadMinutes = Math.min(
    180,
    Math.max(0, Number(process.env.UV_NOTIFICATION_LEAD_MINUTES ?? 30) || 30),
  );
  const now = new Date();
  const cutoff = new Date(now.getTime() + leadMinutes * 60_000);
  const devices = await enabledDevices();
  const cityIds = [...new Set(devices.map((device) => device.cityId))];
  const forecasts = await getForecasts(cityIds, true);
  let sent = 0,
    skipped = 0,
    failed = 0,
    disabled = 0;
  for (const device of devices) {
    try {
      const forecast = forecasts.get(device.cityId);
      if (!forecast) throw new Error('Forecast is unavailable');
      const event = firstThresholdCrossing(
        forecast.hourly,
        device.threshold,
        new Date(now.getTime() - 60 * 60_000),
        cutoff,
      );
      if (!event) {
        skipped += 1;
        continue;
      }
      const eventKey = createEventKey(device.cityId, device.threshold, event.time);
      if (!(await reserveEvent(device, eventKey, event.time))) {
        skipped += 1;
        continue;
      }
      const city = getCity(device.cityId)!;
      try {
        await sendUVPush(
          device.fcmToken,
          'UV Alarm',
          `UV is forecast to reach ${event.uv} in ${city.name} at ${localHour(event.time)}.`,
          {
            cityId: city.id,
            threshold: String(device.threshold),
            forecastTime: event.time,
            uv: String(event.uv),
            eventKey,
          },
        );
        await finishEvent(device.id, eventKey, 'sent');
        sent += 1;
      } catch (error) {
        await finishEvent(
          device.id,
          eventKey,
          'failed',
          error instanceof Error ? error.message : 'Push failed',
        );
        if (isInvalidTokenError(error)) {
          await disableDevice(device.id);
          disabled += 1;
        }
        failed += 1;
      }
    } catch (error) {
      console.error(
        `Cron device ${device.id.slice(0, 8)} failed:`,
        error instanceof Error ? error.message : 'unknown',
      );
      failed += 1;
    }
  }
  console.info('UV cron summary', {
    devices: devices.length,
    cities: forecasts.size,
    sent,
    skipped,
    failed,
    disabled,
  });
  json(res, 200, {
    checked: devices.length,
    cities: forecasts.size,
    sent,
    skipped,
    failed,
    disabled,
  });
}
