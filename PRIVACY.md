# UV Alarm privacy policy

Last updated: 20 July 2026

UV Alarm provides UV forecasts and optional threshold notifications for supported Israeli forecast locations.

## Information stored on your device

The app stores the selected forecast-city identifier, UV threshold, alarm state, notification-registration state, theme, onboarding state, the last successful forecast, a random installation ID, and (when remote alerts are enabled) the backend registration ID. Capacitor Preferences is used for native storage.

If you press **Use my location**, Android supplies a one-time foreground location. The app uses it only to calculate the nearest supported forecast city. Precise coordinates are discarded after that calculation and are never sent to the UV Alarm backend.

## Information stored by the backend

When remote notifications are enabled, the backend stores the random installation ID, Firebase Cloud Messaging token, selected city identifier, threshold, timezone, platform, enabled state, timestamps, and notification-event records needed to prevent duplicate alerts. It does not store precise GPS coordinates, names, contacts, advertising identifiers, or account information.

## External services

The backend obtains official UV data from the Israel Meteorological Service. If that source is temporarily unavailable and fallback is enabled, it may obtain forecast data from Open-Meteo; the app labels this as temporary fallback data. Firebase Cloud Messaging delivers remote notifications. Neon Postgres may store registrations and deduplication records, and Vercel may host and schedule the API. Those providers process technical request data under their own policies.

## Permissions

Location permission is requested only after **Use my location** is pressed. Notification permission is requested only after **Enable notifications** is pressed. UV Alarm does not request background location.

## Retention and control

Use **Remove device registration** to delete the backend registration. **Reset app settings** also attempts that removal before clearing local settings. Notification-event records may be retained for operational deduplication and troubleshooting according to the operator's database-retention policy.

## Security and contact

The mobile app communicates with the configured API over HTTPS. Firebase Admin and database credentials remain server-side. Before publishing, the operator should add a support email and a public URL for this policy here.
