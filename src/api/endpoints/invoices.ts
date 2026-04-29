import type { InvoicesAccessibleResponse } from '@/types/api';

import { http } from '../client';

export interface InvoicesAccessibleQuery {
  type?: 'customer' | 'supplier';
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

/**
 * GET /infrasscanfield/invoices/accessible
 * Paginated list of invoices accessible to the authenticated user.
 * External users (linked to a thirdparty via user.socid) only see their own invoices ;
 * internal users see all invoices in the entity scope.
 */
export async function getInvoicesAccessible(
  query: InvoicesAccessibleQuery = {},
): Promise<InvoicesAccessibleResponse> {
  const res = await http.get<InvoicesAccessibleResponse>('/invoices/accessible', {
    params: {
      type: query.type ?? 'customer',
      status: query.status,
      q: query.q,
      page: query.page ?? 0,
      limit: query.limit ?? 20,
    },
  });
  return res.data;
}
