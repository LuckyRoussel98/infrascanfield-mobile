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

import { useInstanceStore } from './instanceStore';

// IMPORTANT : do NOT statically import `@/api/endpoints/auth` here — it would
// create a require cycle (auth -> client -> authStore -> auth). We use a
// dynamic import inside the action callbacks so the cycle is broken.

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
  /**
   * Switch to a different instance and rehydrate its token + persisted user data
   * (if any). Returns true when a valid in-memory session was loaded for the new
   * instance, false when the caller should redirect to /(auth)/login.
   */
  switchInstance: (instanceId: string) => Promise<boolean>;
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
          // First, migrate any pre-Bloc-F single-instance token onto the
          // currently active instance (if there is one).
          const active = useInstanceStore.getState().getActive();
          if (active) {
            await secureStorage.migrateLegacyToken(active.id);
            const token = await secureStorage.getToken(active.id);
            const expiresAt = await secureStorage.getTokenExpiry(active.id);
            if (token) {
              set({ token, expiresAt, hydrated: true });
              logger.debug('authStore.bootstrap : token rehydrated for active instance', {
                instanceId: active.id,
              });
              return;
            }
          }
          set({ hydrated: true });
        } catch (e) {
          logger.warn('authStore.bootstrap failed', e);
          set({ hydrated: true });
        }
      },

      setSession: async ({ token, expiresAt, user, permissions, settings, license }) => {
        const active = useInstanceStore.getState().getActive();
        if (!active) {
          throw new Error('authStore.setSession: no active instance');
        }
        // Defensive: when the server responds with an HTML error page (eg the
        // module isn't installed on this Dolibarr instance), axios still
        // resolves and `token` arrives as undefined. Bail out with a clear
        // message instead of letting expo-secure-store throw the cryptic
        // "value must be strings" error.
        if (typeof token !== 'string' || token.length === 0) {
          throw new Error(
            'Réponse serveur invalide : pas de token. Le module InfraSScanField est-il bien installé et activé sur cette instance ?',
          );
        }
        await secureStorage.setToken(active.id, token, expiresAt);
        useInstanceStore.getState().updateInstance(active.id, { lastUserLogin: user?.login ?? '' });
        set({ token, expiresAt, user, permissions, settings, license, hydrated: true });
      },

      logout: async (options) => {
        if (options?.callServer !== false) {
          try {
            // Dynamic import breaks the require cycle with @/api/endpoints/auth
            const { logout: logoutApi } = await import('@/api/endpoints/auth');
            await logoutApi();
          } catch (e) {
            logger.warn('authStore.logout : server call failed (token may already be invalid)', e);
          }
        }
        const active = useInstanceStore.getState().getActive();
        if (active) await secureStorage.clearToken(active.id);
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
        const active = useInstanceStore.getState().getActive();
        if (!active) return false;
        try {
          const { refresh: refreshApi } = await import('@/api/endpoints/auth');
          const res = await refreshApi();
          await secureStorage.setToken(active.id, res.token, res.expires_at);
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

      switchInstance: async (instanceId) => {
        useInstanceStore.getState().setActive(instanceId);
        // Reset in-memory session — the rehydration below will populate
        // token + expiresAt from the new instance's secure-store keys.
        set({
          token: null,
          expiresAt: null,
          user: null,
          permissions: null,
          settings: null,
          license: null,
        });
        try {
          const token = await secureStorage.getToken(instanceId);
          const expiresAt = await secureStorage.getTokenExpiry(instanceId);
          if (!token) return false;
          set({ token, expiresAt });
          // user/permissions/settings/license live in MMKV under the auth
          // key — that's a single shared slot, so they may now be stale.
          // Trigger a /auth/me refresh in the background to re-sync.
          void (async () => {
            try {
              const { me } = await import('@/api/endpoints/auth');
              const res = await me();
              set({
                user: res.user,
                permissions: res.permissions,
                settings: res.settings,
              });
            } catch (e) {
              logger.warn('authStore.switchInstance: /auth/me failed', e);
            }
          })();
          return true;
        } catch (e) {
          logger.warn('authStore.switchInstance failed', e);
          return false;
        }
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
