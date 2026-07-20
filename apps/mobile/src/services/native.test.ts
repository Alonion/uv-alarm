import { describe, expect, it } from 'vitest';
import { findNearestCity } from '@uv-alarm/shared';

describe('one-shot location selection', () => {
  it('matches coordinates rather than using a hard-coded city', () => {
    expect(findNearestCity(29.56, 34.95).city.id).toBe('eilat');
    expect(findNearestCity(32.79, 34.99).city.id).toBe('haifa');
  });
});
