/**
 * Validation tests for work photo upload: best and worst cases.
 */
import { isAllowedImageFormat } from '../workPhotoUpload';

describe('isAllowedImageFormat', () => {
  describe('best cases', () => {
    it('accepts .jpg and .jpeg', () => {
      expect(isAllowedImageFormat('file:///photo.jpg')).toBe(true);
      expect(isAllowedImageFormat('file:///photo.jpeg')).toBe(true);
    });
    it('accepts .png, .heif, .heic, .webp', () => {
      expect(isAllowedImageFormat('file:///a.png')).toBe(true);
      expect(isAllowedImageFormat('file:///a.heif')).toBe(true);
      expect(isAllowedImageFormat('file:///a.heic')).toBe(true);
      expect(isAllowedImageFormat('file:///a.webp')).toBe(true);
    });
    it('accepts by MIME type', () => {
      expect(isAllowedImageFormat('file:///x', 'image/jpeg')).toBe(true);
      expect(isAllowedImageFormat('file:///x', 'image/png')).toBe(true);
      expect(isAllowedImageFormat('file:///x', 'image/heif')).toBe(true);
      expect(isAllowedImageFormat('file:///x', 'image/webp')).toBe(true);
    });
    it('ignores query string in URI for extension', () => {
      expect(isAllowedImageFormat('https://cdn.example/photo.jpg?token=abc')).toBe(true);
    });
  });

  describe('worst cases', () => {
    it('rejects empty or missing URI', () => {
      expect(isAllowedImageFormat('')).toBe(false);
      expect(isAllowedImageFormat('   ')).toBe(false);
    });
    it('rejects non-string URI', () => {
      expect(isAllowedImageFormat(null as unknown as string)).toBe(false);
      expect(isAllowedImageFormat(undefined as unknown as string)).toBe(false);
    });
    it('rejects unknown extension', () => {
      expect(isAllowedImageFormat('file:///photo.bmp')).toBe(false);
      expect(isAllowedImageFormat('file:///photo.gif')).toBe(false);
      expect(isAllowedImageFormat('file:///photo.tiff')).toBe(false);
      expect(isAllowedImageFormat('file:///noext')).toBe(false);
    });
    it('rejects unknown MIME', () => {
      expect(isAllowedImageFormat('file:///x', 'image/bmp')).toBe(false);
      expect(isAllowedImageFormat('file:///x', 'application/octet-stream')).toBe(false);
    });
    it('is case-insensitive for MIME', () => {
      expect(isAllowedImageFormat('file:///x', 'IMAGE/JPEG')).toBe(true);
    });
  });
});
