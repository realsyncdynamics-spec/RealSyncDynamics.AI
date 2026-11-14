import { describe, expect, it } from 'vitest';
import {
  LINKEDIN_CONNECTION_METADATA_COLUMNS,
  stampLinkedInAccount,
  type LinkedInConnectionRef,
} from '../../../src/core/social-orchestrator/channelAccount';
import { DistributionQueue } from '../../../src/core/social-orchestrator/distributionQueue';
import { SocialOrchestrator } from '../../../src/core/social-orchestrator/socialOrchestrator';
import type { RuntimeEvent, SocialChannel, SocialPost } from '../../../src/core/social-orchestrator/types';

const ORG = 'urn:li:organization:5515715';
const PERSON = 'urn:li:person:5abc_dEfgH';
const NOW = new Date('2026-11-13T12:00:00.000Z');

function connection(over: Partial<LinkedInConnectionRef> = {}): LinkedInConnectionRef {
  return {
    accountExternalId: ORG,
    status: 'connected',
    tokenExpiresAt: null,
    ...over,
  };
}

function post(channel: SocialChannel, accountExternalId?: string): SocialPost {
  return {
    id: `post_${channel}`,
    socialEventId: 'sev_1',
    channel,
    approvalStatus: 'AUTO',
    body: 'Hinweis',
    hashtags: ['#Gov'],
    charCount: 7,
    generatedAt: '2026-11-13T12:00:00.000Z',
    accountExternalId,
  };
}

function fakeSupabase(rows: Array<Record<string, unknown>>) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const selects: string[] = [];
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          selects.push(`${table}:${columns}`);
          const filters: Record<string, string> = {};
          const builder = {
            eq(column: string, value: string) {
              filters[column] = value;
              return builder;
            },
            then(
              onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null,
              onrejected?: ((reason: unknown) => unknown) | null,
            ) {
              const data = table === 'social_channel_connections'
                ? rows.filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value))
                : [];
              return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
            },
          };
          return builder;
        },
        insert(row: Record<string, unknown>) {
          inserts.push({ table, row });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client, inserts, selects };
}

function queued(inserts: Array<{ table: string; row: Record<string, unknown> }>) {
  return inserts.filter((item) => item.table === 'distribution_queue_entries');
}

describe('stampLinkedInAccount', () => {
  it('schreibt die einzige verbundene Kennung', () => {
    expect(stampLinkedInAccount([connection()], null, NOW)).toEqual({
      ok: true,
      accountExternalId: ORG,
    });
  });

  it('verlangt bei mehreren Konten eine Kennung aus genau diesen Zeilen', () => {
    const rows = [connection(), connection({ accountExternalId: PERSON })];
    expect(stampLinkedInAccount(rows, null, NOW)).toMatchObject({
      ok: false,
      code: 'ambiguous_connection',
    });
    expect(stampLinkedInAccount(rows, PERSON, NOW)).toEqual({
      ok: true,
      accountExternalId: PERSON,
    });
    expect(stampLinkedInAccount(rows, 'urn:li:organization:9', NOW)).toMatchObject({
      ok: false,
      code: 'unknown_account',
    });
  });

  it('nimmt eine abgelaufene oder fremde Zeile nicht', () => {
    expect(stampLinkedInAccount([
      connection({ tokenExpiresAt: '2020-01-01T00:00:00.000Z' }),
    ], null, NOW)).toMatchObject({ ok: false, code: 'not_usable' });
    expect(stampLinkedInAccount([], ORG, NOW)).toMatchObject({ ok: false, code: 'unknown_account' });
    expect(stampLinkedInAccount([], null, NOW)).toMatchObject({ ok: false, code: 'no_connection' });
    expect(stampLinkedInAccount([
      connection({ accountExternalId: 'ABC123' }),
    ], null, NOW)).toMatchObject({ ok: false, code: 'not_usable' });
  });
});

describe('Orchestrator schreibt account_external_id', () => {
  const event: RuntimeEvent = {
    id: 'evt_runtime_linkedin',
    type: 'tracker.detected',
    occurred_at: '2026-11-13T12:00:00.000Z',
    severity: 'medium',
    payload: {},
  };

  it('setzt die Kennung der einen Verbindung auf beide LinkedIn-Kanaele', async () => {
    const db = fakeSupabase([
      {
        tenant_id: 'tenant-a',
        channel: 'linkedin',
        account_external_id: ORG,
        status: 'connected',
        token_expires_at: null,
        credentials_enc: 'v1:not-selected',
      },
      {
        tenant_id: 'tenant-b',
        channel: 'linkedin',
        account_external_id: 'urn:li:organization:9',
        status: 'connected',
        token_expires_at: null,
      },
    ]);
    const queue = new DistributionQueue({
      supabase: db.client as never,
      tenantId: 'tenant-a',
    });
    const orch = new SocialOrchestrator({
      queue,
      channels: ['linkedin.enterprise', 'linkedin.legal'],
    });
    const result = await orch.process(event);
    const rows = queued(db.inserts);
    expect(result.queueEntries).toHaveLength(2);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const data = row.row.post_data as { account_external_id?: string; accountExternalId?: string };
      expect(data.account_external_id).toBe(ORG);
      expect(data.accountExternalId).toBe(ORG);
      expect(JSON.stringify(data)).not.toContain('v1:not-selected');
    }
    expect(db.selects.every((select) => select.startsWith('social_channel_connections:'))).toBe(true);
    expect(db.selects.join('\n')).toContain(LINKEDIN_CONNECTION_METADATA_COLUMNS);
    expect(db.selects.join('\n')).not.toContain('credentials_enc');
    expect(result.queueEntries.map((entry) => entry.post.accountExternalId)).toEqual([ORG, ORG]);
  });

  it('ordnet mehrere Konten nur ueber die vom Orchestrator genannte Kennung zu', async () => {
    const db = fakeSupabase([
      { tenant_id: 'tenant-a', channel: 'linkedin', account_external_id: ORG, status: 'connected', token_expires_at: null },
      { tenant_id: 'tenant-a', channel: 'linkedin', account_external_id: PERSON, status: 'connected', token_expires_at: null },
    ]);
    const queue = new DistributionQueue({ supabase: db.client as never, tenantId: 'tenant-a' });
    const orch = new SocialOrchestrator({
      queue,
      channels: ['linkedin.enterprise', 'linkedin.legal'],
      linkedInAccounts: {
        'linkedin.enterprise': ORG,
        'linkedin.legal': PERSON,
      },
    });
    await orch.process(event);
    const byChannel = Object.fromEntries(queued(db.inserts).map((item) => [
      item.row.channel,
      (item.row.post_data as { account_external_id: string }).account_external_id,
    ]));
    expect(byChannel).toEqual({
      'linkedin.enterprise': ORG,
      'linkedin.legal': PERSON,
    });
  });

  it('reiht ohne eindeutige Verbindung nichts ein', async () => {
    const db = fakeSupabase([
      { tenant_id: 'tenant-a', channel: 'linkedin', account_external_id: ORG, status: 'connected', token_expires_at: null },
      { tenant_id: 'tenant-a', channel: 'linkedin', account_external_id: PERSON, status: 'connected', token_expires_at: null },
    ]);
    const queue = new DistributionQueue({ supabase: db.client as never, tenantId: 'tenant-a' });
    const orch = new SocialOrchestrator({ queue, channels: ['linkedin.enterprise'] });
    await expect(orch.process(event)).rejects.toMatchObject({ code: 'ambiguous_connection' });
    expect(queued(db.inserts)).toHaveLength(0);
    expect(db.inserts).toHaveLength(0);
  });

  it('akzeptiert eine Kennung auf dem Post nur, wenn sie zur Verbindung gehoert', async () => {
    const db = fakeSupabase([
      { tenant_id: 'tenant-a', channel: 'linkedin', account_external_id: ORG, status: 'connected', token_expires_at: null },
      { tenant_id: 'tenant-a', channel: 'linkedin', account_external_id: PERSON, status: 'connected', token_expires_at: null },
    ]);
    const queue = new DistributionQueue({ supabase: db.client as never, tenantId: 'tenant-a' });
    const entry = await queue.enqueue(post('linkedin.legal', PERSON));
    expect(entry?.post.accountExternalId).toBe(PERSON);
    expect((queued(db.inserts)[0]!.row.post_data as { account_external_id: string }).account_external_id).toBe(PERSON);

    await expect(queue.enqueue(post('linkedin.enterprise', 'urn:li:organization:9'))).rejects.toMatchObject({
      code: 'unknown_account',
    });
  });

  it('laesst andere Kanaele ohne LinkedIn-Verbindung durch', async () => {
    const db = fakeSupabase([]);
    const queue = new DistributionQueue({ supabase: db.client as never, tenantId: 'tenant-a' });
    const entry = await queue.enqueue(post('wordpress.blog'));
    expect(entry?.post.accountExternalId).toBeUndefined();
    expect(db.selects).toHaveLength(0);
    expect(queued(db.inserts)[0]!.row.channel).toBe('wordpress.blog');
    const data = queued(db.inserts)[0]!.row.post_data as { account_external_id?: string };
    expect(data.account_external_id).toBeUndefined();
  });

  it('aendert die Vorschau ohne Datenbank nicht', async () => {
    const queue = new DistributionQueue();
    const entry = await queue.enqueue(post('linkedin.enterprise'));
    expect(entry?.post.channel).toBe('linkedin.enterprise');
    expect(entry?.post.accountExternalId).toBeUndefined();
  });
});
