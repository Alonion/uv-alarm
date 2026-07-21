import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, type Token } from '@capacitor/push-notifications';
import { findNearestCity, firstThresholdTime, type UVForecastResponse } from '@uv-alarm/shared';
import type { PermissionStatus, Settings } from '../models';
import { registerDevice, removeDevice, updateDevice } from './api';

const NotificationSettings = registerPlugin<{
  open(): Promise<void>;
  openChannel(options: { channelId: string }): Promise<void>;
}>('NotificationSettings');
let pushToken: string | undefined;
let listenersReady = false;

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function createNotificationChannel(): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.createChannel({
    id: 'uv-alerts',
    name: 'UV Alerts',
    description: 'Alerts when UV reaches your selected level',
    importance: 5,
    visibility: 1,
    vibration: true,
    sound: 'default',
  });
}

export async function notificationPermission(): Promise<PermissionStatus> {
  if (!isNative()) return 'unavailable';
  const status = await LocalNotifications.checkPermissions();
  return status.display === 'granted'
    ? 'granted'
    : status.display === 'denied'
      ? 'denied'
      : 'unknown';
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (!isNative()) return 'unavailable';
  await createNotificationChannel();
  // On Android, local and push notifications share POST_NOTIFICATIONS. Request it
  // once through the local plugin. Push registration is deliberately deferred
  // until after onboarding so it cannot overlap the permission activity result.
  const local = await LocalNotifications.requestPermissions();
  return local.display === 'granted' ? 'granted' : 'denied';
}

export async function testLocalNotification(threshold: number): Promise<void> {
  if (!isNative()) throw new Error('Notifications are available in the Android app');
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 7101,
        title: 'UV Alarm',
        body: `Test successful — your alert level is UV ${threshold}.`,
        channelId: 'uv-alerts',
        schedule: { at: new Date(Date.now() + 700) },
      },
    ],
  });
}

export async function scheduleForecastNotification(
  forecast: UVForecastResponse,
  settings: Settings,
): Promise<void> {
  if (!isNative()) return;
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((item) => item.id === 7102);
  if (ours.length) await LocalNotifications.cancel({ notifications: ours });
  if (!settings.alarmEnabled || (await notificationPermission()) !== 'granted') return;
  const event = firstThresholdTime(forecast.hourly, settings.threshold, new Date());
  if (!event || Date.parse(event.time) <= Date.now()) return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 7102,
        title: 'UV Alarm',
        body: `UV is forecast to reach ${event.uv} in ${forecast.location.name}.`,
        channelId: 'uv-alerts',
        schedule: { at: new Date(event.time), allowWhileIdle: true },
        extra: { cityId: settings.cityId, threshold: settings.threshold, forecastTime: event.time },
      },
    ],
  });
}

export async function nearestForecastCity(): Promise<{ cityId: string; distanceKm: number }> {
  if (!isNative()) throw new Error('Location is available in the Android app');
  const permission = await Geolocation.requestPermissions({ permissions: ['location'] });
  if (permission.location !== 'granted') throw new Error('permission-denied');
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: false,
    timeout: 12_000,
    maximumAge: 60_000,
  });
  const match = findNearestCity(position.coords.latitude, position.coords.longitude);
  return { cityId: match.city.id, distanceKm: match.distanceKm };
}

async function tokenAfterRegistration(): Promise<string> {
  if (pushToken) return pushToken;
  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('FCM token timed out')), 12_000);
    void (async () => {
      const registration = await PushNotifications.addListener('registration', (token: Token) => {
        pushToken = token.value;
        window.clearTimeout(timer);
        void registration.remove();
        resolve(token.value);
      });
      const error = await PushNotifications.addListener('registrationError', () => {
        window.clearTimeout(timer);
        void registration.remove();
        void error.remove();
        reject(new Error('FCM registration failed'));
      });
      await PushNotifications.register();
    })().catch((error) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
}

export async function preparePushListeners(
  onForegroundMessage: (message: string) => void,
  onTokenChange?: () => void,
  onNotificationOpen?: () => void,
): Promise<void> {
  if (!isNative() || listenersReady) return;
  listenersReady = true;
  await PushNotifications.addListener('registration', (token) => {
    pushToken = token.value;
    onTokenChange?.();
  });
  await PushNotifications.addListener('pushNotificationReceived', (notification) =>
    onForegroundMessage(notification.body ?? 'UV alert received.'),
  );
  await PushNotifications.addListener('pushNotificationActionPerformed', () => {
    onNotificationOpen?.();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

export async function enableRemote(settings: Settings): Promise<string> {
  const token = await tokenAfterRegistration();
  return registerDevice({
    installationId: settings.installationId,
    fcmToken: token,
    cityId: settings.cityId,
    threshold: settings.threshold,
    timezone: 'Asia/Jerusalem',
    enabled: true,
    platform: 'android',
  });
}

export async function syncRemote(settings: Settings): Promise<void> {
  if (!settings.remoteEnabled || !settings.deviceId) return;
  const preferences = {
    cityId: settings.cityId,
    threshold: settings.threshold,
    enabled: settings.alarmEnabled,
    ...(pushToken ? { fcmToken: pushToken } : {}),
  };
  await updateDevice(settings.deviceId, preferences);
}

export async function unregisterRemote(settings: Settings): Promise<void> {
  if (settings.deviceId) await removeDevice(settings.deviceId);
}
export async function openNotificationSettings(): Promise<void> {
  if (isNative()) await NotificationSettings.open();
}

export async function openNotificationSoundSettings(): Promise<void> {
  if (isNative()) await NotificationSettings.openChannel({ channelId: 'uv-alerts' });
}
