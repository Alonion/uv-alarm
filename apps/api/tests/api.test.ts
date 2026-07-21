import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResponse } from '../src/http';
import * as forecastService from '../src/forecast-service';
import * as repository from '../src/db/repository';
import * as firebase from '../src/firebase';

vi.mock('../src/forecast-service', () => ({
  getForecast: vi.fn(async () => ({
    location: {
      id: 'lod',
      name: 'Lod',
      nameHebrew: 'לוד',
      latitude: 31.951,
      longitude: 34.8881,
      timezone: 'Asia/Jerusalem',
    },
    source: 'ims',
    updatedAt: '2026-07-20T00:00:00.000Z',
    stale: false,
    hourly: [],
  })),
  getForecasts: vi.fn(async () => new Map()),
}));
vi.mock('../src/db/repository', () => ({
  registerDevice: vi.fn(async (input) => ({ id: 'device-1', ...input })),
  updateDevice: vi.fn(async () => ({ id: 'device-1' })),
  removeDevice: vi.fn(async () => true),
  enabledDevices: vi.fn(async () => []),
  findDeviceByInstallation: vi.fn(async () => undefined),
  reserveEvent: vi.fn(),
  finishEvent: vi.fn(),
  disableDevice: vi.fn(),
}));
vi.mock('../src/firebase', () => ({
  sendUVPush: vi.fn(),
  isInvalidTokenError: vi.fn(() => false),
}));

function response() {
  const result: { status?: number; body?: any; headers: Record<string, string> } = { headers: {} };
  const res: ApiResponse = {
    status(code) {
      result.status = code;
      return this;
    },
    json(value) {
      result.body = value;
    },
    setHeader(name, value) {
      result.headers[name] = value;
    },
    end() {},
  };
  return { res, result };
}

describe('API handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });
  it('returns a normalized forecast', async () => {
    const { res, result } = response();
    const handler = (await import('../api/forecast')).default;
    await handler({ method: 'GET', query: { cityId: 'lod' }, headers: {} }, res);
    expect(result.status).toBe(200);
    expect(result.body.source).toBe('ims');
  });
  it('validates registration thresholds', async () => {
    const { res, result } = response();
    const handler = (await import('../api/devices/register')).default;
    await handler(
      {
        method: 'POST',
        headers: {},
        body: {
          installationId: crypto.randomUUID(),
          fcmToken: 'x'.repeat(30),
          cityId: 'lod',
          threshold: 12,
          timezone: 'Asia/Jerusalem',
          enabled: true,
          platform: 'android',
        },
      },
      res,
    );
    expect(result.status).toBe(400);
  });
  it('protects the cron endpoint', async () => {
    process.env.CRON_SECRET = 'secret';
    const { res, result } = response();
    const handler = (await import('../api/cron/check-uv')).default;
    await handler({ method: 'GET', headers: { authorization: 'Bearer wrong' } }, res);
    expect(result.status).toBe(401);
  });
  it('accepts validated device preference changes', async () => {
    const { res, result } = response();
    const handler = (await import('../api/devices/preferences')).default;
    await handler(
      {
        method: 'POST',
        headers: {},
        body: {
          deviceId: '11111111-1111-4111-8111-111111111111',
          preferences: { cityId: 'jerusalem', threshold: 7, enabled: true },
        },
      },
      res,
    );
    expect(result.status).toBe(200);
    expect(repository.updateDevice).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
      cityId: 'jerusalem',
      threshold: 7,
      enabled: true,
    });
  });
  it('removes a validated device registration', async () => {
    const { res, result } = response();
    const handler = (await import('../api/devices/remove')).default;
    await handler(
      {
        method: 'POST',
        headers: {},
        body: { deviceId: '11111111-1111-4111-8111-111111111111' },
      },
      res,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ removed: true });
    expect(repository.removeDevice).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });
  it('validates test notification requests without calling Firebase', async () => {
    const { res, result } = response();
    const handler = (await import('../api/notifications/test')).default;
    await handler(
      {
        method: 'POST',
        headers: {},
        body: { installationId: crypto.randomUUID(), cityId: 'lod', threshold: 0 },
      },
      res,
    );
    expect(result.status).toBe(400);
    expect(firebase.sendUVPush).not.toHaveBeenCalled();
  });
  it('skips a cron event already reserved by the deduplication store', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T07:00:00.000Z'));
    process.env.CRON_SECRET = 'secret';
    const now = new Date();
    const device = {
      id: '2005d66e-208d-4c7c-80f0-356ee5f4dddb',
      installationId: '583f0220-c2c4-4e80-96b0-2fd11d7997b8',
      fcmToken: 'x'.repeat(30),
      cityId: 'lod',
      threshold: 7,
      timezone: 'Asia/Jerusalem',
      enabled: true,
      platform: 'android',
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    };
    vi.mocked(repository.enabledDevices).mockResolvedValueOnce([device]);
    vi.mocked(forecastService.getForecasts).mockResolvedValueOnce(
      new Map([
        [
          'lod',
          {
            location: {
              id: 'lod',
              name: 'Lod',
              nameHebrew: 'לוד',
              latitude: 31.951,
              longitude: 34.8881,
              timezone: 'Asia/Jerusalem',
            },
            source: 'ims',
            updatedAt: '2026-07-20T06:00:00.000Z',
            stale: false,
            hourly: [
              { time: '2026-07-20T06:00:00.000Z', uv: 3 },
              { time: '2026-07-20T07:20:00.000Z', uv: 7 },
            ],
          },
        ],
      ]),
    );
    vi.mocked(repository.reserveEvent).mockResolvedValueOnce(false);
    const { res, result } = response();
    const handler = (await import('../api/cron/check-uv')).default;
    await handler({ method: 'GET', headers: { authorization: 'Bearer secret' } }, res);
    expect(result.status).toBe(200);
    expect(result.body.skipped).toBe(1);
    expect(firebase.sendUVPush).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
