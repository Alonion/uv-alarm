CREATE TABLE IF NOT EXISTS "devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "installation_id" uuid NOT NULL UNIQUE,
  "fcm_token" text NOT NULL UNIQUE,
  "city_id" text NOT NULL,
  "threshold" integer NOT NULL,
  "timezone" text NOT NULL DEFAULT 'Asia/Jerusalem',
  "enabled" boolean NOT NULL DEFAULT true,
  "platform" text NOT NULL DEFAULT 'android',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "devices_threshold_check" CHECK ("threshold" BETWEEN 1 AND 11)
);

CREATE TABLE IF NOT EXISTS "notification_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "device_id" uuid NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
  "event_key" text NOT NULL,
  "city_id" text NOT NULL,
  "threshold" integer NOT NULL,
  "forecast_time" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "status" text NOT NULL DEFAULT 'pending',
  "error_message" text,
  CONSTRAINT "notification_events_device_event_unique" UNIQUE("device_id", "event_key")
);

CREATE INDEX IF NOT EXISTS "devices_enabled_idx" ON "devices" ("enabled");
CREATE INDEX IF NOT EXISTS "notification_events_forecast_idx" ON "notification_events" ("forecast_time");

