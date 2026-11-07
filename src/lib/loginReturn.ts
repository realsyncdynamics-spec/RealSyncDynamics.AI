import { safeInternalPath } from './safeInternalPath';

/**
 * Only a same-origin navigation target is stored. Never persist an auth code,
 * access/refresh token, e-mail address, or a third-party URL.
 *
 * localStorage is intentional: a Magic Link may open in a different tab on
 * the same browser and origin. A different device/browser cannot recover it;
 * in that case Welcome continues through its normal activation/dashboard path.
 */
const STORAGE_KEY = 'rsd:login-next:v1';
export const LOGIN_RETURN_TTL_MS = 30 * 60 * 1000;

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reject protocol-relative paths, browser backslashes and encoded variants. */
export function validLoginReturn(raw: string | null | undefined): string | null {
  const path = safeInternalPath(raw);
  if (!path) return null;
  const pathname = path.split(/[?#]/, 1)[0];
  try {
    const decoded = decodeURIComponent(pathname);
    if (
      decoded.startsWith('//') ||
      decoded.includes('\\') ||
      /[\u0000-\u001f\u007f]/.test(decoded) ||
      path.includes('\\')
    ) return null;
  } catch {
    return null;
  }
  return path;
}

/** Called immediately before OAuth redirect or after Magic Link send succeeds. */
export function rememberLoginReturn(raw: string | null | undefined, now = Date.now()): void {
  const store = storage();
  if (!store) return;
  const path = validLoginReturn(raw);
  try {
    if (path) {
      store.setItem(STORAGE_KEY, JSON.stringify({ path, expiresAt: now + LOGIN_RETURN_TTL_MS }));
    } else {
      // A plain /login must not reuse an earlier unfinished ?next= flow.
      store.removeItem(STORAGE_KEY);
    }
  } catch {
    // Disabled storage must never prevent signing in.
  }
}

export function clearLoginReturn(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Best effort.
  }
}

/**
 * One-time retrieval after verified sign-in. Expired, malformed and unsafe
 * entries are removed. Explicit Welcome ?next= and checkout session= take
 * precedence over this optional state.
 */
export function consumeLoginReturn(now = Date.now()): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    store.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const record = value as { path?: unknown; expiresAt?: unknown };
    if (
      typeof record.path !== 'string' ||
      typeof record.expiresAt !== 'number' ||
      !Number.isFinite(record.expiresAt) ||
      record.expiresAt <= now ||
      record.expiresAt > now + LOGIN_RETURN_TTL_MS
    ) return null;
    return validLoginReturn(record.path);
  } catch {
    return null;
  }
}
