import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const MAP_HEIGHT = 350;
const ZOOM = 15;

/**
 * Renders a map preview with a marker at (latitude, longitude).
 * Uses Leaflet + OSM in a WebView. Height 350px, zoom 15.
 */
export function MapPreview({
  latitude,
  longitude,
  width = '100%',
  style,
}: {
  latitude: number;
  longitude: number;
  width?: number | string;
  style?: object;
}) {
  const html = useMemo(
    () => `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>body{margin:0;}.map{width:100%;height:100%;}<\/style>
</head>
<body>
  <div id="map" class="map"><\/div>
  <script>
    var map = L.map('map').setView([${latitude}, ${longitude}], ${ZOOM});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.marker([${latitude}, ${longitude}]).addTo(map);
  <\/script>
</body>
</html>`,
    [latitude, longitude]
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.wrap, style, { width: width as number }]}>
        <iframe
          title="Map"
          srcDoc={html}
          style={{ width: '100%', height: MAP_HEIGHT, border: 0, borderRadius: 8 }}
          sandbox="allow-scripts allow-same-origin"
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style, typeof width === 'number' ? { width } : undefined]}>
      <WebView
        source={{ html }}
        style={[styles.webview, { height: MAP_HEIGHT }]}
        scrollEnabled={false}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 8 },
  webview: { width: '100%', backgroundColor: '#e2e8f0' },
});
