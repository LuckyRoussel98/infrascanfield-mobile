import type { InterventionsAssignedResponse } from '@/types/api';

import { http } from '../client';

export interface InterventionsAssignedQuery {
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/**
 * GET /infrasscanfield/interventions/assigned
 * Paginated list of interventions where the authenticated user is an internal contact.
 */
export async function getInterventionsAssigned(
  query: InterventionsAssignedQuery = {},
): Promise<InterventionsAssignedResponse> {
  const res = await http.get<InterventionsAssignedResponse>('/interventions/assigned', {
    params: {
      status: query.status,
      from: query.from,
      to: query.to,
      page: query.page ?? 0,
      limit: query.limit ?? 20,
    },
  });
  return res.data;
}
