import * as Location from 'expo-location';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface GetCurrentPositionOptions {
  /** Timeout in ms (default 10000). Use high accuracy only for START/END capture. */
  timeoutMs?: number;
  /** If true, on timeout/failure return cached last known position when available (default true). */
  useCachedFallback?: boolean;
  /** If true, retry once with lower accuracy on timeout/failure (default true). */
  retryWithLowAccuracy?: boolean;
  /** Accuracy for first attempt. Use Accuracy.High for START/END capture only. */
  accuracy?: Location.LocationAccuracy;
}

/** Cached last known position so we never block UI; fallback when fresh GPS fails. */
let cachedPosition: { lat: number; lon: number } | null = null;

function isValidCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90;
}

function isValidLon(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180;
}

/**
 * Returns consistent { lat, lon }. Use this for trip start/end so you never get null coordinates.
 * - Uses Promise.race with timeout (default 10s).
 * - On timeout/failure: if useCachedFallback and we have cached position, returns it; otherwise throws.
 * - Never block UI: run this inside withLoading or after user action; do not call on main thread in a blocking way.
 */
export async function getCurrentPositionWithTimeout(
  options: GetCurrentPositionOptions = {}
): Promise<Location.LocationObject> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    useCachedFallback = true,
    retryWithLowAccuracy = true,
    accuracy = Location.Accuracy.Balanced,
  } = options;

  const tryGet = (acc: Location.LocationAccuracy) =>
    Promise.race([
      Location.getCurrentPositionAsync({ accuracy: acc }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Location request timed out. Please try again.')),
          timeoutMs
        )
      ),
    ]);

  try {
    const result = await tryGet(accuracy);
    const lat = result?.coords?.latitude;
    const lon = result?.coords?.longitude;
    if (isValidCoord(lat) && isValidLon(lon)) {
      cachedPosition = { lat, lon };
      return result;
    }
    if (useCachedFallback && cachedPosition) {
      return {
        ...result,
        coords: {
          ...result.coords,
          latitude: cachedPosition.lat,
          longitude: cachedPosition.lon,
        },
      } as Location.LocationObject;
    }
    throw new Error('Invalid GPS coordinates received.');
  } catch (first) {
    if (retryWithLowAccuracy && accuracy !== Location.Accuracy.Lowest) {
      try {
        const result = await tryGet(Location.Accuracy.Lowest);
        const lat = result?.coords?.latitude;
        const lon = result?.coords?.longitude;
        if (isValidCoord(lat) && isValidLon(lon)) {
          cachedPosition = { lat, lon };
          return result;
        }
      } catch {
        // fall through to fallback or throw
      }
    }
    if (useCachedFallback && cachedPosition) {
      return {
        coords: {
          latitude: cachedPosition.lat,
          longitude: cachedPosition.lon,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as Location.LocationObject;
    }
    throw first;
  }
}

/** Result type for coords-only usage (trip start/end). */
export interface CoordsResult {
  lat: number;
  lon: number;
}

/**
 * Get current position and return only { lat, lon }. Use for trip start/end.
 * - 10s timeout, cached fallback when allowed.
 * - Throws if GPS fails and no cache (caller should prevent trip start with message).
 */
export async function getCoordsWithTimeout(
  options: GetCurrentPositionOptions = {}
): Promise<CoordsResult> {
  const pos = await getCurrentPositionWithTimeout(options);
  const lat = pos?.coords?.latitude;
  const lon = pos?.coords?.longitude;
  if (!isValidCoord(lat) || !isValidLon(lon)) {
    if (cachedPosition) return cachedPosition;
    throw new Error('Could not get current position. Please ensure location is enabled and try again.');
  }
  return { lat, lon };
}

/** Optional coords from photo or start for fallback. */
export interface FallbackCoords {
  lat: number;
  lon: number;
}

/**
 * Get coords for trip END only. NEVER throws — use fallback chain so driver is never blocked.
 * Order: 1) photoCoords if valid, 2) high-accuracy fetch, 3) cached, 4) startCoords.
 * Use this in handleEndTrip so trip end always succeeds from a coord perspective.
 */
export async function getCoordsForTripEnd(
  options: {
    photoCoords?: FallbackCoords | null;
    startCoords?: FallbackCoords | null;
    timeoutMs?: number;
  } = {}
): Promise<CoordsResult> {
  const { photoCoords, startCoords, timeoutMs = 10_000 } = options;

  if (photoCoords && isValidCoord(photoCoords.lat) && isValidLon(photoCoords.lon)) {
    return { lat: photoCoords.lat, lon: photoCoords.lon };
  }

  try {
    const pos = await getCurrentPositionWithTimeout({
      timeoutMs,
      useCachedFallback: true,
      retryWithLowAccuracy: true,
      accuracy: Location.Accuracy.High,
    });
    const lat = pos?.coords?.latitude;
    const lon = pos?.coords?.longitude;
    if (isValidCoord(lat) && isValidLon(lon)) return { lat, lon };
  } catch {
    // fall through to cached or start
  }

  if (cachedPosition) return cachedPosition;
  if (startCoords && isValidCoord(startCoords.lat) && isValidLon(startCoords.lon)) {
    return { lat: startCoords.lat, lon: startCoords.lon };
  }

  return { lat: 0, lon: 0 };
}
