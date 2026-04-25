import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  /** Clear everything (logout). */
  logout: () => Promise<void>;
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

      logout: async () => {
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
