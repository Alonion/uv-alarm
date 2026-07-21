import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../models';

const preferenceValues = vi.hoisted(() => new Map<string, string>());

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: preferenceValues.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      preferenceValues.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      preferenceValues.delete(key);
    }),
    clear: vi.fn(async () => {
      preferenceValues.clear();
    }),
  },
}));

import { loadBootstrap, saveSettings } from './storage';

describe('native preference storage', () => {
  beforeEach(() => preferenceValues.clear());

  it('persists the selected threshold and related settings', async () => {
    const settings: Settings = {
      cityId: 'jerusalem',
      threshold: 9,
      alarmEnabled: true,
      remoteEnabled: true,
      theme: 'dark',
      accent: 'coral',
      onboardingCompleted: true,
      installationId: '583f0220-c2c4-4e80-96b0-2fd11d7997b8',
      deviceId: 'device-1',
    };
    await saveSettings(settings);
    const restored = await loadBootstrap();
    expect(restored.settings).toEqual(settings);
  });
});
