/**
 * Save an image from a URL to the device:
 * - Web: trigger browser download (e.g. to Downloads / hapyjo-images).
 * - Native: save to app's hapyjo-images folder (visible in Files app).
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const HAPYJO_IMAGES_DIR = 'hapyjo-images';

/**
 * Saves the image at imageUrl to the device. suggestedName is used as the filename (e.g. "trip-123-start.jpg").
 * On web this triggers a download; on native the file is saved under documentDirectory/hapyjo-images/.
 */
export async function saveImageToDevice(imageUrl: string, suggestedName: string): Promise<void> {
  const ext = suggestedName.includes('.') ? '' : '.jpg';
  const filename = suggestedName.endsWith('.jpg') || suggestedName.endsWith('.jpeg') || suggestedName.endsWith('.png') ? suggestedName : `${suggestedName}${ext}`;

  if (Platform.OS === 'web') {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return;
  }

  const dir = (FileSystem.documentDirectory ?? '') + HAPYJO_IMAGES_DIR + '/';
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const filePath = dir + filename;
  const { status } = await FileSystem.downloadAsync(imageUrl, filePath);
  if (status !== 200) throw new Error(`Download failed: ${status}`);
}
