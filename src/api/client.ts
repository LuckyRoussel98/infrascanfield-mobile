import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from '@/stores/authStore';
import { useInstanceStore } from '@/stores/instanceStore';
import { logger } from '@/utils/logger';

const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Build a fresh axios instance bound to the active Dolibarr base URL.
 * The instance reads `baseUrl` and `token` lazily via Zustand on every request,
 * so no rebuild is needed when the user logs out / changes instance.
 *
 * Configurable per-call timeout via `config.timeout` (defaults to 30s, 120s for upload).
 *
 * The interceptor :
 *   - prepends `${baseUrl}/api/index.php` to relative URLs
 *   - adds `X-IFS-Token` header when a token is loaded (login endpoint sends it
 *     anyway — server ignores it on /auth/login)
 *   - normalizes axios errors into a structured shape
 *   - on 401, triggers a logout (clears token) so the navigator can redirect
 */
function buildClient(): AxiosInstance {
  const instance = axios.create({
    timeout: DEFAULT_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const baseUrl = useInstanceStore.getState().baseUrl;
    const token = useAuthStore.getState().token;

    // Prepend Dolibarr API root if the URL is relative (`/auth/login`, etc.)
    if (baseUrl && config.url && !/^https?:\/\//i.test(config.url)) {
      const path = config.url.startsWith('/') ? config.url : `/${config.url}`;
      config.url = `${baseUrl}/api/index.php/infrasscanfield${path}`;
    }

    if (token) {
      config.headers = config.headers ?? {};
      config.headers['X-IFS-Token'] = token;
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      // Network / timeout error — no response object
      if (!error.response) {
        logger.warn('http network error', { url: error.config?.url, code: error.code });
        return Promise.reject(normalizeError(error));
      }

      const status = error.response.status;

      // Auth failure : drop the token so the router can redirect to /login
      if (status === 401) {
        logger.warn('http 401 — logging out', { url: error.config?.url });
        try {
          await useAuthStore.getState().logout();
        } catch (e) {
          logger.error('logout on 401 failed', e);
        }
      }

      return Promise.reject(normalizeError(error));
    },
  );

  return instance;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  /** Raw payload returned by the server, when present. */
  data?: unknown;
}

function normalizeError(error: AxiosError): ApiError {
  if (!error.response) {
    return {
      status: 0,
      code: error.code ?? 'NETWORK',
      message: error.message || 'Network error',
    };
  }
  const data = error.response.data as { error?: string; message?: string } | undefined;
  return {
    status: error.response.status,
    code: data?.error ?? `HTTP_${error.response.status}`,
    message: data?.message ?? data?.error ?? error.message,
    data: error.response.data,
  };
}

export const http: AxiosInstance = buildClient();

/**
 * Helper to call the Dolibarr **native** status endpoint (used by /(auth)/setup to validate
 * that the URL points at a real Dolibarr install before attempting login). This call does
 * NOT go through our X-IFS-Token interceptor logic since the URL is absolute and unrelated
 * to the InfraSScanField module endpoints.
 */
export async function pingDolibarr(baseUrl: string, timeoutMs = 10_000): Promise<boolean> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/index.php/status`;
  try {
    const res = await axios.get(url, { timeout: timeoutMs, validateStatus: () => true });
    // 200 (OK), 401/403 (Dolibarr is alive but rejects unauthenticated calls — counts as "alive")
    return res.status === 200 || res.status === 401 || res.status === 403;
  } catch (e) {
    logger.debug('pingDolibarr failed', { url, error: (e as Error).message });
    return false;
  }
}

/** Tag to easily set per-call long timeout for uploads. */
export function withUploadTimeout(config: AxiosRequestConfig = {}): AxiosRequestConfig {
  return { ...config, timeout: config.timeout ?? UPLOAD_TIMEOUT_MS };
}
