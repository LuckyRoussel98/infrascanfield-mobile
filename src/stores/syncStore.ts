import { create } from 'zustand';

import type { OutboxStatus } from '@/db/outbox';

interface SyncState {
  online: boolean;
  draining: boolean;
  counts: Record<OutboxStatus, number>;
  lastError: string | null;
  setState: (patch: Partial<Omit<SyncState, 'setState'>>) => void;
}

const initialCounts: Record<OutboxStatus, number> = {
  pending: 0,
  sending: 0,
  sent: 0,
  error: 0,
};

export const useSyncStore = create<SyncState>((set) => ({
  online: true,
  draining: false,
  counts: { ...initialCounts },
  lastError: null,
  setState: (patch) => set(patch),
}));
