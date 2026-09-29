// siteos — Rebuild-Workflow am Edge.
//
//   POST /siteos/rebuild-analyze  { tenant_id, url }
//        DISCOVER + ASSESS + REBUILD: Ausgangsseite lesen, belegen, bewerten,
//        zwei bis drei Richtungen ableiten. Schreibt einen Lauf und einen
//        Evidence-Eintrag — beides oder nichts.
//   POST /siteos/rebuild-select   { tenant_id, run_id, direction }
//        Richtung serverseitig aus dem gespeicherten Snapshot neu ableiten
//        und als Blueprint-Version (Herkunft `import`) in die Kette hängen.
//   POST /siteos/rebuild-refine   { tenant_id, slug, base_sha256, intents?, instruction? }
//        REFINE: benannte Regeln („seriöser", „CTA stärker" …) und Freitext.
//   POST /siteos/rebuild-status   { tenant_id, slug, base_url? }
//        PUBLISH / AUTOMATE: Backend-Vergleich, Checkliste, jüngste
//        Freigabebewertung, nächste Schritte mit echtem Verbindungsstand.
//   POST /siteos/rebuild-waive    { tenant_id, run_id, key, reason, revoke? }
//        Bewusster Verzicht auf eine Backend-Funktion — Person und Grund.
//        Nur auf dem Lauf, an den die Site gebunden ist (`origin.rebuild`).
//
// ## Autorität
//
// Mandant und Rolle kommen aus `requireAuthAndTenant` (Mitgliedschaft in der
// Datenbank); `tenant_id` im Body ist nur die Behauptung, die geprüft wird.
// Alles Weitere — Snapshot, Richtung, Vergleich, Verbindungsstand — liest
// oder berechnet der Server selbst. Eine Adresse aus der Anfrage ist nie
// Autorität für Mandant oder Richtlinie.
//
// ## Reihenfolge
//
// Prüfen → lesen → ableiten → Nachweis schreiben → speichern. Wer zuerst
// speichert und dann belegt, hat im Fehlerfall einen Lauf ohne Beleg.

import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';
import { requireAuthAndTenant } from '../../_shared/auth.ts';
import { EntitlementError, gateFeature } from '../../_shared/entitlements.ts';
import { audit } from '../../_shared/auditLog.ts';
import { persistBlueprintVersion } from '../persist.ts';
import { gateSiteCreate } from '../site-entitlements.ts';
import { appendSiteosEvidence } from '../evidence.ts';
import { crawlSite } from '../rebuild-fetch.ts';
import { artifactOptionsFor, baseUrlFor, rebuildBinding, resolveRebuildContext, sanitizeWaivers } from '../rebuild-context.ts';
import {
  REBUILD_ENGINE_VERSION,
  analyzeBlueprint,
  assessSnapshot,
  backendDigest,
  buildDeploymentArtifact,
  buildDirection,
  buildDirections,
  buildPublishChecklist,
  buildSnapshot,
  canonicalHash,
  compareBackend,
  computeScores,
  derivePositioning,
  isPublicHttpUrl,
  isRevisionIntentKey,
  normalizeInputUrl,
  planNextSteps,
  redirectsForBlueprint,
  reviseBlueprint,
  sealSnapshot,
  type BackendWaiver,
  type ConnectorState,
  type DirectionKey,
  type SiteBlueprint,
  type SourceSnapshot,
} from '../../../../packages/siteos-core/src/index.ts';

// deno-lint-ignore no-explicit-any
type AdminClient = any;

/** Lesen und ableiten: auch der Datenschutzbeauftragte darf eine Analyse anstoßen. */
const ANALYZE_ROLES = ['owner', 'admin', 'editor', 'dpo'];
/** Eine Version erzeugen: Redaktion. */
const WRITE_ROLES = ['owner', 'admin', 'editor'];
/** Auf eine Backend-Funktion verzichten: eine Entscheidung wie eine Freigabe (G4). */
const WAIVE_ROLES = ['owner', 'admin', 'dpo'];

/**
 * Kostenbremse je Mandant und Stunde. Gezählt werden **Versuche** (jeder
 * Abruf wird vorher protokolliert), nicht nur gespeicherte Läufe — sonst
 * wären fehlschlagende Abrufe beliebig oft wiederholbar.
 */
const RUNS_PER_HOUR = 12;
const ATTEMPT_ACTION = 'siteos.rebuild.analyze.attempt';
const MAX_INSTRUCTION = 600;
const MAX_REASON = 1000;
const DIRECTIONS: ReadonlySet<string> = new Set(['clean-enterprise', 'conversion-focus', 'local-trust', 'premium-advisory']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;

// ─────────────────────────────────────────────────────────────────────
// rebuild-analyze
// ─────────────────────────────────────────────────────────────────────

export async function handleAnalyze(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();
  const body = await readBody(req);
  if (body instanceof Response) return body;

  const auth = await requireAuthAndTenant(req, stringOrNull(body.tenant_id), ANALYZE_ROLES);
  if (auth instanceof Response) return auth;
  const { admin, tenantId, user } = auth;

  const gated = await gateBuilder(admin, tenantId);
  if (gated) return gated;

  const start = normalizeInputUrl(String(body.url ?? ''));
  if (!start) return jsonError(400, 'BAD_REQUEST', 'Bitte eine gültige Website-Adresse angeben (z. B. ihre-firma.de).');
  const check = isPublicHttpUrl(start);
  if (!check.ok) return jsonError(400, 'BAD_REQUEST', `Diese Adresse wird nicht abgerufen: ${check.reason}.`);

  // Kostenbremse je Mandant: gezählt werden die protokollierten Versuche
  // der letzten Stunde — auch fehlgeschlagene, nicht umgehbar durch neue
  // Sitzungen. Ist der Zähler nicht lesbar, wird nicht abgerufen.
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error: countError } = await admin
    .from('governance_admin_log').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).eq('action', ATTEMPT_ACTION).gte('created_at', since);
  if (countError) return jsonError(503, 'UNAVAILABLE', 'Die Analyse ist gerade nicht möglich. Bitte später erneut versuchen.');
  if ((count ?? 0) >= RUNS_PER_HOUR) {
    return jsonError(429, 'RATE_LIMITED', `Höchstens ${RUNS_PER_HOUR} Analysen pro Stunde und Workspace. Bitte später erneut versuchen.`);
  }

  // Jeder Abruf fremder Adressen im Namen des Mandanten wird vorher
  // protokolliert — auch einer, der danach scheitert. Ohne Protokoll kein
  // Abruf (fail-closed).
  const attempt = await audit(admin, {
    tenant_id: tenantId, actor_user_id: user.id, actor_email: user.email ?? null,
    action: ATTEMPT_ACTION, target_type: 'url', target_id: start.host,
    payload: { url: start.toString() },
  });
  if (!attempt.ok) return jsonError(503, 'UNAVAILABLE', 'Die Analyse ist gerade nicht möglich. Bitte später erneut versuchen.');

  const nowIso = new Date().toISOString();
  let crawled;
  try {
    crawled = await crawlSite(start, nowIso);
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_rebuild_crawl_failed', error: (e as Error)?.message ?? String(e) }));
    return jsonError(502, 'UNREACHABLE', 'Die Website konnte nicht gelesen werden.');
  }
  if ('error' in crawled) return jsonError(crawled.status, crawled.code, crawled.error);

  // ── Ableiten (rein, deterministisch) ────────────────────────────────
  // Lauf-Kennung und Snapshot-Hash gehen in jede Richtung ein
  // (`origin.rebuild`): Die übernommene Site ist damit an genau diesen Lauf
  // gebunden, und Vorschau wie Übernahme leiten mit denselben Werten ab.
  const runId = crypto.randomUUID();
  const snapshot = await sealSnapshot(buildSnapshot(crawled.input));
  const snapshotSha256 = await canonicalHash(snapshot);
  const positioning = derivePositioning(snapshot);
  const assessment = assessSnapshot(snapshot, positioning, nowIso);
  const builds = buildDirections(snapshot, positioning, assessment, { createdAt: nowIso, run: { id: runId, snapshotSha256 } });
  const blueprintHashes = await Promise.all(builds.map((b) => canonicalHash(b.blueprint)));

  // ── Nachweis (fail-closed) ──────────────────────────────────────────
  const evidence = await appendSiteosEvidence(admin, tenantId, {
    title: `Website-Rebuild: Analyse ${snapshot.host}`,
    source: 'siteos.rebuild',
    metadata: { run_id: runId, kind: 'siteos.rebuild.analysis' },
    body: {
      kind: 'siteos.rebuild.analysis',
      engine_version: REBUILD_ENGINE_VERSION,
      run_id: runId,
      source_url: snapshot.sourceUrl,
      resolved_url: snapshot.resolvedUrl,
      fetched_at: snapshot.fetchedAt,
      snapshot_sha256: snapshotSha256,
      documents: snapshot.pages.map((p) => ({ url: p.url, status: p.statusCode, document_sha256: p.documentSha256 })),
      evidence_items: snapshot.evidence.length,
      assessment: { overall: assessment.overall, finding_codes: assessment.findings.map((f) => f.code) },
      directions: builds.map((b, i) => ({ key: b.plan.key, blueprint_sha256: blueprintHashes[i] })),
    },
  });
  if ('error' in evidence) return jsonError(evidence.status, evidence.code, evidence.error);

  // ── Speichern ───────────────────────────────────────────────────────
  const { error: insertError } = await admin.from('siteos_rebuild_runs').insert({
    id: runId,
    tenant_id: tenantId,
    created_by: user.id,
    source_url: snapshot.sourceUrl,
    resolved_url: snapshot.resolvedUrl,
    host: snapshot.host,
    status: 'analyzed',
    engine_version: REBUILD_ENGINE_VERSION,
    snapshot,
    snapshot_sha256: snapshotSha256,
    positioning,
    assessment,
    // `derivedAt` ist Teil der Ableitung (Herkunftszeitpunkt der Blueprints).
    // Auswahl und Vorschau leiten mit genau diesem Wert neu ab — gleiche
    // Eingabe, gleicher Blueprint, gleicher Hash.
    directions: {
      derivedAt: nowIso,
      items: builds.map((b, i) => ({ plan: b.plan, report: b.report, blueprint_sha256: blueprintHashes[i] })),
    },
    evidence_id: evidence.id,
  });
  if (insertError) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_rebuild_run_insert_failed', error: insertError.message }));
    return jsonError(500, 'INTERNAL', 'Die Analyse konnte nicht gespeichert werden.');
  }

  await audit(admin, {
    tenant_id: tenantId, actor_user_id: user.id, actor_email: user.email ?? null,
    action: 'siteos.rebuild.analyze', target_type: 'siteos_rebuild_run', target_id: runId,
    payload: { host: snapshot.host, pages: snapshot.pages.length, overall: assessment.overall, evidence_id: evidence.id, snapshot_sha256: snapshotSha256 },
  });

  return jsonResponse({
    ok: true,
    run: { id: runId, engine_version: REBUILD_ENGINE_VERSION, derived_at: nowIso, snapshot_sha256: snapshotSha256, evidence_id: evidence.id, evidence_hash: evidence.contentHash },
    snapshot,
    positioning,
    assessment,
    directions: builds.map((b, i) => ({ plan: b.plan, report: b.report, blueprint: b.blueprint, blueprint_sha256: blueprintHashes[i] })),
  });
}

// ─────────────────────────────────────────────────────────────────────
// rebuild-select
// ─────────────────────────────────────────────────────────────────────

export async function handleSelect(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();
  const body = await readBody(req);
  if (body instanceof Response) return body;

  const auth = await requireAuthAndTenant(req, stringOrNull(body.tenant_id), WRITE_ROLES);
  if (auth instanceof Response) return auth;
  const { admin, tenantId, user } = auth;

  const gated = await gateBuilder(admin, tenantId);
  if (gated) return gated;

  const runId = String(body.run_id ?? '');
  const direction = String(body.direction ?? '');
  if (!UUID.test(runId)) return jsonError(400, 'BAD_REQUEST', 'run_id required');
  if (!DIRECTIONS.has(direction)) return jsonError(400, 'BAD_REQUEST', 'unknown direction');

  const { data: run } = await admin
    .from('siteos_rebuild_runs')
    .select('id, host, snapshot, snapshot_sha256, engine_version, directions')
    .eq('id', runId).eq('tenant_id', tenantId)
    .maybeSingle();
  if (!run) return jsonError(404, 'NOT_FOUND', 'Analyse nicht gefunden.');
  if (run.engine_version !== REBUILD_ENGINE_VERSION) {
    return jsonError(409, 'STALE_ENGINE', 'Die Analyse stammt aus einer älteren Version des Rebuilds. Bitte die Website erneut analysieren.');
  }
  const derivedAt = String(run.directions?.derivedAt ?? '');
  const offeredItems: { plan?: { key?: string }; blueprint_sha256?: string }[] = Array.isArray(run.directions?.items) ? run.directions.items : [];
  const offered = offeredItems.find((i) => i.plan?.key === direction);
  if (!offered) return jsonError(400, 'BAD_REQUEST', 'Diese Richtung wurde für die Analyse nicht angeboten.');

  // Der gespeicherte Snapshot ist der, den der Nachweis der Analyse nennt.
  const snapshot = run.snapshot as SourceSnapshot;
  const snapshotSha256 = String(run.snapshot_sha256 ?? '');
  if (await canonicalHash(snapshot) !== snapshotSha256) {
    return jsonError(409, 'INTEGRITY', 'Die gespeicherte Analyse stimmt nicht mehr mit ihrem Nachweis überein. Bitte die Website erneut analysieren.');
  }

  // Neu abgeleitet, nicht aus der Anfrage übernommen: derselbe Snapshot,
  // derselbe Zeitpunkt, derselbe Lauf ⇒ derselbe Blueprint wie in der
  // Vorschau. Das wird geprüft, nicht angenommen: Weicht der Hash von dem
  // ab, der bei der Analyse angeboten und belegt wurde (geänderte
  // Ableitung ohne neue Engine-Version), wird nichts übernommen.
  const positioning = derivePositioning(snapshot);
  const assessment = assessSnapshot(snapshot, positioning, derivedAt);
  const build = buildDirection(snapshot, positioning, assessment, direction as DirectionKey, { createdAt: derivedAt, run: { id: run.id, snapshotSha256 } });
  const blueprint = build.blueprint;
  const blueprintSha256 = await canonicalHash(blueprint);
  if (offered.blueprint_sha256 !== blueprintSha256) {
    return jsonError(409, 'STALE_DERIVATION', 'Diese Richtung ließe sich nicht mehr genau so übernehmen, wie sie in der Vorschau stand. Bitte die Website erneut analysieren.');
  }
  const findings = analyzeBlueprint(blueprint);
  const scores = computeScores(findings);

  // Gehört der Slug schon einer Site, muss es dieselbe Ausgangsseite sein.
  // Slugs entstehen aus dem Host (`mueller--bau.de` und `mueller-bau.de`
  // ergeben denselben); eine zweite Analyse einer anderen Domain darf die
  // Vergleichsgrundlage einer bestehenden Site nicht austauschen.
  const { data: existing } = await admin
    .from('siteos_blueprints')
    .select('id, origin_source, blueprint')
    .eq('tenant_id', tenantId).eq('slug', blueprint.slug)
    .order('version', { ascending: false }).limit(1)
    .maybeSingle();
  if (existing) {
    if (existing.origin_source !== 'import') {
      return jsonError(409, 'SLUG_TAKEN', `Unter „${blueprint.slug}" gibt es bereits eine Site, die nicht aus einer bestehenden Website übernommen wurde. Sie wird nicht überschrieben.`);
    }
    const bound = rebuildBinding(existing.blueprint as SiteBlueprint);
    if (bound && bound.runId !== run.id) {
      const { data: boundRun } = await admin
        .from('siteos_rebuild_runs').select('host')
        .eq('tenant_id', tenantId).eq('id', bound.runId)
        .maybeSingle();
      if (boundRun && siteHost(String(boundRun.host)) !== siteHost(String(run.host))) {
        return jsonError(409, 'OTHER_SOURCE', `Die Site „${blueprint.slug}" wurde aus ${boundRun.host} übernommen, diese Analyse stammt von ${run.host}. Eine andere Ausgangsseite wird nicht in ihre Kette übernommen.`);
      }
    }
  }

  const denied = await gateSiteCreate(admin, tenantId, blueprint.slug);
  if (denied) return denied;

  const nowIso = new Date().toISOString();
  const persisted = await persistBlueprintVersion({
    admin, tenantId, userId: user.id, userEmail: user.email ?? null,
    blueprint, blueprintSha256, findings, scores,
    projectId: null,
    originSource: 'import',
    originModel: null,
    nowIso,
    workflow: 'website-transformation',
    auditSource: 'siteos.rebuild',
    auditAction: 'siteos.rebuild.select',
    auditPayload: { run_id: runId, direction, snapshot_sha256: run.snapshot_sha256, source_host: snapshot.host },
  });
  if ('error' in persisted) return jsonError(500, 'INTERNAL', persisted.error);

  let blueprintId: string | null = persisted.unchanged ? null : persisted.blueprintId;
  if (!blueprintId) {
    const { data: latest } = await admin
      .from('siteos_blueprints').select('id')
      .eq('tenant_id', tenantId).eq('slug', blueprint.slug)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    blueprintId = latest?.id ?? null;
  }

  const { error: updateError } = await admin
    .from('siteos_rebuild_runs')
    .update({ status: 'selected', selected_direction: direction, site_slug: blueprint.slug, selected_blueprint_id: blueprintId, updated_at: nowIso })
    .eq('id', runId).eq('tenant_id', tenantId);
  if (updateError) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_rebuild_select_update_failed', error: updateError.message }));
    return jsonError(500, 'INTERNAL', 'Auswahl gespeichert, Lauf aber nicht aktualisiert — bitte erneut auswählen.');
  }

  return jsonResponse({
    ok: true,
    slug: blueprint.slug,
    version: persisted.version,
    blueprint_id: blueprintId,
    unchanged: persisted.unchanged,
    content_sha256: blueprintSha256,
  });
}

// ─────────────────────────────────────────────────────────────────────
// rebuild-refine
// ─────────────────────────────────────────────────────────────────────

export async function handleRefine(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();
  const body = await readBody(req);
  if (body instanceof Response) return body;

  const auth = await requireAuthAndTenant(req, stringOrNull(body.tenant_id), WRITE_ROLES);
  if (auth instanceof Response) return auth;
  const { admin, tenantId, user } = auth;

  const gated = await gateBuilder(admin, tenantId);
  if (gated) return gated;

  const slug = String(body.slug ?? '');
  if (!SLUG.test(slug)) return jsonError(400, 'BAD_REQUEST', 'slug required');
  const intents = (Array.isArray(body.intents) ? body.intents : []).filter(isRevisionIntentKey).slice(0, 10);
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim().slice(0, MAX_INSTRUCTION) : '';
  if (intents.length === 0 && instruction === '') return jsonError(400, 'BAD_REQUEST', 'intents or instruction required');

  const { data: row } = await admin
    .from('siteos_blueprints')
    .select('id, version, blueprint, content_sha256, origin_source, origin_model, project_id')
    .eq('tenant_id', tenantId).eq('slug', slug)
    .order('version', { ascending: false }).limit(1)
    .maybeSingle();
  if (!row?.blueprint) return jsonError(404, 'NOT_FOUND', 'Site nicht gefunden.');

  // Optimistische Sperre: Die Überarbeitung gilt dem Stand, den der Nutzer
  // gesehen hat. Hat sich die Kette inzwischen bewegt, wird nicht blind
  // auf einen anderen Stand angewandt.
  const base = typeof body.base_sha256 === 'string' ? body.base_sha256 : '';
  if (base && SHA256.test(base) && base !== String(row.content_sha256).trim()) {
    return jsonError(409, 'STALE', 'Die Site wurde inzwischen geändert. Bitte neu laden und erneut anwenden.');
  }

  const result = reviseBlueprint(row.blueprint as SiteBlueprint, { intents, instruction });
  if (!result.understood) {
    return jsonResponse({ ok: true, understood: false, notes: result.notes, refusals: result.refusals, changes: [] });
  }
  const blueprintSha256 = await canonicalHash(result.blueprint);
  if (result.changes.length === 0 || blueprintSha256 === String(row.content_sha256).trim()) {
    return jsonResponse({ ok: true, understood: true, unchanged: true, blueprint_id: row.id, notes: result.notes, refusals: result.refusals, changes: [], intents: result.intents });
  }

  const findings = analyzeBlueprint(result.blueprint);
  const scores = computeScores(findings);
  const persisted = await persistBlueprintVersion({
    admin, tenantId, userId: user.id, userEmail: user.email ?? null,
    blueprint: result.blueprint, blueprintSha256, findings, scores,
    projectId: row.project_id ?? null,
    originSource: row.origin_source,
    originModel: row.origin_model ?? null,
    nowIso: new Date().toISOString(),
    workflow: 'content-governance',
    auditSource: 'siteos.rebuild',
    auditAction: 'siteos.rebuild.refine',
    auditPayload: { intents: result.intents, instruction: instruction || null, change_codes: result.changes.map((c) => c.code), base_version: row.version },
  });
  if ('error' in persisted) return jsonError(500, 'INTERNAL', persisted.error);

  return jsonResponse({
    ok: true,
    understood: true,
    unchanged: persisted.unchanged,
    // Die neue Zeile — Bewertung, Freigabe und Export beziehen sich auf sie.
    blueprint_id: persisted.unchanged ? row.id : persisted.blueprintId,
    version: persisted.version,
    content_sha256: blueprintSha256,
    blueprint: result.blueprint,
    intents: result.intents,
    changes: result.changes,
    notes: result.notes,
    refusals: result.refusals,
    findings,
    scores,
  });
}

// ─────────────────────────────────────────────────────────────────────
// rebuild-status
// ─────────────────────────────────────────────────────────────────────

export async function handleStatus(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();
  const body = await readBody(req);
  if (body instanceof Response) return body;

  // Lesen: jedes Mitglied, auch Prüfer (viewer_auditor).
  const auth = await requireAuthAndTenant(req, stringOrNull(body.tenant_id));
  if (auth instanceof Response) return auth;
  const { admin, tenantId } = auth;

  const slug = String(body.slug ?? '');
  if (!SLUG.test(slug)) return jsonError(400, 'BAD_REQUEST', 'slug required');

  const { data: row } = await admin
    .from('siteos_blueprints')
    .select('id, version, blueprint, content_sha256, origin_source')
    .eq('tenant_id', tenantId).eq('slug', slug)
    .order('version', { ascending: false }).limit(1)
    .maybeSingle();
  if (!row?.blueprint) return jsonError(404, 'NOT_FOUND', 'Site nicht gefunden.');
  const blueprint = row.blueprint as SiteBlueprint;
  // Wie im Publish Gate — sonst zeigte der Status ein anderes Bündel.
  const baseUrl = baseUrlFor(row.origin_source, body.base_url);

  // Der Lauf, an den die Site gebunden ist — nicht der zuletzt bearbeitete.
  const { context, problem: bindingProblem } = await resolveRebuildContext(admin, tenantId, { slug, origin_source: row.origin_source, blueprint });
  const artifact = await buildDeploymentArtifact(blueprint, artifactOptionsFor(row.origin_source, context, blueprint, baseUrl));
  const redirects = context ? redirectsForBlueprint(context.snapshot, blueprint) : [];
  const backend = context ? compareBackend(context.snapshot, blueprint, context.waivers) : null;
  const checklist = buildPublishChecklist({
    blueprint,
    files: artifact.files,
    baseUrl: baseUrl ?? null,
    sourceHost: context?.snapshot.host ?? null,
    redirects,
  });

  // Verbindungsstand aus der Registratur — nie aus der Anfrage.
  const { data: registry } = await admin
    .from('connector_registry')
    .select('system_type, status, display_name')
    .eq('tenant_id', tenantId)
    .limit(200);
  const connectors: ConnectorState[] = (registry ?? [])
    .filter((r: { system_type?: unknown; status?: unknown }) => typeof r.system_type === 'string' && typeof r.status === 'string')
    .map((r: { system_type: string; status: ConnectorState['status']; display_name: string | null }) => ({
      systemType: r.system_type, status: r.status, displayName: r.display_name ?? r.system_type,
    }));
  const nextSteps = planNextSteps({ blueprint, snapshot: context?.snapshot ?? null, connectors });

  // „Aktuell" heißt: dasselbe Bündel — und bei übernommenen Sites derselbe
  // Backend-Vergleich (ein seither zurückgenommener Verzicht macht eine
  // bestandene Bewertung zu einer eines früheren Stands).
  const imported = row.origin_source === 'import';
  const backendSha256 = context && backend ? await backendDigest(context.runId, backend.comparison) : null;
  const columns: string = imported
    ? 'id, status, publishable, blockers, warnings, artifact_sha256, human_approval_required, evaluated_at, approved_by, backend_sha256'
    : 'id, status, publishable, blockers, warnings, artifact_sha256, human_approval_required, evaluated_at, approved_by';
  const { data: evaluation } = await admin
    .from('siteos_publish_evaluations')
    .select(columns)
    .eq('tenant_id', tenantId).eq('blueprint_id', row.id)
    .order('evaluated_at', { ascending: false }).limit(1)
    .maybeSingle<EvaluationRow>();
  const current = evaluation !== null
    && evaluation.artifact_sha256 === artifact.artifactSha256
    && (!imported || (backendSha256 !== null && evaluation.backend_sha256 === backendSha256));

  return jsonResponse({
    ok: true,
    blueprint_id: row.id,
    version: row.version,
    content_sha256: String(row.content_sha256).trim(),
    origin_source: row.origin_source,
    run_id: context?.runId ?? null,
    source_host: context?.host ?? null,
    binding_problem: bindingProblem,
    base_url: baseUrl ?? null,
    artifact: {
      sha256: artifact.artifactSha256,
      total_bytes: artifact.totalBytes,
      files: artifact.files.map((f) => ({ path: f.path, bytes: f.bytes, sha256: f.sha256 })),
    },
    backend,
    checklist,
    next_steps: nextSteps,
    evaluation: evaluation ? { ...evaluation, current } : null,
  });
}

interface EvaluationRow {
  id: string;
  status: string;
  publishable: boolean;
  blockers: string[];
  warnings: string[];
  artifact_sha256: string;
  human_approval_required: boolean;
  evaluated_at: string;
  approved_by: string | null;
  backend_sha256?: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// rebuild-waive
// ─────────────────────────────────────────────────────────────────────

export async function handleWaive(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();
  const body = await readBody(req);
  if (body instanceof Response) return body;

  const auth = await requireAuthAndTenant(req, stringOrNull(body.tenant_id), WAIVE_ROLES);
  if (auth instanceof Response) return auth;
  const { admin, tenantId, user } = auth;

  const runId = String(body.run_id ?? '');
  const key = String(body.key ?? '').slice(0, 400);
  const reason = String(body.reason ?? '').trim();
  const revoke = body.revoke === true;
  if (!UUID.test(runId)) return jsonError(400, 'BAD_REQUEST', 'run_id required');
  if (key === '') return jsonError(400, 'BAD_REQUEST', 'key required');
  if (!revoke && reason.length < 10) {
    return jsonError(400, 'BAD_REQUEST', 'Begründung erforderlich (mindestens 10 Zeichen) — ein Verzicht ohne Grund ist ein Schalter, keine Entscheidung.');
  }

  const { data: run } = await admin
    .from('siteos_rebuild_runs')
    .select('id, snapshot, site_slug, backend_waivers')
    .eq('id', runId).eq('tenant_id', tenantId)
    .maybeSingle();
  if (!run) return jsonError(404, 'NOT_FOUND', 'Analyse nicht gefunden.');
  if (!run.site_slug) return jsonError(409, 'CONFLICT', 'Erst eine Richtung auswählen.');

  const { data: row } = await admin
    .from('siteos_blueprints')
    .select('blueprint, origin_source')
    .eq('tenant_id', tenantId).eq('slug', run.site_slug)
    .order('version', { ascending: false }).limit(1)
    .maybeSingle();
  if (!row?.blueprint) return jsonError(404, 'NOT_FOUND', 'Site nicht gefunden.');
  // Verzichtet wird nur auf dem Lauf, an den die Site gebunden ist — ein
  // Verzicht auf einem anderen (älteren, fremden) Lauf wirkte nirgends
  // oder am falschen Vergleich.
  if (row.origin_source !== 'import' || rebuildBinding(row.blueprint as SiteBlueprint)?.runId !== runId) {
    return jsonError(409, 'NOT_BOUND', 'Diese Analyse ist nicht (mehr) die Grundlage der Site. Bitte die Seite neu laden.');
  }

  const snapshot = run.snapshot as SourceSnapshot;
  const blueprint = row.blueprint as SiteBlueprint;
  const waivers = sanitizeWaivers(run.backend_waivers);
  const current = compareBackend(snapshot, blueprint, waivers);
  const item = current.items.find((i) => i.key === key);

  let next: BackendWaiver[];
  const nowIso = new Date().toISOString();
  if (revoke) {
    if (!waivers.some((w) => w.key === key)) return jsonError(404, 'NOT_FOUND', 'Kein Verzicht für diese Funktion.');
    next = waivers.filter((w) => w.key !== key);
  } else {
    // Verzichtet werden kann nur auf etwas, das der Server selbst als
    // verloren festgestellt hat — nicht auf eine behauptete Funktion.
    if (!item || !item.waivable || item.status !== 'lost') {
      return jsonError(409, 'CONFLICT', 'Nur eine Funktion, die im Neubau fehlt, kann bewusst entfallen.');
    }
    next = [...waivers.filter((w) => w.key !== key), { key, reason: reason.slice(0, MAX_REASON), by: user.id, at: nowIso }];
  }

  const evidence = await appendSiteosEvidence(admin, tenantId, {
    title: `Website-Rebuild: ${revoke ? 'Verzicht zurückgenommen' : 'bewusster Verzicht'} — ${item?.label ?? key}`,
    source: 'siteos.rebuild',
    metadata: { run_id: runId, kind: 'siteos.rebuild.backend-waiver' },
    body: {
      kind: 'siteos.rebuild.backend-waiver',
      run_id: runId,
      site_slug: run.site_slug,
      key,
      label: item?.label ?? null,
      source_target: item?.source ?? null,
      revoke,
      reason: revoke ? null : reason.slice(0, MAX_REASON),
      decided_by: user.id,
      decided_at: nowIso,
    },
  });
  if ('error' in evidence) return jsonError(evidence.status, evidence.code, evidence.error);

  const { error: updateError } = await admin
    .from('siteos_rebuild_runs')
    .update({ backend_waivers: next, updated_at: nowIso })
    .eq('id', runId).eq('tenant_id', tenantId);
  if (updateError) return jsonError(500, 'INTERNAL', 'Verzicht belegt, aber nicht gespeichert — bitte erneut versuchen.');

  await audit(admin, {
    tenant_id: tenantId, actor_user_id: user.id, actor_email: user.email ?? null,
    action: revoke ? 'siteos.rebuild.waive.revoke' : 'siteos.rebuild.waive', target_type: 'siteos_rebuild_run', target_id: runId,
    payload: { key, reason: revoke ? null : reason.slice(0, MAX_REASON), evidence_id: evidence.id },
  });

  return jsonResponse({ ok: true, waivers: next, backend: compareBackend(snapshot, blueprint, next) });
}

// ─────────────────────────────────────────────────────────────────────
// Hilfen
// ─────────────────────────────────────────────────────────────────────

async function readBody(req: Request): Promise<Record<string, unknown> | Response> {
  try {
    const parsed = await req.json();
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : jsonError(400, 'BAD_REQUEST', 'invalid json');
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }
}

/** Host ohne `www.` — zwei Analysen derselben Website gelten als dieselbe Quelle. */
function siteHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

async function gateBuilder(admin: AdminClient, tenantId: string): Promise<Response | null> {
  try {
    await gateFeature(admin, tenantId, 'siteos.builder');
    return null;
  } catch (e) {
    if (e instanceof EntitlementError) return jsonError(e.code === 'INTERNAL' ? 500 : 403, e.code, e.message);
    throw e;
  }
}
