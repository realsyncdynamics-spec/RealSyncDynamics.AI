/**
 * Integration gegen ein live-förmiges Schema (nicht den Localtest-Stub,
 * der webhook_deliveries an die defekte Funktion anpasst).
 *
 * Ohne TEST_DB_URL wird die Suite übersprungen.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

async function seedTenant(ctx: DbCtx) {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { rows: tRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`,
    [`quota_${suffix}`],
  );
  const tenantId = tRows[0]!.id;

  const { rows: ownerRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
    [`owner_${suffix}@example.com`],
  );
  const { rows: adminRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
    [`admin_${suffix}@example.com`],
  );
  const { rows: editorRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
    [`editor_${suffix}@example.com`],
  );
  const { rows: shadowRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
    [`shadow_admin_${suffix}@example.com`],
  );

  const ownerId = ownerRows[0]!.id;
  const adminId = adminRows[0]!.id;
  const editorId = editorRows[0]!.id;
  const shadowId = shadowRows[0]!.id;

  await ctx.client.query(
    `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES
      ($1,$2,'owner'), ($1,$3,'admin'), ($1,$4,'editor')`,
    [tenantId, ownerId, adminId, editorId],
  );
  // Nur in der Schattentabelle: darf keine Mail bekommen.
  await ctx.client.query(
    `INSERT INTO public.tenant_memberships(tenant_id, user_id, role) VALUES ($1,$2,'admin')`,
    [tenantId, shadowId],
  );

  await ctx.client.query(
    `INSERT INTO public.webhook_subscriptions(tenant_id, event_key, url, enabled, active)
     VALUES ($1, 'quota.warning', 'https://example.test/hook', true, true)`,
    [tenantId],
  );

  return {
    tenantId,
    ownerEmail: `owner_${suffix}@example.com`,
    adminEmail: `admin_${suffix}@example.com`,
    editorEmail: `editor_${suffix}@example.com`,
    shadowEmail: `shadow_admin_${suffix}@example.com`,
  };
}

d('notify_quota_alert (live-förmiges Schema)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => {
    ctx = await openDb();
  });
  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  it('mappt warning_80 auf quota_warning und mailt Owner und Admin, nicht Editor oder Schatten-Admin', async () => {
    const seed = await seedTenant(ctx!);
    await ctx!.client.query(
      `SELECT public.notify_quota_alert($1::uuid, 'warning_80', 80, 100)`,
      [seed.tenantId],
    );

    const { rows: alerts } = await ctx!.client.query<{ alert_type: string }>(
      `SELECT alert_type FROM public.quota_alerts WHERE tenant_id = $1`,
      [seed.tenantId],
    );
    expect(alerts.map((r) => r.alert_type)).toEqual(['warning_80']);

    const { rows: mails } = await ctx!.client.query<{ recipient_email: string; event_type: string }>(
      `SELECT recipient_email, event_type FROM public.email_notifications WHERE tenant_id = $1 ORDER BY recipient_email`,
      [seed.tenantId],
    );
    expect(mails.map((r) => r.event_type)).toEqual(['quota_warning', 'quota_warning']);
    const recipients = mails.map((r) => r.recipient_email).sort();
    expect(recipients).toEqual([seed.adminEmail, seed.ownerEmail].sort());
    expect(recipients).not.toContain(seed.editorEmail);
    expect(recipients).not.toContain(seed.shadowEmail);
  });

  it('schreibt webhook_deliveries in die Live-Spalten mit event_key quota.warning', async () => {
    const seed = await seedTenant(ctx!);
    await ctx!.client.query(
      `SELECT public.notify_quota_alert($1::uuid, 'warning_80', 80, 100)`,
      [seed.tenantId],
    );

    const { rows } = await ctx!.client.query<{
      event_key: string;
      url: string;
      status: string;
      request_body: { event_type: string; alert_type: string };
    }>(
      `SELECT event_key, url, status, request_body
         FROM public.webhook_deliveries
        WHERE tenant_id = $1`,
      [seed.tenantId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.event_key).toBe('quota.warning');
    expect(rows[0]?.url).toBe('https://example.test/hook');
    expect(rows[0]?.status).toBe('pending');
    expect(rows[0]?.request_body.event_type).toBe('quota_warning');
    expect(rows[0]?.request_body.alert_type).toBe('warning_80');
  });

  it('mappt limit_exceeded auf quota_exceeded und legt ohne passendes Abo keine Delivery an', async () => {
    const seed = await seedTenant(ctx!);
    await ctx!.client.query(
      `SELECT public.notify_quota_alert($1::uuid, 'limit_exceeded', 120, 100)`,
      [seed.tenantId],
    );

    const { rows: mails } = await ctx!.client.query<{ event_type: string }>(
      `SELECT event_type FROM public.email_notifications WHERE tenant_id = $1`,
      [seed.tenantId],
    );
    expect(mails).toHaveLength(2);
    expect(new Set(mails.map((r) => r.event_type))).toEqual(new Set(['quota_exceeded']));

    const { rows: deliveries } = await ctx!.client.query(
      `SELECT 1 FROM public.webhook_deliveries WHERE tenant_id = $1`,
      [seed.tenantId],
    );
    expect(deliveries).toHaveLength(0);
  });

  it('nimmt auch bereits kanonische p_alert_type-Werte quota_warning entgegen', async () => {
    const seed = await seedTenant(ctx!);
    await ctx!.client.query(
      `SELECT public.notify_quota_alert($1::uuid, 'quota_warning', 80, 100)`,
      [seed.tenantId],
    );
    const { rows } = await ctx!.client.query<{ alert_type: string }>(
      `SELECT alert_type FROM public.quota_alerts WHERE tenant_id = $1`,
      [seed.tenantId],
    );
    expect(rows[0]?.alert_type).toBe('warning_80');
  });
});
