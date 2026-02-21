import React from 'react';
import { View, Text, Image } from 'react-native';
import { useResponsiveTheme } from '@/theme/responsive';
import type { GpsLocationResult } from './useGpsLocation';
import { formatIstTimestamp } from './formatIstTimestamp';
import { countryToFlag, getCountryCode } from './countryFlag';

export interface GpsOverlayProps {
  location: GpsLocationResult;
  staticMapUrl: string | null;
  capturedAt: Date;
}

export function GpsOverlay({ location, staticMapUrl, capturedAt }: GpsOverlayProps) {
  const theme = useResponsiveTheme();
  const cityStateCountry = [location.city, location.region, location.country].filter(Boolean).join(', ') || '—';
  const flag = location.country ? countryToFlag(getCountryCode(location.country)) : '🌍';
  const overlayBottom = theme.spacingLg;
  const overlayPadding = theme.scale(14);
  const mapHeight = theme.scaleMin(100);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: overlayBottom,
        left: theme.screenPadding,
        right: theme.screenPadding,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: overlayPadding,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacingSm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: theme.fontSizeTitle, marginRight: theme.spacingXs + 2 }}>{flag}</Text>
          <Text style={{ color: '#fff', fontSize: theme.fontSizeCaption + 1, fontWeight: '600', flex: 1 }} numberOfLines={1}>
            {cityStateCountry}
          </Text>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: theme.fontSizeCaption - 2, fontWeight: '600' }}>GPS Map Camera</Text>
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: theme.fontSizeCaption - 1, marginBottom: theme.spacingXs + 2 }} numberOfLines={2}>
        {location.fullAddress}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacingXs + 2 }}>
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: theme.fontSizeCaption - 1 }}>
          Lat {location.latitude.toFixed(5)}° Long {location.longitude.toFixed(5)}°
        </Text>
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: theme.fontSizeCaption - 1, marginBottom: theme.spacingSm }}>
        {formatIstTimestamp(capturedAt)}
      </Text>
      {staticMapUrl ? (
        <View style={{ borderRadius: theme.spacingSm, overflow: 'hidden', height: mapHeight, marginTop: theme.spacingXs }}>
          <Image
            source={{ uri: staticMapUrl }}
            style={{ width: '100%', height: mapHeight }}
            resizeMode="cover"
          />
        </View>
      ) : null}
    </View>
  );
}
