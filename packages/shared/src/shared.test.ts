import { describe, expect, it } from 'vitest';
import {
  createEventKey,
  findNearestCity,
  firstBelowAfter,
  firstThresholdCrossing,
  firstThresholdTime,
  getUVCategory,
  haversineKm,
  peakUV,
  thresholdSchema,
  zonedLocalToIso,
} from './index';

const hours = [
  { time: '2026-07-20T06:00:00.000Z', uv: 3 },
  { time: '2026-07-20T07:00:00.000Z', uv: 7 },
  { time: '2026-07-20T08:00:00.000Z', uv: 9 },
  { time: '2026-07-20T09:00:00.000Z', uv: 4 },
];

describe('UV domain logic', () => {
  it('classifies every category boundary', () => {
    expect([0, 2, 3, 5, 6, 7, 8, 10, 11].map(getUVCategory)).toEqual([
      'Low',
      'Low',
      'Moderate',
      'Moderate',
      'High',
      'High',
      'Very High',
      'Very High',
      'Extreme',
    ]);
  });
  it('accepts only integer thresholds from 1 to 11', () => {
    expect(thresholdSchema.safeParse(1).success).toBe(true);
    expect(thresholdSchema.safeParse(11).success).toBe(true);
    expect(thresholdSchema.safeParse(0).success).toBe(false);
    expect(thresholdSchema.safeParse(6.5).success).toBe(false);
  });
  it('calculates distance and nearest IMS city', () => {
    expect(haversineKm(31.7683, 35.2137, 31.7683, 35.2137)).toBeCloseTo(0);
    expect(findNearestCity(31.77, 35.21).city.id).toBe('jerusalem');
  });
  it('calculates threshold, peak, and fall-below time', () => {
    expect(firstThresholdTime(hours, 7)?.time).toBe(hours[1]!.time);
    expect(peakUV(hours)?.uv).toBe(9);
    expect(firstBelowAfter(hours, 7, hours[1]!.time)?.time).toBe(hours[3]!.time);
  });
  it('finds one threshold crossing instead of every hour above the threshold', () => {
    const crossing = firstThresholdCrossing(
      hours,
      7,
      new Date('2026-07-20T05:30:00.000Z'),
      new Date('2026-07-20T08:30:00.000Z'),
    );
    expect(crossing?.time).toBe(hours[1]!.time);
    expect(
      firstThresholdCrossing(
        hours,
        7,
        new Date('2026-07-20T08:00:00.000Z'),
        new Date('2026-07-20T08:30:00.000Z'),
      ),
    ).toBeUndefined();
  });
  it('converts Jerusalem local time and makes deterministic keys', () => {
    expect(zonedLocalToIso('2026-07-20 10:00')).toBe('2026-07-20T07:00:00.000Z');
    expect(createEventKey('lod', 7, '2026-07-20T07:00:00.000Z')).toBe('lod:7:2026-07-20:10');
  });
});
