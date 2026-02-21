import { supabase } from '@/lib/supabase';

export interface GpsRecordInsert {
  image_url: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
  captured_at: string;
}

export interface GpsRecordRow {
  id: string;
  user_id: string;
  image_url: string;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postal_code: string | null;
  captured_at: string;
  created_at: string;
}

/** Persists one GPS photo record to Supabase `gps_photos` table. Returns only after the row is saved in the DB. */
export async function saveGpsRecord(
  userId: string,
  record: Omit<GpsRecordInsert, 'captured_at'> & { captured_at?: string }
): Promise<GpsRecordRow> {
  const capturedAt = record.captured_at ?? new Date().toISOString();
  const row = {
    user_id: userId,
    image_url: record.image_url,
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    address: record.address ?? null,
    city: record.city ?? null,
    region: record.region ?? null,
    country: record.country ?? null,
    postal_code: record.postal_code ?? null,
    captured_at: capturedAt,
  };

  const { data, error } = await supabase
    .from('gps_photos')
    .insert(row)
    .select()
    .single();

  if (error) {
    throw new Error(`Save GPS record failed: ${error.message}. Check RLS allows INSERT for your user.`);
  }
  return data as GpsRecordRow;
}
