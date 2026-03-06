import React, { useMemo } from 'react';
import { View, Image, StyleSheet, Text, TouchableOpacity, Linking } from 'react-native';

const MAP_HEIGHT = 220;
const MAP_BAR = 40;
const TILE_GRID_HEIGHT = MAP_HEIGHT - MAP_BAR; // 180
const ZOOM = 15;

/**
 * Convert lat/lon to OSM tile indices.
 * https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
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

const OPENSTREETMAP_TILE = 'https://tile.openstreetmap.org';

/**
 * Free map preview: OpenStreetMap tiles (no API key).
 * Uses 4 tile images in a 2x2 grid. Optional compact mode for list/gallery cards.
 */
export function MapPreview({
  latitude,
  longitude,
  width = '100%',
  style,
  compact = false,
}: {
  latitude: number;
  longitude: number;
  width?: number | string;
  style?: object;
  /** When true, renders a smaller preview (e.g. for gallery cards). */
  compact?: boolean;
}) {
  const height = compact ? 56 : MAP_HEIGHT;
  const barHeight = compact ? 14 : MAP_BAR;
  const gridHeight = height - barHeight;

  const { x, y } = useMemo(
    () => latLonToTile(latitude, longitude, ZOOM),
    [latitude, longitude]
  );

  const tileUrls = useMemo(
    () => [
      `${OPENSTREETMAP_TILE}/${ZOOM}/${x}/${y}.png`,
      `${OPENSTREETMAP_TILE}/${ZOOM}/${x + 1}/${y}.png`,
      `${OPENSTREETMAP_TILE}/${ZOOM}/${x}/${y + 1}.png`,
      `${OPENSTREETMAP_TILE}/${ZOOM}/${x + 1}/${y + 1}.png`,
    ],
    [x, y]
  );

  const openInMaps = () => {
    const url = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=16`;
    Linking.openURL(url).catch(() => {});
  };

  const containerWidth = typeof width === 'number' ? width : undefined;
  const isValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

  if (!isValidCoords) {
    return (
      <View style={[styles.wrap, styles.fallback, { height }, style, containerWidth ? { width: containerWidth } : undefined]}>
        <Text style={[styles.fallbackText, compact && styles.fallbackTextCompact]}>No location</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }, style, containerWidth ? { width: containerWidth } : undefined]}>
      <View style={[styles.tileGrid, { height: gridHeight }]}>
        {tileUrls.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={[styles.tile, { height: gridHeight / 2 }]}
            resizeMode="cover"
          />
        ))}
      </View>
      <View style={[styles.fallbackBar, { paddingVertical: compact ? 2 : 6, paddingHorizontal: compact ? 6 : 10 }]}>
        <Text style={[styles.coordsText, compact && styles.coordsTextCompact]} numberOfLines={1}>
          {latitude.toFixed(compact ? 4 : 5)}, {longitude.toFixed(compact ? 4 : 5)}
        </Text>
        {!compact && (
          <TouchableOpacity onPress={openInMaps} style={styles.linkBtn} activeOpacity={0.7}>
            <Text style={styles.linkText}>View on map</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderRadius: 8,
    height: MAP_HEIGHT,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#e2e8f0',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: TILE_GRID_HEIGHT,
  },
  tile: {
    width: '50%',
    height: TILE_GRID_HEIGHT / 2,
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  coordsText: {
    fontSize: 11,
    color: '#fff',
    flex: 1,
  },
  coordsTextCompact: {
    fontSize: 9,
  },
  fallbackTextCompact: {
    fontSize: 11,
  },
  linkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  linkText: {
    fontSize: 12,
    color: '#93c5fd',
    fontWeight: '600',
  },
  fallbackText: {
    fontSize: 14,
    color: '#64748b',
  },
});
