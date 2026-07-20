import type { ZodType } from 'zod';

export type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
export type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(): void;
};

export function json(res: ApiResponse, status: number, body: unknown): void {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function method(req: ApiRequest, res: ApiResponse, allowed: string[]): boolean {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', allowed.join(', '));
    res.status(204).end();
    return false;
  }
  if (!req.method || !allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    json(res, 405, { error: 'Method not allowed' });
    return false;
  }
  return true;
}

export function body<T>(
  schema: ZodType<T>,
  value: unknown,
): { ok: true; data: T } | { ok: false; issues: unknown } {
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : {
        ok: false,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
}

export function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
