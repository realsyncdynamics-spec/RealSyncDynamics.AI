/**
 * AP2: memberships ist nach der Vorwaerts-Migration die einzige Quelle.
 * tenant_memberships bleibt bestehen, schreibt fuer anon/authenticated nicht
 * mehr, und der Rollback stellt Funktion, Policies und Grants wieder her.
 *
 * webhook_deliveries hat seit 20260705200000 kein webhook_id und nicht die
 * Policy "webhook_deliveries tenant_member_read". Die wird nur angelegt, wenn
 * die Spalte existiert. Der Nachzug 20261120180000 haelt notify_quota_alert
 * auf diesem Schema aufrufbar; Empfaenger bleiben memberships.admin.
 *
 * Laeuft in der Testtransaktion (scripts/test-db). Fehlende Zieltabellen
 * werden dort als Mindestschema angelegt und mit der Transaktion verworfen.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  applyMigration,
  closeDb,
  createTenantWithMember,
  insertEvent,
  openDb,
  requireDbOrFail,
  type DbCtx,
} from './db-helpers';

const d = requireDbOrFail('ap2-memberships') ? describe : describe.skip;
const root = resolve(__dirname, '../../..');
const forward = ['supabase/migrations', '20261120160200_ap2_memberships_single_source.sql'] as const;
const repair = ['supabase/migrations', '20261120180000_ap2_membership_policy_column_guard.sql'] as const;
const backward = ['supabase/rollback', '20261120160200_ap2_memberships_single_source.sql'] as const;

type Outcome = 'allow' | 'deny';

async function apply(ctx: DbCtx, dir: string, file: string): Promise<void> {
  await applyMigration(ctx, resolve(root, dir), file);
}

async function applyForward(ctx: DbCtx): Promise<void> {
  await apply(ctx, ...forward);
  await apply(ctx, ...repair);
}

async function insertApiKey(ctx: DbCtx, tenantId: string, name: string): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.api_keys (tenant_id, name, key_hash, key_prefix)
     VALUES ($1, $2, md5(random()::text || $2), 'rs' || substr(md5(random()::text), 1, 10))
     RETURNING id`,
    [tenantId, name],
  );
  return rows[0]!.id;
}

async function asRole(
  ctx: DbCtx,
  role: 'anon' | 'authenticated',
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<Outcome> {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await ctx.client.query(`SAVEPOINT ${sp}`);
  try {
    await ctx.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: userId, role }),
    ]);
    await ctx.client.query(`SET LOCAL ROLE ${role}`);
    const res = await ctx.client.query(sql, params);
    return (res.rowCount ?? 0) > 0 ? 'allow' : 'deny';
  } catch (err) {
    const msg = String((err as Error).message);
    if (/row-level security|permission denied/i.test(msg)) return 'deny';
    throw err;
  } finally {
    await ctx.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    await ctx.client.query(`RESET ROLE`);
  }
}

async function membershipRoles(ctx: DbCtx): Promise<string[]> {
  const { rows } = await ctx.client.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'public.memberships'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%role%'`,
  );
  const found = new Set<string>();
  for (const row of rows) {
    for (const match of row.def.matchAll(/'([^']+)'/g)) found.add(match[1]!);
  }
  return [...found];
}

async function prepareTargets(ctx: DbCtx): Promise<void> {
  await ctx.client.query(`
    CREATE TABLE IF NOT EXISTS public.api_calls (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      api_key_id uuid,
      endpoint text,
      method text,
      request_path text
    );
    CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      url text,
      events text[] NOT NULL DEFAULT ARRAY['warning_80']::text[],
      is_active boolean NOT NULL DEFAULT true,
      secret_key text
    );
    CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      webhook_id uuid,
      tenant_id uuid,
      event_type text,
      event_data jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS public.quota_alerts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      alert_type text,
      api_calls_count integer,
      quota_limit integer,
      message text
    );
    CREATE TABLE IF NOT EXISTS public.email_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      recipient_email text,
      event_type text,
      subject text,
      body text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS public.custom_frameworks (
      id text PRIMARY KEY,
      tenant_id uuid NOT NULL,
      name text,
      created_by uuid
    );
    CREATE TABLE IF NOT EXISTS public.custom_controls (
      id text PRIMARY KEY,
      framework_id text NOT NULL,
      name text
    );
    CREATE TABLE IF NOT EXISTS public.custom_framework_mappings (
      id text PRIMARY KEY,
      framework_id text NOT NULL,
      standard_framework text
    );
    CREATE TABLE IF NOT EXISTS public.api_rate_limit_configs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL
    );
    CREATE TABLE IF NOT EXISTS public.api_rate_limit_violations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL
    );

    ALTER TABLE public.api_calls ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.quota_alerts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.custom_frameworks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.custom_controls ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.custom_framework_mappings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.api_rate_limit_configs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.api_rate_limit_violations ENABLE ROW LEVEL SECURITY;

    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public.api_calls, public.webhook_endpoints, public.webhook_deliveries,
      public.quota_alerts, public.email_notifications, public.custom_frameworks,
      public.custom_controls, public.custom_framework_mappings,
      public.api_rate_limit_configs, public.api_rate_limit_violations,
      public.tenant_memberships
      TO anon, authenticated;
  `);

  // custom_frameworks ist in Produktion ueber is_tenant_member lesbar.
  // Die Control-Policies lesen diese Tabelle in einer Unterabfrage.
  await ctx.client.query(`
    DO $stub$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policy
         WHERE polrelid = 'public.custom_frameworks'::regclass
           AND polname = 'Users can read frameworks in their tenant'
      ) THEN
        CREATE POLICY "Users can read frameworks in their tenant"
          ON public.custom_frameworks FOR SELECT
          USING (public.is_tenant_member(tenant_id));
      END IF;
    END
    $stub$;
  `);

  const legacy: Array<[string, string, string] | [string, string, string, string[]]> = [
    ['api_calls', 'api_calls tenant_member_read', `CREATE POLICY "api_calls tenant_member_read" ON public.api_calls FOR SELECT USING (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = api_calls.tenant_id AND m.user_id = auth.uid()))`],
    ['webhook_endpoints', 'webhook_endpoints tenant_member_read', `CREATE POLICY "webhook_endpoints tenant_member_read" ON public.webhook_endpoints FOR SELECT USING (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()))`],
    ['webhook_endpoints', 'webhook_endpoints tenant_member_insert', `CREATE POLICY "webhook_endpoints tenant_member_insert" ON public.webhook_endpoints FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()))`],
    ['webhook_endpoints', 'webhook_endpoints tenant_member_update', `CREATE POLICY "webhook_endpoints tenant_member_update" ON public.webhook_endpoints FOR UPDATE USING (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()))`],
    ['webhook_endpoints', 'webhook_endpoints tenant_member_delete', `CREATE POLICY "webhook_endpoints tenant_member_delete" ON public.webhook_endpoints FOR DELETE USING (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()))`],
    ['webhook_deliveries', 'webhook_deliveries tenant_member_read', `CREATE POLICY "webhook_deliveries tenant_member_read" ON public.webhook_deliveries FOR SELECT USING (EXISTS (SELECT 1 FROM public.webhook_endpoints we JOIN public.tenant_memberships m ON we.tenant_id = m.tenant_id WHERE we.id = webhook_deliveries.webhook_id AND m.user_id = auth.uid()))`, ['webhook_deliveries.webhook_id', 'webhook_endpoints.id', 'webhook_endpoints.tenant_id', 'tenant_memberships.tenant_id', 'tenant_memberships.user_id']],
    ['quota_alerts', 'quota_alerts tenant_member_read', `CREATE POLICY "quota_alerts tenant_member_read" ON public.quota_alerts FOR SELECT USING (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = quota_alerts.tenant_id AND m.user_id = auth.uid()))`],
    ['email_notifications', 'email_notifications tenant_member_read', `CREATE POLICY "email_notifications tenant_member_read" ON public.email_notifications FOR SELECT USING (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id = email_notifications.tenant_id AND m.user_id = auth.uid()))`],
    ['custom_controls', 'Users can read controls in their frameworks', `CREATE POLICY "Users can read controls in their frameworks" ON public.custom_controls FOR SELECT USING (framework_id IN (SELECT id FROM public.custom_frameworks WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())))`],
    ['custom_controls', 'Users can create controls in their frameworks', `CREATE POLICY "Users can create controls in their frameworks" ON public.custom_controls FOR INSERT WITH CHECK (framework_id IN (SELECT id FROM public.custom_frameworks WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())))`],
    ['custom_controls', 'Users can update controls in their frameworks', `CREATE POLICY "Users can update controls in their frameworks" ON public.custom_controls FOR UPDATE USING (framework_id IN (SELECT id FROM public.custom_frameworks WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())))`],
    ['custom_controls', 'Users can delete controls in their frameworks', `CREATE POLICY "Users can delete controls in their frameworks" ON public.custom_controls FOR DELETE USING (framework_id IN (SELECT id FROM public.custom_frameworks WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())))`],
    ['custom_framework_mappings', 'Users can read mappings in their frameworks', `CREATE POLICY "Users can read mappings in their frameworks" ON public.custom_framework_mappings FOR SELECT USING (framework_id IN (SELECT id FROM public.custom_frameworks WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())))`],
    ['custom_framework_mappings', 'Users can create mappings in their frameworks', `CREATE POLICY "Users can create mappings in their frameworks" ON public.custom_framework_mappings FOR INSERT WITH CHECK (framework_id IN (SELECT id FROM public.custom_frameworks WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())))`],
    ['custom_framework_mappings', 'Users can delete mappings in their frameworks', `CREATE POLICY "Users can delete mappings in their frameworks" ON public.custom_framework_mappings FOR DELETE USING (framework_id IN (SELECT id FROM public.custom_frameworks WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())))`],
    ['api_rate_limit_configs', "Users can view their tenant's rate limit configs", `CREATE POLICY "Users can view their tenant's rate limit configs" ON public.api_rate_limit_configs FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid() OR id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())))`],
    ['api_rate_limit_configs', "Users can update their tenant's rate limit configs", `CREATE POLICY "Users can update their tenant's rate limit configs" ON public.api_rate_limit_configs FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid() OR id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())))`],
    ['api_rate_limit_violations', "Users can view their tenant's rate limit violations", `CREATE POLICY "Users can view their tenant's rate limit violations" ON public.api_rate_limit_violations FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid() OR id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())))`],
  ];

  const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  for (const entry of legacy) {
    const [table, name, sql] = entry;
    const columns = entry.length === 4 ? entry[3] : [];
    const columnGuard = columns.map((qualified) => {
      const dot = qualified.indexOf('.');
      const rel = qualified.slice(0, dot);
      const column = qualified.slice(dot + 1);
      return `AND EXISTS (
             SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = ${quote(rel)}
                AND column_name = ${quote(column)}
           )`;
    }).join('\n');
    await ctx.client.query(`
      DO $legacy$
      BEGIN
        IF to_regclass(${quote(`public.${table}`)}) IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM pg_policy
              WHERE polrelid = ${quote(`public.${table}`)}::regclass
                AND polname = ${quote(name)}
           )
           ${columnGuard}
        THEN
          EXECUTE ${quote(sql)};
        END IF;
      END
      $legacy$;
    `);
  }
}

async function policySources(ctx: DbCtx): Promise<Array<{ table: string; name: string; src: string }>> {
  const { rows } = await ctx.client.query<{ table: string; name: string; src: string }>(`
    SELECT c.relname AS table, p.polname AS name,
           coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
           coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') AS src
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname <> 'tenant_memberships'
       AND (
         coalesce(pg_get_expr(p.polqual, p.polrelid), '') ILIKE '%tenant_memberships%'
         OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ILIKE '%tenant_memberships%'
         OR coalesce(pg_get_expr(p.polqual, p.polrelid), '') ILIKE '%is_tenant_member%'
         OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ILIKE '%is_tenant_member%'
       )
       AND c.relname IN (
         'api_calls', 'webhook_endpoints', 'webhook_deliveries', 'quota_alerts',
         'email_notifications', 'custom_controls', 'custom_framework_mappings',
         'api_rate_limit_configs', 'api_rate_limit_violations'
       )
  `);
  return rows;
}

d('AP2 memberships als einzige Quelle', () => {
  let ctx: DbCtx | null = null;

  beforeEach(async () => {
    ctx = await openDb();
  });
  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  it('bricht ab, wenn eine Altzeile kein Gegenstueck in memberships hat', async () => {
    const member = await createTenantWithMember(ctx!);
    await ctx!.client.query(`DELETE FROM public.memberships WHERE user_id = $1`, [member.userId]);
    await expect(apply(ctx!, ...forward)).rejects.toThrow(/AP2 abgebrochen: 1 Zeile/);
  });

  it('laesst nach vorne nur memberships zu, nach dem Rollback wieder nur tenant_memberships', async () => {
    await prepareTargets(ctx!);
    const membershipPoliciesBefore = await ctx!.client.query(
      `SELECT count(*)::int AS n FROM pg_policy WHERE polrelid = 'public.memberships'::regclass`,
    );
    const own = await createTenantWithMember(ctx!);
    const foreign = await createTenantWithMember(ctx!);
    const { rows: legacyRows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
      [`legacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.test`],
    );
    const legacyUserId = legacyRows[0]!.id;
    await ctx!.client.query(
      `INSERT INTO public.memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [own.tenantId, legacyUserId],
    );
    await ctx!.client.query(
      `INSERT INTO public.tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [own.tenantId, legacyUserId],
    );

    const apiKeyId = await insertApiKey(ctx!, own.tenantId, 'ap2-own');
    await ctx!.client.query(
      `INSERT INTO public.api_calls (tenant_id, api_key_id, endpoint, method, request_path)
       VALUES ($1, $2, '/x', 'GET', '/x')`,
      [own.tenantId, apiKeyId],
    );
    const { rows: hook } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.webhook_endpoints (tenant_id, url, secret_key, events)
       VALUES ($1, 'https://example.test/hook', 'secret', ARRAY['warning_80'])
       RETURNING id`,
      [own.tenantId],
    );
    const { rows: deliveryColumn } = await ctx!.client.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'webhook_deliveries'
            AND column_name = 'webhook_id'
       ) AS ok`,
    );
    const deliveriesUseWebhookId = deliveryColumn[0]!.ok;
    if (deliveriesUseWebhookId) {
      await ctx!.client.query(
        `INSERT INTO public.webhook_deliveries (webhook_id, event_type, event_data)
         VALUES ($1, 'warning_80', '{}'::jsonb)`,
        [hook[0]!.id],
      );
    }
    await ctx!.client.query(
      `INSERT INTO public.quota_alerts (tenant_id, alert_type, api_calls_count, quota_limit)
       VALUES ($1, 'warning_80', 1, 10)`,
      [own.tenantId],
    );
    await ctx!.client.query(
      `INSERT INTO public.email_notifications (tenant_id, recipient_email, event_type, subject, body)
       VALUES ($1, 'a@example.test', 'quota_warning', 's', 'b')`,
      [own.tenantId],
    );
    await ctx!.client.query(
      `INSERT INTO public.custom_frameworks (id, tenant_id, name, created_by)
       VALUES ('cf-own', $1, 'Rahmen', $2)`,
      [own.tenantId, own.userId],
    );
    await ctx!.client.query(
      `INSERT INTO public.custom_controls (id, framework_id, name) VALUES ('cc-own', 'cf-own', 'Kontrolle')`,
    );
    await ctx!.client.query(
      `INSERT INTO public.custom_framework_mappings (id, framework_id, standard_framework)
       VALUES ('cfm-own', 'cf-own', 'dsgvo')`,
    );
    await ctx!.client.query(
      `INSERT INTO public.api_rate_limit_configs (tenant_id, api_key_id) VALUES ($1, $2)`,
      [own.tenantId, apiKeyId],
    );
    await ctx!.client.query(
      `INSERT INTO public.api_rate_limit_violations
         (tenant_id, api_key_id, violation_type, requests_count, limit_value)
       VALUES ($1, $2, 'per_minute', 11, 10)`,
      [own.tenantId, apiKeyId],
    );
    await insertEvent(ctx!, own.tenantId);

    await applyForward(ctx!);
    await ctx!.client.query(`DELETE FROM public.tenant_memberships WHERE user_id = $1`, [own.userId]);
    await ctx!.client.query(`DELETE FROM public.memberships WHERE user_id = $1`, [legacyUserId]);

    const reads: Array<[string, string]> = [
      ['api_calls', `SELECT 1 FROM public.api_calls WHERE tenant_id = $1`],
      ['quota_alerts', `SELECT 1 FROM public.quota_alerts WHERE tenant_id = $1`],
      ['email_notifications', `SELECT 1 FROM public.email_notifications WHERE tenant_id = $1`],
      ['webhook_endpoints', `SELECT 1 FROM public.webhook_endpoints WHERE tenant_id = $1`],
      ...(deliveriesUseWebhookId
        ? [['webhook_deliveries', `SELECT 1 FROM public.webhook_deliveries WHERE webhook_id = $1`] as [string, string]]
        : []),
      ['custom_controls', `SELECT 1 FROM public.custom_controls WHERE id = 'cc-own'`],
      ['custom_framework_mappings', `SELECT 1 FROM public.custom_framework_mappings WHERE id = 'cfm-own'`],
      ['api_rate_limit_configs', `SELECT 1 FROM public.api_rate_limit_configs WHERE tenant_id = $1`],
      ['api_rate_limit_violations', `SELECT 1 FROM public.api_rate_limit_violations WHERE tenant_id = $1`],
      ['runtime_events', `SELECT 1 FROM public.runtime_events WHERE tenant_id = $1`],
    ];

    for (const [label, sql] of reads) {
      const param = label === 'webhook_deliveries' ? [hook[0]!.id] : label.startsWith('custom_') ? [] : [own.tenantId];
      const member = await asRole(ctx!, 'authenticated', own.userId, sql, param);
      const legacy = await asRole(ctx!, 'authenticated', legacyUserId, sql, param);
      const stranger = await asRole(ctx!, 'authenticated', foreign.userId, sql, param);
      const anon = await asRole(ctx!, 'anon', null, sql, param);
      expect(member, `${label} nur memberships`).toBe('allow');
      expect(legacy, `${label} nur tenant_memberships`).toBe('deny');
      expect(stranger, `${label} fremder Mandant`).toBe('deny');
      expect(anon, `${label} anon`).toBe('deny');
    }

    const inserted = await asRole(
      ctx!,
      'authenticated',
      own.userId,
      `INSERT INTO public.webhook_endpoints (tenant_id, url, secret_key) VALUES ($1, 'https://example.test/new', 's') RETURNING id`,
      [own.tenantId],
    );
    const insertedForeign = await asRole(
      ctx!,
      'authenticated',
      foreign.userId,
      `INSERT INTO public.webhook_endpoints (tenant_id, url, secret_key) VALUES ($1, 'https://example.test/no', 's') RETURNING id`,
      [own.tenantId],
    );
    expect(inserted).toBe('allow');
    expect(insertedForeign).toBe('deny');

    const updated = await asRole(
      ctx!,
      'authenticated',
      own.userId,
      `UPDATE public.webhook_endpoints SET url = 'https://example.test/edited' WHERE tenant_id = $1 RETURNING id`,
      [own.tenantId],
    );
    const deleted = await asRole(
      ctx!,
      'authenticated',
      own.userId,
      `DELETE FROM public.custom_controls WHERE id = 'cc-own' RETURNING id`,
    );
    expect(updated).toBe('allow');
    expect(deleted).toBe('allow');

    const switchedNames = [
      'api_calls tenant_member_read',
      'webhook_endpoints tenant_member_read',
      'webhook_endpoints tenant_member_insert',
      'webhook_endpoints tenant_member_update',
      'webhook_endpoints tenant_member_delete',
      ...(deliveriesUseWebhookId ? ['webhook_deliveries tenant_member_read'] : []),
      'quota_alerts tenant_member_read',
      'email_notifications tenant_member_read',
      'Users can read controls in their frameworks',
      'Users can create controls in their frameworks',
      'Users can update controls in their frameworks',
      'Users can delete controls in their frameworks',
      'Users can read mappings in their frameworks',
      'Users can create mappings in their frameworks',
      'Users can delete mappings in their frameworks',
      "Users can view their tenant's rate limit configs",
      "Users can update their tenant's rate limit configs",
      "Users can view their tenant's rate limit violations",
    ];
    const switched = (await policySources(ctx!)).filter((source) => switchedNames.includes(source.name));
    expect(switched.map((source) => source.name).sort()).toEqual([...switchedNames].sort());
    for (const source of switched) {
      expect(source.src, source.name).not.toMatch(/tenant_memberships/i);
      expect(source.src, source.name).toMatch(/is_tenant_member/i);
    }
    if (!deliveriesUseWebhookId) {
      const obsolete = await ctx!.client.query(
        `SELECT 1 FROM pg_policy
          WHERE polrelid = 'public.webhook_deliveries'::regclass
            AND polname = 'webhook_deliveries tenant_member_read'`,
      );
      expect(obsolete.rowCount).toBe(0);
    }

    const fn = await ctx!.client.query<{ prosrc: string }>(
      `SELECT prosrc FROM pg_proc WHERE proname = 'has_tenant_membership'`,
    );
    expect(fn.rows[0]!.prosrc).toMatch(/is_tenant_member/);
    expect(fn.rows[0]!.prosrc).not.toMatch(/tenant_memberships/);

    const seen = await asRole(
      ctx!,
      'authenticated',
      own.userId,
      `SELECT 1 WHERE public.is_tenant_member($1)`,
      [own.tenantId],
    );
    const unseen = await asRole(
      ctx!,
      'authenticated',
      legacyUserId,
      `SELECT 1 WHERE public.is_tenant_member($1)`,
      [own.tenantId],
    );
    expect(seen).toBe('allow');
    expect(unseen).toBe('deny');

    const membershipPoliciesAfter = await ctx!.client.query(
      `SELECT count(*)::int AS n FROM pg_policy WHERE polrelid = 'public.memberships'::regclass`,
    );
    expect(membershipPoliciesAfter.rows[0]!.n).toBe(membershipPoliciesBefore.rows[0]!.n);

    const freeze = await asRole(
      ctx!,
      'authenticated',
      own.userId,
      `INSERT INTO public.tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner') RETURNING tenant_id`,
      [own.tenantId, own.userId],
    );
    expect(freeze).toBe('deny');

    await apply(ctx!, ...backward);

    for (const [label, sql] of reads) {
      if (label === 'custom_controls') continue;
      const param = label === 'webhook_deliveries' ? [hook[0]!.id] : label.startsWith('custom_') ? [] : [own.tenantId];
      const onlyMemberships = await asRole(ctx!, 'authenticated', own.userId, sql, param);
      const onlyLegacy = await asRole(ctx!, 'authenticated', legacyUserId, sql, param);
      const stranger = await asRole(ctx!, 'authenticated', foreign.userId, sql, param);
      // Zweite Policies, die AP2 nicht anfasst und die schon memberships lesen:
      // api_calls member_read_canonical, runtime_events_tenant_read.
      const membershipsReadRemains = label === 'api_calls' || label === 'runtime_events';
      expect(onlyMemberships, `${label} Rollback, nur memberships`).toBe(membershipsReadRemains ? 'allow' : 'deny');
      expect(stranger, `${label} Rollback, fremder Mandant`).toBe('deny');
      // mappings: Unterabfrage auf custom_frameworks unterliegt dort weiter
      // is_tenant_member. Rate-Limits: Unterabfrage auf tenants sieht die Zeile
      // fuer einen Nutzer ohne memberships nicht. Die Policy-Texte stellen die
      // Altquelle trotzdem her (Assertion darunter).
      if (label !== 'custom_framework_mappings'
        && label !== 'api_rate_limit_configs'
        && label !== 'api_rate_limit_violations') {
        expect(onlyLegacy, `${label} Rollback, nur tenant_memberships`).toBe('allow');
      }
    }

    const restored = (await policySources(ctx!)).filter((source) => switchedNames.includes(source.name));
    expect(restored.map((source) => source.name).sort()).toEqual([...switchedNames].sort());
    expect(restored.every((source) => /tenant_memberships/i.test(source.src))).toBe(true);
    const fnBack = await ctx!.client.query<{ prosrc: string }>(
      `SELECT prosrc FROM pg_proc WHERE proname = 'has_tenant_membership'`,
    );
    expect(fnBack.rows[0]!.prosrc).toMatch(/tenant_memberships/);

    await ctx!.client.query(
      `INSERT INTO public.memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [own.tenantId, legacyUserId],
    );
    await applyForward(ctx!);
    const again = await asRole(
      ctx!,
      'authenticated',
      own.userId,
      `SELECT 1 FROM public.api_calls WHERE tenant_id = $1`,
      [own.tenantId],
    );
    expect(again).toBe('allow');
  });

  it('gewahrt jede erlaubte memberships-Rolle und verweigert den fremden Mandanten', async () => {
    await prepareTargets(ctx!);
    await applyForward(ctx!);
    const roles = await membershipRoles(ctx!);
    expect(roles.length).toBeGreaterThan(0);
    const stranger = await createTenantWithMember(ctx!);
    const strangerKey = await insertApiKey(ctx!, stranger.tenantId, 'ap2-stranger');
    await ctx!.client.query(
      `INSERT INTO public.api_calls (tenant_id, api_key_id, endpoint, method, request_path) VALUES ($1, $2, '/r', 'GET', '/r')`,
      [stranger.tenantId, strangerKey],
    );

    for (const role of roles) {
      const member = await createTenantWithMember(ctx!);
      await ctx!.client.query(`UPDATE public.memberships SET role = $2 WHERE user_id = $1`, [member.userId, role]);
      await ctx!.client.query(`DELETE FROM public.tenant_memberships WHERE user_id = $1`, [member.userId]);
      const memberKey = await insertApiKey(ctx!, member.tenantId, `ap2-${role}`);
      await ctx!.client.query(
        `INSERT INTO public.api_calls (tenant_id, api_key_id, endpoint, method, request_path) VALUES ($1, $2, '/r', 'GET', '/r')`,
        [member.tenantId, memberKey],
      );
      const own = await asRole(
        ctx!,
        'authenticated',
        member.userId,
        `SELECT 1 FROM public.api_calls WHERE tenant_id = $1`,
        [member.tenantId],
      );
      const foreign = await asRole(
        ctx!,
        'authenticated',
        member.userId,
        `SELECT 1 FROM public.api_calls WHERE tenant_id = $1`,
        [stranger.tenantId],
      );
      expect(own, role).toBe('allow');
      expect(foreign, role).toBe('deny');
    }
  });

  it('schickt die Quota-Mail nur an memberships.admin, nach dem Rollback nur an tenant_memberships.admin', async () => {
    await prepareTargets(ctx!);
    const tenant = await createTenantWithMember(ctx!);
    await ctx!.client.query(`UPDATE public.memberships SET role = 'admin' WHERE user_id = $1`, [tenant.userId]);
    await ctx!.client.query(`UPDATE auth.users SET email = 'kanonisch@example.test' WHERE id = $1`, [tenant.userId]);
    await applyForward(ctx!);
    await ctx!.client.query(`DELETE FROM public.tenant_memberships WHERE user_id = $1`, [tenant.userId]);

    const { rows: legacyUser } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users (email) VALUES ('alt@example.test') RETURNING id`,
    );
    await ctx!.client.query(
      `INSERT INTO public.tenant_memberships (tenant_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [tenant.tenantId, legacyUser[0]!.id],
    );
    await ctx!.client.query(`SELECT public.notify_quota_alert($1, 'warning_80', 8, 10)`, [tenant.tenantId]);
    const forwardMails = await ctx!.client.query<{ recipient_email: string }>(
      `SELECT recipient_email FROM public.email_notifications WHERE tenant_id = $1 ORDER BY recipient_email`,
      [tenant.tenantId],
    );
    expect(forwardMails.rows.map((row) => row.recipient_email)).toEqual(['kanonisch@example.test']);

    await ctx!.client.query(`DELETE FROM public.email_notifications WHERE tenant_id = $1`, [tenant.tenantId]);
    await apply(ctx!, ...backward);
    await ctx!.client.query(`SELECT public.notify_quota_alert($1, 'warning_80', 8, 10)`, [tenant.tenantId]);
    const backMails = await ctx!.client.query<{ recipient_email: string }>(
      `SELECT recipient_email FROM public.email_notifications WHERE tenant_id = $1 ORDER BY recipient_email`,
      [tenant.tenantId],
    );
    expect(backMails.rows.map((row) => row.recipient_email)).toEqual(['alt@example.test']);
  });
});
