/**
 * Pick a .txt file and return its UTF-8 content.
 * Used for survey TOP (multiple) and Depth (single) files.
 */
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';

export interface PickedSurveyFile {
  name: string;
  content: string;
}

export async function pickSurveyTextFile(): Promise<PickedSurveyFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'text/plain',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const uri = asset.uri;
  const name = asset.name ?? 'file.txt';

  const content = await readAsStringAsync(uri, { encoding: 'utf8' });
  return { name, content };
}
