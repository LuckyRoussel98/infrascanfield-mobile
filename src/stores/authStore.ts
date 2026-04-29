import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { logout as logoutApi, refresh as refreshApi } from '@/api/endpoints/auth';
import type {
  ClientSettings,
  LicenseInfo,
  Permissions,
  UserPublic,
} from '@/types/api';
import { logger } from '@/utils/logger';
import { mmkvStorage, secureStorage } from '@/utils/secureStorage';

/**
 * Auth state held in memory and persisted across launches.
 *
 * Persistence split :
 *  - X-IFS-Token + expiry  -> expo-secure-store (Android Keystore / iOS Keychain)
 *  - user / permissions / settings / license / expiresAt mirror -> MMKV via Zustand persist
 *
 * The token is intentionally NOT serialized through Zustand persist : we re-hydrate
 * it asynchronously from secureStorage during boot (see `bootstrap()`).
 */
export interface AuthState {
  token: string | null;
  expiresAt: string | null;
  user: UserPublic | null;
  permissions: Permissions | null;
  settings: ClientSettings | null;
  license: LicenseInfo | null;
  hydrated: boolean;

  /** Called once at app boot to read the secure-store token and warm the in-memory state. */
  bootstrap: () => Promise<void>;
  /** Persist a fresh login response. */
  setSession: (payload: {
    token: string;
    expiresAt: string;
    user: UserPublic;
    permissions: Permissions;
    settings: ClientSettings;
    license: LicenseInfo;
  }) => Promise<void>;
  /** Clear everything (logout). Optionally calls /auth/logout server-side first. */
  logout: (options?: { callServer?: boolean }) => Promise<void>;
  /** Try to refresh the token via /auth/refresh. Returns true if refreshed, false otherwise. */
  refresh: () => Promise<boolean>;
  /** True iff a token is loaded AND not past its known expiry. */
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      expiresAt: null,
      user: null,
      permissions: null,
      settings: null,
      license: null,
      hydrated: false,

      bootstrap: async () => {
        try {
          const token = await secureStorage.getToken();
          const expiresAt = await secureStorage.getTokenExpiry();
          if (token) {
            set({ token, expiresAt, hydrated: true });
            logger.debug('authStore.bootstrap : token rehydrated');
          } else {
            set({ hydrated: true });
          }
        } catch (e) {
          logger.warn('authStore.bootstrap failed', e);
          set({ hydrated: true });
        }
      },

      setSession: async ({ token, expiresAt, user, permissions, settings, license }) => {
        await secureStorage.setToken(token, expiresAt);
        set({ token, expiresAt, user, permissions, settings, license, hydrated: true });
      },

      logout: async (options) => {
        if (options?.callServer !== false) {
          try {
            await logoutApi();
          } catch (e) {
            logger.warn('authStore.logout : server call failed (token may already be invalid)', e);
          }
        }
        await secureStorage.clearToken();
        set({
          token: null,
          expiresAt: null,
          user: null,
          permissions: null,
          settings: null,
          license: null,
        });
      },

      refresh: async () => {
        try {
          const res = await refreshApi();
          await secureStorage.setToken(res.token, res.expires_at);
          set({ token: res.token, expiresAt: res.expires_at });
          logger.debug('authStore.refresh : token refreshed', { expires_at: res.expires_at });
          return true;
        } catch (e) {
          logger.warn('authStore.refresh failed', e);
          return false;
        }
      },

      isAuthenticated: () => {
        const { token, expiresAt } = get();
        if (!token) return false;
        if (expiresAt) {
          const ts = new Date(expiresAt).getTime();
          if (!Number.isNaN(ts) && ts <= Date.now()) return false;
        }
        return true;
      },
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => mmkvStorage),
      // Token + expiresAt come from secureStorage (re-hydrated by bootstrap()) ;
      // here we only persist the non-secret session metadata.
      partialize: (state) => ({
        user: state.user,
        permissions: state.permissions,
        settings: state.settings,
        license: state.license,
      }),
    },
  ),
);
