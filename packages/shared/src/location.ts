import { CITIES, type ForecastCity } from './cities.js';

const EARTH_RADIUS_KM = 6371;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestCity(
  latitude: number,
  longitude: number,
): { city: ForecastCity; distanceKm: number } {
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Invalid coordinates');
  }
  return CITIES.map((city) => ({
    city,
    distanceKm: haversineKm(latitude, longitude, city.latitude, city.longitude),
  })).sort((a, b) => a.distanceKm - b.distanceKm)[0]!;
}
