import type { LoginRequest, LoginResponse, MeResponse } from '@/types/api';

import { http } from '../client';

/**
 * POST /infrasscanfield/auth/login — public.
 * Returns the X-IFS-Token plus user / permissions / settings / license.
 */
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await http.post<LoginResponse>('/auth/login', payload);
  return res.data;
}

/**
 * GET /infrasscanfield/auth/me — requires X-IFS-Token.
 * Returns the current user + instance metadata. Useful as a "ping authenticated" call
 * after the app boots to validate that the persisted token is still alive.
 */
export async function me(): Promise<MeResponse> {
  const res = await http.get<MeResponse>('/auth/me');
  return res.data;
}
