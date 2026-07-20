import { removeDevice } from '../../../src/db/repository.js';
import type { ApiRequest, ApiResponse } from '../../../src/http.js';
import { json, method, queryValue } from '../../../src/http.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!method(req, res, ['DELETE'])) return;
  const id = queryValue(req.query?.id);
  if (!id) return json(res, 400, { error: 'Device ID is required' });
  try {
    json(res, 200, { removed: await removeDevice(id) });
  } catch {
    json(res, 503, { error: 'Could not remove device registration' });
  }
}
