import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

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
