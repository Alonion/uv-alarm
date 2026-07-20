import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    installationId: uuid('installation_id').notNull().unique(),
    fcmToken: text('fcm_token').notNull().unique(),
    cityId: text('city_id').notNull(),
    threshold: integer('threshold').notNull(),
    timezone: text('timezone').notNull().default('Asia/Jerusalem'),
    enabled: boolean('enabled').notNull().default(true),
    platform: text('platform').notNull().default('android'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('devices_threshold_check', sql`${table.threshold} between 1 and 11`),
    index('devices_enabled_idx').on(table.enabled),
  ],
);

export const notificationEvents = pgTable(
  'notification_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    eventKey: text('event_key').notNull(),
    cityId: text('city_id').notNull(),
    threshold: integer('threshold').notNull(),
    forecastTime: timestamp('forecast_time', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    status: text('status').notNull().default('pending'),
    errorMessage: text('error_message'),
  },
  (table) => [
    unique('notification_events_device_event_unique').on(table.deviceId, table.eventKey),
    index('notification_events_forecast_idx').on(table.forecastTime),
  ],
);

export type DeviceRow = typeof devices.$inferSelect;
