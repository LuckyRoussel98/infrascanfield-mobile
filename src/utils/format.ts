/**
 * Formatting helpers shared across screens.
 * Uses native Intl when available — no extra deps.
 */

/**
 * Format a numeric amount as a currency string.
 * Defaults to EUR / fr-FR ; pass overrides for other instances.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'EUR',
  locale: string = 'fr-FR',
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Format a date string (YYYY-MM-DD or full ISO) into a short locale date.
 */
export function formatDate(dateStr: string | null | undefined, locale: string = 'fr-FR'): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Format a Dolibarr SQL datetime ('YYYY-MM-DD HH:mm:ss') as 'today HH:mm', 'yesterday HH:mm', or full date.
 */
export function formatRelativeDateTime(dateStr: string | null | undefined, locale: string = 'fr-FR'): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return formatDate(dateStr, locale);
  const now = new Date();
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (sameDay) return time;
  if (isYesterday) return `${time}, J-1`;
  return formatDate(dateStr, locale);
}

/**
 * Format a duration in seconds as 'Xh YYm' (or 'Xm YYs' if <1h).
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '—';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  }
  const secs = total % 60;
  return `${minutes}m${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate a v4-ish UUID with the crypto API if available, else a Math.random fallback.
 * Used for idempotency keys client-side. Format : 8-4-4-4-12 hex.
 */
export function generateUuid(): string {
  // expo-crypto / native crypto.randomUUID is preferred ; fall back to Math.random.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoApi = (globalThis as any).crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  // Fallback : RFC4122 v4-ish using Math.random (NOT cryptographically secure ;
  // acceptable for idempotency keys, NOT for tokens)
  const rand = (n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  };
  return `${rand(8)}-${rand(4)}-4${rand(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${rand(3)}-${rand(12)}`;
}
