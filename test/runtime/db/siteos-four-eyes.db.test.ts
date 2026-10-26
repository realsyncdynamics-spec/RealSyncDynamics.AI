/**
 * SiteOS — Vier-Augen-Prinzip in der Datenbank (Migration 20261025100000).
 *
 * Der Kern dieses Tests: Die Regeln halten auch gegen `service_role`. Die
 * Edge Functions prüfen dieselben Regeln vorher (approval-policy.ts); der
 * Trigger ist die Stelle, an der kein Schreibpfad — auch kein Cron- oder
 * KI-Pfad ohne Nutzer — vorbeikommt.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

const SHA = 'c'.repeat(64);
const SERVICE = { role: 'service_role' } as const;
const LONG_REASON = 'Einziger Verantwortlicher; Inhalte selbst geprüft und dokumentiert.';

async function addMember(ctx: DbCtx, tenantId: string, role: string): Promise<string> {
  const email = `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`;
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [email],
  );
  const userId = rows[0]!.id;
  await ctx.client.query(
    `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, $3)`,
    [tenantId, userId, role],
  );
  return userId;
}

async function blueprintBy(ctx: DbCtx, tenantId: string, createdBy: string | null): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.siteos_blueprints
       (tenant_id, slug, name, industry, version, blueprint, content_sha256, origin_source, created_by)
     VALUES ($1, $2, 'Site', 'sonstiges', 1, '{"schemaVersion":1,"pages":[]}'::jsonb, $3, 'ai-builder', $4)
     RETURNING id`,
    [tenantId, `s-${Math.random().toString(36).slice(2, 8)}`, SHA, createdBy],
  );
  return rows[0]!.id;
}

async function pendingEvaluation(ctx: DbCtx, tenantId: string, blueprintId: string): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.siteos_publish_evaluations
       (tenant_id, blueprint_id, artifact_sha256, blueprint_sha256, status, evidence_complete,
        backend_preservation, policy_compliant, human_approval_required)
     VALUES ($1, $2, $3, $3, 'pending', true, 'preserve_all', true, true)
     RETURNING id`,
    [tenantId, blueprintId, SHA],
  );
  return rows[0]!.id;
}

async function waitingRun(ctx: DbCtx, tenantId: string, requestedBy: string | null): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.siteos_agent_runs (tenant_id, agent, status, requires_approval, requested_by)
     VALUES ($1, 'compliance', 'awaiting_approval', true, $2)
     RETURNING id`,
    [tenantId, requestedBy],
  );
  return rows[0]!.id;
}

function approveEvaluation(ctx: DbCtx, id: string, approver: string, reason: string, self = false) {
  return ctx.withClaims(SERVICE, () => ctx.client.query(
    `UPDATE public.siteos_publish_evaluations
        SET approved_by = $2, approved_at = now(), approval_reason = $3, self_approval = $4
      WHERE id = $1`,
    [id, approver, reason, self],
  ));
}

function approveRun(ctx: DbCtx, id: string, approver: string, reason: string | null, self = false) {
  return ctx.withClaims(SERVICE, () => ctx.client.query(
    `UPDATE public.siteos_agent_runs
        SET status = 'queued', approved_by = $2, approved_at = now(), approval_reason = $3, self_approval = $4
      WHERE id = $1`,
    [id, approver, reason, self],
  ));
}

const FOUR_EYES = /four-eyes|not an owner, admin or dpo|author unknown|immutable|without a human approval|self_approval/i;

d('SiteOS / Vier-Augen in der Datenbank (auch gegen service_role)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Publish: Autor kann die eigene Version nicht freigeben, wenn es weitere Freigabeberechtigte gibt', async () => {
    const { tenantId, userId: author } = await createTenantWithMember(ctx!);
    await addMember(ctx!, tenantId, 'dpo');
    const evalId = await pendingEvaluation(ctx!, tenantId, await blueprintBy(ctx!, tenantId, author));

    await expect(approveEvaluation(ctx!, evalId, author, LONG_REASON, true)).rejects.toThrow(FOUR_EYES);
    await expect(approveEvaluation(ctx!, evalId, author, LONG_REASON, false)).rejects.toThrow(FOUR_EYES);
  });

  it('Publish: eine andere berechtigte Person darf freigeben — die Freigabe ist danach unveränderlich', async () => {
    const { tenantId, userId: author } = await createTenantWithMember(ctx!);
    const dpo = await addMember(ctx!, tenantId, 'dpo');
    const admin = await addMember(ctx!, tenantId, 'admin');
    const evalId = await pendingEvaluation(ctx!, tenantId, await blueprintBy(ctx!, tenantId, author));

    await approveEvaluation(ctx!, evalId, dpo, 'Inhalt geprüft, freigegeben.');
    const r = await ctx!.client.query<{ approved_by: string; publishable: boolean }>(
      `SELECT approved_by, publishable FROM public.siteos_publish_evaluations WHERE id = $1`, [evalId],
    );
    expect(r.rows[0]!.approved_by).toBe(dpo);

    await expect(approveEvaluation(ctx!, evalId, admin, 'Nachträglich umschreiben.')).rejects.toThrow(/immutable/);
  });

  it('Publish: editor und viewer_auditor können nicht freigeben', async () => {
    const { tenantId, userId: author } = await createTenantWithMember(ctx!);
    const editor = await addMember(ctx!, tenantId, 'editor');
    const viewer = await addMember(ctx!, tenantId, 'viewer_auditor');
    const evalId = await pendingEvaluation(ctx!, tenantId, await blueprintBy(ctx!, tenantId, author));

    await expect(approveEvaluation(ctx!, evalId, editor, 'Inhalt geprüft, freigegeben.')).rejects.toThrow(FOUR_EYES);
    await expect(approveEvaluation(ctx!, evalId, viewer, 'Inhalt geprüft, freigegeben.')).rejects.toThrow(FOUR_EYES);
  });

  it('Publish: Mitglied eines anderen Mandanten kann nicht freigeben', async () => {
    const A = await createTenantWithMember(ctx!);
    const B = await createTenantWithMember(ctx!);
    const evalId = await pendingEvaluation(ctx!, A.tenantId, await blueprintBy(ctx!, A.tenantId, A.userId));

    await expect(approveEvaluation(ctx!, evalId, B.userId, 'Inhalt geprüft, freigegeben.')).rejects.toThrow(FOUR_EYES);
  });

  it('Publish: Solo-Mandant darf dokumentiert selbst freigeben — nur mit Markierung und Begründung', async () => {
    const { tenantId, userId: solo } = await createTenantWithMember(ctx!);
    // Ein editor zählt nicht als Freigabeberechtigter.
    await addMember(ctx!, tenantId, 'editor');
    const evalId = await pendingEvaluation(ctx!, tenantId, await blueprintBy(ctx!, tenantId, solo));

    await expect(approveEvaluation(ctx!, evalId, solo, LONG_REASON, false)).rejects.toThrow(FOUR_EYES);
    await expect(approveEvaluation(ctx!, evalId, solo, 'zu kurz begründet', true)).rejects.toThrow(FOUR_EYES);

    await approveEvaluation(ctx!, evalId, solo, LONG_REASON, true);
    const r = await ctx!.client.query<{ self_approval: boolean }>(
      `SELECT self_approval FROM public.siteos_publish_evaluations WHERE id = $1`, [evalId],
    );
    expect(r.rows[0]!.self_approval).toBe(true);
  });

  it('Publish: unbekannter Autor ⇒ keine Freigabe (fail-closed)', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const dpo = await addMember(ctx!, tenantId, 'dpo');
    const evalId = await pendingEvaluation(ctx!, tenantId, await blueprintBy(ctx!, tenantId, null));

    await expect(approveEvaluation(ctx!, evalId, dpo, 'Inhalt geprüft, freigegeben.')).rejects.toThrow(/author unknown/);
  });

  it('Agentenlauf: Auslöser kann nicht selbst freigeben, eine andere berechtigte Person schon', async () => {
    const { tenantId, userId: requester } = await createTenantWithMember(ctx!);
    const dpo = await addMember(ctx!, tenantId, 'dpo');
    const runId = await waitingRun(ctx!, tenantId, requester);

    await expect(approveRun(ctx!, runId, requester, LONG_REASON, true)).rejects.toThrow(FOUR_EYES);
    await approveRun(ctx!, runId, dpo, null);
    const r = await ctx!.client.query<{ status: string; approved_by: string }>(
      `SELECT status, approved_by FROM public.siteos_agent_runs WHERE id = $1`, [runId],
    );
    expect(r.rows[0]).toEqual({ status: 'queued', approved_by: dpo });
  });

  it('Agentenlauf: Wartezustand lässt sich nicht per Status-Update ohne Freigabe verlassen', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const runId = await waitingRun(ctx!, tenantId, userId);

    for (const status of ['queued', 'running']) {
      await expect(ctx!.withClaims(SERVICE, () => ctx!.client.query(
        `UPDATE public.siteos_agent_runs SET status = $2 WHERE id = $1`, [runId, status],
      ))).rejects.toThrow(/without a human approval/);
    }
    // Abbrechen bleibt möglich.
    await ctx!.withClaims(SERVICE, () => ctx!.client.query(
      `UPDATE public.siteos_agent_runs SET status = 'cancelled', completed_at = now() WHERE id = $1`, [runId],
    ));
  });

  it('Agentenlauf: Altdaten ohne requested_by sind nicht freigebbar (fail-closed)', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const dpo = await addMember(ctx!, tenantId, 'dpo');
    const runId = await waitingRun(ctx!, tenantId, null);

    await expect(approveRun(ctx!, runId, dpo, null)).rejects.toThrow(/author unknown/);
  });

  it('Agentenlauf: requested_by ist unveränderlich', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const other = await addMember(ctx!, tenantId, 'admin');
    const runId = await waitingRun(ctx!, tenantId, userId);

    await expect(ctx!.withClaims(SERVICE, () => ctx!.client.query(
      `UPDATE public.siteos_agent_runs SET requested_by = $2 WHERE id = $1`, [runId, other],
    ))).rejects.toThrow(/immutable/);
  });
});
