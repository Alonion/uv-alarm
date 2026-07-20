import { XMLParser } from 'fast-xml-parser';
import iconv from 'iconv-lite';
import {
  forecastResponseSchema,
  getCity,
  zonedLocalToIso,
  type UVForecastResponse,
} from '@uv-alarm/shared';

export const IMS_RADIATION_URL =
  'https://ims.gov.il/sites/default/files/ims_data/xml_files/isr_rad.xml';

type XmlRecord = Record<string, unknown>;

function normalized(key: string): string {
  return key
    .split(':')
    .at(-1)!
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}
function field(object: unknown, name: string): unknown {
  if (!object || typeof object !== 'object') return undefined;
  const target = normalized(name);
  const entry = Object.entries(object as XmlRecord).find(([key]) => normalized(key) === target);
  return entry?.[1];
}
function list(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
function text(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return undefined;
}

export function decodeIMSXml(buffer: ArrayBuffer): string {
  return iconv.decode(Buffer.from(buffer), 'ISO-8859-8');
}

export function parseIMSXml(xml: string, cityId: string): UVForecastResponse {
  const city = getCity(cityId);
  if (!city) throw new Error('Unknown city');
  const parsed = new XMLParser({
    removeNSPrefix: true,
    trimValues: true,
    parseTagValue: false,
  }).parse(xml) as XmlRecord;
  const root = field(parsed, 'SolarRadiationForecast');
  if (!root) throw new Error('IMS document root is missing');
  const identification = field(root, 'Identification');
  const issueText = text(field(identification, 'IssueDateTime'));
  if (!issueText) throw new Error('IMS issue time is missing');
  const updatedAt = zonedLocalToIso(issueText);
  const locations = list(field(root, 'Location'));
  const location = locations.find(
    (candidate) => text(field(field(candidate, 'LocationMetaData'), 'LocationId')) === city.imsId,
  );
  if (!location) throw new Error('IMS location is missing');
  const metadata = field(location, 'LocationMetaData');
  const units = list(field(field(location, 'LocationData'), 'TimeUnitData'));
  const unique = new Map<string, number>();
  for (const unit of units) {
    const period = field(unit, 'SolRadPeriod');
    const localTime = text(field(period, 'DateTimeFrom'));
    const elements = list(field(unit, 'Element'));
    const radiation =
      elements.find(
        (element) => text(field(element, 'ElementName'))?.toLowerCase() === 'radiation',
      ) ?? elements[0];
    const uv = Number(text(field(radiation, 'ElementIndex')));
    if (!localTime || !Number.isFinite(uv) || uv < 0 || uv > 30) continue;
    try {
      unique.set(zonedLocalToIso(localTime), uv);
    } catch {
      /* Reject malformed timestamps without discarding valid hours. */
    }
  }
  const hourly = [...unique]
    .map(([time, uv]) => ({ time, uv }))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  if (!hourly.length) throw new Error('IMS contained no valid UV values');
  return forecastResponseSchema.parse({
    location: {
      id: city.id,
      name: text(field(metadata, 'LocationNameEng')) || city.name,
      nameHebrew: city.nameHebrew,
      latitude: city.latitude,
      longitude: city.longitude,
      timezone: city.timezone,
    },
    source: 'ims',
    updatedAt,
    stale: false,
    hourly,
  });
}
