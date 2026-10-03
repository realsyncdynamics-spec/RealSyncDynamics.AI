// siteos — AI Rebuild Workflow.
//
//   POST /functions/v1/siteos/rebuild-start      URL → Import + Bewertung + Richtungen
//   POST /functions/v1/siteos/rebuild-get        Zustand lesen
//   POST /functions/v1/siteos/rebuild-refine     Klartext / Editor-Operation / Richtung wählen
//   POST /functions/v1/siteos/rebuild-readiness  Publish-Prüfung inkl. Gate
//   POST /functions/v1/siteos/rebuild-approve    ausdrückliches GO → Blueprint persistieren
//
// ## Was hier gilt
//
//   • Der Mandant kommt aus der geprüften Mitgliedschaft (`requireAuthAndTenant`),
//     nie aus dem Body allein, nie aus URL oder localStorage.
//   • Der Kern rechnet, der Handler holt und schreibt. Kein Feld des
//     Zustands entsteht hier — außer `approved_by`, und das aus der Sitzung.
//   • Jede Revision braucht `base_sha256`. Ein veralteter Stand ergibt 409,
//     nicht eine stille Überschreibung.
//   • Die Freigabe ist an den Artefakt-Hash gebunden (G6) und den Rollen
//     owner/admin/dpo vorbehalten — wie `publish-approve`.

import { requireAuthAndTenant } from '../../_shared/auth.ts';
import { audit } from '../../_shared/auditLog.ts';
import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';
import { appendCustodyEvent } from '../../_shared/provenanceCore.ts';
import { fetchSource, parseSourceUrl, SourceFetchError } from '../fetch-source.ts';
import { persistBlueprintVersion } from '../persist.ts';
import { consultPolicyEngine } from './publish-gate.ts';
import {
  analyzeBlueprint,
  artifactHash,
  canonicalHash,
  computeScores,
  createWorkflow,
  directionToBlueprint,
  editSelected,
  evaluatePublishGate,
  evaluateReadiness,
  proposeAutomations,
  recordApproval,
  reviseSelected,
  runDiscoverAssessRebuild,
  selectDirection,
  selectedDirection,
  summarizeGovernance,
  type ApprovalState,
  type BackendComparison,
  type ComponentOperation,
  type RebuildDirection,
  type RebuildDirectionKey,
  type RebuildWorkflowState,
  type SiteImport,
} from '../../../../packages/siteos-core/src/index.ts';

const MAX_INSTRUCTION_LENGTH = 400;
const MAX_OPERATIONS = 50;
const MAX_REVISIONS = 120;
const APPROVER_ROLES = ['owner', 'admin', 'dpo'];
const DIRECTION_KEYS = new Set<RebuildDirectionKey>(['clean-enterprise', 'conversion-focus', 'local-trust', 'premium-advisory', 'governance-first']);
const OPERATION_KINDS = new Set(['set-text', 'set-item', 'move', 'set-visible', 'set-variant', 'set-cta', 'set-media', 'set-form-target']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

interface Context {
  admin: AdminClient;
  tenantId: string;
  userId: string;
  userEmail: string | null;
  body: Record<string, unknown>;
}

interface RebuildRow {
  id: string;
  tenant_id: string;
  source_url: string;
  stage: string;
  state: RebuildWorkflowState;
  state_sha256: string;
  version: number;
  approved_at: string | null;
  approved_by: string | null;
  approval_reason: string | null;
  artifact_sha256: string | null;
  blueprint_id: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Vorprüfung
// ─────────────────────────────────────────────────────────────────────

async function prepare(req: Request, roles?: string[]): Promise<Context | Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const auth = await requireAuthAndTenant(req, typeof body.tenant_id === 'string' ? body.tenant_id : null, roles);
  if (auth instanceof Response) return auth;
  return { admin: auth.admin, tenantId: auth.tenantId, userId: auth.user.id, userEmail: auth.user.email ?? null, body };
}

async function loadRebuild(ctx: Context): Promise<RebuildRow | Response> {
  const id = String(ctx.body.rebuild_id ?? '').trim();
  if (!id) return jsonError(400, 'BAD_REQUEST', 'rebuild_id required');
  const { data, error } = await ctx.admin
    .from('siteos_rebuilds')
    .select('id, tenant_id, source_url, stage, state, state_sha256, version, approved_at, approved_by, approval_reason, artifact_sha256, blueprint_id')
    .eq('id', id).eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  if (error) return jsonError(500, 'INTERNAL', 'could not load rebuild');
  if (!data) return jsonError(404, 'NOT_FOUND', 'rebuild not found for this tenant');
  return data as RebuildRow;
}

async function saveState(ctx: Context, row: RebuildRow, state: RebuildWorkflowState, extra: Record<string, unknown> = {}): Promise<{ row: RebuildRow; stateSha256: string } | Response> {
  const stateSha256 = await canonicalHash(state);
  const { data, error } = await ctx.admin
    .from('siteos_rebuilds')
    .update({ state, state_sha256: stateSha256, stage: state.stage, version: row.version + 1, updated_at: new Date().toISOString(), ...extra })
    .eq('id', row.id).eq('tenant_id', ctx.tenantId)
    .select('id, tenant_id, source_url, stage, state, state_sha256, version, approved_at, approved_by, approval_reason, artifact_sha256, blueprint_id')
    .maybeSingle();
  if (error || !data) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_rebuild_save_failed', error: error?.message }));
    return jsonError(500, 'INTERNAL', 'could not persist rebuild state');
  }
  return { row: data as RebuildRow, stateSha256 };
}

function describe(row: RebuildRow): Record<string, unknown> {
  return {
    ok: true,
    rebuild_id: row.id,
    version: row.version,
    state_sha256: row.state_sha256,
    stage: row.stage,
    state: row.state,
    approved_at: row.approved_at,
    blueprint_id: row.blueprint_id,
  };
}

// ─────────────────────────────────────────────────────────────────────
// rebuild-start
// ─────────────────────────────────────────────────────────────────────

export async function handleStart(req: Request): Promise<Response> {
  const ctx = await prepare(req);
  if (ctx instanceof Response) return ctx;

  let sourceUrl: URL;
  try { sourceUrl = parseSourceUrl(String(ctx.body.url ?? '')); }
  catch (e) { return jsonError(400, 'BAD_REQUEST', e instanceof Error ? e.message : 'invalid url'); }

  let fetched;
  try { fetched = await fetchSource(sourceUrl); }
  catch (e) {
    const err = e instanceof SourceFetchError ? e : new SourceFetchError('UNREACHABLE', 'website could not be read');
    return jsonError(err.code === 'BAD_REQUEST' ? 400 : 502, err.code, err.message);
  }

  let state: RebuildWorkflowState;
  try {
    state = await runDiscoverAssessRebuild(createWorkflow(fetched.sourceUrl), fetched);
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_rebuild_core_failed', error: (e as Error)?.message }));
    return jsonError(500, 'INTERNAL', 'rebuild analysis failed');
  }

  const stateSha256 = await canonicalHash(state);
  const { data, error } = await ctx.admin
    .from('siteos_rebuilds')
    .insert({
      tenant_id: ctx.tenantId,
      created_by: ctx.userId,
      source_url: fetched.sourceUrl,
      source_domain: sourceUrl.hostname.toLowerCase(),
      stage: state.stage,
      state,
      state_sha256: stateSha256,
      version: 1,
    })
    .select('id, tenant_id, source_url, stage, state, state_sha256, version, approved_at, approved_by, approval_reason, artifact_sha256, blueprint_id')
    .maybeSingle();
  if (error || !data) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_rebuild_insert_failed', error: error?.message }));
    return jsonError(500, 'INTERNAL', 'could not persist rebuild');
  }
  const row = data as RebuildRow;

  await audit(ctx.admin, {
    tenant_id: ctx.tenantId, actor_user_id: ctx.userId, actor_email: ctx.userEmail,
    action: 'siteos.rebuild.start', target_type: 'siteos_rebuild', target_id: row.id,
    payload: { source_url: fetched.sourceUrl, import_sha256: state.import?.htmlSha256 ?? null, evidence_count: state.import?.evidence.length ?? 0, directions: state.directions.map((d) => d.key), overall: state.assessment?.overall ?? null },
  });

  return jsonResponse(describe(row));
}

// ─────────────────────────────────────────────────────────────────────
// rebuild-get
// ─────────────────────────────────────────────────────────────────────

export async function handleGet(req: Request): Promise<Response> {
  const ctx = await prepare(req);
  if (ctx instanceof Response) return ctx;
  const row = await loadRebuild(ctx);
  if (row instanceof Response) return row;
  return jsonResponse(describe(row));
}

// ─────────────────────────────────────────────────────────────────────
// rebuild-refine
// ─────────────────────────────────────────────────────────────────────

export async function handleRefine(req: Request): Promise<Response> {
  const ctx = await prepare(req);
  if (ctx instanceof Response) return ctx;
  const row = await loadRebuild(ctx);
  if (row instanceof Response) return row;

  const base = String(ctx.body.base_sha256 ?? '').trim();
  if (!base) return jsonError(400, 'BAD_REQUEST', 'base_sha256 required');
  if (base !== row.state_sha256) return jsonError(409, 'CONFLICT', 'rebuild state changed — reload and retry');
  if (row.approved_at) return jsonError(409, 'CONFLICT', 'rebuild already approved — edit the published blueprint in the workspace');
  if (row.state.revisions.length >= MAX_REVISIONS) return jsonError(429, 'LIMIT', `rebuild reached ${MAX_REVISIONS} revisions`);

  const now = new Date().toISOString();
  let state = row.state;
  let record: unknown = null;

  const select = typeof ctx.body.select === 'string' ? (ctx.body.select as RebuildDirectionKey) : null;
  if (select !== null) {
    if (!DIRECTION_KEYS.has(select) || !state.directions.some((d) => d.key === select)) return jsonError(400, 'BAD_REQUEST', 'unknown direction');
    state = selectDirection(state, select);
  }

  const instruction = typeof ctx.body.instruction === 'string' ? ctx.body.instruction.trim().slice(0, MAX_INSTRUCTION_LENGTH) : '';
  const operations = Array.isArray(ctx.body.operations) ? sanitizeOperations(ctx.body.operations) : null;
  if (operations instanceof Response) return operations;

  if (instruction) {
    const result = reviseSelected(state, instruction, now);
    state = result.state;
    record = result.record;
  } else if (operations && operations.length > 0) {
    const result = editSelected(state, operations, now);
    state = result.state;
    record = result.record;
  } else if (select === null) {
    return jsonError(400, 'BAD_REQUEST', 'instruction, operations or select required');
  }

  const saved = await saveState(ctx, row, state);
  if (saved instanceof Response) return saved;
  return jsonResponse({ ...describe(saved.row), record });
}

function sanitizeOperations(raw: unknown[]): ComponentOperation[] | Response {
  if (raw.length > MAX_OPERATIONS) return jsonError(400, 'BAD_REQUEST', `at most ${MAX_OPERATIONS} operations`);
  const out: ComponentOperation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return jsonError(400, 'BAD_REQUEST', 'operation must be an object');
    const op = item as Record<string, unknown>;
    if (typeof op.op !== 'string' || !OPERATION_KINDS.has(op.op)) return jsonError(400, 'BAD_REQUEST', `unknown operation ${String(op.op)}`);
    if (typeof op.id !== 'string' || op.id.length === 0 || op.id.length > 64) return jsonError(400, 'BAD_REQUEST', 'operation id required');
    // Der Kern prüft Felder, Varianten und Werte gegen den Katalog und
    // meldet Ablehnungen im Ergebnis; hier reicht die Formprüfung.
    out.push(op as unknown as ComponentOperation);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// rebuild-readiness
// ─────────────────────────────────────────────────────────────────────

export async function handleReadiness(req: Request): Promise<Response> {
  const ctx = await prepare(req);
  if (ctx instanceof Response) return ctx;
  const row = await loadRebuild(ctx);
  if (row instanceof Response) return row;

  const direction = selectedDirection(row.state);
  if (!direction || !row.state.import) return jsonError(409, 'CONFLICT', 'no direction selected');

  const now = new Date().toISOString();
  const gate = await evaluateGate(ctx, row, direction, row.state.import, now);
  const state = await evaluateReadiness(row.state, now, gate.evaluation);

  const saved = await saveState(ctx, row, state);
  if (saved instanceof Response) return saved;
  return jsonResponse({ ...describe(saved.row), gate: gate.evaluation });
}

/**
 * Publish Gate über den aus der Richtung abgeleiteten Blueprint — dieselbe
 * Auswertung wie `publish-gate`, mit einem Unterschied: Der Backend-Vergleich
 * gegen die Ausgangsseite wird hier **durchgeführt**, weil der Import sie
 * kennt. Verlorene Formularziele und Kaufpfade werden benannt, nicht als
 * `unknown` verschwiegen.
 */
async function evaluateGate(ctx: Context, row: RebuildRow, direction: RebuildDirection, imp: SiteImport, now: string) {
  const blueprint = directionToBlueprint(direction, imp, { createdAt: now });
  const findings = analyzeBlueprint(blueprint);
  const scores = computeScores(findings);
  const artifactSha256 = await artifactHash(row.state, direction);

  const { data: scan } = await ctx.admin
    .from('siteos_runtime_scans')
    .insert({
      tenant_id: ctx.tenantId, blueprint_id: null, url: row.source_url,
      trigger: 'manual', scope: 'blueprint', status: 'completed',
      findings, finding_count: findings.length, severity_max: scores.severityMax,
      observed_at: now, correlation_id: row.id,
    })
    .select('id').maybeSingle();

  let custodyLinked = false;
  try {
    await appendCustodyEvent(ctx.admin, {
      tenantId: ctx.tenantId,
      assetRef: `siteos:rebuild:${ctx.tenantId}:${row.id}`,
      contentSha256: artifactSha256,
      action: 'updated',
      issuer: `tenant:${ctx.tenantId}`,
      timestamp: now,
    });
    custodyLinked = true;
  } catch (e) {
    console.error(JSON.stringify({ level: 'warn', scope: 'siteos_rebuild_custody_failed', error: (e as Error)?.message }));
  }

  const approval: ApprovalState = row.state.approval.approved
    ? { grantedForArtifactSha256: row.state.approval.artifactSha256, grantedBy: row.state.approval.approvedBy, reason: row.approval_reason }
    : { grantedForArtifactSha256: null, grantedBy: null, reason: null };

  const policyEngine = await consultPolicyEngine({ admin: ctx.admin, tenantId: ctx.tenantId, userId: ctx.userId }, { id: row.id, slug: blueprint.slug, blueprint }, artifactSha256, findings.length);

  const evaluation = evaluatePublishGate({
    policyEngine,
    blueprint,
    findings,
    artifactSha256,
    evidence: { snapshotWritten: scan !== null, custodyLinked },
    backend: { kind: 'transformation', comparison: compareBackend(imp, direction) },
    approval,
    evaluationId: crypto.randomUUID(),
    evaluatedAt: now,
  });
  return { evaluation, blueprint, findings, scores, artifactSha256 };
}

function compareBackend(imp: SiteImport, direction: RebuildDirection): BackendComparison {
  const kept = new Set<string>([direction.primaryCta.href, direction.secondaryCta?.href ?? '', direction.leadFlow.formTarget ?? '']);
  for (const c of direction.components) {
    if (!c.visible) continue;
    if (c.cta) kept.add(c.cta.href);
    if (c.formTarget) kept.add(c.formTarget);
  }
  const sourceTargets = imp.forms
    .filter((f) => ['contact', 'quote', 'booking', 'newsletter'].includes(f.purpose))
    .map((f) => f.action)
    .filter((a): a is string => a !== null);
  const paymentPaths = imp.ctas
    .filter((c) => c.href && /shop|cart|checkout|kaufen|bestellen|warenkorb|bezahlen|payment/i.test(`${c.label} ${c.href}`))
    .map((c) => c.href as string);
  const bookingPaths = imp.ctas
    .filter((c) => c.href && /termin|booking|buchen|reservier/i.test(`${c.label} ${c.href}`))
    .map((c) => c.href as string);
  return {
    lostFormTargets: [...new Set(sourceTargets.filter((t) => !kept.has(t)))],
    lostPaymentPaths: [...new Set(paymentPaths.filter((p) => !kept.has(p)))],
    lostBookingPaths: [...new Set(bookingPaths.filter((p) => !kept.has(p)))],
    lostApiEndpoints: [],
    lostConsentCategories: [],
  };
}

// ─────────────────────────────────────────────────────────────────────
// rebuild-approve — das GO
// ─────────────────────────────────────────────────────────────────────

export async function handleApprove(req: Request): Promise<Response> {
  const ctx = await prepare(req, APPROVER_ROLES);
  if (ctx instanceof Response) return ctx;
  const row = await loadRebuild(ctx);
  if (row instanceof Response) return row;

  const artifactSha256 = String(ctx.body.artifact_sha256 ?? '').trim();
  const reason = String(ctx.body.reason ?? '').trim().slice(0, 500);
  if (!/^[0-9a-f]{64}$/.test(artifactSha256)) return jsonError(400, 'BAD_REQUEST', 'artifact_sha256 required');
  if (!reason) return jsonError(400, 'BAD_REQUEST', 'reason required — a GO without reason is not attributable');
  if (row.approved_at) return jsonError(409, 'CONFLICT', 'rebuild already approved');

  const direction = selectedDirection(row.state);
  if (!direction || !row.state.import) return jsonError(409, 'CONFLICT', 'no direction selected');

  const now = new Date().toISOString();

  // Die Reife wird neu bewertet, nicht aus dem Speicher gelesen: Zwischen
  // Prüfung und GO kann sich nichts geändert haben (Hash-Bindung), aber
  // die Richtlinienlage kann es — und die gilt zum Zeitpunkt des GO.
  const gate = await evaluateGate(ctx, row, direction, row.state.import, now);
  if (gate.artifactSha256 !== artifactSha256) return jsonError(409, 'CONFLICT', 'artifact hash does not match the current state — re-run readiness');
  const reassessed = await evaluateReadiness(row.state, now, gate.evaluation);
  if (gate.evaluation.status === 'blocked') {
    return jsonError(422, 'BLOCKED', `publish gate blocks: ${gate.evaluation.blockers.join(' · ')}`);
  }

  const approved = recordApproval(reassessed, ctx.userId, artifactSha256, now);
  if (approved.refused) return jsonError(422, 'NOT_READY', approved.refused);

  // Erst jetzt entsteht der Blueprint im Mandanten — mit Prüfpfad, Kette
  // und Agentenaufgaben wie bei jedem anderen Bau.
  const blueprintSha256 = await canonicalHash(gate.blueprint);
  const persisted = await persistBlueprintVersion({
    admin: ctx.admin,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    blueprint: gate.blueprint,
    blueprintSha256,
    findings: gate.findings,
    scores: gate.scores,
    projectId: null,
    originSource: 'import',
    originModel: null,
    nowIso: now,
    workflow: 'website-transformation',
    auditSource: 'siteos.rebuild',
    auditAction: 'siteos.rebuild.approve',
    auditPayload: { rebuild_id: row.id, artifact_sha256: artifactSha256, direction: direction.key, reason },
  });
  if ('error' in persisted) return jsonError(500, 'INTERNAL', persisted.error);

  let blueprintId: string | null = null;
  if (persisted.unchanged) {
    const { data } = await ctx.admin.from('siteos_blueprints').select('id').eq('tenant_id', ctx.tenantId).eq('slug', gate.blueprint.slug).eq('version', persisted.version).maybeSingle();
    blueprintId = (data as { id: string } | null)?.id ?? null;
  } else {
    blueprintId = persisted.blueprintId;
  }

  let state = proposeAutomations(approved.state);
  state = await summarizeGovernance(state);

  const saved = await saveState(ctx, row, state, {
    approved_at: now,
    approved_by: ctx.userId,
    approval_reason: reason,
    artifact_sha256: artifactSha256,
    blueprint_id: blueprintId,
  });
  if (saved instanceof Response) return saved;

  await audit(ctx.admin, {
    tenant_id: ctx.tenantId, actor_user_id: ctx.userId, actor_email: ctx.userEmail,
    action: 'siteos.rebuild.go', target_type: 'siteos_rebuild', target_id: row.id,
    payload: { artifact_sha256: artifactSha256, blueprint_id: blueprintId, slug: gate.blueprint.slug, reason, gate_status: gate.evaluation.status },
  });

  return jsonResponse({ ...describe(saved.row), gate: gate.evaluation, blueprint_id: blueprintId, slug: gate.blueprint.slug, blueprint_version: persisted.version });
}
