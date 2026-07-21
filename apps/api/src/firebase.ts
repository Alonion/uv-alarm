import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { UVNotificationPayload } from '@uv-alarm/shared';

function messaging() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey)
    throw new Error('Firebase Admin is not configured');
  const app =
    getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getMessaging(app);
}

export async function sendUVPush(
  token: string,
  title: string,
  body: string,
  data: UVNotificationPayload,
): Promise<void> {
  await messaging().send({
    token,
    notification: { title, body },
    data,
    android: { priority: 'high', notification: { channelId: 'uv-alerts-v2', sound: 'default' } },
  });
}

export function isInvalidTokenError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}
