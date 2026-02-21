/**
 * Generate OpenStreetMap tile URL for mini-map preview.
 * No API key. Use zoom 19 for street-level detail.
 * Tile server: https://tile.openstreetmap.org/{z}/{x}/{y}.png
 */

const OSM_TILE_BASE = 'https://tile.openstreetmap.org';

/**
 * Convert lat/lon to OSM tile indices at given zoom.
 * tileX = floor((lon + 180) / 360 * 2^zoom)
 * tileY = floor((1 - ln(tan(latRad) + sec(latRad)) / π) / 2 * 2^zoom)
 */
function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/**
 * Return the tile URL containing the given point at zoom 19.
 * Use this URL in an <Image source={{ uri }} /> for the mini-map preview.
 */
export function generateOSMStaticMapUrl(
  lat: number,
  lon: number,
  zoom: number = 19
): string {
  const { x, y } = latLonToTile(lat, lon, zoom);
  return `${OSM_TILE_BASE}/${zoom}/${x}/${y}.png`;
}

export function generateOSMStaticMap(lat: number, lon: number, zoom?: number): string {
  return generateOSMStaticMapUrl(lat, lon, zoom);
}
