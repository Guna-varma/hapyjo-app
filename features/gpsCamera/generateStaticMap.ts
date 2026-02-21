/**
 * Generate Google Static Maps API URL for satellite mini-map.
 * Requires EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env
 */

const BASE = 'https://maps.googleapis.com/maps/api/staticmap';

export function generateStaticMapUrl(lat: number, long: number, size = '300x300', zoom = 19): string {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  if (!key) {
    return '';
  }
  const params = new URLSearchParams({
    center: `${lat},${long}`,
    zoom: String(zoom),
    size,
    maptype: 'satellite',
    markers: `color:red|${lat},${long}`,
    key,
  });
  return `${BASE}?${params.toString()}`;
}

export function generateStaticMap(lat: number, long: number, size = '300x300', zoom = 19): string {
  return generateStaticMapUrl(lat, long, size, zoom);
}
