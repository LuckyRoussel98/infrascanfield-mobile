import type { ThirdpartiesSearchResponse } from '@/types/api';

import { http } from '../client';

export interface ThirdpartiesSearchQuery {
  q: string;
  type?: 'customer' | 'supplier' | '';
  page?: number;
  limit?: number;
}

/**
 * GET /infrasscanfield/thirdparties/search
 * Searches third parties by name, code, email or phone.
 * Server requires q.length >= 2.
 */
export async function searchThirdparties(
  query: ThirdpartiesSearchQuery,
): Promise<ThirdpartiesSearchResponse> {
  const res = await http.get<ThirdpartiesSearchResponse>('/thirdparties/search', {
    params: {
      q: query.q,
      type: query.type,
      page: query.page ?? 0,
      limit: query.limit ?? 20,
    },
  });
  return res.data;
}
