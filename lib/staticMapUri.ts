/**
 * Map preview: MapTiler static map (with marker) + OSM tiles fallback.
 * Used by WorkPhotoDetailModal and WorkProgressGalleryScreen.
 */

const MAPTILER_KEY = 'WqR9YbCXUfVRNH72YEgn';
const OSM_TILE = 'https://tile.openstreetmap.org';
const ZOOM = 15;

/**
 * MapTiler: single static map image with a red marker at (lat, lng).
 * No seam, and the point is visible on the map.
 */
export function buildStaticMapUri(
  lat: number,
  lng: number,
  size: string = '600x300'
): string {
  return `https://api.maptiler.com/maps/streets/static/${lng},${lat},15/${size}.png?key=${MAPTILER_KEY}&markers=${lng},${lat},red`;
}

/**
 * Convert lat/lon to OSM tile indices (for fallback).
 * @see https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */
function latLonToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/**
 * OSM fallback: 4 tile URLs for a 2x2 grid (no API key).
 */
export function getOSMMapTileUrls(lat: number, lng: number): [string, string, string, string] {
  const { x, y } = latLonToTile(lat, lng, ZOOM);
  return [
    `${OSM_TILE}/${ZOOM}/${x}/${y}.png`,
    `${OSM_TILE}/${ZOOM}/${x + 1}/${y}.png`,
    `${OSM_TILE}/${ZOOM}/${x}/${y + 1}.png`,
    `${OSM_TILE}/${ZOOM}/${x + 1}/${y + 1}.png`,
  ];
}
