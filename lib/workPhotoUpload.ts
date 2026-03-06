import { File, Directory, Paths } from 'expo-file-system';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getUriSizeInBytes } from '@/lib/compressIssueImage';
import * as ImageManipulator from 'expo-image-manipulator';

const BUCKET = 'work-photos';
const PREFIX = 'work/';
const TARGET_PHOTO_BYTES = 50 * 1024;
const TARGET_THUMB_BYTES_MAX = 20 * 1024;
const MIN_ACCEPTED_BYTES = 30 * 1024;
const MAX_WIDTH = 1280;
const THUMB_WIDTH = 320;
const PHOTO_QUALITY = 0.45;
const PHOTO_QUALITY_LOW = 0.28;
const PHOTO_QUALITY_MIN = 0.18;
const THUMB_QUALITY = 0.5;
const MAX_WIDTH_SMALL = 800;

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.heif', '.heic', '.webp']);
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/heif', 'image/heic', 'image/webp']);

function getExtension(uri: string): string {
  const q = uri.indexOf('?');
  const path = q >= 0 ? uri.slice(0, q) : uri;
  const last = path.lastIndexOf('.');
  if (last < 0) return '';
  return path.slice(last).toLowerCase();
}

export function isAllowedImageFormat(uri: string, mimeType?: string): boolean {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') return false;
  if (mimeType != null && typeof mimeType === 'string' && ALLOWED_MIMES.has(mimeType.toLowerCase())) return true;
  const ext = getExtension(uri);
  return ext.length > 0 && ALLOWED_EXTENSIONS.has(ext);
}

export async function validateAndPrepareWorkPhoto(localUri: string): Promise<{ uri: string; size: number }> {
  if (!localUri || typeof localUri !== 'string' || localUri.trim() === '') {
    throw new Error('Invalid image: no file.');
  }
  if (!isAllowedImageFormat(localUri)) {
    throw new Error('Only image files are allowed (JPEG, PNG, HEIF, WebP).');
  }
  const size = await getUriSizeInBytes(localUri);
  if (!Number.isFinite(size) || size < 0) {
    throw new Error('Could not read image file.');
  }
  if (size === 0) {
    throw new Error('Image file is empty.');
  }
  // Always compress to 30–50 KB when over target; no upper size limit (compress any size).
  if (size <= TARGET_PHOTO_BYTES && size >= MIN_ACCEPTED_BYTES) {
    return { uri: localUri, size };
  }
  if (size < MIN_ACCEPTED_BYTES) {
    return { uri: localUri, size };
  }
  // Over 50 KB: always compress to 30–50 KB (any input size)
  return compressToTargetSize(localUri);
}

async function compressToTargetSize(localUri: string): Promise<{ uri: string; size: number }> {
  const attempts: { width: number; quality: number }[] = [
    { width: MAX_WIDTH, quality: PHOTO_QUALITY },
    { width: MAX_WIDTH, quality: PHOTO_QUALITY_LOW },
    { width: MAX_WIDTH_SMALL, quality: PHOTO_QUALITY_LOW },
    { width: MAX_WIDTH_SMALL, quality: PHOTO_QUALITY_MIN },
  ];
  let result: { uri: string } | null = null;
  for (const { width, quality } of attempts) {
    const res = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: false }
    );
    if (!res.uri) continue;
    result = res;
    const outSize = await getUriSizeInBytes(res.uri);
    if (outSize <= TARGET_PHOTO_BYTES) break;
  }
  if (!result?.uri) throw new Error('Compression produced no output');
  const finalSize = await getUriSizeInBytes(result.uri);
  return { uri: result.uri, size: finalSize };
}

export async function generateThumbnail(localUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: THUMB_WIDTH } }],
    { compress: THUMB_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: false }
  );
  if (!result.uri) throw new Error('Thumbnail failed');
  return result.uri;
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const useFetch =
    Platform.OS === 'web' ||
    uri.startsWith('content://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('blob:') ||
    uri.startsWith('data:');
  if (useFetch) {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.arrayBuffer();
  }
  const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return bytes.buffer;
}

export async function uploadWorkPhoto(photoId: string, photoUri: string, thumbUri: string): Promise<{ photoUrl: string; thumbnailUrl: string }> {
  const photoPath = `${PREFIX}${photoId}/photo-${Date.now()}.jpg`;
  const thumbPath = `${PREFIX}${photoId}/thumb-${Date.now()}.jpg`;
  const [photoBuf, thumbBuf] = await Promise.all([uriToArrayBuffer(photoUri), uriToArrayBuffer(thumbUri)]);
  const { error: e1 } = await supabase.storage.from(BUCKET).upload(photoPath, photoBuf, { contentType: 'image/jpeg', upsert: true });
  if (e1) throw new Error(`Upload failed: ${e1.message}`);
  const { error: e2 } = await supabase.storage.from(BUCKET).upload(thumbPath, thumbBuf, { contentType: 'image/jpeg', upsert: true });
  if (e2) throw new Error(`Thumbnail upload failed: ${e2.message}`);
  const { data: photoUrlData } = supabase.storage.from(BUCKET).getPublicUrl(photoPath);
  const { data: thumbUrlData } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath);
  return { photoUrl: photoUrlData.publicUrl, thumbnailUrl: thumbUrlData.publicUrl };
}
