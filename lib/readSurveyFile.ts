/**
 * Pick a .txt file and return its UTF-8 content.
 * Used for survey TOP (multiple) and Depth (single) files.
 * On web, expo-file-system is not available; we use fetch(blob URI) or base64 as fallback.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';

export interface PickedSurveyFile {
  name: string;
  content: string;
}

function base64ToUtf8Safe(base64: string): string {
  if (typeof atob === 'undefined' || !base64 || typeof base64 !== 'string') return '';
  const sanitized = base64.replace(/\s/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
  try {
    const binary = atob(sanitized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export async function pickSurveyTextFile(): Promise<PickedSurveyFile | null> {
  const isWeb = Platform.OS === 'web';

  const result = await DocumentPicker.getDocumentAsync({
    type: 'text/plain',
    copyToCacheDirectory: !isWeb,
    multiple: false,
    ...(isWeb && { base64: true }),
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const name = asset.name ?? 'file.txt';

  let content: string;
  if (isWeb) {
    content = '';
    // Prefer fetch(uri): on web the picker often returns a blob URL we can read as text.
    if (asset.uri) {
      try {
        const res = await fetch(asset.uri);
        content = await res.text();
      } catch {
        // ignore
      }
    }
    // If fetch didn't yield content, try base64 if present (sanitized and safe decode).
    if (content === '' && (asset as { base64?: string }).base64) {
      content = base64ToUtf8Safe((asset as { base64: string }).base64);
    }
  } else {
    content = await readAsStringAsync(asset.uri, { encoding: 'utf8' });
  }

  return { name, content };
}
