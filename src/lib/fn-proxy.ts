/**
 * Same-origin CSRF-Proxy für Edge Functions.
 *
 * Browser → POST /api/fn/<name> (Pages) → supabase /functions/v1/<name>
 * Cookies bleiben auf der SPA-Origin. Der Relay schickt sie nicht weiter.
 *
 * Localhost: direkter Supabase-URL (Vite hat keine Pages-Function).
 */

import { csrfHeadersFor, originHostAllowed } from './csrf';
import { getSupabaseUrl } from './supabaseUrl';

export const FN_PROXY_PREFIX = '/api/fn';

/** Eng; kein User-String ohne Map. Slash = Router-Slot (siteos/code-persist). */
export const FN_PROXY_ALLOW = [
  'ai-gateway',
  'siteos/code-persist',
  'gdpr-audit',
  'cookie-scan',
  'sales-lead',
  'save-company-profile',
  'create-trial-subscription',
] as const;

const ALLOW = new Set<string>(FN_PROXY_ALLOW);
const NAME_RE = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/;

export function normalizeFnName(raw: string | string[] | undefined): string | null {
  const joined = Array.isArray(raw) ? raw.filter(Boolean).join('/') : (raw ?? '');
  const name = joined.replace(/^\/+|\/+$/g, '');
  if (!NAME_RE.test(name) || !ALLOW.has(name)) return null;
  return name;
}

export function isFnProxyAllowed(name: string): boolean {
  return ALLOW.has(name);
}

export function shouldUseFnProxy(): boolean {
  if (typeof window === 'undefined') return false;
  const origin = window.location.origin;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  return originHostAllowed(origin);
}

export function edgeFunctionUrl(fn: string): string {
  if (shouldUseFnProxy()) return `${FN_PROXY_PREFIX}/${fn}`;
  return `${getSupabaseUrl()}/functions/v1/${fn}`;
}

export function fnFetchInit(url: string, init: RequestInit = {}): RequestInit {
  const extra = csrfHeadersFor(url);
  const headers = { ...(init.headers as Record<string, string> | undefined), ...extra };
  return {
    ...init,
    headers,
    credentials: shouldUseFnProxy() ? 'same-origin' : init.credentials,
  };
}
