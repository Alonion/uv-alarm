export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface CelestialState {
  phase: SkyPhase;
  isNight: boolean;
  x: number;
  y: number;
}

function localTime(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 12);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour + minute / 60;
}

export function celestialState(date: Date, timeZone = 'Asia/Jerusalem'): CelestialState {
  const hour = localTime(date, timeZone);
  const isNight = hour < 6 || hour >= 18;
  const progress = isNight ? ((hour + 6) % 24) / 12 : (hour - 6) / 12;
  const phase: SkyPhase = isNight ? 'night' : hour < 8 ? 'dawn' : hour >= 16 ? 'dusk' : 'day';

  return {
    phase,
    isNight,
    // Keep the celestial arc in the card's open sky, away from the UV reading.
    x: 64 + progress * 26,
    y: 64 - Math.sin(progress * Math.PI) * 45,
  };
}
