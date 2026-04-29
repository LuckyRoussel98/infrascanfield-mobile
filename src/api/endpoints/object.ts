import type { ModulePart, ObjectDetailResponse } from '@/types/api';

import { http } from '../client';

/**
 * GET /infrasscanfield/object/{modulepart}/{id}
 * Unified detail payload for any supported Dolibarr object — returns header,
 * lines (when applicable), attached documents and scan_log entries in one call.
 */
export async function getObjectDetail(
  modulepart: ModulePart,
  id: number,
): Promise<ObjectDetailResponse> {
  const res = await http.get<ObjectDetailResponse>(
    `/object/${encodeURIComponent(modulepart)}/${encodeURIComponent(String(id))}`,
  );
  return res.data;
}
