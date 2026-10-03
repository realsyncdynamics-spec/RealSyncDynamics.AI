// provision-tenant — Tenant-Boot (Release 1).
//
// Ein Orchestrator, zwei Einstiege:
//   * Self-Service:  Authorization: Bearer <user JWT>, Owner/Admin des Tenants
//   * Intern:        Authorization: Bearer <service role>, nur mit
//                    trigger ∈ INTERNAL_TRIGGERS (checkout, sales, agency_child)
//
// POST { tenant_id?, trigger?, domain? }
//
// Fuehrt BOOT_STEPS der Reihe nach aus, jeder Schritt idempotent. Ein zweiter
// Aufruf legt nichts doppelt an, sondern meldet den Stand — damit ist dieselbe
// Function auch der Status-Endpunkt fuer „ist mein Sensor schon verifiziert?".
//
// tenant_id kommt nie ungeprueft aus dem Body: Nutzeraufrufe brauchen eine
// Owner/Admin-Mitgliedschaft, interne Aufrufe den Service-Role-Key.
//
// Der Klartext des Ingest-Keys steht ausschliesslich in der Antwort des
// Laufs, der ihn erzeugt hat — nie in tenant_provisioning_runs.steps.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import { randomToken, sha256Hex } from '../_shared/hash.ts';
import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../_shared/evidence-hash.ts';
import { hasFeature, loadEntitlementsForTenant } from '../_shared/entitlements.ts';
import {
  BASELINE_PACKS,
  BOOT_STEPS,
  INTERNAL_TRIGGERS,
  aggregateRunStatus,
  buildVerifyCommand,
  buildWorkerScript,
  connectorStatus,
  isBootTrigger,
  lifecycleSnapshot,
  normalizeDomain,
  policyRowFromTemplate,
  timingSafeEqualString,
  type BootStepId,
  type BootStepResult,
  type BootTrigger,
  type PolicyTemplate,
} from '../_shared/tenant-boot.ts';

const ADMIN_ROLES = ['owner', 'admin'];
const LOCK_MS = 2 * 60 * 1000;
const EVIDENCE_APPEND_ATTEMPTS = 5;
const BOOT_KEY_SOURCES = ['website_scanner'];

interface Ctx {
  admin: SupabaseClient;
  tenantId: string;
  trigger: BootTrigger;
  requestedBy: string | null;
  domainHint: string | null;
  ingestUrl: string;
  // Zwischenergebnisse fuer spaetere Schritte
  apiAccess: boolean;
  websiteAssetId: string | null;
  domain: string | null;
  key: { id: string; prefix: string; first_event_at: string | null; last_used_at: string | null; revoked_at: string | null } | null;
  rawToken: string | null;
}

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === '23505';
}

// ─── Schritte ──────────────────────────────────────────────────────────────

async function stepIdentity(c: Ctx): Promise<BootStepResult> {
  const { data: tenant, error } = await c.admin.from('tenants').select('id').eq('id', c.tenantId).maybeSingle();
  if (error) throw error;
  if (!tenant) return { step: 'identity', status: 'failed', reason: 'tenant_not_found' };
  const { count, error: me } = await c.admin
    .from('memberships').select('user_id', { count: 'exact', head: true })
    .eq('tenant_id', c.tenantId).eq('role', 'owner');
  if (me) throw me;
  if (!count) return { step: 'identity', status: 'failed', reason: 'no_owner' };
  return { step: 'identity', status: 'done', detail: { owners: count } };
}

async function stepEntitlements(c: Ctx): Promise<BootStepResult> {
  const ent = await loadEntitlementsForTenant(c.admin, c.tenantId);
  c.apiAccess = hasFeature(ent, 'api.access');
  return {
    step: 'entitlements',
    status: 'done',
    detail: { api_access: c.apiAccess, resolved_keys: Object.keys(ent.byKey).length },
  };
}

async function resolveDomain(c: Ctx): Promise<string | null> {
  if (c.domainHint) return c.domainHint;
  const { data: site } = await c.admin
    .from('websites').select('domain').eq('tenant_id', c.tenantId)
    .order('created_at', { ascending: true }).limit(1).maybeSingle();
  const fromSite = normalizeDomain(site?.domain);
  if (fromSite) return fromSite;
  const { data: profile } = await c.admin
    .from('company_profiles').select('onboarding_answers').eq('tenant_id', c.tenantId).maybeSingle();
  const a = (profile?.onboarding_answers ?? {}) as Record<string, unknown>;
  return normalizeDomain(a.website ?? a.websiteUrl);
}

async function stepCatalog(c: Ctx): Promise<BootStepResult> {
  c.domain = await resolveDomain(c);
  if (!c.domain) return { step: 'catalog', status: 'pending', reason: 'no_domain' };
  const systemUrl = `https://${c.domain}`;

  // Letzter oeffentlicher Scan derselben Domain: nur Kennzahlen, keine
  // Lead-Daten (E-Mail, IP-Hash) wandern in den Tenant.
  let scan: Record<string, unknown> | null = null;
  const { data: audit, error: ae } = await c.admin
    .from('gdpr_audits').select('id, score, severity, issues, created_at')
    .eq('domain', c.domain).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!ae && audit) {
    scan = {
      audit_id: audit.id,
      score: audit.score,
      severity: audit.severity,
      issue_count: Array.isArray(audit.issues) ? audit.issues.length : 0,
      scanned_at: audit.created_at,
    };
  }

  const { data: existing, error: ee } = await c.admin
    .from('governance_assets').select('id, metadata')
    .eq('tenant_id', c.tenantId).eq('asset_type', 'website').eq('system_url', systemUrl)
    .limit(1).maybeSingle();
  if (ee) throw ee;

  let created = false;
  if (existing) {
    c.websiteAssetId = existing.id;
    if (scan) {
      const { error } = await c.admin.from('governance_assets')
        .update({ metadata: { ...(existing.metadata ?? {}), scan }, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    }
  } else {
    const { data: ins, error } = await c.admin.from('governance_assets').insert({
      tenant_id: c.tenantId,
      asset_type: 'website',
      name: c.domain,
      system_url: systemUrl,
      status: 'active',
      metadata: { discovered_by: 'tenant-boot', ...(scan ? { scan } : {}) },
    }).select('id').single();
    if (error) throw error;
    c.websiteAssetId = ins.id;
    created = true;
  }
  return {
    step: 'catalog',
    status: 'done',
    created,
    detail: { domain: c.domain, asset_id: c.websiteAssetId, scan: scan ? 'imported' : 'none' },
  };
}

async function stepPolicyBundle(c: Ctx): Promise<BootStepResult> {
  const now = new Date().toISOString();
  for (const pack_id of BASELINE_PACKS) {
    const { error } = await c.admin.from('policy_pack_activations').upsert(
      { tenant_id: c.tenantId, pack_id, activated_at: now, created_by: c.requestedBy },
      { onConflict: 'tenant_id,pack_id', ignoreDuplicates: true },
    );
    if (error) throw error;
  }
  const { data: acts, error: ae } = await c.admin
    .from('policy_pack_activations').select('pack_id').eq('tenant_id', c.tenantId);
  if (ae) throw ae;
  const packs = [...new Set((acts ?? []).map((a) => a.pack_id as string))];

  const { data: templates, error: te } = await c.admin
    .from('policy_rule_templates')
    .select('id, pack_id, version, name, description, policy_type, severity, enforce_action, condition')
    .in('pack_id', packs);
  if (te) throw te;
  if (!templates?.length) return { step: 'policy_bundle', status: 'failed', reason: 'no_templates' };

  const { data: have, error: he } = await c.admin
    .from('governance_policies').select('source_template_id')
    .eq('tenant_id', c.tenantId).not('source_template_id', 'is', null);
  if (he) throw he;
  const present = new Set((have ?? []).map((p) => p.source_template_id as string));

  const cloned: string[] = [];
  for (const t of templates as PolicyTemplate[]) {
    if (present.has(t.id)) continue;
    const { error } = await c.admin.from('governance_policies').insert(policyRowFromTemplate(c.tenantId, t));
    if (error && !isUniqueViolation(error)) throw error;
    if (!error) cloned.push(t.id);
  }
  return {
    step: 'policy_bundle',
    status: 'done',
    created: cloned.length > 0,
    detail: { mode: 'observe', packs, templates: templates.length, cloned },
  };
}

async function loadBootKey(c: Ctx) {
  const { data, error } = await c.admin
    .from('governance_ingest_keys')
    .select('id, key_prefix, first_event_at, last_used_at, revoked_at')
    .eq('tenant_id', c.tenantId).eq('connector_kind', 'boot').is('revoked_at', null)
    .limit(1).maybeSingle();
  if (error) throw error;
  return data
    ? { id: data.id, prefix: data.key_prefix, first_event_at: data.first_event_at, last_used_at: data.last_used_at, revoked_at: data.revoked_at }
    : null;
}

async function stepIngestKey(c: Ctx): Promise<BootStepResult> {
  c.key = await loadBootKey(c);
  if (c.key) {
    return { step: 'ingest_key', status: 'done', detail: { key_id: c.key.id, key_prefix: c.key.prefix } };
  }
  // Entitlement-Gate wie in governance-keys: kein API-Zugang, kein Key.
  if (!c.apiAccess) return { step: 'ingest_key', status: 'skipped', reason: 'not_entitled:api.access' };

  const token = 'rsd_gov_' + randomToken(24);
  const { data, error } = await c.admin.from('governance_ingest_keys').insert({
    tenant_id: c.tenantId,
    name: 'Boot-Sensor',
    key_hash: await sha256Hex(token),
    key_prefix: token.slice(0, 12),
    allowed_sources: BOOT_KEY_SOURCES,
    rate_limit_per_minute: 60,
    created_by: c.requestedBy,
    connector_kind: 'boot',
  }).select('id, key_prefix').single();
  if (error) {
    // Paralleler Lauf hat den Key zuerst angelegt — dessen Klartext kennen
    // wir nicht und geben ihn auch nicht aus.
    if (!isUniqueViolation(error)) throw error;
    c.key = await loadBootKey(c);
    return { step: 'ingest_key', status: 'done', detail: { key_id: c.key?.id ?? null, key_prefix: c.key?.prefix ?? null } };
  }
  c.key = { id: data.id, prefix: data.key_prefix, first_event_at: null, last_used_at: null, revoked_at: null };
  c.rawToken = token;
  return { step: 'ingest_key', status: 'done', created: true, detail: { key_id: data.id, key_prefix: data.key_prefix } };
}

function stepInstaller(c: Ctx): BootStepResult {
  if (!c.key) return { step: 'installer', status: 'skipped', reason: 'no_ingest_key' };
  const status = connectorStatus(c.key);
  if (status === 'verified') return { step: 'installer', status: 'done', detail: { connector_status: status } };
  return {
    step: 'installer',
    status: 'pending',
    reason: status === 'stale' ? 'connector_stale' : 'awaiting_first_event',
    detail: { connector_status: status },
  };
}

async function chainHead(c: Ctx): Promise<string | null> {
  const { data, error } = await c.admin
    .from('governance_evidence').select('content_hash')
    .eq('tenant_id', c.tenantId).not('content_hash', 'is', null)
    // Gleiche Reihenfolge wie append_governance_evidence, damit beide denselben Kopf sehen.
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw error;
  return (data?.content_hash as string | undefined) ?? null;
}

async function appendLifecycle(
  c: Ctx,
  step: BootStepId | 'boot',
  action: string,
  detail: Record<string, unknown>,
  existingEventId: string | null = null,
): Promise<string> {
  const occurredAt = new Date().toISOString();
  // Ein Event ohne Evidence (abgebrochener Lauf) wird wiederverwendet, nicht dupliziert.
  let eventId = existingEventId;
  if (!eventId) {
    const { data: ev, error: ee } = await c.admin.from('governance_events').insert({
      tenant_id: c.tenantId,
      asset_id: step === 'catalog' ? c.websiteAssetId : null,
      event_type: `tenant.lifecycle.${action}`,
      event_source: 'api',
      title: `Tenant-Boot: ${action}`,
      risk_level: 'info',
      payload: { step, trigger: c.trigger, ...detail },
    }).select('id').single();
    if (ee) throw ee;
    eventId = ev.id as string;
  }
  // Anhaengen per Compare-and-Swap auf den Kettenkopf (append_governance_evidence,
  // Advisory-Lock je Tenant): andere Schreiber derselben Kette (tenant-audit,
  // email-auth-rescan) koennen dazwischenkommen — dann neu lesen, neu hashen,
  // erneut versuchen. Die Kette verzweigt nie.
  for (let attempt = 0; attempt < EVIDENCE_APPEND_ATTEMPTS; attempt++) {
    const previousHash = await chainHead(c);
    const snapshot = lifecycleSnapshot({ tenantId: c.tenantId, step, action, detail, occurredAt, previousHash });
    const contentHash = await evidenceContentHash(snapshot);
    const { data, error } = await c.admin.rpc('append_governance_evidence', {
      p_row: {
        tenant_id: c.tenantId,
        event_id: eventId,
        asset_id: step === 'catalog' ? c.websiteAssetId : null,
        evidence_type: 'json',
        title: `Tenant-Boot: ${action}`,
        content_hash: contentHash,
        previous_hash: previousHash,
        metadata: { snapshot, hash_method: EVIDENCE_HASH_METHOD },
      },
      p_expected_previous_hash: previousHash,
    });
    if (error) throw error;
    if (data) return contentHash;
  }
  throw new Error(`evidence chain head kept moving (${EVIDENCE_APPEND_ATTEMPTS} attempts)`);
}

const LIFECYCLE_ACTION: Partial<Record<BootStepId, string>> = {
  catalog: 'asset_discovered',
  policy_bundle: 'pack_applied',
  ingest_key: 'key_issued',
};

/**
 * Stand der Lifecycle-Evidence fuer eine Aktion: ob schon ein Chain-Eintrag
 * existiert, und ob ein Event ohne Evidence liegt (Abbruch zwischen beiden
 * Schreibvorgaengen), das wiederverwendet werden muss.
 */
async function lifecycleEvidenceState(c: Ctx, action: string): Promise<{ covered: boolean; orphanEventId: string | null }> {
  const { data: events, error } = await c.admin
    .from('governance_events').select('id')
    .eq('tenant_id', c.tenantId).eq('event_type', `tenant.lifecycle.${action}`)
    .order('created_at', { ascending: true }).limit(50);
  if (error) throw error;
  const ids = (events ?? []).map((e) => e.id as string);
  if (!ids.length) return { covered: false, orphanEventId: null };
  const { data: ev, error: ee } = await c.admin
    .from('governance_evidence').select('event_id')
    .eq('tenant_id', c.tenantId).in('event_id', ids).not('content_hash', 'is', null);
  if (ee) throw ee;
  const withEvidence = new Set((ev ?? []).map((e) => e.event_id as string));
  // Ein unbelegtes Event zaehlt auch dann, wenn andere derselben Aktion belegt sind.
  const orphanEventId = ids.find((id) => !withEvidence.has(id)) ?? null;
  return { covered: !orphanEventId, orphanEventId };
}

async function stepFirstEvidence(c: Ctx, prior: BootStepResult[]): Promise<BootStepResult> {
  // Jeder erledigte Schritt mit Lifecycle-Aktion ist eine Nachweis-Pflicht. Sie
  // wird aus dem Zustand abgeleitet, nicht aus `created` dieses Laufs: ein
  // abgebrochener Vorlauf hinterlaesst sonst eine Ressource ohne Nachweis, die
  // kein spaeterer Lauf mehr nachtraegt.
  let head: string | null = null;
  const appended: string[] = [];
  const missing: string[] = [];
  let obligations = 0;
  for (const r of prior) {
    const action = LIFECYCLE_ACTION[r.step];
    if (!action || r.status !== 'done') continue;
    obligations++;
    // Immer den Zustand pruefen — auch wenn dieser Lauf etwas angelegt hat:
    // ein verwaistes Event eines Vorlaufs wird zuerst belegt, danach bekommt
    // die neue Anlage ihren eigenen Eintrag.
    const state = await lifecycleEvidenceState(c, action);
    if (state.covered && !r.created) continue;
    try {
      // Nur Kennungen in die Chain, nie Token oder Installer-Artefakte.
      if (state.orphanEventId) {
        head = await appendLifecycle(c, r.step, action, r.detail ?? {}, state.orphanEventId);
        appended.push(action);
      }
      if (r.created || !state.orphanEventId) {
        head = await appendLifecycle(c, r.step, action, r.detail ?? {});
        appended.push(action);
      }
    } catch (e) {
      console.error(`[provision-tenant] lifecycle evidence ${action} failed`, e);
      missing.push(action);
    }
  }
  if (missing.length) return { step: 'first_evidence', status: 'pending', reason: 'evidence_missing', detail: { missing, appended } };
  if (!obligations) return { step: 'first_evidence', status: 'pending', reason: 'no_obligations' };
  head ??= await chainHead(c);
  return { step: 'first_evidence', status: 'done', created: appended.length > 0, detail: { appended, head_hash: head } };
}

// ─── Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');
  const bearer = auth.slice('Bearer '.length).trim();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON = Deno.env.get('SUPABASE_ANON_KEY');
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !ANON || !SRK) return jsonError(500, 'INTERNAL', 'Supabase environment variables missing');

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) ?? {}; } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  if (typeof body !== 'object' || Array.isArray(body)) return jsonError(400, 'BAD_REQUEST', 'expected object');

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  const bodyTenant = typeof body.tenant_id === 'string' ? body.tenant_id : null;
  const trigger: unknown = body.trigger ?? 'self_service';
  if (!isBootTrigger(trigger)) return jsonError(400, 'BAD_REQUEST', 'unknown trigger');

  let tenantId: string;
  let requestedBy: string | null = null;

  if (await timingSafeEqualString(bearer, SRK)) {
    if (!INTERNAL_TRIGGERS.includes(trigger)) return jsonError(400, 'BAD_REQUEST', 'trigger not allowed for service calls');
    if (!bodyTenant) return jsonError(400, 'BAD_REQUEST', 'tenant_id is required');
    tenantId = bodyTenant;
  } else {
    if (INTERNAL_TRIGGERS.includes(trigger)) return jsonError(403, 'FORBIDDEN', 'trigger reserved for server-side calls');
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } }, auth: { persistSession: false },
    });
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u?.user) return jsonError(401, 'UNAUTHORIZED', 'invalid or expired token');
    requestedBy = u.user.id;

    let q = admin.from('memberships').select('tenant_id, role').eq('user_id', u.user.id).in('role', ADMIN_ROLES);
    if (bodyTenant) q = q.eq('tenant_id', bodyTenant);
    const { data: ms, error: me } = await q.limit(2);
    if (me) return jsonError(500, 'INTERNAL', 'membership lookup failed');
    if (!ms?.length) return jsonError(403, 'FORBIDDEN', 'owner or admin membership required');
    if (ms.length > 1) return jsonError(400, 'TENANT_AMBIGUOUS', 'multiple tenants — tenant_id required');
    tenantId = ms[0].tenant_id as string;
  }

  // Lauf-Sperre: parallele Boots desselben Tenants wuerden die Chain gabeln.
  const { data: run, error: re } = await admin
    .from('tenant_provisioning_runs').select('id, status, attempts, updated_at, completed_at')
    .eq('tenant_id', tenantId).maybeSingle();
  if (re) return jsonError(500, 'INTERNAL', 'run lookup failed');
  if (run?.status === 'running' && Date.now() - Date.parse(run.updated_at) < LOCK_MS) {
    return jsonError(409, 'BOOT_IN_PROGRESS', 'a boot run for this tenant is in progress');
  }
  const startedAt = new Date().toISOString();
  if (run) {
    const { data: locked, error } = await admin.from('tenant_provisioning_runs')
      .update({ status: 'running', attempts: run.attempts + 1, updated_at: startedAt, finished_at: null })
      .eq('id', run.id).eq('updated_at', run.updated_at).select('id');
    if (error) return jsonError(500, 'INTERNAL', 'run lock failed');
    if (!locked?.length) return jsonError(409, 'BOOT_IN_PROGRESS', 'a boot run for this tenant is in progress');
  } else {
    const { error } = await admin.from('tenant_provisioning_runs').insert({
      tenant_id: tenantId, trigger, status: 'running', requested_by: requestedBy, started_at: startedAt, updated_at: startedAt,
    });
    if (error) {
      if (isUniqueViolation(error)) return jsonError(409, 'BOOT_IN_PROGRESS', 'a boot run for this tenant is in progress');
      return jsonError(500, 'INTERNAL', 'run create failed');
    }
  }

  const c: Ctx = {
    admin, tenantId, trigger, requestedBy,
    domainHint: normalizeDomain(body.domain),
    ingestUrl: `${SUPABASE_URL}/functions/v1/governance-ingest`,
    apiAccess: false, websiteAssetId: null, domain: null, key: null, rawToken: null,
  };

  const steps: BootStepResult[] = [];
  const runners: Record<BootStepId, () => Promise<BootStepResult> | BootStepResult> = {
    identity: () => stepIdentity(c),
    entitlements: () => stepEntitlements(c),
    catalog: () => stepCatalog(c),
    policy_bundle: () => stepPolicyBundle(c),
    ingest_key: () => stepIngestKey(c),
    installer: () => stepInstaller(c),
    first_evidence: () => stepFirstEvidence(c, steps),
  };
  let blockedBy: BootStepId | null = null;
  for (const id of BOOT_STEPS) {
    if (blockedBy) { steps.push({ step: id, status: 'pending', reason: `blocked_by:${blockedBy}` }); continue; }
    // Lease-Fencing: hat nach Ablauf von LOCK_MS ein neuerer Lauf die Sperre
    // uebernommen, erzeugt dieser Lauf keine weiteren Seiteneffekte mehr.
    const { data: lease, error: le } = await admin.from('tenant_provisioning_runs')
      .select('id').eq('tenant_id', tenantId).eq('updated_at', startedAt).maybeSingle();
    if (le) return jsonError(500, 'INTERNAL', 'run lease check failed');
    if (!lease) return jsonError(409, 'BOOT_SUPERSEDED', 'a newer boot run took over this tenant');
    try {
      steps.push(await runners[id]());
    } catch (e) {
      console.error(`[provision-tenant] step ${id} failed`, e);
      steps.push({ step: id, status: 'failed', reason: 'internal' });
    }
    if (steps[steps.length - 1].status === 'failed') blockedBy = id;
  }

  let status = aggregateRunStatus(steps);
  let completedAt: string | null = run?.completed_at ?? null;
  if (status === 'completed' && !completedAt) {
    try {
      await appendLifecycle(c, 'boot', 'boot_completed', { steps: steps.map((s) => s.step) });
      completedAt = new Date().toISOString();
    } catch (e) {
      console.error('[provision-tenant] boot_completed evidence failed', e);
      status = 'partial';
    }
  }

  const finishedAt = new Date().toISOString();
  // Nur speichern, solange dieser Lauf die Sperre haelt (updated_at = startedAt):
  // ein Lauf, der LOCK_MS ueberschritten hat, darf das Ergebnis eines neueren
  // Laufs nicht ueberschreiben. Ein nicht gespeicherter Stand ist kein Erfolg.
  const { data: saved, error: saveErr } = await admin.from('tenant_provisioning_runs').update({
    status, steps, finished_at: finishedAt, updated_at: finishedAt, completed_at: completedAt,
  }).eq('tenant_id', tenantId).eq('updated_at', startedAt).select('id');
  if (saveErr || !saved?.length) {
    console.error('[provision-tenant] run persist failed', saveErr);
    return jsonError(500, 'INTERNAL', 'run persist failed');
  }

  const installer = c.key
    ? {
        kind: 'cloudflare_worker',
        ingest_url: c.ingestUrl,
        key_prefix: c.key.prefix,
        connector_status: connectorStatus(c.key),
        worker_script: buildWorkerScript({ ingestUrl: c.ingestUrl, domain: c.domain, assetId: c.websiteAssetId, keyPrefix: c.key.prefix }),
        verify_command: buildVerifyCommand({ ingestUrl: c.ingestUrl, domain: c.domain, assetId: c.websiteAssetId, keyPrefix: c.key.prefix }),
      }
    : null;

  return jsonResponse({
    ok: status !== 'failed',
    tenant_id: tenantId,
    trigger,
    status,
    steps,
    installer,
    // Klartext genau einmal — nur im Lauf, der den Key erzeugt hat.
    ingest_token: c.rawToken,
  }, status === 'failed' ? 500 : 200);
});
