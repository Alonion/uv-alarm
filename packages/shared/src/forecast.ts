import { firstBelowAfter, firstThresholdTime, peakUV, todaysForecast, type HourlyUV } from './time';

export type ForecastSummary = {
  today: HourlyUV[];
  peak?: HourlyUV;
  threshold?: HourlyUV;
  below?: HourlyUV;
};

export function summarizeForecast(
  hourly: HourlyUV[],
  threshold: number,
  now = new Date(),
  timezone = 'Asia/Jerusalem',
): ForecastSummary {
  const today = todaysForecast(hourly, now, timezone);
  const thresholdPoint = firstThresholdTime(today, threshold, now);
  return {
    today,
    peak: peakUV(today),
    threshold: thresholdPoint,
    below: firstBelowAfter(today, threshold, thresholdPoint?.time),
  };
}
