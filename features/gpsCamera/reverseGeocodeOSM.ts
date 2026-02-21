/**
 * Free reverse geocoding via OpenStreetMap Nominatim.
 * - On web: uses Supabase Edge Function proxy to avoid CORS (browsers block direct Nominatim).
 * - On native: calls Nominatim directly (no CORS).
 * No API key. Respect usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'HapyJo/1.0 (GPS Camera; contact@hapyjo.com)';

export interface OSMAddressResult {
  display_name: string;
  city: string | undefined;
  state: string | undefined;
  country: string | undefined;
  postcode: string | undefined;
}

interface NominatimResponse {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

const REQUEST_DELAY_MS = 1100;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Use Edge Function on web to avoid CORS; direct fetch on native. */
async function reverseGeocodeViaProxy(lat: number, lon: number): Promise<OSMAddressResult> {
  const { data, error } = await supabase.functions.invoke<OSMAddressResult>('reverse-geocode', {
    body: { lat, lon },
  });
  if (error) throw new Error(error.message || 'Reverse geocode failed');
  if (!data) throw new Error('No data from reverse-geocode');
  return data;
}

async function reverseGeocodeDirect(lat: number, lon: number): Promise<OSMAddressResult> {
  const url = `${NOMINATIM_BASE}?format=json&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Nominatim ${res.status}: ${res.statusText}`);
  }
  const data = (await res.json()) as NominatimResponse;
  const addr = data.address ?? {};
  const city = addr.city ?? addr.town ?? addr.village;
  return {
    display_name: data.display_name ?? `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
    city,
    state: addr.state,
    country: addr.country,
    postcode: addr.postcode,
  };
}

export async function reverseGeocodeOSM(
  lat: number,
  lon: number,
  retries = 2
): Promise<OSMAddressResult> {
  const isWeb = Platform.OS === 'web';
  const doRequest = isWeb ? () => reverseGeocodeViaProxy(lat, lon) : () => reverseGeocodeDirect(lat, lon);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) await delay(REQUEST_DELAY_MS * attempt);
      return await doRequest();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) continue;
    }
  }

  throw lastError ?? new Error('Reverse geocode failed');
}
