import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStorage } from '@/utils/secureStorage';

export interface InstanceState {
  /** Base URL of the active Dolibarr instance, eg `https://my-dolibarr.example.com` (no trailing slash). */
  baseUrl: string | null;
  /** Set the active instance URL. Strips trailing slash automatically. */
  setBaseUrl: (url: string) => void;
  /** Forget the active instance (logout, switch instance, factory reset). */
  clear: () => void;
}

export const useInstanceStore = create<InstanceState>()(
  persist(
    (set) => ({
      baseUrl: null,

      setBaseUrl: (url: string) => {
        const clean = url.trim().replace(/\/+$/, '');
        set({ baseUrl: clean });
      },

      clear: () => set({ baseUrl: null }),
    }),
    {
      name: 'instance',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
