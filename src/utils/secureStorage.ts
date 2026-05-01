import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { generateUuid } from './format';
import { logger } from './logger';

/**
 * Storage tiers used by the app :
 *
 *  - secureStorage : Android Keystore / iOS Keychain. Used ONLY for the X-IFS-Token.
 *    Limit ~2 KB per key. Hardware-backed when available.
 *
 *  - mmkv : on-device encrypted key/value store. Used for non-secret persistent state
 *    (Dolibarr URL, last route, settings cache, etc.). Fast, no async.
 */

// Legacy keys (single-instance, pre-Bloc-F). Kept for one-shot migration only.
const LEGACY_KEYS = {
  X_IFS_TOKEN: 'x_ifs_token',
  X_IFS_TOKEN_EXPIRES_AT: 'x_ifs_token_expires_at',
} as const;

const SECURE_KEYS = {
  DEVICE_UUID: 'device_uuid',
} as const;

// SecureStore.setItemAsync rejects characters outside [A-Za-z0-9._-]. UUIDs include
// hyphens which are fine, but be defensive: replace anything else with `_`.
function sanitize(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, '_');
}

function tokenKey(instanceId: string): string {
  return `x_ifs_token__${sanitize(instanceId)}`;
}

function tokenExpiryKey(instanceId: string): string {
  return `x_ifs_token_expires_at__${sanitize(instanceId)}`;
}

export const secureStorage = {
  /**
   * Read the token for a specific instance.
   * If `instanceId` is omitted (legacy callers), falls back to the pre-Bloc-F key.
   */
  async getToken(instanceId?: string): Promise<string | null> {
    try {
      if (instanceId) return await SecureStore.getItemAsync(tokenKey(instanceId));
      return await SecureStore.getItemAsync(LEGACY_KEYS.X_IFS_TOKEN);
    } catch (e) {
      logger.warn('secureStorage.getToken failed', e);
      return null;
    }
  },

  async setToken(instanceId: string, token: string, expiresAt?: string): Promise<void> {
    // Hard guard against non-string values reaching SecureStore — its native
    // validator throws a cryptic "value must be strings" message that's
    // useless for diagnosing where the bad value came from.
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error(`secureStorage.setToken: token must be a non-empty string (got ${typeof token})`);
    }
    if (expiresAt !== undefined && typeof expiresAt !== 'string') {
      throw new Error(`secureStorage.setToken: expiresAt must be a string when provided (got ${typeof expiresAt})`);
    }
    try {
      await SecureStore.setItemAsync(tokenKey(instanceId), token);
      if (expiresAt) {
        await SecureStore.setItemAsync(tokenExpiryKey(instanceId), expiresAt);
      }
    } catch (e) {
      logger.error('secureStorage.setToken failed', e);
      throw e;
    }
  },

  async getTokenExpiry(instanceId?: string): Promise<string | null> {
    try {
      if (instanceId) return await SecureStore.getItemAsync(tokenExpiryKey(instanceId));
      return await SecureStore.getItemAsync(LEGACY_KEYS.X_IFS_TOKEN_EXPIRES_AT);
    } catch {
      return null;
    }
  },

  async clearToken(instanceId: string): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(tokenKey(instanceId)),
        SecureStore.deleteItemAsync(tokenExpiryKey(instanceId)),
      ]);
    } catch (e) {
      logger.warn('secureStorage.clearToken failed', e);
    }
  },

  /**
   * One-shot migration: if a legacy single-instance token exists in secure-store,
   * move it under the given instanceId and delete the old keys. Returns true if
   * migration happened. Safe to call repeatedly — no-ops once cleared.
   */
  async migrateLegacyToken(instanceId: string): Promise<boolean> {
    try {
      const legacyToken = await SecureStore.getItemAsync(LEGACY_KEYS.X_IFS_TOKEN);
      if (!legacyToken) return false;
      const legacyExpiry = await SecureStore.getItemAsync(LEGACY_KEYS.X_IFS_TOKEN_EXPIRES_AT);
      await SecureStore.setItemAsync(tokenKey(instanceId), legacyToken);
      if (legacyExpiry) await SecureStore.setItemAsync(tokenExpiryKey(instanceId), legacyExpiry);
      await Promise.all([
        SecureStore.deleteItemAsync(LEGACY_KEYS.X_IFS_TOKEN),
        SecureStore.deleteItemAsync(LEGACY_KEYS.X_IFS_TOKEN_EXPIRES_AT),
      ]);
      logger.info('secureStorage: migrated legacy token to instance', { instanceId });
      return true;
    } catch (e) {
      logger.warn('secureStorage.migrateLegacyToken failed', e);
      return false;
    }
  },

  /**
   * Get-or-create the device UUID. Persists in secure-store so it survives login/logout
   * and app reinstalls (depending on Android backup policy). Stable per app install.
   */
  async getDeviceUuid(): Promise<string> {
    try {
      let uuid = await SecureStore.getItemAsync(SECURE_KEYS.DEVICE_UUID);
      if (!uuid) {
        uuid = generateUuid();
        await SecureStore.setItemAsync(SECURE_KEYS.DEVICE_UUID, uuid);
      }
      return uuid;
    } catch (e) {
      logger.warn('secureStorage.getDeviceUuid failed, returning ephemeral', e);
      return generateUuid();
    }
  },
};

/**
 * Adapter for Zustand's persist middleware, backed by AsyncStorage.
 * Compatible with Expo Go (no native module beyond what's bundled).
 *
 * Note : we keep the symbol name `mmkvStorage` for backwards compat with
 * existing imports in the stores. A future Phase 2 EAS dev build can swap
 * the implementation back to react-native-mmkv for sync + better perf.
 */
export const mmkvStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch (e) {
      logger.warn('AsyncStorage.getItem failed', e);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (e) {
      logger.warn('AsyncStorage.setItem failed', e);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (e) {
      logger.warn('AsyncStorage.removeItem failed', e);
    }
  },
};
