// siteos — anonymer Build, Verfeinerung und Übernahme.
//
//   POST /functions/v1/siteos/build-anon    Beschreibung → Blueprint, ohne Konto
//   POST /functions/v1/siteos/refine-anon   Anweisung → neue Version, ohne Konto
//   POST /functions/v1/siteos/session       Sitzung lesen, ohne Konto
//   POST /functions/v1/siteos/claim         Sitzung → Mandant, mit Konto
//
// ## Warum der Blueprint hier serverseitig entsteht
//
// Die vorige Fassung baute im Browser und spielte die Anweisungsfolge beim
// Übernehmen serverseitig nach. Deterministisch — aber der Blueprint wurde
// beim Claim **neu erzeugt**. Solange sich `packages/siteos-core` nicht
// ändert, kommt dasselbe heraus. Ändert es sich zwischen Vorschau und
// Anmeldung, bekommt der Kunde etwas anderes als das, was er gesehen hat,
// und niemand merkt es: Beide Ergebnisse sind für sich „richtig".
//
// Deshalb gilt hier: **Der Claim verschiebt, er baut nicht.** Was in der
// Vorschau stand, ist Zeile für Zeile das, was im Mandanten landet.
//
// ## Was den anonymen Pfad absichert
//
// Dasselbe Gate wie beim anonymen Assistenten, nicht ein zweites daneben:
// `reserveAnonAudit` schreibt **vor** der Arbeit eine Zeile in
// `anon_chat_runs`; schlägt das fehl, wird die Anfrage abgelehnt (503), nicht
// stillschweigend ausgeführt. Dazu der gemeinsame Rate-Limiter aus
// `_shared/anonRateLimit.ts` mit eigenem Zählerraum, damit ein
// Website-Entwurf nicht das Kontingent des Assistenten verbraucht.
//
// Die Grenzen dieses Limits stehen in `anonRateLimit.ts` und sind real: Der
// Zähler liegt im Isolate-Speicher und ist keine Abwehr gegen einen
// verteilten Angriff. Der Prüfpfad hängt nicht daran.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../../_shared/gateway.ts';
import { audit } from '../../_shared/auditLog.ts';
import { appendCustodyEvent } from '../../_shared/provenanceCore.ts';
import { checkAnonRateLimit } from '../../_shared/anonRateLimit.ts';
import { completeAnonAudit, extractPayloadKeys, reserveAnonAudit } from '../../_shared/anonAudit.ts';
import { createPreviewId } from '../../../../src/lib/preview-sandbox.ts';
import {
  publishPreview,
  readPreviewTarget,
  revokePreview,
  ttlUntil,
  type PreviewOutcome,
  type PreviewTarget,
} from '../preview.ts';
import {
  analyzeBlueprint,
  buildSiteFromPrompt,
  canonicalHash,
  computeScores,
  refineBlueprint,
  sha256Hex,
  type Locale,
  type RuntimeFinding,
  type ScoreBreakdown,
  type SiteBlueprint,
} from '../../../../packages/siteos-core/src/index.ts';

const MAX_PROMPT_LENGTH = 2000;
const MAX_INSTRUCTION_LENGTH = 400;
/** Höchstzahl Verfeinerungen je Sitzung — schützt vor endlosem Fortschreiben. */
const MAX_VERSION = 60;
const VALID_LOCALES = new Set<Locale>(['de', 'en', 'fr', 'it', 'es', 'nl', 'pl']);

/** Eigener Zählerraum (siehe Kopf). */
const RATE_BUCKET = 'siteos-build';

/**
 * Anonyme Entwürfe je IP-Hash und 24 Stunden.
 *
 * Der Zähler aus `anonRateLimit.ts` liegt im Isolate-Speicher: Er bremst
 * einen Ansturm innerhalb einer Minute, überlebt aber kein Recycling und
 * kennt keine zweite Instanz. Als Kontingent taugt er deshalb nicht — genau
 * das war der Befund im Runbook („ein ausbleibender 429 bestätigt den
 * Befund").
 *
 * Dieses Kontingent zählt in der Datenbank, über den Index
 * `siteos_anonymous_builds_ip_idx (ip_hash, created_at)`, der seit
 * Migration 20260822180000 genau dafür liegt und bisher von keiner Abfrage
 * benutzt wurde. Es überlebt Isolate-Wechsel und gilt über alle Instanzen.
 *
 * Gezählt werden **neue Sitzungen**, nicht Verfeinerungen: Die sind je
 * Sitzung durch `MAX_VERSION` begrenzt und erzeugen keine weitere Ablage.
 */
const ANON_BUILD_QUOTA_PER_DAY = 10;
const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = ReturnType<typeof createClient<any, 'public', any>>;

interface SessionRow {
  id: string;
  blueprint: SiteBlueprint;
  content_sha256: string;
  slug: string;
  name: string;
  industry: string;
  findings: RuntimeFinding[];
  scores: ScoreBreakdown;
  version: number;
  prompt_sha256: string | null;
  origin_model: string | null;
  claimed_tenant_id: string | null;
  claimed_blueprint_id: string | null;
  preview_id: string | null;
  expires_at: string;
}

// ─────────────────────────────────────────────────────────────────────
// Schritt 1+2 — anonymer Bau
// ─────────────────────────────────────────────────────────────────────

export async function handleBuildAnon(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();

  const gate = await openAnonGate(req, 'siteos_build_anon');
  if (gate instanceof Response) return gate;
  const { admin, requestId, ipHash, body, startedAt } = gate;

  const prompt = String(body.prompt ?? '').trim();
  if (!prompt) return await deny(admin, requestId, startedAt, 400, 'BAD_REQUEST', 'prompt required');
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return await deny(admin, requestId, startedAt, 400, 'BAD_REQUEST', `prompt exceeds ${MAX_PROMPT_LENGTH} characters`);
  }

  const localeInput = typeof body.locale === 'string' ? (body.locale as Locale) : 'de';
  const locale: Locale = VALID_LOCALES.has(localeInput) ? localeInput : 'de';

  try {
    // Kein Modell beteiligt: `origin.model` bleibt null. Ein Modellname, der
    // nie gerufen wurde, wäre eine falsche Angabe im Herkunftsnachweis
    // (Art. 50 EU AI Act).
    const result = await buildSiteFromPrompt(prompt, {
      locale,
      enrichment: sanitizeEnrichment(body.enrichment),
      model: null,
    });

    const { data: session, error } = await admin
      .from('siteos_anonymous_builds')
      .insert({
        blueprint: result.blueprint,
        content_sha256: result.blueprintSha256,
        slug: result.blueprint.slug,
        name: result.blueprint.name,
        industry: result.blueprint.industry,
        findings: result.findings,
        scores: result.scores,
        version: 1,
        prompt_sha256: result.blueprint.origin.promptSha256,
        origin_model: null,
        ip_hash: ipHash,
      })
      .select('id, expires_at').single();

    if (error || !session) {
      console.error(JSON.stringify({ level: 'error', scope: 'siteos_anon_build_insert_failed', error: error?.message }));
      return await deny(admin, requestId, startedAt, 500, 'INTERNAL', 'could not persist build session');
    }

    const sessionId = (session as { id: string }).id;
    const expiresAt = (session as { expires_at: string }).expires_at;

    // Die Vorschau entsteht **nach** der Sitzung, nicht davor: Ihre
    // Lebensdauer ist die Restzeit dieser Zeile, und die kennt erst die
    // Datenbank (Default `now() + 7 days`).
    const preview = await storePreview(admin, sessionId, result.blueprint, expiresAt, null);

    await completeAnonAudit(admin, requestId, { outcome: 'success', duration_ms: Date.now() - startedAt });

    return jsonResponse({
      ok: true,
      session_id: sessionId,
      expires_at: expiresAt,
      version: 1,
      slug: result.blueprint.slug,
      content_sha256: result.blueprintSha256,
      blueprint: result.blueprint,
      findings: result.findings,
      scores: result.scores,
      preview: describePreview(preview),
    });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_anon_build_failed', error: (e as Error)?.message }));
    return await deny(admin, requestId, startedAt, 500, 'INTERNAL', 'build failed');
  }
}

// ─────────────────────────────────────────────────────────────────────
// Schritt 2 — Verfeinerung derselben Sitzung
// ─────────────────────────────────────────────────────────────────────

export async function handleRefineAnon(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();

  const gate = await openAnonGate(req, 'siteos_refine_anon');
  if (gate instanceof Response) return gate;
  const { admin, requestId, body, startedAt } = gate;

  const sessionId = String(body.session_id ?? '').trim();
  const instruction = String(body.instruction ?? '').trim().slice(0, MAX_INSTRUCTION_LENGTH);
  if (!sessionId) return await deny(admin, requestId, startedAt, 400, 'BAD_REQUEST', 'session_id required');
  if (!instruction) return await deny(admin, requestId, startedAt, 400, 'BAD_REQUEST', 'instruction required');

  const session = await loadSession(admin, sessionId);
  if (session === null) return await deny(admin, requestId, startedAt, 404, 'NOT_FOUND', 'build session not found');
  if (isExpired(session)) return await deny(admin, requestId, startedAt, 410, 'GONE', 'build session expired');
  if (session.claimed_at_set) {
    return await deny(admin, requestId, startedAt, 409, 'CONFLICT', 'session already claimed — refine in the project instead');
  }
  if (session.row.version >= MAX_VERSION) {
    return await deny(admin, requestId, startedAt, 429, 'LIMIT', `session reached ${MAX_VERSION} versions`);
  }

  const step = refineBlueprint(session.row.blueprint, instruction);

  // Ohne Wirkung wird nichts fortgeschrieben: Eine neue Version, die
  // dasselbe enthält, macht die Versionskette unlesbar.
  if (step.changes.length === 0) {
    await completeAnonAudit(admin, requestId, { outcome: 'success', duration_ms: Date.now() - startedAt });
    return jsonResponse({
      ok: true, unchanged: true,
      session_id: sessionId, version: session.row.version,
      blueprint: session.row.blueprint,
      findings: session.row.findings, scores: session.row.scores,
      changes: [], refusals: step.refusals, understood: step.understood,
      // Nichts geändert heisst auch: nichts neu abgelegt. Die Adresse bleibt
      // dieselbe, damit ein geteilter Link nicht von einer folgenlosen
      // Anweisung abhängt.
      preview: describeExisting(session.row.preview_id),
    });
  }

  const findings = analyzeBlueprint(step.blueprint);
  const scores = computeScores(findings);
  const contentSha = await canonicalHash(step.blueprint);
  const version = session.row.version + 1;

  const { error } = await admin
    .from('siteos_anonymous_builds')
    .update({
      blueprint: step.blueprint,
      content_sha256: contentSha,
      slug: step.blueprint.slug,
      name: step.blueprint.name,
      findings, scores, version,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId).is('claimed_at', null);

  if (error) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_anon_refine_update_failed', error: error.message }));
    return await deny(admin, requestId, startedAt, 500, 'INTERNAL', 'could not persist refinement');
  }

  // Dieselbe Kennung, neuer Inhalt: Wer den Link geteilt hat, sieht den
  // aktuellen Stand — und es entsteht nicht bei jeder Anweisung eine weitere
  // Kopie des Entwurfs im Netz.
  const preview = await storePreview(
    admin, sessionId, step.blueprint, session.row.expires_at, session.row.preview_id,
  );

  await completeAnonAudit(admin, requestId, { outcome: 'success', duration_ms: Date.now() - startedAt });

  return jsonResponse({
    ok: true, unchanged: false,
    session_id: sessionId, version,
    content_sha256: contentSha,
    blueprint: step.blueprint, findings, scores,
    changes: step.changes, refusals: step.refusals, understood: step.understood,
    preview: describePreview(preview),
  });
}

// ─────────────────────────────────────────────────────────────────────
// Schritt 2 — Sitzung lesen
// ─────────────────────────────────────────────────────────────────────

/**
 * Liefert den aktuellen Stand einer Sitzung.
 *
 * Nötig für den Neuladen-Fall: Ohne Lesepfad müsste der Browser seine
 * eigene Kopie anzeigen — und die kann von dem abweichen, was der Claim
 * übernimmt. Genau diese Abweichung soll der serverseitige Entwurf
 * beseitigen; ein clientseitiger Zwischenspeicher als Anzeigequelle würde
 * sie wieder einführen.
 *
 * Ohne Konto, weil die Sitzungskennung selbst das Zugriffsmittel ist (128
 * Bit, siehe Migration 20260822180000). Sie steht in keiner Antwort, die
 * jemand anders bekommt.
 *
 * Bewusst **ohne** Rate-Limit und ohne Prüfpfad-Eintrag: Lesen erzeugt
 * nichts, verbraucht kein Modell und ändert nichts. Ein Zähler darauf würde
 * das Neuladen der eigenen Vorschau bestrafen.
 */
export async function handleGetSession(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const sessionId = String(body.session_id ?? '').trim();
  if (!sessionId) return jsonError(400, 'BAD_REQUEST', 'session_id required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin: AdminClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const session = await loadSession(admin, sessionId);
  // „Nicht gefunden" und „abgelaufen" antworten unterschiedlich, weil der
  // Unterschied für den Besucher zählt: Im einen Fall hilft die Kennung
  // nicht mehr, im anderen ist die Frist abgelaufen und er weiss, warum.
  if (session === null) return jsonError(404, 'NOT_FOUND', 'build session not found');
  if (isExpired(session)) return jsonError(410, 'GONE', 'build session expired');

  return jsonResponse({
    ok: true,
    session_id: session.row.id,
    version: session.row.version,
    slug: session.row.slug,
    content_sha256: session.row.content_sha256,
    blueprint: session.row.blueprint,
    findings: session.row.findings,
    scores: session.row.scores,
    expires_at: session.row.expires_at,
    claimed: session.claimed_at_set,
    claimed_blueprint_id: session.row.claimed_blueprint_id,
    preview: describeExisting(session.row.preview_id),
  });
}

// ─────────────────────────────────────────────────────────────────────
// Schritt 3 — Übernahme
// ─────────────────────────────────────────────────────────────────────

/**
 * Verschiebt die Sitzung in einen Mandanten.
 *
 * **Idempotent**: Ein zweiter Aufruf liefert dieselbe Blueprint-Zeile,
 * statt eine zweite anzulegen. Das ist kein Komfort — der Kunde klickt
 * „Übernehmen", die Verbindung bricht ab, er klickt erneut. Ohne
 * Idempotenz hätte er dann zwei Websites.
 *
 * **Ohne Neuerzeugung**: Der Blueprint wird aus der Sitzung übernommen, nicht
 * neu gebaut. Genau das ist der Unterschied zur vorigen Fassung.
 */
export async function handleClaim(req: Request): Promise<Response> {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return methodNotAllowed();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const tenantId = String(body.tenant_id ?? '').trim();
  const sessionId = String(body.session_id ?? '').trim();
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!sessionId) return jsonError(400, 'BAD_REQUEST', 'session_id required');

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

  const admin: AdminClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: member } = await admin
    .from('memberships').select('user_id')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const session = await loadSession(admin, sessionId);
  if (session === null) return jsonError(404, 'NOT_FOUND', 'build session not found');

  // Bereits übernommen: dieselbe Antwort wie beim ersten Mal.
  if (session.row.claimed_blueprint_id) {
    if (session.row.claimed_tenant_id !== tenantId) {
      return jsonError(409, 'CONFLICT', 'this build session belongs to another workspace');
    }
    return jsonResponse({
      ok: true, already_claimed: true,
      blueprint_id: session.row.claimed_blueprint_id,
      slug: session.row.slug, version: session.row.version,
      content_sha256: session.row.content_sha256,
    });
  }

  // Abgelaufen wird NICHT stillschweigend übernommen. Der Verfall ist eine
  // Zusage nach aussen (Art. 5 Abs. 1 lit. e DSGVO); wer sie hier umgeht,
  // hebt sie überall auf.
  if (isExpired(session)) return jsonError(410, 'GONE', 'build session expired');

  try {
    const nowIso = new Date().toISOString();
    const blueprint = session.row.blueprint;

    // Unversehrtheit vor der Uebernahme.
    //
    // Die Zusage des Claims lautet „genau diese Fassung". Nachgerechnet wurde
    // sie bisher nicht: Blueprint und gespeicherter Hash wurden nebeneinander
    // kopiert, ohne zu pruefen, dass sie zusammengehoeren. Der Blueprint macht
    // dazwischen einen Umlauf durch JSONB — passte die Kanonisierung nicht,
    // faellt das sonst nirgends auf, sondern erst einem Pruefer, der die
    // Kette nachrechnet.
    //
    // Schreiben kann diese Zeile nur service_role, das Risiko ist also klein.
    // Der Aufwand ist aber genauso klein, und eine Nachweiskette, die man
    // nicht prueft, ist eine Behauptung.
    const verifiedSha = await canonicalHash(blueprint);
    if (verifiedSha !== session.row.content_sha256) {
      console.error(JSON.stringify({
        level: 'error', scope: 'siteos_claim_integrity_mismatch',
        session_id: sessionId, stored: session.row.content_sha256, computed: verifiedSha,
      }));
      return jsonError(409, 'DRAFT_CORRUPT',
        'Der Entwurf stimmt nicht mehr mit seinem Nachweis ueberein und wird nicht uebernommen.');
    }

    const { data: previous } = await admin
      .from('siteos_blueprints').select('version, content_sha256')
      .eq('tenant_id', tenantId).eq('slug', session.row.slug)
      .order('version', { ascending: false }).limit(1)
      .maybeSingle<{ version: number; content_sha256: string }>();

    const version = (previous?.version ?? 0) + 1;
    const prevHash = previous?.content_sha256 ?? null;

    const { data: inserted, error: insertErr } = await admin
      .from('siteos_blueprints')
      .insert({
        tenant_id: tenantId,
        slug: session.row.slug,
        name: session.row.name,
        industry: session.row.industry,
        version,
        // Unverändert aus der Sitzung — nicht neu erzeugt.
        blueprint,
        content_sha256: session.row.content_sha256,
        prev_hash: prevHash,
        origin_source: 'ai-builder',
        origin_model: session.row.origin_model,
        prompt_sha256: session.row.prompt_sha256,
        status: 'draft',
        created_by: userId,
      })
      .select('id').single();

    if (insertErr || !inserted) {
      console.error(JSON.stringify({ level: 'error', scope: 'siteos_claim_insert_failed', error: insertErr?.message }));
      return jsonError(500, 'INTERNAL', 'could not persist blueprint');
    }
    const blueprintId = (inserted as { id: string }).id;

    // Wettlauf zweier gleichzeitiger Übernahmen: Nur der Aufruf, der die
    // Sitzung noch unbeansprucht vorfindet, gewinnt. Der Verlierer räumt
    // seine gerade angelegte Zeile wieder ab und liefert das Ergebnis des
    // Gewinners — sonst entstünden zwei Websites aus einem Entwurf.
    const { data: won } = await admin
      .from('siteos_anonymous_builds')
      .update({
        claimed_tenant_id: tenantId,
        claimed_blueprint_id: blueprintId,
        claimed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', sessionId).is('claimed_at', null)
      .select('id');

    if (!won || (won as unknown[]).length === 0) {
      await admin.from('siteos_blueprints').delete().eq('id', blueprintId);
      const winner = await loadSession(admin, sessionId);
      return jsonResponse({
        ok: true, already_claimed: true,
        blueprint_id: winner?.row.claimed_blueprint_id ?? null,
        slug: session.row.slug, version: session.row.version,
        content_sha256: session.row.content_sha256,
      });
    }

    // Ab hier gehört der Entwurf einem Mandanten. Die anonym abrufbare Kopie
    // hat damit keinen Zweck mehr (Art. 5 Abs. 1 lit. b DSGVO) und wird
    // zurückgenommen — best effort: Der Claim ist bereits vollzogen und wird
    // an einer Ablage, die nicht antwortet, nicht rückgängig gemacht. Bleibt
    // sie stehen, verfällt sie spätestens mit ihrer eigenen Frist.
    const revokedPreviewId = session.row.preview_id;
    let previewRevoked = false;
    if (revokedPreviewId) {
      previewRevoked = await revokePreview(previewTarget(), revokedPreviewId);
      // Die Spalte führt die **lebende** Vorschau. Nach der Übernahme gibt es
      // keine; der Beleg, dass es eine gab, steht im Prüfpfad.
      await admin
        .from('siteos_anonymous_builds')
        .update({ preview_id: null, updated_at: nowIso })
        .eq('id', sessionId);
      if (!previewRevoked) {
        console.error(JSON.stringify({
          level: 'warn', scope: 'siteos_claim_preview_revoke_failed',
          session_id: sessionId,
        }));
      }
    }

    // Prüfstand und Nachweis zum übernommenen Stand.
    const { data: scan } = await admin
      .from('siteos_runtime_scans')
      .insert({
        tenant_id: tenantId, blueprint_id: blueprintId,
        trigger: 'manual', scope: 'blueprint', status: 'completed',
        findings: session.row.findings,
        finding_count: session.row.findings.length,
        severity_max: session.row.scores?.severityMax ?? null,
        observed_at: nowIso,
      })
      .select('id').maybeSingle<{ id: string }>();

    if (scan) {
      await admin.from('siteos_scores').insert({
        tenant_id: tenantId, scan_id: scan.id, blueprint_id: blueprintId,
        health: session.row.scores?.health ?? null,
        risk: session.row.scores?.risk ?? null,
        compliance: session.row.scores?.compliance ?? null,
        performance: session.row.scores?.performance ?? null,
        ai_risk: session.row.scores?.aiRisk ?? null,
        dimensions: session.row.scores?.dimensions ?? {},
      });
    }

    let provenanceLinked = false;
    try {
      await appendCustodyEvent(admin, {
        tenantId,
        assetRef: `siteos:blueprint:${tenantId}:${session.row.slug}`,
        contentSha256: session.row.content_sha256,
        action: version === 1 ? 'registered' : 'updated',
        issuer: `tenant:${tenantId}`,
        timestamp: nowIso,
      });
      provenanceLinked = true;
    } catch (provErr) {
      console.error(JSON.stringify({
        level: 'warn', scope: 'siteos_claim_provenance_failed',
        error: (provErr as Error)?.message ?? String(provErr),
      }));
    }

    await audit(admin, {
      tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
      action: 'siteos.build.claim', target_type: 'siteos_blueprint', target_id: blueprintId,
      payload: {
        session_id: sessionId, slug: session.row.slug, version,
        // Der Beleg für „keine Neuerzeugung": derselbe Hash wie in der Vorschau.
        content_sha256: session.row.content_sha256,
        session_version: session.row.version,
        finding_count: session.row.findings.length,
        // Welche anonyme Vorschau es gab und ob sie zurückgenommen wurde.
        // Ohne diesen Eintrag wäre nach dem Nullen der Spalte nicht mehr
        // belegbar, dass überhaupt eine im Netz stand.
        preview_id: revokedPreviewId,
        preview_revoked: previewRevoked,
      },
    });

    return jsonResponse({
      ok: true, already_claimed: false,
      blueprint_id: blueprintId,
      slug: session.row.slug,
      version,
      content_sha256: session.row.content_sha256,
      provenance_linked: provenanceLinked,
      preview_revoked: previewRevoked,
    });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'siteos_claim_failed', error: (e as Error)?.message }));
    return jsonError(500, 'INTERNAL', 'claim failed');
  }
}

// ─────────────────────────────────────────────────────────────────────
// Gemeinsames
// ─────────────────────────────────────────────────────────────────────

interface AnonGate {
  admin: AdminClient;
  requestId: string;
  ipHash: string;
  body: Record<string, unknown>;
  startedAt: number;
}

/**
 * Prüfpfad zuerst, dann Kontingent, dann Arbeit.
 *
 * Die Reihenfolge ist der Punkt: Wer erst arbeitet und danach protokolliert,
 * hat bei jedem Fehlschlag eine Lücke im Prüfpfad genau dort, wo sie am
 * meisten stört.
 */
async function openAnonGate(req: Request, op: 'siteos_build_anon' | 'siteos_refine_anon'): Promise<AnonGate | Response> {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = req.headers.get('user-agent') ?? '';
  const ipHash = await sha256Hex(ip);
  const uaHash = ua ? await sha256Hex(ua) : undefined;
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin: AdminClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    await reserveAnonAudit(admin, {
      request_id: requestId, op, ip_hash: ipHash,
      user_agent_hash: uaHash,
      session_id: typeof body.session_id === 'string' ? body.session_id : undefined,
      payload_keys: extractPayloadKeys(body),
    });
  } catch (e) {
    // Ohne Prüfpfad keine Arbeit — dieselbe Regel wie beim Assistenten.
    return jsonError(503, 'AUDIT_UNAVAILABLE', `anon path refused: audit log not writable (${(e as Error).message})`);
  }

  const rl = checkAnonRateLimit(ipHash, { bucket: RATE_BUCKET });
  if (!rl.allowed) {
    await completeAnonAudit(admin, requestId, { outcome: 'rate_limited', duration_ms: Date.now() - startedAt });
    return jsonError(429, 'RATE_LIMIT', 'Zu viele Anfragen. Bitte in einer Minute erneut versuchen.');
  }

  // Das dauerhafte Kontingent gilt nur für neue Sitzungen (siehe
  // `ANON_BUILD_QUOTA_PER_DAY`).
  if (op === 'siteos_build_anon') {
    const quota = await checkBuildQuota(admin, ipHash);
    if (quota.status === 'unavailable') {
      // Fail closed, aus demselben Grund wie beim Prüfpfad: Ein Kontingent,
      // das bei jedem Fehler alles durchlässt, ist keines. Der Fehler ist
      // benannt, damit er im Betrieb nicht als Kundenfehler ankommt.
      await completeAnonAudit(admin, requestId, {
        outcome: 'error', error_code: 'QUOTA_UNAVAILABLE', duration_ms: Date.now() - startedAt,
      });
      return jsonError(503, 'QUOTA_UNAVAILABLE', 'anon path refused: quota not readable');
    }
    if (quota.status === 'exceeded') {
      await completeAnonAudit(admin, requestId, {
        outcome: 'rate_limited', error_code: 'QUOTA_EXCEEDED', duration_ms: Date.now() - startedAt,
      });
      return jsonError(
        429,
        'QUOTA_EXCEEDED',
        `Kontingent erschöpft: ${ANON_BUILD_QUOTA_PER_DAY} Entwürfe in 24 Stunden. Mit einem Konto entfällt die Grenze.`,
      );
    }
  }

  return { admin, requestId, ipHash, body, startedAt };
}

/**
 * Zählt die Entwürfe dieses IP-Hashes im laufenden 24-Stunden-Fenster.
 *
 * `head: true` mit `count: 'exact'` holt nur die Zahl, keine Zeilen — die
 * Abfrage liest den Index, nicht die Blueprints.
 */
async function checkBuildQuota(
  admin: AdminClient,
  ipHash: string,
): Promise<{ status: 'ok' | 'exceeded' | 'unavailable'; used: number }> {
  const since = new Date(Date.now() - QUOTA_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from('siteos_anonymous_builds')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if (error || count === null || count === undefined) {
    console.error(JSON.stringify({
      level: 'error', scope: 'siteos_anon_quota_unreadable', error: error?.message ?? 'no count',
    }));
    return { status: 'unavailable', used: 0 };
  }
  return { status: count >= ANON_BUILD_QUOTA_PER_DAY ? 'exceeded' : 'ok', used: count };
}

// ─────────────────────────────────────────────────────────────────────
// Vorschau
// ─────────────────────────────────────────────────────────────────────

/** Ziel des Vorschau-Workers. Einmal je Aufruf gelesen, nie zwischengespeichert. */
function previewTarget(): PreviewTarget | null {
  return readPreviewTarget((key) => Deno.env.get(key) ?? undefined);
}

/**
 * Legt die Vorschau ab und schreibt die Kennung in die Sitzung.
 *
 * Reihenfolge: erst ablegen, dann vermerken. Andersherum stünde in der
 * Datenbank eine Kennung, hinter der nichts liegt — und die Sitzung
 * behauptete eine Adresse, die 404 antwortet.
 *
 * Wirft nie: Der Entwurf ist bereits gebaut und gespeichert. Eine
 * fehlgeschlagene Ablage nimmt ihm die Adresse, nicht die Existenz.
 */
async function storePreview(
  admin: AdminClient,
  sessionId: string,
  blueprint: SiteBlueprint,
  expiresAt: string,
  existingPreviewId: string | null,
): Promise<PreviewOutcome> {
  const target = previewTarget();
  if (!target) return { status: 'not_configured' };

  const previewId = existingPreviewId ?? createPreviewId((array) => crypto.getRandomValues(array));
  const outcome = await publishPreview(target, previewId, blueprint, ttlUntil(expiresAt));

  if (outcome.status !== 'stored') {
    console.error(JSON.stringify({
      level: 'warn', scope: 'siteos_anon_preview_unavailable',
      session_id: sessionId, status: outcome.status,
      reason: outcome.status === 'failed' ? outcome.reason : undefined,
    }));
    return outcome;
  }

  if (existingPreviewId === null) {
    const { error } = await admin
      .from('siteos_anonymous_builds')
      .update({ preview_id: previewId, updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) {
      console.error(JSON.stringify({
        level: 'warn', scope: 'siteos_anon_preview_link_failed',
        session_id: sessionId, error: error.message,
      }));
    }
  }

  return outcome;
}

/** Die Vorschau in der Antwort. Ein Zustand, kein Fehler — siehe `preview.ts`. */
function describePreview(outcome: PreviewOutcome): Record<string, unknown> {
  if (outcome.status === 'stored') {
    return { status: 'stored', url: outcome.url, expires_in: outcome.expiresInSeconds };
  }
  if (outcome.status === 'not_configured') return { status: 'not_configured' };
  return { status: 'failed', reason: outcome.reason };
}

/**
 * Beschreibt eine bereits abgelegte Vorschau, ohne sie neu zu schreiben.
 *
 * Die Adresse wird aus der Kennung und der konfigurierten Herkunft gebildet.
 * Ist keine Herkunft gesetzt, gibt es auch keine Adresse — dann steht das da
 * und nicht eine URL, die ins Nichts zeigt.
 */
function describeExisting(previewId: string | null): Record<string, unknown> {
  if (!previewId) return { status: 'none' };
  const target = previewTarget();
  if (!target) return { status: 'not_configured' };
  return { status: 'stored', url: `${target.origin}/p/${previewId}` };
}

/** Schliesst den Prüfpfad-Eintrag und antwortet mit dem Fehler. */
async function deny(
  admin: AdminClient, requestId: string, startedAt: number,
  status: number, code: string, message: string,
): Promise<Response> {
  await completeAnonAudit(admin, requestId, {
    outcome: status >= 500 ? 'error' : 'blocked',
    error_code: code,
    duration_ms: Date.now() - startedAt,
  });
  return jsonError(status, code, message);
}

async function loadSession(admin: AdminClient, sessionId: string): Promise<{ row: SessionRow & { claimed_at?: string | null }; claimed_at_set: boolean } | null> {
  const { data } = await admin
    .from('siteos_anonymous_builds')
    .select('id, blueprint, content_sha256, slug, name, industry, findings, scores, version, prompt_sha256, origin_model, claimed_tenant_id, claimed_blueprint_id, preview_id, claimed_at, expires_at')
    .eq('id', sessionId).maybeSingle();

  if (!data) return null;
  const row = data as SessionRow & { claimed_at: string | null };
  return { row, claimed_at_set: row.claimed_at !== null };
}

function isExpired(session: { row: { expires_at: string } }): boolean {
  return new Date(session.row.expires_at).getTime() <= Date.now();
}

function sanitizeEnrichment(raw: unknown): { name?: string; summary?: string; services?: string[]; highlights?: string[]; locality?: string | null } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as Record<string, unknown>;
  const out: { name?: string; summary?: string; services?: string[]; highlights?: string[]; locality?: string | null } = {};
  if (typeof v.name === 'string') out.name = v.name.trim().slice(0, 120);
  if (typeof v.summary === 'string') out.summary = v.summary.trim().slice(0, 600);
  if (Array.isArray(v.services)) {
    out.services = v.services.filter((s): s is string => typeof s === 'string').map((s) => s.trim().slice(0, 80)).slice(0, 12);
  }
  // Muss dieselben Felder durchlassen wie die Zwillingsfunktion in
  // builder.ts — sonst baut der anonyme Pfad eine andere Website als der
  // angemeldete, und das faellt erst beim Claim auf.
  if (Array.isArray(v.highlights)) {
    out.highlights = v.highlights.filter((s): s is string => typeof s === 'string').map((s) => s.trim().slice(0, 120)).slice(0, 6);
  }
  if (v.locality === null || typeof v.locality === 'string') {
    out.locality = v.locality === null ? null : String(v.locality).trim().slice(0, 80);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
