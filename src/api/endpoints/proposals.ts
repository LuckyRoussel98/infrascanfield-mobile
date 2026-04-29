import type { ProposalsAccessibleResponse } from '@/types/api';

import { http } from '../client';

export interface ProposalsAccessibleQuery {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

/**
 * GET /infrasscanfield/proposals/accessible
 * Paginated list of proposals (devis) accessible to the authenticated user.
 */
export async function getProposalsAccessible(
  query: ProposalsAccessibleQuery = {},
): Promise<ProposalsAccessibleResponse> {
  const res = await http.get<ProposalsAccessibleResponse>('/proposals/accessible', {
    params: {
      status: query.status,
      q: query.q,
      page: query.page ?? 0,
      limit: query.limit ?? 20,
    },
  });
  return res.data;
}
