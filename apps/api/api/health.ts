import type { ApiRequest, ApiResponse } from '../src/http';
import { json, method } from '../src/http';

export default function handler(req: ApiRequest, res: ApiResponse): void {
  if (!method(req, res, ['GET'])) return;
  json(res, 200, {
    status: 'ok',
    service: 'uv-alarm-api',
    time: new Date().toISOString(),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    firebaseConfigured: Boolean(process.env.FIREBASE_PROJECT_ID),
  });
}
