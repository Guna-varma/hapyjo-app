import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

/** Max size for an image before compression: 5 MB */
export const ISSUE_IMAGE_MAX_INPUT_BYTES = 5 * 1024 * 1024;

/** Target output size: 30–50 KB. We compress to land in this range. */
const TARGET_MAX_BYTES = 50 * 1024;
const TARGET_MIN_BYTES = 30 * 1024;

const MAX_WIDTH = 1024;
const INITIAL_QUALITY = 0.45;
const FALLBACK_QUALITY = 0.28;

/**
 * Get size in bytes of a URI (file://, content://, blob:, or http(s):).
 * Used to enforce 5 MB max before compression.
 */
export async function getUriSizeInBytes(uri: string): Promise<number> {
  if (Platform.OS !== 'web' && (uri.startsWith('file://') || uri.startsWith('content://'))) {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return typeof (info as { size?: number }).size === 'number' ? (info as { size: number }).size : 0;
  }
  try {
    const res = await fetch(uri, { method: 'HEAD' });
    const contentLength = res.headers.get('Content-Length');
    if (contentLength != null) return parseInt(contentLength, 10) || 0;
    const blob = await fetch(uri).then((r) => r.blob());
    return blob.size;
  } catch {
    return 0;
  }
}

/**
 * Compress an image for issue upload. Targets 30–50 KB output.
 * Resizes to max width 1024px and uses JPEG quality to hit the target.
 * @throws if image is over 5 MB (before compression)
 */
export async function compressIssueImage(localUri: string): Promise<string> {
  const size = await getUriSizeInBytes(localUri);
  if (size > ISSUE_IMAGE_MAX_INPUT_BYTES) {
    throw new Error('Image must be under 5 MB. Please choose a smaller image.');
  }

  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: MAX_WIDTH } }],
    {
      compress: INITIAL_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    }
  );
  if (!result.uri) throw new Error('Compression produced no output');

  if (Platform.OS !== 'web') {
    const info = await FileSystem.getInfoAsync(result.uri, { size: true });
    const outSize = typeof (info as { size?: number }).size === 'number' ? (info as { size: number }).size : 0;
    if (outSize > TARGET_MAX_BYTES) {
      const retry = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: MAX_WIDTH } }],
        {
          compress: FALLBACK_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false,
        }
      );
      if (retry.uri) return retry.uri;
    }
  }

  return result.uri;
}
