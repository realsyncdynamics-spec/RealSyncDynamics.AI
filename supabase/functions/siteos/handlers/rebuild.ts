// siteos — Rebuild-Workflow am Edge (Ersatz-Schnitt 3 aus #1727).
//
//   POST /siteos/rebuild-analyze  { tenant_id, url }
//        DISCOVER + ASSESS + REBUILD: Ausgangsseite lesen, belegen, bewerten,
//        zwei bis drei Richtungen ableiten. Schreibt einen Evidence-Eintrag
//        und danach den Lauf — ohne Nachweis kein Lauf.
//   POST /siteos/rebuild-select   { tenant_id, run_id, direction }
//        Richtung serverseitig aus dem gespeicherten Snapshot neu ableiten
//        und als Blueprint-Version (Herkunft `import`) in die Kette hängen.
//   POST /siteos/rebuild-refine   { tenant_id, slug, base_sha256, intents?, instruction? }
//        REFINE: benannte Regeln („seriöser", „CTA stärker" …) und Freitext.
//   POST /siteos/rebuild-status   { tenant_id, slug }
//        Bindung der Site an ihren Lauf und nächste Schritte mit echtem
//        Verbindungsstand (AUTOMATE / GOVERN).
//
// Backend-Vergleich, Verzicht, Veröffentlichungs-Checkliste und Export
// gehören zum PUBLISH-Schnitt. Bis dahin bewertet das Publish Gate eine
// übernommene Site ohne Vergleich (`backend_preservation: 'unknown'`) und
// sperrt sie — fail-closed, nicht übersehen.
//
// ## Autorität
//
// Mandant und Rolle kommen aus `requireAuthAndTenant` (Mitgliedschaft in der
// Datenbank); `tenant_id` im Body ist nur die Behauptung, die geprüft wird.
// Alles Weitere — Snapshot, Richtung, Bindung, Verbindungsstand — liest oder
// berechnet der Server selbst. Eine Adresse aus der Anfrage ist nie Autorität
// für Mandant oder Richtlinie.
//
// Resolver und Plan-Schranken kommen über `deps` herein, verdrahtet in
// `../rebuild-deps.ts` (kanonischer Resolver aus `_shared/auth.ts`). Diese
// Datei hat dadurch keine `jsr:`-Abhängigkeit und läuft auch in Vitest —
// geprüft in `test/edge/siteos-rebuild-handlers.test.ts`. Muster wie
// `ai-act-auto-classify/handler.ts`.
//
// ## Reihenfolge
//
// Prüfen → lesen → ableiten → Nachweis schreiben → speichern. Wer zuerst
// speichert und dann belegt, hat im Fehlerfall einen Lauf ohne Beleg.

import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';
import { audit } from '../../_shared/auditLog.ts';
import { persistBlueprintVersion } from '../persist.ts';
import { appendSiteosEvidence } from '../evidence.ts';
import { crawlSite } from '../rebuild-fetch.ts';
import { rebuildBinding, resolveRebuildContext, siteHost } from '../rebuild-context.ts';
import {
  REBUILD_ENGINE_VERSION,
  analyzeBlueprint,
  assessSnapshot,
  buildDirection,
  buildDirections,
  buildSnapshot,
  canonicalHash,
  computeScores,
  derivePositioning,
  isPublicHttpUrl,
  isRevisionIntentKey,
  normalizeInputUrl,
  planNextSteps,
  reviseBlueprint,
  sealSnapshot,
  type ConnectorState,
  type DirectionKey,
  type SiteBlueprint,
  type SourceSnapshot,
} from '../../../../packages/siteos-core/src/index.ts';

/**
 * Service-Role-Client, wie ihn der Resolver nach der Mitgliedschaftsprüfung
 * liefert. Bewusst lose (PostgREST-Builder sind tiefe Generics).
 */
// deno-lint-ignore no-explicit-any
export type AdminClient = any;

/** Ergebnis des Resolvers — Mandant erst NACH der Mitgliedschaftsprüfung. */
export interface VerifiedAuth {
  user: { id: string; email?: string | null };
  tenantId: string;
  admin: AdminClient;
}

export interface RebuildDeps {
  /** Kanonischer Resolver (`_shared/auth.ts`): Token, Mitgliedschaft, Rolle — sonst 401/403. */
  requireAuthAndTenant(req: Request, clientTenantId: string | null | undefined, allowedRoles?: string[]): Promise<VerifiedAuth | Response>;
  /** `siteos.builder` (`site-entitlements.ts`). */
  gateSiteEdit(admin: AdminClient, tenantId: string): Promise<Response | null>;
  /** `siteos.builder` und `limit.sites` für einen neuen Slug (`site-entitlements.ts`). */
  gateSiteCreate(admin: AdminClient, tenantId: string, slug?: string | null): Promise<Response | null>;
}

/** Lesen und ableiten: auch der Datenschutzbeauftragte darf eine Analyse anstoßen. */
const ANALYZE_ROLES = ['owner', 'admin', 'editor', 'dpo'];
/** Eine Version erzeugen: Redaktion. */
const WRITE_ROLES = ['owner', 'admin', 'editor'];

/**
 * Kostenbremse je Mandant und Stunde. Gezählt werden **Versuche** (jeder
 * Abruf wird vorher protokolliert), nicht nur gespeicherte Läufe — sonst
 * wären fehlschlagende Abrufe beliebig oft wiederholbar.
 */
const RUNS_PER_HOUR = 12;
const ATTEMPT_ACTION = 'siteos.rebuild.analyze.attempt';
const MAX_INSTRUCTION = 600;
const MAX_INTENTS = 10;
const DIRECTIONS: ReadonlySet<string> = new Set(['clean-enterprise', 'conversion-focus', 'local-trust', 'premium-advisory']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;

// ─────────────────────────────────────────────────────────────────────
// rebuild-analyze
// ─────────────────────────────────────────────────────────────────────

export async function handleAnalyze(req: Request, deps: RebuildDeps): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();
  const body = await readBody(req);
  if (body instanceof Response) return body;

  const auth = await deps.requireAuthAndTenant(req, stringOrNull(body.tenant_id), ANALYZE_ROLES);
  if (auth instanceof Response) return auth;
  const { admin, tenantId, user } = auth;

  const denied = await deps.gateSiteEdit(admin, tenantId);
  if (denied) return denied;

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
      requested_by: user.id,
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

export async function handleSelect(req: Request, deps: RebuildDeps): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();
  const body = await readBody(req);
  if (body instanceof Response) return body;

  const auth = await deps.requireAuthAndTenant(req, stringOrNull(body.tenant_id), WRITE_ROLES);
  if (auth instanceof Response) return auth;
  const { admin, tenantId, user } = auth;

  const denied = await deps.gateSiteEdit(admin, tenantId);
  if (denied) return denied;

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
  // Vergleichsgrundlage einer bestehenden Site nicht austauschen. Lässt sich
  // die Ausgangsseite der bestehenden Site nicht feststellen, wird sie
  // ebenfalls nicht überschrieben (fail-closed).
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
    if (!bound) {
      return jsonError(409, 'OTHER_SOURCE', `Für die Site „${blueprint.slug}" ist keine Ausgangsseite belegt. Sie wird nicht durch eine Analyse von ${run.host} ersetzt.`);
    }
    if (bound.runId !== run.id) {
      const { data: boundRun } = await admin
        .from('siteos_rebuild_runs').select('host')
        .eq('tenant_id', tenantId).eq('id', bound.runId)
        .maybeSingle();
      if (!boundRun) {
        return jsonError(409, 'OTHER_SOURCE', `Die Analyse, aus der „${blueprint.slug}" stammt, ist nicht mehr vorhanden. Eine andere Analyse wird nicht ungeprüft in ihre Kette übernommen.`);
      }
      if (siteHost(String(boundRun.host)) !== siteHost(String(run.host))) {
        return jsonError(409, 'OTHER_SOURCE', `Die Site „${blueprint.slug}" wurde aus ${boundRun.host} übernommen, diese Analyse stammt von ${run.host}. Eine andere Ausgangsseite wird nicht in ihre Kette übernommen.`);
      }
    }
  }

  const slotDenied = await deps.gateSiteCreate(admin, tenantId, blueprint.slug);
  if (slotDenied) return slotDenied;

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
    auditPayload: { run_id: runId, direction, snapshot_sha256: snapshotSha256, source_host: snapshot.host },
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

export async function handleRefine(req: Request, deps: RebuildDeps): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();
  const body = await readBody(req);
  if (body instanceof Response) return body;

  const auth = await deps.requireAuthAndTenant(req, stringOrNull(body.tenant_id), WRITE_ROLES);
  if (auth instanceof Response) return auth;
  const { admin, tenantId, user } = auth;

  const denied = await deps.gateSiteEdit(admin, tenantId);
  if (denied) return denied;

  const slug = String(body.slug ?? '');
  if (!SLUG.test(slug)) return jsonError(400, 'BAD_REQUEST', 'slug required');
  // Wie `siteos/edit`: Die Überarbeitung gilt dem Stand, den der Nutzer
  // gesehen hat — ohne diesen Stand keine Überarbeitung.
  const base = typeof body.base_sha256 === 'string' ? body.base_sha256.trim() : '';
  if (!SHA256.test(base)) return jsonError(400, 'BAD_REQUEST', 'base_sha256 must be a sha256 hex');
  const intents = (Array.isArray(body.intents) ? body.intents : []).filter(isRevisionIntentKey).slice(0, MAX_INTENTS);
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim().slice(0, MAX_INSTRUCTION) : '';
  if (intents.length === 0 && instruction === '') return jsonError(400, 'BAD_REQUEST', 'intents or instruction required');

  const { data: row } = await admin
    .from('siteos_blueprints')
    .select('id, version, blueprint, content_sha256, origin_source, origin_model, project_id')
    .eq('tenant_id', tenantId).eq('slug', slug)
    .order('version', { ascending: false }).limit(1)
    .maybeSingle();
  if (!row?.blueprint) return jsonError(404, 'NOT_FOUND', 'Site nicht gefunden.');

  // Optimistische Sperre: Hat sich die Kette inzwischen bewegt, wird nicht
  // blind auf einen anderen Stand angewandt.
  const current = String(row.content_sha256).trim();
  if (base !== current) {
    return jsonError(409, 'STALE_BASE', 'Die Site wurde inzwischen geändert. Bitte neu laden und erneut anwenden.');
  }

  const result = reviseBlueprint(row.blueprint as SiteBlueprint, { intents, instruction });
  if (!result.understood) {
    return jsonResponse({ ok: true, understood: false, notes: result.notes, refusals: result.refusals, changes: [] });
  }
  const blueprintSha256 = await canonicalHash(result.blueprint);
  if (result.changes.length === 0 || blueprintSha256 === current) {
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
    auditPayload: { base_sha256: base, intents: result.intents, instruction: instruction || null, change_codes: result.changes.map((c) => c.code), base_version: row.version },
  });
  if ('error' in persisted) return jsonError(500, 'INTERNAL', persisted.error);

  return jsonResponse({
    ok: true,
    understood: true,
    unchanged: persisted.unchanged,
    // Die neue Zeile — Bewertung und Freigabe beziehen sich auf sie.
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

export async function handleStatus(req: Request, deps: RebuildDeps): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();
  const body = await readBody(req);
  if (body instanceof Response) return body;

  // Lesen: jedes Mitglied, auch Prüfer (viewer_auditor).
  const auth = await deps.requireAuthAndTenant(req, stringOrNull(body.tenant_id));
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

  // Der Lauf, an den die Site gebunden ist — nicht der zuletzt bearbeitete.
  const { context, problem: bindingProblem } = await resolveRebuildContext(admin, tenantId, { slug, origin_source: row.origin_source, blueprint });

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

  return jsonResponse({
    ok: true,
    blueprint_id: row.id,
    version: row.version,
    content_sha256: String(row.content_sha256).trim(),
    origin_source: row.origin_source,
    run_id: context?.runId ?? null,
    source_host: context?.host ?? null,
    binding_problem: bindingProblem,
    next_steps: nextSteps,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Hilfen
// ─────────────────────────────────────────────────────────────────────

async function readBody(req: Request): Promise<Record<string, unknown> | Response> {
  try {
    const parsed = await req.json();
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : jsonError(400, 'BAD_REQUEST', 'invalid json');
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
