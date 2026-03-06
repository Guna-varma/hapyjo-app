import { File, Directory, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

/** No input size limit; all images are compressed to 30–50 KB. Kept for compatibility (e.g. IssuesScreen). */
export const ISSUE_IMAGE_MAX_INPUT_BYTES = 100 * 1024 * 1024;

/** Target output size: 30–50 KB. We always compress to land in this range. */
const TARGET_MAX_BYTES = 50 * 1024;
const TARGET_MIN_BYTES = 30 * 1024;

const MAX_WIDTH = 1024;
const MAX_WIDTH_SMALL = 800;
const INITIAL_QUALITY = 0.45;
const FALLBACK_QUALITY = 0.28;
const MIN_QUALITY = 0.18;

/**
 * Get size in bytes of a URI (file://, content://, blob:, or http(s):).
 */
export async function getUriSizeInBytes(uri: string): Promise<number> {
  if (Platform.OS !== 'web' && (uri.startsWith('file://') || uri.startsWith('content://'))) {
    const file = new File(uri);
    const info = file.info();
    return typeof info.size === 'number' ? info.size : 0;
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
 * Compress an image for issue upload. Always compresses to 30–50 KB output (no input size limit).
 */
export async function compressIssueImage(localUri: string): Promise<string> {
  const attempts: { width: number; quality: number }[] = [
    { width: MAX_WIDTH, quality: INITIAL_QUALITY },
    { width: MAX_WIDTH, quality: FALLBACK_QUALITY },
    { width: MAX_WIDTH_SMALL, quality: FALLBACK_QUALITY },
    { width: MAX_WIDTH_SMALL, quality: MIN_QUALITY },
  ];
  let resultUri: string | null = null;
  for (const { width, quality } of attempts) {
    const result = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width } }],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );
    if (!result.uri) continue;
    resultUri = result.uri;
    const outSize = await getUriSizeInBytes(result.uri);
    if (outSize <= TARGET_MAX_BYTES) break;
  }
  if (!resultUri) throw new Error('Compression produced no output');
  return resultUri;
}
