/**
 * Parse EXIF GPS from image picker asset (or 3rd party images with embedded GPS).
 * When photo already has GPS/timestamp in EXIF we use it; otherwise app uses current location/time.
 * Handles best/worst cases: missing exif, partial exif, invalid numbers, out-of-range values.
 */

const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;

function toDecimalDegrees(
  deg: number | { numerator?: number; denominator?: number },
  min: number | { numerator?: number; denominator?: number },
  sec: number | { numerator?: number; denominator?: number }
): number {
  const d = typeof deg === 'number' ? deg : (deg?.numerator ?? 0) / ((deg as { denominator?: number })?.denominator || 1);
  const m = typeof min === 'number' ? min : (min?.numerator ?? 0) / ((min as { denominator?: number })?.denominator || 1);
  const s = typeof sec === 'number' ? sec : (sec?.numerator ?? 0) / ((sec as { denominator?: number })?.denominator || 1);
  return d + m / 60 + s / 3600;
}

function parseDMS(
  value: unknown,
  ref: string | undefined
): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const sign = ref === 'S' || ref === 'W' ? -1 : 1;
    return sign * Math.abs(value);
  }
  const arr = Array.isArray(value) ? value : null;
  if (!arr || arr.length < 3) return null;
  const [deg, min, sec] = arr;
  const decimal = toDecimalDegrees(deg, min, sec);
  if (!Number.isFinite(decimal)) return null;
  const sign = ref === 'S' || ref === 'W' ? -1 : 1;
  return sign * Math.abs(decimal);
}

function clampLat(lat: number): number {
  return Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
}

function clampLon(lon: number): number {
  return Math.max(LON_MIN, Math.min(LON_MAX, lon));
}

/**
 * Extract GPS coordinates from Expo ImagePicker EXIF (or any record with standard EXIF GPS tags).
 * Supports photos from 3rd party systems that embed GPS in EXIF.
 * Returns null if no valid GPS (use current device location as fallback).
 */
export function parseExifGps(exif: Record<string, unknown> | null | undefined): { latitude: number; longitude: number } | null {
  if (!exif || typeof exif !== 'object') return null;

  const latRef = (exif.GPSLatitudeRef as string) ?? (exif.gpsLatitudeRef as string);
  const lonRef = (exif.GPSLongitudeRef as string) ?? (exif.gpsLongitudeRef as string);
  const latVal = exif.GPSLatitude ?? exif.gpsLatitude;
  const lonVal = exif.GPSLongitude ?? exif.gpsLongitude;

  let lat: number | null = null;
  let lon: number | null = null;

  if (latVal != null) lat = parseDMS(latVal, latRef);
  if (lonVal != null) lon = parseDMS(lonVal, lonRef);

  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  lat = clampLat(lat);
  lon = clampLon(lon);
  return { latitude: lat, longitude: lon };
}
