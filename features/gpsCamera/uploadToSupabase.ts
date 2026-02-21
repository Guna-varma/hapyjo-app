import { readAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const BUCKET = 'gps-images';
const PREFIX = 'gps/';

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

/** Uploads image to Supabase Storage (gps-images bucket). Returns public URL only after upload is persisted. */
export async function uploadToSupabase(compressedImageUri: string): Promise<string> {
  const fileName = `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await uriToArrayBuffer(compressedImageUri);
  } catch (e) {
    throw new Error(
      e instanceof Error ? `Read image failed: ${e.message}` : 'Read image failed'
    );
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, arrayBuffer, {
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
