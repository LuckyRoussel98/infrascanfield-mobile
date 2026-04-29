import * as Location from 'expo-location';

import type { Geolocation } from '@/types/api';

import { logger } from './logger';

export type GeolocationResult =
  | { ok: true; coords: Geolocation }
  | { ok: false; reason: 'permission_denied' | 'services_off' | 'timeout' | 'error' };

/**
 * One-shot geolocation fetch suitable for tagging an equipment photo.
 * Asks for foreground permission, returns coords with accuracy.
 *
 * Uses `Location.Accuracy.Balanced` — finer than network-only, but doesn't
 * keep the GPS chip on for long. The whole call is bounded by `timeoutMs`.
 */
export async function getCurrentPosition(
  timeoutMs: number = 8000,
): Promise<GeolocationResult> {
  try {
    const services = await Location.hasServicesEnabledAsync();
    if (!services) return { ok: false, reason: 'services_off' };

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ok: false, reason: 'permission_denied' };

    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), timeoutMs);
    });

    const result = await Promise.race([positionPromise, timeoutPromise]);
    if (result === 'timeout') {
      logger.warn('geolocation timeout', { timeoutMs });
      return { ok: false, reason: 'timeout' };
    }

    return {
      ok: true,
      coords: {
        lat: result.coords.latitude,
        lng: result.coords.longitude,
        accuracy: result.coords.accuracy ?? 0,
      },
    };
  } catch (e) {
    logger.warn('geolocation failed', e);
    return { ok: false, reason: 'error' };
  }
}
