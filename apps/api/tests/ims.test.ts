import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseIMSXml } from '../src/ims';

describe('IMS XML parser', () => {
  it('uses observed IMS tags, sorts hours, and removes duplicates', async () => {
    const xml = await readFile(
      new URL('./fixtures/isr_rad.sanitized.xml', import.meta.url),
      'utf8',
    );
    const result = parseIMSXml(xml, 'lod');
    expect(result.source).toBe('ims');
    expect(result.location.id).toBe('lod');
    expect(result.updatedAt).toBe('2026-07-20T00:00:00.000Z');
    expect(result.hourly).toHaveLength(2);
    expect(result.hourly.map((point) => point.uv)).toEqual([7, 9]);
  });
  it('rejects unsupported locations and malformed documents', () => {
    expect(() => parseIMSXml('<SolarRadiationForecast/>', 'lod')).toThrow();
    expect(() => parseIMSXml('<x/>', 'unknown')).toThrow('Unknown city');
  });
});
