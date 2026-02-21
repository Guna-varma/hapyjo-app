/**
 * Country code to flag emoji (e.g. RW -> 🇷🇼).
 */

const REGION_FLAGS: Record<string, string> = {};
const A = 0x1f1e6;
for (let i = 0; i < 26; i++) {
  REGION_FLAGS[String.fromCharCode(65 + i)] = String.fromCodePoint(A + i);
}

export function countryToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const upper = countryCode.toUpperCase();
  const a = REGION_FLAGS[upper[0]];
  const b = REGION_FLAGS[upper[1]];
  return a && b ? a + b : '🌍';
}

export function getCountryCode(countryName: string): string {
  const map: Record<string, string> = {
    Rwanda: 'RW',
    Kenya: 'KE',
    Uganda: 'UG',
    Tanzania: 'TZ',
    India: 'IN',
    USA: 'US',
    'United States': 'US',
    UK: 'GB',
    'United Kingdom': 'GB',
  };
  return map[countryName] || (countryName ? countryName.slice(0, 2).toUpperCase() : '');
}
