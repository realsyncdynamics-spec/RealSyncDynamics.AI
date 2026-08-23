// public-site-scan — der kostenlose Website-Scan des Trichters.
//
//   POST /functions/v1/public-site-scan          { url }        → Bericht + Kennung
//   POST /functions/v1/public-site-scan/result   { scan_id }    → Bericht erneut
//   POST /functions/v1/public-site-scan/claim    { scan_id }    → Übernahme ins Konto
//
// ## Was hier NICHT neu gebaut wurde
//
// Die Analyse ist die bestehende: `analyzeObservation()` und
// `computeScores()` aus `packages/siteos-core` — dieselbe Engine, die das
// SiteOS-Monitoring nach jedem Deployment fährt, mit denselben acht
// Dimensionen, denselben Befund-Codes und denselben Gewichten. Neu ist der
// Zugang: ohne Anmeldung, für eine fremde Domain, mit Zusatzsignalen, die
// bei einer fremden Seite nötig sind (`_shared/public-scan/detectors.ts`).
//
// ## Reihenfolge der Schranken
//
// Prüfpfad → Kontingent → Zielprüfung → Arbeit. Wer erst arbeitet und danach
// protokolliert, hat bei jedem Fehlschlag eine Lücke im Prüfpfad genau dort,
// wo sie am meisten stört. Dieselbe Reihenfolge wie im anonymen
// SiteOS-Build (`siteos/handlers/anonymous.ts`).
//
// ## Datenschutz
//
// Das HTML der geprüften Seite wird ausgewertet, aber nicht gespeichert
// (Art. 5 Abs. 1 lit. c DSGVO). Persistiert werden nur die abgeleiteten
// Befunde, Kennzahlen und erkannten Technologien. Die IP liegt nur als Hash
// vor. Nicht übernommene Scans verfallen nach sieben Tagen.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildCorsHeaders,
  handleOptions,
  jsonError,
  jsonResponse,
  methodNotAllowed,
} from '../_shared/gateway.ts';
import { sha256Hex } from '../_shared/hash.ts';
import {
  completeAnonAudit,
  extractPayloadKeys,
  reserveAnonAudit,
} from '../_shared/anonAudit.ts';
import { checkAnonRateLimit } from '../_shared/anonRateLimit.ts';
import { validateScanTarget } from '../_shared/public-scan/target.ts';
import { observeSite } from '../_shared/public-scan/observe.ts';
import { collectSignals, detectAdditionalFindings } from '../_shared/public-scan/detectors.ts';
import { buildPublicScanReport, type PublicScanReport } from '../_shared/public-scan/report.ts';
import { analyzeObservation } from '../../../packages/siteos-core/src/index.ts';

const cors = buildCorsHeaders('POST, OPTIONS');

/** Eigener Zählerraum — der Scan teilt sein Kontingent mit keinem anderen Pfad. */
const RATE_BUCKET = 'public_site_scan';
const RATE_MAX = 4;
const RATE_WINDOW_MS = 60_000;

// Gleiche Schreibweise wie in `siteos/handlers/anonymous.ts`: Ein blosses
// `SupabaseClient` passt strukturell nicht auf die `AdminLike`-Schnittstellen
// von `anonAudit.ts`, weil dort die Generics fehlen.
type AdminClient = ReturnType<typeof createClient<any, 'public', any>>;

interface ScanRow {
  id: string;
  report: PublicScanReport;
  tenant_id: string | null;
  claimed_at: string | null;
  expires_at: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req, cors);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed(cors);

  const action = lastPathSegment(req.url);

  try {
    if (action === 'claim') return await handleClaim(req);
    if (action === 'result') return await handleResult(req);
    return await handleScan(req);
  } catch (e) {
    console.error('public-site-scan failed:', (e as Error).message);
    return jsonError(500, 'INTERNAL', 'Der Scan konnte nicht abgeschlossen werden.', cors);
  }
});

// ─────────────────────────────────────────────────────────────────────
// Scan
// ─────────────────────────────────────────────────────────────────────

async function handleScan(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'Ungültige Anfrage.', cors);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('cf-connecting-ip')
    ?? 'unknown';
  const ua = req.headers.get('user-agent') ?? '';
  const ipHash = await sha256Hex(ip);
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  const admin = adminClient();

  // 1. Prüfpfad — ohne ihn keine Arbeit.
  try {
    await reserveAnonAudit(admin, {
      request_id: requestId,
      op: 'start_audit_scan',
      ip_hash: ipHash,
      user_agent_hash: ua ? await sha256Hex(ua) : undefined,
      payload_keys: extractPayloadKeys(body),
    });
  } catch (e) {
    return jsonError(
      503,
      'AUDIT_UNAVAILABLE',
      `Der Scan ist derzeit nicht verfügbar (Prüfpfad nicht schreibbar: ${(e as Error).message}).`,
      cors,
    );
  }

  // 2. Kontingent.
  const rl = checkAnonRateLimit(ipHash, { bucket: RATE_BUCKET, max: RATE_MAX, windowMs: RATE_WINDOW_MS });
  if (!rl.allowed) {
    await completeAnonAudit(admin, requestId, { outcome: 'rate_limited', duration_ms: Date.now() - startedAt });
    return jsonError(429, 'RATE_LIMIT', 'Zu viele Scans. Bitte in einer Minute erneut versuchen.', cors);
  }

  // 3. Zielprüfung (SSRF-Schranke).
  const target = validateScanTarget(String(body.url ?? ''));
  if (!target.ok) {
    await completeAnonAudit(admin, requestId, {
      outcome: 'blocked', error_code: 'INVALID_TARGET', duration_ms: Date.now() - startedAt,
    });
    return jsonError(400, 'INVALID_TARGET', target.reason, cors);
  }

  // 4. Arbeit.
  let report: PublicScanReport;
  let findings: RuntimeFinding[];
  try {
    const observation = await observeSite(target.url);
    const signals = collectSignals(observation);
    findings = [
      ...analyzeObservation(observation),
      ...detectAdditionalFindings(observation, signals),
    ];
    report = buildPublicScanReport({
      url: observation.url,
      domain: target.domain,
      scannedAt: observation.observedAt,
      httpStatus: observation.statusCode,
      htmlLength: observation.html.length,
      findings,
      signals,
    });
  } catch (e) {
    await completeAnonAudit(admin, requestId, {
      outcome: 'error', error_code: 'FETCH_FAILED', duration_ms: Date.now() - startedAt,
    });
    // Der Grund bleibt bewusst grob: Ob ein Host nicht auflöst, das
    // Zertifikat abgelaufen ist oder eine Sperre greift, ist für den
    // Besucher dieselbe Auskunft — und für einen Angreifer wäre die
    // Unterscheidung ein Portscanner.
    console.error('public-site-scan fetch failed:', (e as Error).message);
    return jsonError(
      502,
      'FETCH_FAILED',
      'Die Website war nicht erreichbar oder hat den Abruf abgelehnt. Bitte Adresse prüfen.',
      cors,
    );
  }

  // 5. Ablegen. Schlägt das fehl, ist der Bericht trotzdem etwas wert —
  // der Besucher bekommt ihn, kann ihn aber nicht speichern.
  const { data, error } = await admin
    .from('public_site_scans')
    .insert({
      url: report.url,
      domain: report.domain,
      http_status: report.httpStatus,
      overall_score: report.overallScore,
      report,
      findings,
      engine_version: report.engineVersion,
      ip_hash: ipHash,
    })
    .select('id')
    .single();

  if (error) {
    console.error('public-site-scan persist failed:', error.message);
    await completeAnonAudit(admin, requestId, {
      outcome: 'error', error_code: 'PERSIST_FAILED', duration_ms: Date.now() - startedAt,
    });
    return jsonResponse({ ok: true, scan_id: null, persisted: false, report }, 200, cors);
  }

  await completeAnonAudit(admin, requestId, { outcome: 'success', duration_ms: Date.now() - startedAt });
  return jsonResponse({ ok: true, scan_id: data.id, persisted: true, report }, 200, cors);
}

// ─────────────────────────────────────────────────────────────────────
// Bericht erneut abrufen
// ─────────────────────────────────────────────────────────────────────

/**
 * Liefert einen Bericht zu seiner Kennung. Die Kennung ist das
 * Zugriffsmittel (122 Bit Zufall, nicht aufzählbar) — genau wie beim
 * anonymen SiteOS-Build. Es gibt keine Auflistung: Ohne Kennung ist kein
 * Bericht erreichbar, auch nicht der eigene.
 */
async function handleResult(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'Ungültige Anfrage.', cors);
  }

  const scanId = String(body.scan_id ?? '').trim();
  if (!isUuid(scanId)) return jsonError(400, 'BAD_REQUEST', 'Ungültige Scan-Kennung.', cors);

  const row = await loadScan(adminClient(), scanId);
  if (!row) return jsonError(404, 'NOT_FOUND', 'Dieser Scan ist nicht mehr verfügbar.', cors);

  return jsonResponse({
    ok: true,
    scan_id: row.id,
    claimed: row.claimed_at !== null,
    report: row.report,
  }, 200, cors);
}

// ─────────────────────────────────────────────────────────────────────
// Übernahme ins Konto
// ─────────────────────────────────────────────────────────────────────

/**
 * Ordnet einen anonymen Scan dem Mandanten des angemeldeten Benutzers zu.
 *
 * Idempotent: Ein zweiter Aufruf mit derselben Kennung durch denselben
 * Mandanten meldet Erfolg, ohne etwas zu ändern. Ein Aufruf durch einen
 * **anderen** Mandanten wird abgelehnt — sonst könnte ein Konto den Scan
 * eines anderen an sich ziehen.
 */
async function handleClaim(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'Bitte melden Sie sich an.', cors);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'Ungültige Anfrage.', cors);
  }

  const scanId = String(body.scan_id ?? '').trim();
  if (!isUuid(scanId)) return jsonError(400, 'BAD_REQUEST', 'Ungültige Scan-Kennung.', cors);

  // Identität aus dem Token des Aufrufers, nicht aus dem Anfragekörper. Ein
  // `tenant_id` aus dem Body wäre eine Einladung, fremde Mandanten zu
  // benennen.
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData?.user) {
    return jsonError(401, 'UNAUTHORIZED', 'Anmeldung nicht gültig.', cors);
  }

  const admin = adminClient();
  const tenantId = await resolveTenantId(admin, userData.user.id);
  if (!tenantId) {
    return jsonError(409, 'NO_TENANT', 'Für dieses Konto ist noch kein Arbeitsbereich angelegt.', cors);
  }

  const row = await loadScan(admin, scanId);
  if (!row) return jsonError(404, 'NOT_FOUND', 'Dieser Scan ist nicht mehr verfügbar.', cors);

  if (row.tenant_id !== null) {
    if (row.tenant_id === tenantId) {
      return jsonResponse({ ok: true, scan_id: row.id, tenant_id: tenantId, already_claimed: true }, 200, cors);
    }
    return jsonError(409, 'ALREADY_CLAIMED', 'Dieser Scan gehört bereits zu einem anderen Arbeitsbereich.', cors);
  }

  // Bedingtes Update: `is null` in der Bedingung schliesst das Rennen
  // zweier gleichzeitiger Übernahmen aus — die zweite trifft keine Zeile
  // mehr, statt die erste zu überschreiben.
  const { data: updated, error } = await admin
    .from('public_site_scans')
    .update({ tenant_id: tenantId, claimed_at: new Date().toISOString() })
    .eq('id', scanId)
    .is('tenant_id', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('public-site-scan claim failed:', error.message);
    return jsonError(500, 'INTERNAL', 'Die Übernahme ist fehlgeschlagen.', cors);
  }
  if (!updated) {
    // Zwischenzeitlich von jemand anderem übernommen.
    return jsonError(409, 'ALREADY_CLAIMED', 'Dieser Scan wurde soeben einem anderen Arbeitsbereich zugeordnet.', cors);
  }

  return jsonResponse({ ok: true, scan_id: scanId, tenant_id: tenantId, already_claimed: false }, 200, cors);
}

// ─────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────

function adminClient(): AdminClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

async function loadScan(admin: AdminClient, scanId: string): Promise<ScanRow | null> {
  const { data } = await admin
    .from('public_site_scans')
    .select('id, report, tenant_id, claimed_at, expires_at')
    .eq('id', scanId)
    .maybeSingle();

  if (!data) return null;
  const row = data as ScanRow;

  // Abgelaufene, nicht übernommene Scans gelten als nicht vorhanden. Der
  // Verfallslauf räumt sie später; bis dahin dürfen sie nicht mehr
  // ausgeliefert werden.
  if (row.claimed_at === null && new Date(row.expires_at).getTime() <= Date.now()) return null;

  return row;
}

/**
 * Mandant des Benutzers. `memberships` ist die führende Zuordnung; ein
 * Benutzer gehört zu genau einem Mandanten (`CLAUDE.md` §11).
 */
async function resolveTenantId(admin: AdminClient, userId: string): Promise<string | null> {
  const { data: membership } = await admin
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (membership?.tenant_id) return membership.tenant_id as string;

  const { data: profile } = await admin
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle();
  return (profile?.tenant_id as string | undefined) ?? null;
}

function lastPathSegment(rawUrl: string): string {
  try {
    const segments = new URL(rawUrl).pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? '';
  } catch {
    return '';
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
