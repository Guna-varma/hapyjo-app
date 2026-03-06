/**
 * Best and worst case tests for EXIF GPS parsing.
 */
import { parseExifGps } from '../workPhotoExif';

describe('parseExifGps', () => {
  it('returns coordinates when EXIF has DMS array', () => {
    const exif = {
      GPSLatitudeRef: 'N',
      GPSLongitudeRef: 'E',
      GPSLatitude: [30, 15, 0],
      GPSLongitude: [97, 45, 0],
    };
    const result = parseExifGps(exif);
    expect(result).not.toBeNull();
    expect(result!.latitude).toBeCloseTo(30.25, 4);
    expect(result!.longitude).toBeCloseTo(97.75, 4);
  });

  it('returns null for null or undefined exif', () => {
    expect(parseExifGps(null)).toBeNull();
    expect(parseExifGps(undefined)).toBeNull();
  });

  it('returns null when GPS tags are missing', () => {
    expect(parseExifGps({})).toBeNull();
  });

  it('clamps out-of-range values', () => {
    const exif = {
      GPSLatitudeRef: 'N',
      GPSLongitudeRef: 'E',
      GPSLatitude: 100,
      GPSLongitude: 200,
    };
    const result = parseExifGps(exif);
    expect(result!.latitude).toBe(90);
    expect(result!.longitude).toBe(180);
  });
});
