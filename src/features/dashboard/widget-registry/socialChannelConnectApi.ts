/**
 * Lesen und Trennen von Social-Kanalkonten.
 *
 * Liste: genau die Spalten, die `authenticated` sehen darf
 * (`SOCIAL_CONNECTION_PUBLIC_COLUMNS`). Nicht `scopes`, `last_error`,
 * `created_by`, `credentials_enc` oder Token-Felder.
 * Schreiben: nur `op: 'remove'`. Kein Client-Helfer für configure/rotate,
 * damit der Browser keine Zugangsdaten schickt.
 */
import { getSupabase } from '../../../lib/supabase';

export interface SocialChannelConnectionMeta {
  id: string;
  channel: string;
  account_name: string | null;
  account_external_id: string;
  status: string;
  token_expires_at: string | null;
  updated_at: string | null;
}

/** Dieselbe Tabelle. Die UI-Rechte stehen auf diesen Spalten, nicht auf einer View. */
export const SOCIAL_CHANNEL_UI_RELATION = 'social_channel_connections';

/**
 * Grant für `authenticated` aus 20261113120000, Stand #2211 (`22c0ed40`).
 * Reihenfolge wie `SOCIAL_CONNECTION_PUBLIC_COLUMNS`.
 */
export const SOCIAL_CHANNEL_UI_COLUMNS = [
  'id',
  'tenant_id',
  'channel',
  'account_external_id',
  'account_name',
  'status',
  'token_expires_at',
  'updated_at',
] as const;

/** Explizite Spaltenliste. Niemals Siegel, Token oder interne Audit-Felder. */
export const SOCIAL_CHANNEL_META_COLUMNS = SOCIAL_CHANNEL_UI_COLUMNS.join(', ');

export const SOCIAL_CHANNEL_HIDDEN_COLUMNS = [
  'scopes',
  'last_error',
  'created_by',
  'credentials_enc',
  'access_token',
  'refresh_token',
] as const;

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
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : null,
  };
}

const ACTION_MESSAGES: Readonly<Record<string, string>> = {
  CREDENTIALS_NOT_ACCEPTED:
    'Zugangsdaten werden hier nicht angenommen. Verbinden und Rotieren warten auf den serverseitigen LinkedIn-OAuth.',
  AUDIT_FAILED: 'Die Änderung wurde nicht protokolliert und zurückgenommen.',
};

export class SocialChannelActionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SocialChannelActionError';
    this.code = code;
  }
}

export function socialChannelActionMessage(code: string | null): string {
  if (code && ACTION_MESSAGES[code]) return ACTION_MESSAGES[code];
  return 'Trennen ist fehlgeschlagen.';
}

function codeFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const error = (body as { error?: { code?: unknown } }).error;
  return typeof error?.code === 'string' ? error.code : null;
}

async function readActionCode(error: unknown, data: unknown): Promise<string | null> {
  const fromData = codeFromBody(data);
  if (fromData) return fromData;
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      return codeFromBody(await ctx.json());
    } catch {
      return null;
    }
  }
  return null;
}

export async function listSocialChannelConnections(tenantId: string): Promise<SocialChannelConnectionMeta[]> {
  const { data, error } = await getSupabase()
    .from(SOCIAL_CHANNEL_UI_RELATION)
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
    const code = await readActionCode(error, data);
    throw new SocialChannelActionError(code ?? 'FAILED', socialChannelActionMessage(code));
  }
}
