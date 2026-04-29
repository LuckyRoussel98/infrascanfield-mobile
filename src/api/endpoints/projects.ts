import type { ProjectsAssignedResponse } from '@/types/api';

import { http } from '../client';

export interface ProjectsAssignedQuery {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

/**
 * GET /infrasscanfield/projects/assigned
 * Paginated list of projects assigned to the authenticated user (via element_contact source=internal).
 */
export async function getProjectsAssigned(
  query: ProjectsAssignedQuery = {},
): Promise<ProjectsAssignedResponse> {
  const res = await http.get<ProjectsAssignedResponse>('/projects/assigned', {
    params: {
      status: query.status,
      q: query.q,
      page: query.page ?? 0,
      limit: query.limit ?? 20,
    },
  });
  return res.data;
}
