export type HourlyUV = { time: string; uv: number };

export function dateKey(instant: string | Date, timezone = 'Asia/Jerusalem'): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function localHour(instant: string | Date, timezone = 'Asia/Jerusalem'): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(instant));
}

export function todaysForecast(
  hourly: HourlyUV[],
  now = new Date(),
  timezone = 'Asia/Jerusalem',
): HourlyUV[] {
  const today = dateKey(now, timezone);
  return hourly
    .filter((point) => dateKey(point.time, timezone) === today)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

export function peakUV(hourly: HourlyUV[]): HourlyUV | undefined {
  return hourly.reduce<HourlyUV | undefined>(
    (peak, point) => (!peak || point.uv > peak.uv ? point : peak),
    undefined,
  );
}

export function firstThresholdTime(
  hourly: HourlyUV[],
  threshold: number,
  after = new Date(0),
): HourlyUV | undefined {
  return [...hourly]
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    .find((point) => Date.parse(point.time) >= after.getTime() && point.uv >= threshold);
}

export function firstBelowAfter(
  hourly: HourlyUV[],
  threshold: number,
  reachedAt?: string,
): HourlyUV | undefined {
  if (!reachedAt) return undefined;
  return [...hourly]
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    .find((point) => Date.parse(point.time) > Date.parse(reachedAt) && point.uv < threshold);
}

export function firstThresholdCrossing(
  hourly: HourlyUV[],
  threshold: number,
  windowStart: Date,
  windowEnd: Date,
): HourlyUV | undefined {
  const sorted = [...hourly].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  return sorted.find((point, index) => {
    const time = Date.parse(point.time);
    if (
      !Number.isFinite(time) ||
      time < windowStart.getTime() ||
      time > windowEnd.getTime() ||
      point.uv < threshold
    )
      return false;
    const previous = sorted[index - 1];
    return !previous || previous.uv < threshold;
  });
}

// IMS timestamps are wall-clock times without an offset. Convert them using Intl's timezone data.
export function zonedLocalToIso(local: string, timezone = 'Asia/Jerusalem'): string {
  const match = local.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error('Invalid local date');
  const [, year, month, day, hour, minute, second = '00'] = match;
  const desiredUtc = Date.UTC(+year!, +month! - 1, +day!, +hour!, +minute!, +second!);
  let guess = desiredUtc;
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(
      +values.year!,
      +values.month! - 1,
      +values.day!,
      +values.hour!,
      +values.minute!,
      +values.second!,
    );
    guess += desiredUtc - represented;
  }
  const result = new Date(guess);
  if (Number.isNaN(result.getTime())) throw new Error('Invalid local date');
  return result.toISOString();
}
