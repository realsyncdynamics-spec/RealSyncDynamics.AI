/**
 * social_channel_connections — RLS, Spaltenrechte, mehrere Konten.
 *
 * Die Zusage steckt in Grants und Policies, nicht in der Edge Function:
 * authenticated darf Metadaten der eigenen Mitgliedschaft lesen und
 * credentials_enc weder sehen noch schreiben. service_role liest das Siegel.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('social-channel-connections') ? describe : describe.skip;

async function rejects(ctx: DbCtx, sql: string, params: unknown[] = []): Promise<string> {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await ctx.client.query(`SAVEPOINT ${sp}`);
  let message = '';
  try {
    await ctx.client.query(sql, params);
  } catch (error) {
    message = (error as Error).message;
  }
  await ctx.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
  return message;
}

d('social_channel_connections', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('haelt RLS und die Spaltenrechte', async () => {
    const flags = await ctx!.client.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class
        WHERE oid = 'public.social_channel_connections'::regclass`,
    );
    expect(flags.rows[0]?.relrowsecurity).toBe(true);

    const priv = await ctx!.client.query<{
      auth_secret: boolean;
      auth_name: boolean;
      auth_scopes: boolean;
      auth_error: boolean;
      auth_actor: boolean;
      auth_insert: boolean;
      anon_select: boolean;
      service_secret: boolean;
      service_error: boolean;
    }>(
      `SELECT
         has_column_privilege('authenticated', 'public.social_channel_connections', 'credentials_enc', 'SELECT') AS auth_secret,
         has_column_privilege('authenticated', 'public.social_channel_connections', 'account_name', 'SELECT') AS auth_name,
         has_column_privilege('authenticated', 'public.social_channel_connections', 'scopes', 'SELECT') AS auth_scopes,
         has_column_privilege('authenticated', 'public.social_channel_connections', 'last_error', 'SELECT') AS auth_error,
         has_column_privilege('authenticated', 'public.social_channel_connections', 'created_by', 'SELECT') AS auth_actor,
         has_table_privilege('authenticated', 'public.social_channel_connections', 'INSERT') AS auth_insert,
         has_table_privilege('anon', 'public.social_channel_connections', 'SELECT') AS anon_select,
         has_column_privilege('service_role', 'public.social_channel_connections', 'credentials_enc', 'SELECT') AS service_secret,
         has_column_privilege('service_role', 'public.social_channel_connections', 'last_error', 'SELECT') AS service_error`,
    );
    expect(priv.rows[0]).toEqual({
      auth_secret: false,
      auth_name: true,
      auth_scopes: false,
      auth_error: false,
      auth_actor: false,
      auth_insert: false,
      anon_select: false,
      service_secret: true,
      service_error: true,
    });
  });

  it('laesst einen Mandanten zwei Konten desselben Kanals speichern und isoliert den zweiten Mandanten', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    await ctx!.client.query(
      `INSERT INTO public.social_channel_connections
         (tenant_id, channel, account_external_id, account_name, status, credentials_enc)
       VALUES
         ($1, 'linkedin', 'urn:li:organization:1', 'Seite A1', 'connected', 'v1:fixture:not-a-token'),
         ($1, 'linkedin', 'urn:li:organization:2', 'Seite A2', 'connected', 'v1:fixture:not-a-token'),
         ($2, 'linkedin', 'urn:li:organization:9', 'Seite B', 'connected', 'v1:fixture:other')`,
      [a.tenantId, b.tenantId],
    );

    const duplicate = await rejects(
      ctx!,
      `INSERT INTO public.social_channel_connections
         (tenant_id, channel, account_external_id, status)
       VALUES ($1, 'linkedin', 'urn:li:organization:1', 'pending')`,
      [a.tenantId],
    );
    expect(duplicate).toMatch(/duplicate|unique/i);

    const badChannel = await rejects(
      ctx!,
      `INSERT INTO public.social_channel_connections
         (tenant_id, channel, account_external_id, status)
       VALUES ($1, 'youtube', 'acct', 'pending')`,
      [a.tenantId],
    );
    expect(badChannel).toMatch(/check|constraint/i);

    const seen = await ctx!.withClaims({ sub: a.userId, role: 'authenticated' }, async () => {
      const result = await ctx!.client.query<{ account_name: string }>(
        `SELECT account_name FROM public.social_channel_connections ORDER BY account_name`,
      );
      return result.rows.map((item) => item.account_name);
    });
    expect(seen).toEqual(['Seite A1', 'Seite A2']);

    let secretMessage = '';
    try {
      await ctx!.withClaims({ sub: a.userId, role: 'authenticated' }, async () => {
        await ctx!.client.query(`SELECT credentials_enc FROM public.social_channel_connections`);
      });
    } catch (error) {
      secretMessage = (error as Error).message;
    }
    expect(secretMessage).toMatch(/permission denied/i);

    const insertMessage = await (async () => {
      try {
        await ctx!.withClaims({ sub: a.userId, role: 'authenticated' }, async () => {
          await ctx!.client.query(
            `INSERT INTO public.social_channel_connections
               (tenant_id, channel, account_external_id, status)
             VALUES ($1, 'x', 'acct-x', 'pending')`,
            [a.tenantId],
          );
        });
        return '';
      } catch (error) {
        return (error as Error).message;
      }
    })();
    expect(insertMessage).toMatch(/permission denied/i);

    const { rows: memberRows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
      [`m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`],
    );
    const memberId = memberRows[0]!.id;
    // memberships.role kennt kein 'member' mehr (owner/admin/dpo/editor/viewer_auditor).
    // editor ist Mitglied, aber nicht owner/admin — und darf Metadaten trotzdem sehen.
    await ctx!.client.query(
      `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, 'editor')`,
      [a.tenantId, memberId],
    );
    const memberSeen = await ctx!.withClaims({ sub: memberId, role: 'authenticated' }, async () => {
      const result = await ctx!.client.query<{ account_name: string }>(
        `SELECT account_name FROM public.social_channel_connections ORDER BY account_name`,
      );
      return result.rows.map((item) => item.account_name);
    });
    expect(memberSeen).toEqual(['Seite A1', 'Seite A2']);

    const serviceSeen = await ctx!.withClaims({ role: 'service_role' }, async () => {
      const result = await ctx!.client.query<{ credentials_enc: string }>(
        `SELECT credentials_enc FROM public.social_channel_connections
          WHERE tenant_id = $1 AND account_external_id = 'urn:li:organization:1'`,
        [a.tenantId],
      );
      return result.rows[0]?.credentials_enc;
    });
    expect(serviceSeen).toBe('v1:fixture:not-a-token');
  });

  it('schreibt Verbindung, Registratur und Audit atomar und lässt bei Fehler keine Registry zurück', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const args = [
      tenantId,
      userId,
      'urn:li:organization:77',
    ];

    await ctx!.withClaims({ role: 'service_role' }, async () => {
      await ctx!.client.query(
        `SELECT public.social_channel_connection_apply(
           'configure', $1, $2, 'owner@example.com', 'linkedin', $3,
           NULL, 'Seite', NULL, ARRAY['openid','profile']::text[], 'Seite'
         )`,
        args,
      );
    });

    const counts = await ctx!.client.query<{ connections: string; registries: string; audits: string }>(
      `SELECT
         (SELECT count(*) FROM public.social_channel_connections WHERE tenant_id = $1)::text AS connections,
         (SELECT count(*) FROM public.connector_registry WHERE tenant_id = $1 AND system_type = 'social_channel')::text AS registries,
         (SELECT count(*) FROM public.governance_admin_log
           WHERE tenant_id = $1 AND action = 'social_channel.configure')::text AS audits`,
      [tenantId],
    );
    expect(counts.rows[0]).toEqual({ connections: '1', registries: '1', audits: '1' });

    const rejected = await rejects(
      ctx!,
      `SELECT public.social_channel_connection_apply(
         'configure', $1, $2, 'owner@example.com', 'linkedin', 'urn:li:organization:88',
         NULL, 'Andere', NULL, ARRAY['w_member_social']::text[], 'Andere'
       )`,
      [tenantId, userId],
    );
    expect(rejected).toMatch(/social_channel_scopes/);

    const after = await ctx!.client.query<{ registries: string }>(
      `SELECT count(*)::text AS registries
         FROM public.connector_registry
        WHERE tenant_id = $1 AND system_type = 'social_channel'`,
      [tenantId],
    );
    expect(after.rows[0]?.registries).toBe('1');

    const denied = await (async () => {
      try {
        await ctx!.withClaims({ sub: userId, role: 'authenticated' }, async () => {
          await ctx!.client.query(
            `SELECT public.social_channel_connection_apply(
               'configure', $1, $2, NULL, 'x', 'acct-x',
               NULL, NULL, NULL, ARRAY['openid']::text[], 'x'
             )`,
            [tenantId, userId],
          );
        });
        return '';
      } catch (error) {
        return (error as Error).message;
      }
    })();
    expect(denied).toMatch(/permission denied/i);
  });
});
