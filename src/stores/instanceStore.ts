import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { generateUuid } from '@/utils/format';
import { logger } from '@/utils/logger';
import { mmkvStorage } from '@/utils/secureStorage';

export interface Instance {
  /** Stable, locally-generated UUID. Used as the secure-store suffix for the per-instance token. */
  id: string;
  /** Dolibarr base URL, no trailing slash, eg `https://my-dolibarr.example.com`. */
  baseUrl: string;
  /** Free-text label shown in the instance list. Falls back to the host portion of baseUrl. */
  label: string;
  /** Last login used on this instance — speeds up switching. Empty until first successful login. */
  lastUserLogin: string;
  /** Unix ms timestamp at which the instance was first added. */
  addedAt: number;
}

interface InstanceState {
  instances: Instance[];
  activeId: string | null;
  hydrated: boolean;

  /** The active instance object, or null if none. */
  getActive: () => Instance | null;

  /**
   * Convenience accessor for client.ts and existing call sites that just need the URL.
   * Returns `null` when no active instance.
   */
  getBaseUrl: () => string | null;

  /**
   * Add a new instance. If `baseUrl` matches an existing one (case-insensitive,
   * trimmed, no trailing slash), the existing entry is reused and made active.
   */
  addInstance: (input: { baseUrl: string; label?: string }) => Instance;

  /** Set the active instance by id. No-op if id is unknown. */
  setActive: (id: string) => void;

  /**
   * Remove an instance by id. The caller is responsible for clearing the
   * associated secure-store token (see `secureStorage.clearTokenForInstance`).
   * If the removed instance was active, picks the most recently added remaining
   * one as the new active (or null if none left).
   */
  removeInstance: (id: string) => void;

  /** Update mutable fields on an instance (label, lastUserLogin). */
  updateInstance: (id: string, patch: Partial<Pick<Instance, 'label' | 'lastUserLogin'>>) => void;

  /** Wipe everything — used by factory-reset / multi-instance "logout from all". */
  clearAll: () => void;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function defaultLabel(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    return u.host;
  } catch {
    return baseUrl;
  }
}

export const useInstanceStore = create<InstanceState>()(
  persist(
    (set, get) => ({
      instances: [],
      activeId: null,
      hydrated: false,

      getActive: () => {
        const { instances, activeId } = get();
        if (!activeId) return null;
        return instances.find((i) => i.id === activeId) ?? null;
      },

      getBaseUrl: () => get().getActive()?.baseUrl ?? null,

      addInstance: ({ baseUrl, label }) => {
        const clean = normalizeUrl(baseUrl);
        const existing = get().instances.find(
          (i) => i.baseUrl.toLowerCase() === clean.toLowerCase(),
        );
        if (existing) {
          set({ activeId: existing.id });
          return existing;
        }
        const inst: Instance = {
          id: generateUuid(),
          baseUrl: clean,
          label: label?.trim() || defaultLabel(clean),
          lastUserLogin: '',
          addedAt: Date.now(),
        };
        set((s) => ({ instances: [...s.instances, inst], activeId: inst.id }));
        return inst;
      },

      setActive: (id) => {
        const exists = get().instances.some((i) => i.id === id);
        if (!exists) {
          logger.warn('instanceStore.setActive: unknown id', id);
          return;
        }
        set({ activeId: id });
      },

      removeInstance: (id) => {
        set((s) => {
          const remaining = s.instances.filter((i) => i.id !== id);
          let nextActive = s.activeId === id ? null : s.activeId;
          if (s.activeId === id && remaining.length > 0) {
            const mostRecent = [...remaining].sort((a, b) => b.addedAt - a.addedAt)[0];
            if (mostRecent) nextActive = mostRecent.id;
          }
          return { instances: remaining, activeId: nextActive };
        });
      },

      updateInstance: (id, patch) => {
        set((s) => ({
          instances: s.instances.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        }));
      },

      clearAll: () => set({ instances: [], activeId: null }),
    }),
    {
      name: 'instance',
      version: 2,
      storage: createJSONStorage(() => mmkvStorage),
      // Migrate the v1 shape `{ baseUrl: string | null }` to v2 `{ instances, activeId }`.
      // The persist middleware re-merges the action methods after migrate runs, so we
      // only need to return the data slice — but Zustand's TS types insist on the
      // full state shape, hence the `unknown` cast.
      migrate: (persisted, version) => {
        const empty = { instances: [], activeId: null, hydrated: true };
        if (!persisted || typeof persisted !== 'object') {
          return empty as unknown as InstanceState;
        }
        if (version >= 2) return persisted as InstanceState;
        const old = persisted as { baseUrl?: string | null };
        if (!old.baseUrl) return empty as unknown as InstanceState;
        const inst: Instance = {
          id: generateUuid(),
          baseUrl: normalizeUrl(old.baseUrl),
          label: defaultLabel(old.baseUrl),
          lastUserLogin: '',
          addedAt: Date.now(),
        };
        logger.info('instanceStore: migrated v1 baseUrl to v2 instance list', {
          baseUrl: inst.baseUrl,
        });
        return { ...empty, instances: [inst], activeId: inst.id } as unknown as InstanceState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

/**
 * Helper used by client.ts for stable call sites that just need the URL.
 * Reads via the store getter so it stays in sync with `setActive` / `addInstance`.
 */
export function getActiveBaseUrl(): string | null {
  return useInstanceStore.getState().getBaseUrl();
}
