/**
 * Lesen und Trennen von Social-Kanalkonten.
 *
 * Liste: Metadaten-Spalten, die `authenticated` sehen darf. `credentials_enc`
 * wird nicht abgefragt. Schreiben: nur `op: 'remove'` an
 * `social-channel-connect`. Verbinden und Rotieren schicken Credentials im
 * Body; ohne serverseitigen OAuth-Code-Tausch gibt es dafür keinen
 * Client-Helfer, damit der Browser kein Token sammelt.
 */
import { getSupabase } from '../../../lib/supabase';

export interface SocialChannelConnectionMeta {
  id: string;
  channel: string;
  account_name: string | null;
  account_external_id: string;
  status: string;
  token_expires_at: string | null;
}

/** Explizite Spaltenliste. Niemals `credentials_enc` oder Token-Felder. */
export const SOCIAL_CHANNEL_META_COLUMNS =
  'id, channel, account_name, account_external_id, status, token_expires_at';

export function toSocialChannelConnectionMeta(row: unknown): SocialChannelConnectionMeta | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0) return null;
  if (typeof record.channel !== 'string' || record.channel.length === 0) return null;
  if (typeof record.account_external_id !== 'string') return null;
  if (typeof record.status !== 'string') return null;
  return {
    id: record.id,
    channel: record.channel,
    account_name: typeof record.account_name === 'string' ? record.account_name : null,
    account_external_id: record.account_external_id,
    status: record.status,
    token_expires_at: typeof record.token_expires_at === 'string' ? record.token_expires_at : null,
  };
}

export async function listSocialChannelConnections(tenantId: string): Promise<SocialChannelConnectionMeta[]> {
  const { data, error } = await getSupabase()
    .from('social_channel_connections')
    .select(SOCIAL_CHANNEL_META_COLUMNS)
    .eq('tenant_id', tenantId)
    .order('channel', { ascending: true });
  if (error) throw new Error('Social-Konten konnten nicht geladen werden.');
  const rows: SocialChannelConnectionMeta[] = [];
  for (const row of data ?? []) {
    const meta = toSocialChannelConnectionMeta(row);
    if (meta) rows.push(meta);
  }
  return rows;
}

export async function removeSocialChannelConnection(tenantId: string, connectionId: string): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke('social-channel-connect', {
    body: {
      op: 'remove',
      tenant_id: tenantId,
      connection_id: connectionId,
    },
  });
  if (error || !data || (data as { ok?: unknown }).ok !== true) {
    throw new Error('Trennen ist fehlgeschlagen.');
  }
}
