import { z } from 'zod';
import { CITIES, FORECAST_TIMEZONE } from './cities';

const cityIds = CITIES.map((city) => city.id);

export const thresholdSchema = z.number().int().min(1).max(11);
export const cityIdSchema = z.string().refine((value) => cityIds.includes(value), 'Unknown city');
export const themeSchema = z.enum(['system', 'light', 'dark']);

export const hourlyUVSchema = z.object({
  time: z.iso.datetime({ offset: true }),
  uv: z.number().min(0).max(30),
});

export const forecastResponseSchema = z.object({
  location: z.object({
    id: cityIdSchema,
    name: z.string().min(1),
    nameHebrew: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.literal(FORECAST_TIMEZONE),
  }),
  source: z.enum(['ims', 'fallback', 'unavailable']),
  updatedAt: z.iso.datetime({ offset: true }),
  stale: z.boolean(),
  hourly: z.array(hourlyUVSchema),
});

export const deviceRegistrationSchema = z.object({
  installationId: z.uuid(),
  fcmToken: z.string().min(20).max(4096),
  cityId: cityIdSchema,
  threshold: thresholdSchema,
  timezone: z.literal(FORECAST_TIMEZONE).default(FORECAST_TIMEZONE),
  enabled: z.boolean(),
  platform: z.literal('android'),
});

export const devicePreferencesSchema = z
  .object({
    cityId: cityIdSchema.optional(),
    threshold: thresholdSchema.optional(),
    enabled: z.boolean().optional(),
    fcmToken: z.string().min(20).max(4096).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one preference is required');

export const testNotificationSchema = z.object({
  installationId: z.uuid(),
  cityId: cityIdSchema,
  threshold: thresholdSchema,
});

export type UVForecastResponse = z.infer<typeof forecastResponseSchema>;
export type DeviceRegistration = z.infer<typeof deviceRegistrationSchema>;
export type DevicePreferences = z.infer<typeof devicePreferencesSchema>;
