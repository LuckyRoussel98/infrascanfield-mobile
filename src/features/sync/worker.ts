import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { uploadDocument } from '@/api/endpoints/documents';
import {
  listPending,
  markError,
  markSending,
  markSent,
  purgeOldSent,
  type OutboxRow,
} from '@/db/outbox';
import { useSyncStore } from '@/stores/syncStore';
import type { ApiError } from '@/api/client';
import type { UploadRequest } from '@/types/api';
import { logger } from '@/utils/logger';

const MAX_RETRIES = 5;
const BATCH_SIZE = 5;
/** Min delay between drains kicked off by the same trigger source (ms) */
const DRAIN_THROTTLE_MS = 1500;

export type OpType = 'documents.upload';

let draining = false;
let lastDrainAt = 0;
let netInfoUnsub: (() => void) | null = null;

/**
 * Process one outbox row by op_type. Throws on real failure; the caller
 * handles status bookkeeping. The thrown error's `.status` (if present)
 * is used to decide whether the failure is retryable.
 */
async function processRow(row: OutboxRow): Promise<void> {
  switch (row.op_type as OpType) {
    case 'documents.upload': {
      const payload = JSON.parse(row.payload) as UploadRequest;
      // Force the server to use our queued idempotency_key — it's the contract
      // that lets the server dedup if a previous attempt actually succeeded
      // but we never saw the response (e.g. timeout after server commit).
      await uploadDocument({ ...payload, idempotency_key: row.idempotency_key });
      return;
    }
    default:
      throw new Error(`Unknown op_type: ${row.op_type}`);
  }
}

function isRetryable(err: unknown): boolean {
  const e = err as Partial<ApiError> | undefined;
  // Network / timeout / 5xx → retry. 4xx (except 408/429) → don't retry.
  if (!e) return true;
  if (e.status === 0 || !e.status) return true;
  if (e.status >= 500) return true;
  if (e.status === 408 || e.status === 429) return true;
  return false;
}

/**
 * Drain pending rows. Idempotent — if already draining, returns early.
 * Updates Zustand sync store so the UI can render counts/state.
 */
export async function drainOutbox(): Promise<void> {
  if (draining) return;
  if (Date.now() - lastDrainAt < DRAIN_THROTTLE_MS) return;
  draining = true;
  lastDrainAt = Date.now();
  const setState = useSyncStore.getState().setState;

  try {
    setState({ draining: true, lastError: null });
    const rows = await listPending(BATCH_SIZE);
    if (rows.length === 0) {
      setState({ draining: false });
      return;
    }
    logger.info('sync: draining outbox', { count: rows.length });

    for (const row of rows) {
      // Skip rows that have exhausted their retry budget — those wait for
      // a manual retry from the UI.
      if (row.status === 'error' && row.retry_count >= MAX_RETRIES) continue;

      try {
        await markSending(row.id);
        await processRow(row);
        await markSent(row.id);
      } catch (e) {
        const err = e as Partial<ApiError>;
        const willRetry = isRetryable(err) && row.retry_count + 1 < MAX_RETRIES;
        logger.warn('sync: row failed', {
          id: row.id,
          status: err.status,
          willRetry,
          retry_count: row.retry_count,
        });
        await markError(row.id, err.message ?? String(e), willRetry);
        // On non-retryable error or budget exhausted, keep going through the
        // batch — other rows may still succeed.
      }
    }

    // Best-effort cleanup of old sent rows after a successful drain
    await purgeOldSent();

    await refreshSyncCounts();
  } catch (e) {
    logger.error('sync: drain failed', e);
    useSyncStore.getState().setState({ lastError: (e as Error).message ?? 'sync failed' });
  } finally {
    draining = false;
    useSyncStore.getState().setState({ draining: false });
  }
}

/**
 * Read the current outbox status into the Zustand store so screens can render
 * up-to-date counts without holding direct DB references.
 */
export async function refreshSyncCounts(): Promise<void> {
  const { countByStatus } = await import('@/db/outbox');
  const counts = await countByStatus();
  useSyncStore.getState().setState({ counts });
}

/**
 * Kicked from app startup. Subscribes to NetInfo and drains whenever
 * connectivity flips back to "internet reachable".
 */
export function startSyncWorker(): void {
  if (netInfoUnsub) return; // already started
  void refreshSyncCounts();

  netInfoUnsub = NetInfo.addEventListener((state: NetInfoState) => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    useSyncStore.getState().setState({ online });
    if (online) {
      void drainOutbox();
    }
  });
}

export function stopSyncWorker(): void {
  if (netInfoUnsub) {
    netInfoUnsub();
    netInfoUnsub = null;
  }
}

/** Manual trigger from the sync-queue screen. Bypasses throttle. */
export async function manualDrain(): Promise<void> {
  lastDrainAt = 0;
  await drainOutbox();
}
