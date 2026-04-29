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

export interface RefreshResponse {
  token: string;
  expires_at: string;
}

/**
 * POST /infrasscanfield/auth/refresh — requires X-IFS-Token.
 * Issues a new token for the same user/device and revokes the old one.
 * Call this when the persisted token is close to expiry (eg < 24h).
 */
export async function refresh(): Promise<RefreshResponse> {
  const res = await http.post<RefreshResponse>('/auth/refresh');
  return res.data;
}

/**
 * POST /infrasscanfield/auth/logout — requires X-IFS-Token.
 * Revokes the current token server-side. The mobile must drop the token from
 * secure-store immediately after, regardless of the response.
 */
export async function logout(): Promise<{ success: boolean }> {
  const res = await http.post<{ success: boolean }>('/auth/logout');
  return res.data;
}
