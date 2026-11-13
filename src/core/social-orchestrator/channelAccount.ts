/**
 * Konto-URN fuer LinkedIn-Queue-Eintraege.
 *
 * Der Orchestrator liest nur Metadaten aus social_channel_connections
 * (authenticated sieht credentials_enc nicht) und schreibt die Kennung
 * als account_external_id in post_data. Der Worker ordnet damit mehrere
 * Konten desselben Mandanten zu. Eine Kennung, die nicht in den Zeilen
 * dieses Mandanten steht, wird nicht geraten.
 */

import type { SocialPost } from './types';

export const LINKEDIN_QUEUE_CHANNELS = ['linkedin.enterprise', 'linkedin.legal'] as const;
export type LinkedInQueueChannel = (typeof LINKEDIN_QUEUE_CHANNELS)[number];

/** Spalten, die ein Mitglied lesen darf. credentials_enc fehlt bewusst. */
export const LINKEDIN_CONNECTION_METADATA_COLUMNS =
  'account_external_id, status, token_expires_at';

export interface LinkedInConnectionRef {
  accountExternalId: string;
  status: string;
  tokenExpiresAt: string | null;
}

export type ChannelAccountErrorCode =
  | 'no_connection'
  | 'ambiguous_connection'
  | 'unknown_account'
  | 'not_usable'
  | 'lookup_failed';

export type LinkedInAccountStamp =
  | { ok: true; accountExternalId: string }
  | { ok: false; code: ChannelAccountErrorCode; message: string };

export class ChannelAccountUnresolvedError extends Error {
  readonly code: ChannelAccountErrorCode;

  constructor(code: ChannelAccountErrorCode, message: string) {
    super(message);
    this.name = 'ChannelAccountUnresolvedError';
    this.code = code;
  }
}

export function isLinkedInQueueChannel(channel: string): channel is LinkedInQueueChannel {
  return (LINKEDIN_QUEUE_CHANNELS as readonly string[]).includes(channel);
}

export function queuePostData(post: SocialPost): SocialPost & { account_external_id?: string } {
  if (!post.accountExternalId) return post;
  return { ...post, account_external_id: post.accountExternalId };
}

const AUTHOR_URN = /^urn:li:(?:person|organization):[A-Za-z0-9_-]{1,120}$/;

function authorUrn(value: string): string | null {
  const trimmed = value.trim();
  return AUTHOR_URN.test(trimmed) ? trimmed : null;
}

function isUsable(row: LinkedInConnectionRef, now: Date): boolean {
  if (row.status !== 'connected') return false;
  if (!row.tokenExpiresAt) return true;
  const ms = Date.parse(row.tokenExpiresAt);
  if (Number.isNaN(ms)) return false;
  return ms > now.getTime();
}

/**
 * Waehlt die Autor-URN fuer einen LinkedIn-Job.
 * Eine verbundene Zeile ohne Vorgabe wird geschrieben.
 * Mehrere Zeilen brauchen die vom Aufrufer genannte Kennung.
 */
export function stampLinkedInAccount(
  connections: LinkedInConnectionRef[],
  requestedAccountExternalId: string | null,
  now: Date,
): LinkedInAccountStamp {
  const requested = requestedAccountExternalId?.trim() || null;
  if (requested) {
    const match = connections.find((row) => row.accountExternalId === requested);
    if (!match) {
      return {
        ok: false,
        code: 'unknown_account',
        message: 'linkedin account_external_id is not a connection of this tenant',
      };
    }
    if (!isUsable(match, now)) {
      return { ok: false, code: 'not_usable', message: 'linkedin connection is not usable' };
    }
    const urn = authorUrn(match.accountExternalId);
    if (!urn) {
      return { ok: false, code: 'not_usable', message: 'linkedin account_external_id is not a person or organization urn' };
    }
    return { ok: true, accountExternalId: urn };
  }

  const usable = connections.filter((row) => isUsable(row, now));
  if (usable.length === 1) {
    const urn = authorUrn(usable[0]!.accountExternalId);
    if (!urn) {
      return { ok: false, code: 'not_usable', message: 'linkedin account_external_id is not a person or organization urn' };
    }
    return { ok: true, accountExternalId: urn };
  }
  if (usable.length > 1) {
    return {
      ok: false,
      code: 'ambiguous_connection',
      message: 'multiple linkedin connections; account_external_id required',
    };
  }
  if (connections.length === 0) {
    return { ok: false, code: 'no_connection', message: 'no linkedin connection for tenant' };
  }
  return { ok: false, code: 'not_usable', message: 'linkedin connection is not usable' };
}

interface LinkedInConnectionQuery {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): PromiseLike<{
          data: unknown;
          error: { message?: string } | null;
        }>;
      };
    };
  };
}

export async function listLinkedInConnections(
  supabase: LinkedInConnectionQuery,
  tenantId: string,
): Promise<LinkedInConnectionRef[]> {
  const { data, error } = await supabase
    .from('social_channel_connections')
    .select(LINKEDIN_CONNECTION_METADATA_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('channel', 'linkedin');
  if (error) {
    throw new ChannelAccountUnresolvedError('lookup_failed', 'linkedin connection lookup failed');
  }
  if (!Array.isArray(data)) return [];
  const rows: LinkedInConnectionRef[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.account_external_id !== 'string' || typeof row.status !== 'string') continue;
    rows.push({
      accountExternalId: row.account_external_id,
      status: row.status,
      tokenExpiresAt: typeof row.token_expires_at === 'string' ? row.token_expires_at : null,
    });
  }
  return rows;
}
