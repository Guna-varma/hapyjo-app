import { useState, useCallback } from 'react';
import * as Location from 'expo-location';

const GPS_TIMEOUT_MS = 15000;

export interface GpsLocationResult {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  street?: string;
  postalCode?: string;
  fullAddress: string;
}

export interface GpsCoordsOnly {
  latitude: number;
  longitude: number;
}

export interface UseGpsLocationReturn {
  getCurrentLocation: () => Promise<GpsCoordsOnly>;
  loading: boolean;
  error: string | null;
  lastResult: GpsCoordsOnly | null;
}

export function useGpsLocation(): UseGpsLocationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<GpsCoordsOnly | null>(null);

  const getCurrentLocation = useCallback(async (): Promise<GpsCoordsOnly> => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const { status: requested } = await Location.requestForegroundPermissionsAsync();
        if (requested !== 'granted') {
          throw new Error('Location permission denied');
        }
      }

      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
          mayShowUserSettings: true,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GPS timeout')), GPS_TIMEOUT_MS)
        ),
      ]);

      const result: GpsCoordsOnly = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setLastResult(result);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get location';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getCurrentLocation, loading, error, lastResult };
}
