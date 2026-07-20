export type UVCategory = 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';

export function getUVCategory(uv: number): UVCategory {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

export function getUVSafetyMessage(uv: number): string {
  const category = getUVCategory(uv);
  if (category === 'Low') return 'Protection is usually minimal; sunglasses are still useful.';
  if (category === 'Moderate') return 'Use sunscreen, shade, and protective clothing.';
  if (category === 'High') return 'Protection is essential. Limit midday sun exposure.';
  if (category === 'Very High')
    return 'Extra protection is required. Seek shade whenever possible.';
  return 'Avoid direct sun where possible and use maximum protection.';
}
