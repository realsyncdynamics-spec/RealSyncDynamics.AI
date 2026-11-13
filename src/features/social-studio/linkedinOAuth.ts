/**
 * Start des serverseitigen LinkedIn-OAuth.
 *
 * Der Browser schickt kein Token. Die Edge Function `linkedin-oauth`
 * liefert nur die Authorization-URL; der Code-Tausch bleibt dort.
 * PR #2214 bindet `startLinkedInOAuth` an Verbinden und Rotieren,
 * ohne dieses Panel hier anzufassen.
 */
import { getSupabase } from '../../lib/supabase';

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';

/** Nimmt nur die dokumentierte LinkedIn-Authorization-URL. Jedes weitere Feld fällt durch. */
export function readLinkedInAuthorizationUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !keys.includes('ok') || !keys.includes('authorization_url')) return null;
  if (record.ok !== true || typeof record.authorization_url !== 'string') return null;
  let url: URL;
  try {
    url = new URL(record.authorization_url);
  } catch {
    return null;
  }
  if (`${url.origin}${url.pathname}` !== AUTHORIZE_URL) return null;
  if (url.username || url.password || url.hash) return null;
  if (url.searchParams.get('response_type') !== 'code') return null;
  if (!url.searchParams.get('client_id') || !url.searchParams.get('state')) return null;
  const redirect = url.searchParams.get('redirect_uri');
  if (!redirect || !redirect.startsWith('https://')) return null;
  return url.toString();
}

export async function startLinkedInOAuth(tenantId: string, returnTo?: string): Promise<void> {
  const body: { op: 'start'; tenant_id: string; return_to?: string } = {
    op: 'start',
    tenant_id: tenantId,
  };
  if (returnTo) body.return_to = returnTo;
  const { data, error } = await getSupabase().functions.invoke('linkedin-oauth', { body });
  if (error) throw new Error('LinkedIn-Verbindung konnte nicht gestartet werden.');
  const target = readLinkedInAuthorizationUrl(data);
  if (!target) throw new Error('LinkedIn-Verbindung konnte nicht gestartet werden.');
  window.location.assign(target);
}
