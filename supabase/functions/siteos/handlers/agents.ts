// siteos-agents — asynchrone Ausführung der SiteOS-Agenten.
//
// POST /functions/v1/siteos/agents
// Auth: Authorization: Bearer <user JWT>
// Body:
//   { op: 'list',    tenant_id, status? }
//   { op: 'approve', tenant_id, run_id }        // gibt einen wartenden Lauf frei
//   { op: 'run',     tenant_id, run_id? }       // arbeitet einen bzw. den
//                                               // nächsten Lauf ab
//
// Die Agenten laufen asynchron: `siteos/builder` und `siteos/runtime-scan`
// reihen nur ein, gearbeitet wird hier — angestoßen von der SPA oder vom
// Cron der Governance-Runtime.
//
// Blueprint-ändernde Agenten schreiben nie in die bestehende Version. Sie
// erzeugen eine neue, verkettete Version mit eigenem Hash; die alte bleibt
// mit ihrem Nachweis unangetastet.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../../_shared/gateway.ts';
import { audit } from '../../_shared/auditLog.ts';
import { appendCustodyEvent } from '../../_shared/provenanceCore.ts';
import {
  AGENTS,
  analyzeBlueprint,
  applyRemediations,
  canonicalHash,
  computeScores,
  type AgentKey,
  type RuntimeFinding,
  type SiteBlueprint,
} from '../../../../packages/siteos-core/src/index.ts';

interface AgentRunRow {
  id: string;
  tenant_id: string;
  blueprint_id: string | null;
  scan_id: string | null;
  agent: AgentKey;
  status: string;
  finding_codes: string[];
  requires_approval: boolean;
}

export async function handle(req: Request): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const op = String(body.op ?? '');
  const tenantId = String(body.tenant_id ?? '').trim();
  if (!['list', 'approve', 'run'].includes(op)) return jsonError(400, 'BAD_REQUEST', 'op must be list|approve|run');
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: member } = await admin
    .from('memberships').select('user_id')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    if (op === 'list') {
      let query = admin
        .from('siteos_agent_runs')
        .select('id, agent, status, finding_codes, severity_max, requires_approval, blueprint_id, scan_id, queued_at, completed_at, error_message')
        .eq('tenant_id', tenantId)
        .order('queued_at', { ascending: false })
        .limit(100);

      if (typeof body.status === 'string' && body.status.trim() !== '') {
        query = query.eq('status', body.status.trim());
      }

      const { data, error } = await query;
      if (error) return jsonError(500, 'INTERNAL', 'could not list agent runs');
      return jsonResponse({ ok: true, runs: data ?? [], registry: AGENTS });
    }

    if (op === 'approve') {
      const runId = String(body.run_id ?? '').trim();
      if (!runId) return jsonError(400, 'BAD_REQUEST', 'run_id required');

      // Die Freigabe gilt nur für genau den wartenden Lauf; ein bereits
      // laufender oder abgeschlossener Lauf lässt sich nicht nachträglich
      // freigeben.
      const { data: updated, error } = await admin
        .from('siteos_agent_runs')
        .update({ status: 'queued', approval_id: userId })
        .eq('tenant_id', tenantId).eq('id', runId).eq('status', 'awaiting_approval')
        .select('id, agent').maybeSingle();

      if (error) return jsonError(500, 'INTERNAL', 'could not approve run');
      if (!updated) return jsonError(409, 'CONFLICT', 'run is not awaiting approval');

      await audit(admin, {
        tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
        action: 'siteos.agent.approve', target_type: 'siteos_agent_run', target_id: runId,
        payload: { agent: updated.agent },
      });

      return jsonResponse({ ok: true, run_id: runId, status: 'queued' });
    }

    // ── op === 'run' ───────────────────────────────────────────────────
    const run = await claimRun(admin, tenantId, typeof body.run_id === 'string' ? body.run_id.trim() : null);
    if (run === null) return jsonResponse({ ok: true, ran: false, reason: 'no queued run available' });

    const outcome = await executeRun(admin, run, userId, userEmail);
    return jsonResponse({ ok: true, ran: true, ...outcome });
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error', scope: 'siteos_agents_failed', op,
      error: (e as Error)?.message ?? String(e),
    }));
    return jsonError(500, 'INTERNAL', 'siteos-agents failed');
  }
}

type Admin = ReturnType<typeof createClient>;

/**
 * Nimmt einen wartenden Lauf an. Der Übergang queued → running läuft als
 * bedingtes UPDATE, damit zwei gleichzeitige Aufrufe (SPA-Klick und Cron)
 * nicht denselben Lauf doppelt abarbeiten: nur einer trifft die Zeile im
 * Zustand `queued` an.
 */
async function claimRun(admin: Admin, tenantId: string, runId: string | null): Promise<AgentRunRow | null> {
  let selector = admin
    .from('siteos_agent_runs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'queued');

  if (runId !== null) selector = selector.eq('id', runId);

  const { data: candidate } = await selector
    .order('queued_at', { ascending: true }).limit(1)
    .maybeSingle<{ id: string }>();
  if (!candidate) return null;

  const { data: claimed } = await admin
    .from('siteos_agent_runs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', candidate.id).eq('status', 'queued')
    .select('id, tenant_id, blueprint_id, scan_id, agent, status, finding_codes, requires_approval')
    .maybeSingle<AgentRunRow>();

  return claimed ?? null;
}

interface RunOutcome {
  run_id: string;
  agent: AgentKey;
  status: string;
  applied?: string[];
  skipped?: { code: string; reason: string }[];
  produced_blueprint_id?: string | null;
}

async function executeRun(admin: Admin, run: AgentRunRow, userId: string, userEmail: string | null): Promise<RunOutcome> {
  const definition = AGENTS[run.agent];
  const completedAt = () => new Date().toISOString();

  // Agenten ohne Blueprint-Mandat (Sicherheit, Performance, Monitoring)
  // beheben nichts an der Struktur — ihre Befunde betreffen Auslieferung
  // und Infrastruktur. Der Lauf hält das Ergebnis als Arbeitsauftrag fest.
  if (!definition.canMutateBlueprint || run.blueprint_id === null) {
    const result = {
      handled: false,
      reason: run.blueprint_id === null
        ? 'Lauf ohne Blueprint-Bezug'
        : 'Agent verändert keine Blueprints; Befunde betreffen Auslieferung/Betrieb.',
      finding_codes: run.finding_codes,
    };
    await admin.from('siteos_agent_runs')
      .update({ status: 'completed', completed_at: completedAt(), result })
      .eq('id', run.id);
    return { run_id: run.id, agent: run.agent, status: 'completed' };
  }

  const { data: row } = await admin
    .from('siteos_blueprints')
    .select('id, slug, blueprint, content_sha256, version, project_id')
    .eq('tenant_id', run.tenant_id).eq('id', run.blueprint_id)
    .maybeSingle<{ id: string; slug: string; blueprint: SiteBlueprint; content_sha256: string; version: number; project_id: string | null }>();

  if (!row) {
    await admin.from('siteos_agent_runs')
      .update({ status: 'failed', completed_at: completedAt(), error_message: 'blueprint not found' })
      .eq('id', run.id);
    return { run_id: run.id, agent: run.agent, status: 'failed' };
  }

  // Nur die Befunde in der Zuständigkeit dieses Agenten werden angefasst.
  // Frisch analysiert statt aus dem Scan übernommen: zwischen Einreihung
  // und Ausführung kann eine andere Version entstanden sein.
  const current = analyzeBlueprint(row.blueprint);
  const inScope: RuntimeFinding[] = current.filter(
    (f) => definition.dimensions.includes(f.dimension) && run.finding_codes.includes(f.code),
  );

  const remediation = applyRemediations(row.blueprint, inScope);

  if (!remediation.changed) {
    await admin.from('siteos_agent_runs').update({
      status: 'completed', completed_at: completedAt(),
      result: { handled: false, applied: [], skipped: remediation.skipped },
    }).eq('id', run.id);
    return { run_id: run.id, agent: run.agent, status: 'completed', applied: [], skipped: remediation.skipped };
  }

  const nextSha = await canonicalHash(remediation.blueprint);
  const nowIso = completedAt();

  // Neue Version anlegen — die Vorversion bleibt mitsamt Nachweis bestehen.
  const { data: latest } = await admin
    .from('siteos_blueprints').select('version, content_sha256')
    .eq('tenant_id', run.tenant_id).eq('slug', row.slug)
    .order('version', { ascending: false }).limit(1)
    .maybeSingle<{ version: number; content_sha256: string }>();

  const nextVersion = (latest?.version ?? row.version) + 1;

  const { data: created, error: createErr } = await admin.from('siteos_blueprints').insert({
    tenant_id: run.tenant_id,
    project_id: row.project_id,
    slug: row.slug,
    name: remediation.blueprint.name,
    industry: remediation.blueprint.industry,
    version: nextVersion,
    blueprint: remediation.blueprint,
    content_sha256: nextSha,
    prev_hash: latest?.content_sha256 ?? row.content_sha256,
    origin_source: remediation.blueprint.origin.source,
    origin_model: remediation.blueprint.origin.model,
    prompt_sha256: remediation.blueprint.origin.promptSha256,
    status: 'draft',
    created_by: userId,
  }).select('id').single();

  if (createErr || !created) {
    await admin.from('siteos_agent_runs').update({
      status: 'failed', completed_at: nowIso,
      error_message: `could not persist remediated blueprint: ${createErr?.message ?? 'unknown'}`,
    }).eq('id', run.id);
    return { run_id: run.id, agent: run.agent, status: 'failed' };
  }

  // Nachweis der Agentenänderung in der Herkunftskette.
  try {
    await appendCustodyEvent(admin as never, {
      tenantId: run.tenant_id,
      assetRef: `siteos:blueprint:${run.tenant_id}:${row.slug}`,
      contentSha256: nextSha,
      action: 'updated',
      issuer: `agent:${run.agent}`,
      timestamp: nowIso,
    });
  } catch (provErr) {
    console.error(JSON.stringify({
      level: 'warn', scope: 'siteos_agent_provenance_failed', run_id: run.id,
      error: (provErr as Error)?.message ?? String(provErr),
    }));
  }

  // Nachlauf: Bewertung der neuen Version festhalten, damit der Fortschritt
  // im Monitoring sichtbar wird.
  const nextFindings = analyzeBlueprint(remediation.blueprint);
  const nextScores = computeScores(nextFindings);
  const { data: scan } = await admin.from('siteos_runtime_scans').insert({
    tenant_id: run.tenant_id, blueprint_id: created.id,
    trigger: 'agent', scope: 'blueprint', status: 'completed',
    findings: nextFindings, finding_count: nextFindings.length,
    severity_max: nextScores.severityMax, observed_at: nowIso,
  }).select('id').single();

  if (scan) {
    await admin.from('siteos_scores').insert({
      tenant_id: run.tenant_id, scan_id: scan.id, blueprint_id: created.id,
      health: nextScores.health, risk: nextScores.risk, compliance: nextScores.compliance,
      performance: nextScores.performance, ai_risk: nextScores.aiRisk, dimensions: nextScores.dimensions,
    });
  }

  await admin.from('siteos_agent_runs').update({
    status: 'completed',
    completed_at: nowIso,
    produced_blueprint_id: created.id,
    result: {
      handled: true,
      applied: remediation.applied,
      skipped: remediation.skipped,
      version: nextVersion,
      content_sha256: nextSha,
      health_after: nextScores.health,
    },
  }).eq('id', run.id);

  await audit(admin as never, {
    tenant_id: run.tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'siteos.agent.remediate', target_type: 'siteos_blueprint', target_id: created.id,
    payload: {
      agent: run.agent, run_id: run.id, slug: row.slug, version: nextVersion,
      applied: remediation.applied, skipped: remediation.skipped.map((s) => s.code),
      content_sha256: nextSha,
    },
  });

  return {
    run_id: run.id,
    agent: run.agent,
    status: 'completed',
    applied: remediation.applied,
    skipped: remediation.skipped,
    produced_blueprint_id: created.id,
  };
}
