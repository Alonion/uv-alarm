export const FORECAST_TIMEZONE = 'Asia/Jerusalem' as const;

export type ForecastCity = {
  id: string;
  imsId: string;
  name: string;
  nameHebrew: string;
  latitude: number;
  longitude: number;
  timezone: typeof FORECAST_TIMEZONE;
};

// Coordinates identify public forecast cities, not users. IMS IDs come from isr_rad.xml.
export const CITIES = [
  {
    id: 'tiberias',
    imsId: '202',
    name: 'Tiberias',
    nameHebrew: 'טבריה',
    latitude: 32.7959,
    longitude: 35.531,
  },
  {
    id: 'nazareth',
    imsId: '207',
    name: 'Nazareth',
    nameHebrew: 'נצרת',
    latitude: 32.6996,
    longitude: 35.3035,
  },
  { id: 'lod', imsId: '204', name: 'Lod', nameHebrew: 'לוד', latitude: 31.951, longitude: 34.8881 },
  {
    id: 'eilat',
    imsId: '520',
    name: 'Eilat',
    nameHebrew: 'אילת',
    latitude: 29.5577,
    longitude: 34.9519,
  },
  {
    id: 'jerusalem',
    imsId: '510',
    name: 'Jerusalem',
    nameHebrew: 'ירושלים',
    latitude: 31.7683,
    longitude: 35.2137,
  },
  {
    id: 'ashdod',
    imsId: '114',
    name: 'Ashdod',
    nameHebrew: 'אשדוד',
    latitude: 31.8044,
    longitude: 34.6553,
  },
  {
    id: 'hadera',
    imsId: '113',
    name: 'Hadera',
    nameHebrew: 'חדרה',
    latitude: 32.434,
    longitude: 34.9196,
  },
  {
    id: 'afula',
    imsId: '209',
    name: 'Afula',
    nameHebrew: 'עפולה',
    latitude: 32.6076,
    longitude: 35.2896,
  },
  {
    id: 'haifa',
    imsId: '115',
    name: 'Haifa',
    nameHebrew: 'חיפה',
    latitude: 32.794,
    longitude: 34.9896,
  },
  {
    id: 'zefat',
    imsId: '507',
    name: 'Safed',
    nameHebrew: 'צפת',
    latitude: 32.9646,
    longitude: 35.3815,
  },
  {
    id: 'qazrin',
    imsId: '201',
    name: 'Katzrin',
    nameHebrew: 'קצרין',
    latitude: 32.9908,
    longitude: 35.6896,
  },
].map((city) => ({ ...city, timezone: FORECAST_TIMEZONE })) satisfies ForecastCity[];

export type CityId = (typeof CITIES)[number]['id'];

export function getCity(id: string): ForecastCity | undefined {
  return CITIES.find((city) => city.id === id);
}
