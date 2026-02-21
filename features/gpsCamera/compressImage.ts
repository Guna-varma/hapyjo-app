import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 1280;
const COMPRESS_QUALITY = 0.4;

export async function compressImage(mergedImageUri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      mergedImageUri,
      [{ resize: { width: MAX_WIDTH } }],
      {
        compress: COMPRESS_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );
    if (!result.uri) throw new Error('Compression produced no output');
    return result.uri;
  } catch (e) {
    throw new Error(
      e instanceof Error ? `Image compression failed: ${e.message}` : 'Image compression failed'
    );
  }
}
