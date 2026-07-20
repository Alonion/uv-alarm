import { neon } from '@neondatabase/serverless';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import type { DevicePreferences, DeviceRegistration } from '@uv-alarm/shared';
import { devices, notificationEvents, type DeviceRow } from './schema';

function database() {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured');
  return drizzle(neon(process.env.DATABASE_URL));
}

export async function registerDevice(input: DeviceRegistration): Promise<DeviceRow> {
  const now = new Date();
  const [row] = await database()
    .insert(devices)
    .values({ ...input, lastSeenAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: devices.installationId,
      set: {
        fcmToken: input.fcmToken,
        cityId: input.cityId,
        threshold: input.threshold,
        enabled: input.enabled,
        timezone: input.timezone,
        lastSeenAt: now,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error('Device registration failed');
  return row;
}

export async function updateDevice(
  id: string,
  preferences: DevicePreferences,
): Promise<DeviceRow | undefined> {
  const [row] = await database()
    .update(devices)
    .set({ ...preferences, updatedAt: new Date(), lastSeenAt: new Date() })
    .where(eq(devices.id, id))
    .returning();
  return row;
}

export async function removeDevice(id: string): Promise<boolean> {
  return (
    (await database().delete(devices).where(eq(devices.id, id)).returning({ id: devices.id }))
      .length > 0
  );
}

export async function findDeviceByInstallation(
  installationId: string,
): Promise<DeviceRow | undefined> {
  return (
    await database()
      .select()
      .from(devices)
      .where(eq(devices.installationId, installationId))
      .limit(1)
  )[0];
}

export async function enabledDevices(): Promise<DeviceRow[]> {
  return database().select().from(devices).where(eq(devices.enabled, true));
}

export async function reserveEvent(
  device: DeviceRow,
  eventKey: string,
  forecastTime: string,
): Promise<boolean> {
  const rows = await database()
    .insert(notificationEvents)
    .values({
      deviceId: device.id,
      eventKey,
      cityId: device.cityId,
      threshold: device.threshold,
      forecastTime: new Date(forecastTime),
    })
    .onConflictDoNothing({ target: [notificationEvents.deviceId, notificationEvents.eventKey] })
    .returning({ id: notificationEvents.id });
  return rows.length === 1;
}

export async function finishEvent(
  deviceId: string,
  eventKey: string,
  status: 'sent' | 'failed',
  errorMessage?: string,
): Promise<void> {
  await database()
    .update(notificationEvents)
    .set({
      status,
      sentAt: status === 'sent' ? new Date() : null,
      errorMessage: errorMessage?.slice(0, 500),
    })
    .where(
      and(eq(notificationEvents.deviceId, deviceId), eq(notificationEvents.eventKey, eventKey)),
    );
}

export async function disableDevice(id: string): Promise<void> {
  await database()
    .update(devices)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(devices.id, id));
}
