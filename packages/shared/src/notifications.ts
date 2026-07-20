export type UVNotificationPayload = {
  cityId: string;
  threshold: string;
  forecastTime: string;
  uv: string;
  eventKey: string;
};

export function createEventKey(
  cityId: string,
  threshold: number,
  forecastTime: string,
  timezone = 'Asia/Jerusalem',
): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(forecastTime));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = `${values.year}-${values.month}-${values.day}`;
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(forecastTime));
  return `${cityId}:${threshold}:${date}:${hour}`;
}
