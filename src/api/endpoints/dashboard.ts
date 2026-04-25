import type { DashboardResponse } from '@/types/api';

import { http } from '../client';

/**
 * GET /infrasscanfield/dashboard
 * Aggregated payload for the home screen (single round-trip).
 */
export async function getDashboard(): Promise<DashboardResponse> {
  const res = await http.get<DashboardResponse>('/dashboard');
  return res.data;
}
