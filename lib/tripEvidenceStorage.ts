import { supabase } from '@/lib/supabase';

const BUCKET = 'issue-images';

function extractStoragePath(urlOrPath: string | null | undefined): string | null {
  const raw = String(urlOrPath ?? '').trim();
  if (!raw) return null;
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return raw;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = raw.indexOf(marker);
  if (idx === -1) return null;
  const path = raw.slice(idx + marker.length).split('?')[0].trim();
  return path || null;
}

export async function deleteTripEvidencePhotos(urls: (string | null | undefined)[]): Promise<void> {
  const paths = Array.from(
    new Set(
      urls
        .map(extractStoragePath)
        .filter((p): p is string => !!p)
    )
  );
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw new Error(`Failed to delete trip evidence photos: ${error.message}`);
}
