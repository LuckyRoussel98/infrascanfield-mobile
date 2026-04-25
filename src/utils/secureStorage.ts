import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

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

const SECURE_KEYS = {
  X_IFS_TOKEN: 'x_ifs_token',
  X_IFS_TOKEN_EXPIRES_AT: 'x_ifs_token_expires_at',
} as const;

export const secureStorage = {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SECURE_KEYS.X_IFS_TOKEN);
    } catch (e) {
      logger.warn('secureStorage.getToken failed', e);
      return null;
    }
  },

  async setToken(token: string, expiresAt?: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(SECURE_KEYS.X_IFS_TOKEN, token);
      if (expiresAt) {
        await SecureStore.setItemAsync(SECURE_KEYS.X_IFS_TOKEN_EXPIRES_AT, expiresAt);
      }
    } catch (e) {
      logger.error('secureStorage.setToken failed', e);
      throw e;
    }
  },

  async getTokenExpiry(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SECURE_KEYS.X_IFS_TOKEN_EXPIRES_AT);
    } catch {
      return null;
    }
  },

  async clearToken(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(SECURE_KEYS.X_IFS_TOKEN),
        SecureStore.deleteItemAsync(SECURE_KEYS.X_IFS_TOKEN_EXPIRES_AT),
      ]);
    } catch (e) {
      logger.warn('secureStorage.clearToken failed', e);
    }
  },
};

/**
 * MMKV instance (encrypted at rest with a derived key per app install).
 * Synchronous read/write. Used by Zustand persist middleware.
 */
export const mmkv = new MMKV({ id: 'infrasscanfield' });

/**
 * Adapter for Zustand's persist middleware (createJSONStorage expects async-style API).
 */
export const mmkvStorage = {
  getItem: (name: string): string | null => {
    return mmkv.getString(name) ?? null;
  },
  setItem: (name: string, value: string): void => {
    mmkv.set(name, value);
  },
  removeItem: (name: string): void => {
    mmkv.delete(name);
  },
};
