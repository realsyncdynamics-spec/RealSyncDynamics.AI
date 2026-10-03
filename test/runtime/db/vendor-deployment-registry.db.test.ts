/**
 * Anbieter-/Deployment-Registry (DB-Integration)
 *
 * Prueft die Migration 20260926020000_vendor_deployment_registry.sql:
 *   * Die fuenf echten Registry-Dateien lassen sich ueber den Import-Plan
 *     (scripts/registry/import-dry-run.ts) 1:1 einspielen – nur als service_role.
 *   * Globale Registry: authenticated liest, schreibt nie; anon liest nicht.
 *   * Keine Ergebnis-/Routing-/Immunitaets-Spalte in den Registry-Tabellen.
 *   * Mandanten-Konfiguration ist mandantengetrennt; nur Owner/Admin schreiben.
 *   * Assessment-Snapshots: nur service_role fuegt ein, UPDATE ist gesperrt.
 *   * CHECKs spiegeln die Evidence-Regeln der Gates.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

import { buildImportPlan, FORBIDDEN_COLUMNS } from '../../../scripts/registry/import-dry-run.ts';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('Anbieter-/Deployment-Registry') ? describe : describe.skip;

const REGISTRY = resolve(__dirname, '../../../registry');
const JSONB = new Set(['facts', 'capabilities', 'pricing', 'jurisdiction', 'price', 'sources', 'value', 'verification', 'inputs', 'derived', 'findings', 'settings']);

async function insertRow(ctx: DbCtx, table: string, row: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(row);
  const vals = cols.map((c) => (JSONB.has(c) ? (row[c] === null ? null : JSON.stringify(row[c])) : row[c]));
  const ph = cols.map((c, i) => (JSONB.has(c) ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ');
  await ctx.client.query(`INSERT INTO public.${table} (${cols.join(', ')}) VALUES (${ph})`, vals);
}

async function importRegistry(ctx: DbCtx): Promise<Record<string, number>> {
  const plan = await buildImportPlan(REGISTRY, resolve(REGISTRY, 'schema'));
  expect(plan.ok).toBe(true);
  return ctx.withClaims({ role: 'service_role' }, async () => {
    const counts: Record<string, number> = {};
    for (const table of ['registry_vendors', 'registry_deployments', 'registry_models', 'registry_certifications', 'registry_claims'] as const) {
      for (const row of plan.tables[table]) await insertRow(ctx, table, row);
      counts[table] = plan.tables[table].length;
    }
    return counts;
  });
}

async function expectDenied(p: Promise<unknown>): Promise<void> {
  await expect(p).rejects.toThrow(/permission denied|row-level security|append-only|violates/);
}

async function asAnon<T>(ctx: DbCtx, fn: () => Promise<T>): Promise<T> {
  await ctx.client.query('SAVEPOINT anon_sp');
  await ctx.client.query(`SELECT set_config('request.jwt.claims', '{"role":"anon"}', true)`);
  await ctx.client.query('SET LOCAL ROLE anon');
  try {
    const out = await fn();
    await ctx.client.query('RELEASE SAVEPOINT anon_sp');
    await ctx.client.query('RESET ROLE');
    return out;
  } catch (e) {
    await ctx.client.query('ROLLBACK TO SAVEPOINT anon_sp');
    await ctx.client.query('RESET ROLE');
    throw e;
  }
}

function assessmentRow(tenantId: string, extra: Record<string, unknown> = {}) {
  return {
    tenant_id: tenantId,
    deployment_id: 'ionos-ai-model-hub-de',
    model_id: 'gpt-oss-120b',
    policy_profile: 'eu_data_residency',
    assurance_target: 'data_residency',
    rule_version: 'registry-invariants@0.1.0',
    evaluated_at: '2026-09-26T10:00:00Z',
    evidence_cutoff: '2026-09-26T00:00:00Z',
    expires_at: '2026-12-26T00:00:00Z',
    result: 'CONDITIONAL',
    inputs: { deployment_id: 'ionos-ai-model-hub-de' },
    inputs_hash: 'a'.repeat(64),
    derived: {},
    findings: [],
    ...extra,
  };
}

d('Registry – Import und Lesen', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('die fuenf echten Registry-Dateien lassen sich als service_role einspielen', async () => {
    const counts = await importRegistry(ctx!);
    expect(counts.registry_vendors).toBe(5);
    expect(counts.registry_deployments).toBe(5);
    const r = await ctx!.client.query(`SELECT deployment_id, inference_region_scope, third_country_access_status FROM public.registry_deployments ORDER BY 1`);
    expect(r.rows.map((x) => `${x.deployment_id}:${x.inference_region_scope}`)).toEqual([
      'ionos-ai-model-hub-de:country',
      'mistral-la-plateforme-eu:eu_efta',
      'ovhcloud-ai-endpoints-gra:country',
      'scaleway-generative-apis-fr-par:country',
      'stackit-ai-model-serving-eu01:country',
    ]);
  });

  it('authenticated liest die Registry, schreibt aber nie', async () => {
    await importRegistry(ctx!);
    const { userId } = await createTenantWithMember(ctx!);
    const n = await ctx!.withClaims({ sub: userId, role: 'authenticated' }, async () =>
      (await ctx!.client.query('SELECT count(*)::int AS n FROM public.registry_models')).rows[0].n);
    expect(n).toBeGreaterThan(0);
    await expectDenied(ctx!.withClaims({ sub: userId, role: 'authenticated' }, () =>
      ctx!.client.query(`UPDATE public.registry_deployments SET listing_status = 'retired'`)));
    await expectDenied(ctx!.withClaims({ sub: userId, role: 'authenticated' }, () =>
      ctx!.client.query(`DELETE FROM public.registry_claims`)));
    await expectDenied(ctx!.withClaims({ sub: userId, role: 'authenticated' }, () =>
      insertRow(ctx!, 'registry_vendors', { vendor_id: 'evil', display_name: 'x', legal_name_status: 'unknown', control_change_status: 'unknown', facts: {}, schema_version: '1.0', source_file: 'x', source_sha256: 'a'.repeat(64) })));
  });

  it('anon liest weder Registry noch Mandantendaten', async () => {
    await importRegistry(ctx!);
    for (const t of ['registry_vendors', 'registry_deployments', 'registry_models', 'registry_certifications', 'registry_claims', 'tenant_deployment_configs', 'deployment_assessments']) {
      await expectDenied(asAnon(ctx!, () => ctx!.client.query(`SELECT 1 FROM public.${t} LIMIT 1`)));
    }
  });

  it('keine Ergebnis-, Routing- oder Immunitaets-Spalte in den Registry-Tabellen', async () => {
    const r = await ctx!.client.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name LIKE 'registry\\_%' AND column_name = ANY($1)`,
      [FORBIDDEN_COLUMNS],
    );
    expect(r.rows).toEqual([]);
  });
});

d('Registry – CHECK-Constraints (Evidence-Regeln)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); await importRegistry(ctx); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  const sp = async (fn: () => Promise<unknown>) => {
    await ctx!.client.query('SAVEPOINT c');
    try { await fn(); await ctx!.client.query('RELEASE SAVEPOINT c'); return null; } catch (e) { await ctx!.client.query('ROLLBACK TO SAVEPOINT c'); return e as Error; }
  };

  it('claimed-Claim ohne Quelle wird abgelehnt', async () => {
    const e = await sp(() => insertRow(ctx!, 'registry_claims', { deployment_id: 'ionos-ai-model-hub-de', claim_id: 'x', claim_type: 'other', statement: 'x', status: 'claimed', sources: [], captured_at: '2026-09-26' }));
    expect(e?.message).toMatch(/registry_claims_sourced/);
  });

  it('Zertifikat ohne Quelle oder mit umgekehrter Gueltigkeit wird abgelehnt', async () => {
    const base = { owner_kind: 'vendor', vendor_id: 'ovhcloud', cert_id: 'x', scheme: 'ISO_27001', name: 'x', scope: 'x', applies_to_sku: [], status: 'claimed', captured_at: '2026-09-26' };
    expect((await sp(() => insertRow(ctx!, 'registry_certifications', { ...base, sources: [] })))?.message).toMatch(/check/);
    expect((await sp(() => insertRow(ctx!, 'registry_certifications', { ...base, cert_id: 'y', sources: [{ url: 'https://x' }], valid_from: '2026-01-01', valid_until: '2025-01-01' })))?.message).toMatch(/registry_certifications_validity/);
  });

  it('Modell mit Kategorie UND eigenem Preis wird abgelehnt', async () => {
    const e = await sp(() => ctx!.client.query(`UPDATE public.registry_models SET price = '{"input_per_1m":1}'::jsonb WHERE deployment_id = 'stackit-ai-model-serving-eu01' AND model_id = 'gpt-oss-120b'`));
    expect(e?.message).toMatch(/registry_models_price_xor_category/);
  });

  it('Siegel awarded ohne SKU/Level wird abgelehnt', async () => {
    const e = await sp(() => ctx!.client.query(`UPDATE public.registry_deployments SET eu_commission_seal_status = 'awarded' WHERE deployment_id = 'ovhcloud-ai-endpoints-gra'`));
    expect(e?.message).toMatch(/registry_deployments_seal_level/);
  });
});

d('Mandanten-Konfiguration und Assessment-Snapshots', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); await importRegistry(ctx); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Konfiguration ist mandantengetrennt; nur Owner/Admin schreiben', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    // Owner von A legt eine Konfiguration an.
    await ctx!.withClaims({ sub: a.userId, role: 'authenticated' }, () =>
      insertRow(ctx!, 'tenant_deployment_configs', { tenant_id: a.tenantId, deployment_id: 'stackit-ai-model-serving-eu01', label: 'Chat DE', residency_class: 'DE_ONLY', intended_purpose: 'Interner Governance-Chat' }));
    const seenByB = await ctx!.withClaims({ sub: b.userId, role: 'authenticated' }, async () =>
      (await ctx!.client.query('SELECT count(*)::int AS n FROM public.tenant_deployment_configs')).rows[0].n);
    expect(seenByB).toBe(0);
    // B kann nicht fuer A schreiben.
    await expectDenied(ctx!.withClaims({ sub: b.userId, role: 'authenticated' }, () =>
      insertRow(ctx!, 'tenant_deployment_configs', { tenant_id: a.tenantId, deployment_id: 'ionos-ai-model-hub-de', label: 'fremd', residency_class: 'DE_ONLY' })));
    // Ein Editor von A liest, schreibt aber nicht.
    const { rows } = await ctx!.client.query(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [`editor_${Date.now()}@example.com`]);
    const editor = rows[0].id as string;
    await ctx!.client.query(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, 'editor')`, [a.tenantId, editor]);
    const seenByEditor = await ctx!.withClaims({ sub: editor, role: 'authenticated' }, async () =>
      (await ctx!.client.query('SELECT label, use_case_risk_class FROM public.tenant_deployment_configs')).rows);
    expect(seenByEditor).toEqual([{ label: 'Chat DE', use_case_risk_class: 'not_assessed' }]);
    await expectDenied(ctx!.withClaims({ sub: editor, role: 'authenticated' }, () =>
      insertRow(ctx!, 'tenant_deployment_configs', { tenant_id: a.tenantId, deployment_id: 'ionos-ai-model-hub-de', label: 'editor', residency_class: 'DE_ONLY' })));
  });

  it('Assessments: nur service_role fuegt ein, UPDATE ist gesperrt, Lesen mandantengetrennt', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    await expectDenied(ctx!.withClaims({ sub: a.userId, role: 'authenticated' }, () => insertRow(ctx!, 'deployment_assessments', assessmentRow(a.tenantId))));
    await ctx!.withClaims({ role: 'service_role' }, () => insertRow(ctx!, 'deployment_assessments', assessmentRow(a.tenantId)));
    await expectDenied(ctx!.withClaims({ role: 'service_role' }, () => ctx!.client.query(`UPDATE public.deployment_assessments SET result = 'PASS'`)));
    // Auch der Eigentuemer der Tabelle (Superuser im Test) scheitert am Trigger.
    await ctx!.client.query('SAVEPOINT u');
    await expect(ctx!.client.query(`UPDATE public.deployment_assessments SET result = 'PASS'`)).rejects.toThrow(/append-only/);
    await ctx!.client.query('ROLLBACK TO SAVEPOINT u');
    const seenA = await ctx!.withClaims({ sub: a.userId, role: 'authenticated' }, async () => (await ctx!.client.query('SELECT result FROM public.deployment_assessments')).rows);
    const seenB = await ctx!.withClaims({ sub: b.userId, role: 'authenticated' }, async () => (await ctx!.client.query('SELECT result FROM public.deployment_assessments')).rows);
    expect(seenA).toEqual([{ result: 'CONDITIONAL' }]);
    expect(seenB).toEqual([]);
  });

  it('Snapshot-CHECKs: Hash-Format, Zeitreihenfolge, Ergebnisliste', async () => {
    const a = await createTenantWithMember(ctx!);
    for (const extra of [{ inputs_hash: 'nicht-hex' }, { evidence_cutoff: '2026-09-27T00:00:00Z' }, { expires_at: '2026-09-25T00:00:00Z' }, { result: 'GREEN' }, { rule_version: 'v1' }]) {
      await expectDenied(ctx!.withClaims({ role: 'service_role' }, () => insertRow(ctx!, 'deployment_assessments', assessmentRow(a.tenantId, extra))));
    }
  });
});
