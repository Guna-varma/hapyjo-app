/**
 * Trip/task start and end photo upload. Photos are compressed to ~50KB before upload.
 * Used for: truck (speedometer + fuel gauge), machine (hour meter + fuel gauge).
 */

import { readAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { compressIssueImage } from '@/lib/compressIssueImage';

const BUCKET = 'issue-images';
const PREFIX = 'trip/';

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
 * Compress to ~50KB and upload one trip photo. Returns public URL for storage in assigned_trips.
 */
export async function uploadTripPhoto(assignedTripId: string, kind: 'start' | 'end', localUri: string): Promise<string> {
  const compressed = await compressIssueImage(localUri);
  const fileName = `${PREFIX}${assignedTripId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const arrayBuffer = await uriToArrayBuffer(compressed);

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

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/**
 * Get public URL for display. Pass-through if already a full URL.
 */
export function getTripPhotoPublicUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(pathOrUrl);
  return data.publicUrl;
}
