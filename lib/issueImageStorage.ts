import { readAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const BUCKET = 'issue-images';
const PREFIX = 'issue/';

/** Prefer fetch for content:// and http(s) URIs; use file-system for file:// on native. */
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
    if (!res.ok) throw new Error(`Fetch image failed: ${res.status}`);
    return await res.arrayBuffer();
  }

  try {
    const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    return bytes.buffer;
  } catch (e) {
    const fallback = await fetch(uri);
    if (!fallback.ok) throw e;
    return await fallback.arrayBuffer();
  }
}

/**
 * Upload an image for an issue. Expects a compressed image URI (e.g. from compressIssueImage).
 * Returns the storage path (e.g. issue/<issueId>/file.jpg) to store in issues.image_uris.
 */
export async function uploadIssueImage(issueId: string, localUri: string): Promise<string> {
  const fileName = `${PREFIX}${issueId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await uriToArrayBuffer(localUri);
  } catch (e) {
    throw new Error(
      e instanceof Error ? `Read image failed: ${e.message}` : 'Read image failed'
    );
  }

  const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });

  if (error) {
    throw new Error(
      error.message === 'Network request failed'
        ? 'Upload failed: check your internet connection and that the app is signed in.'
        : `Upload failed: ${error.message}`
    );
  }

  return data.path;
}

/**
 * Convert a stored path (from issues.image_uris) to a public URL for display.
 * Pass-through if the value is already a full URL (legacy).
 */
export function getIssueImagePublicUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(pathOrUrl);
  return data.publicUrl;
}

/**
 * Permanently delete issue images from storage. Call when resolving an issue.
 * Paths must be the stored paths (e.g. issue/<issueId>/file.jpg), not full URLs.
 */
export async function deleteIssueImagesFromStorage(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const pathsToDelete = paths.filter((p) => !p.startsWith('http'));
  if (pathsToDelete.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(pathsToDelete);
  if (error) throw new Error(`Failed to delete issue images: ${error.message}`);
}
