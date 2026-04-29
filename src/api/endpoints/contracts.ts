import type { ContractsAccessibleResponse } from '@/types/api';

import { http } from '../client';

export interface ContractsAccessibleQuery {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

/**
 * GET /infrasscanfield/contracts/accessible
 * Paginated list of contracts accessible to the authenticated user.
 */
export async function getContractsAccessible(
  query: ContractsAccessibleQuery = {},
): Promise<ContractsAccessibleResponse> {
  const res = await http.get<ContractsAccessibleResponse>('/contracts/accessible', {
    params: {
      status: query.status,
      q: query.q,
      page: query.page ?? 0,
      limit: query.limit ?? 20,
    },
  });
  return res.data;
}
