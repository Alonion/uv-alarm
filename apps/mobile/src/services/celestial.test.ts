import { describe, expect, it } from 'vitest';
import { celestialState } from './celestial';

describe('celestial dashboard state', () => {
  it('shows the sun near its highest point at local noon', () => {
    const state = celestialState(new Date('2026-07-21T09:00:00Z'), 'Asia/Jerusalem');
    expect(state.phase).toBe('day');
    expect(state.isNight).toBe(false);
    expect(state.x).toBeCloseTo(77);
    expect(state.y).toBeCloseTo(19);
  });

  it('shows the moon at local midnight', () => {
    const state = celestialState(new Date('2026-07-20T21:00:00Z'), 'Asia/Jerusalem');
    expect(state.phase).toBe('night');
    expect(state.isNight).toBe(true);
    expect(state.x).toBeCloseTo(77);
  });
});
