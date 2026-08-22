// siteos-anon — Website erzeugen, bevor es ein Konto gibt.
//
// POST /functions/v1/siteos-anon
// Auth: keine. Der Endpunkt ist absichtlich offen.
// Body: { prompt: string, locale?: 'de' | 'en' }
//
// ── Warum eine eigene Function und nicht der siteos-Router ───────────────
//
// Der Router `siteos` hat keinen Eintrag in `supabase/config.toml`, also gilt
// dort `verify_jwt = true`: Die Plattform weist unangemeldete Aufrufe ab,
// bevor ein Handler sie sieht. Diese Absicherung liegt VOR der Prüfung, die
// jeder Handler ohnehin selbst macht — sie ist eine zweite Schicht.
//
// Den Router zu öffnen hiesse, diese zweite Schicht für vier bestehende,
// angemeldete Endpunkte zu entfernen, nur damit ein fünfter offen sein kann.
// Deshalb steht der anonyme Pfad hier, in einer eigenen Function mit
// `verify_jwt = false`. Der Router bleibt, wie er ist.
//
// Es entsteht dabei **keine zweite Auth-Logik**: Angemeldete Builds laufen
// unverändert über `siteos/builder`. Dieser Endpunkt hat gar keine Anmeldung,
// die abweichen könnte — er hat ein Kontingent.
//
// ── Was hier erzeugt wird, und was nicht ─────────────────────────────────
//
// Der Blueprint entsteht **deterministisch** aus der Beschreibung
// (`parseBrief` → `synthesizeBlueprint`), ohne Modellaufruf. Das ist eine
// echte, vollständige Site — aber keine generative KI. `origin_model` bleibt
// deshalb `null`, was Art. 50 EU AI Act korrekt abbildet: Es wird keine KI
// behauptet, wo keine war.
//
// Das ist bewusst die Reihenfolge und kein Endzustand: Dieser Schritt
// schliesst die Strecke — anonyme Sitzung, Entwurf, Vorschau, später
// Übernahme. Den Modellaufruf an dieser einen Stelle einzusetzen, ist danach
// eine eng begrenzte Änderung, die aber Kostendeckel braucht. Umgekehrt wäre
// die Strecke offen und die Kosten liefen bereits.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import { reserveAnonAudit, completeAnonAudit, extractPayloadKeys } from '../_shared/anonAudit.ts';
import {
  ANON_BUILD_BURST,
  ANON_BUILD_DAILY,
  consumeRateLimit,
  pruneRateWindows,
  type RateWindow,
} from '../_shared/anonRateLimit.ts';
import {
  canonicalHash,
  parseBrief,
  renderSite,
  sha256Hex,
  synthesizeBlueprint,
  type Locale,
} from '../../../packages/siteos-core/src/index.ts';

/** Im Speicher gehaltene Fenster. Gilt je Instanz — die echte Grenze zieht die Datenbank. */
const BURST = new Map<string, RateWindow>();

const MAX_PROMPT_LENGTH = 2000;
// Deckungsgleich mit `Locale` in siteos-core. Ein unbekannter Wert faellt auf
// `de` zurueck statt abzuweisen — die Sprache ist kein Sicherheitsmerkmal.
const VALID_LOCALES = new Set<Locale>(['de', 'en', 'fr', 'it', 'es', 'nl', 'pl']);

/** Lebensdauer eines Entwurfs ohne Übernahme. Deckungsgleich mit der Vorschau. */
const DRAFT_TTL_DAYS = 7;

/** 128 Bit als 32 Hex-Zeichen — dasselbe Format wie die Vorschau-Kennung. */
function newKey(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const prompt = String(body.prompt ?? '').trim();
  if (!prompt) return jsonError(400, 'BAD_REQUEST', 'prompt required');
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return jsonError(400, 'BAD_REQUEST', `prompt exceeds ${MAX_PROMPT_LENGTH} characters`);
  }
  const localeInput = String(body.locale ?? 'de') as Locale;
  const locale: Locale = VALID_LOCALES.has(localeInput) ? localeInput : 'de';

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = req.headers.get('user-agent') ?? '';
  const ipHash = await sha256Hex(ip);
  const uaHash = ua ? await sha256Hex(ua) : undefined;
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Sicherheits-Gate: Ohne Prüfpfad-Eintrag keine Arbeit. Dieselbe Regel wie
  // im anonymen Pfad von `governance-agent` — reservieren, dann arbeiten.
  try {
    await reserveAnonAudit(admin, {
      request_id: requestId,
      op: 'anon_site_build',
      ip_hash: ipHash,
      user_agent_hash: uaHash,
      payload_keys: extractPayloadKeys(body),
    });
  } catch (e) {
    return jsonError(503, 'AUDIT_UNAVAILABLE',
      `anon path refused: audit log not writable (${(e as Error).message})`);
  }

  // Stufe 1 — schnelle Wiederholungen. Billig, aber nur je Instanz.
  pruneRateWindows(BURST, Date.now());
  const burst = consumeRateLimit(BURST, ipHash, Date.now(), ANON_BUILD_BURST);
  if (!burst.allowed) {
    await completeAnonAudit(admin, requestId, { outcome: 'rate_limited', duration_ms: Date.now() - startedAt });
    return jsonError(429, 'RATE_LIMIT', 'Zu viele Anfragen. Bitte kurz warten.');
  }

  // Stufe 2 — die eigentliche Grenze. Überlebt Kaltstarts und gilt über alle
  // Instanzen; ohne sie wäre der Endpunkt für jeden offen, der Kaltstarts
  // erwischt.
  {
    const since = new Date(Date.now() - ANON_BUILD_DAILY.windowMs).toISOString();
    const { count, error } = await admin
      .from('siteos_anonymous_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', since);
    // Fail closed: Lässt sich das Kontingent nicht feststellen, wird nicht
    // gebaut. Ein nicht prüfbares Kontingent ist keines.
    if (error) {
      await completeAnonAudit(admin, requestId, { outcome: 'error', error_code: 'QUOTA_UNREADABLE', duration_ms: Date.now() - startedAt });
      return jsonError(503, 'QUOTA_UNAVAILABLE', 'Kontingent konnte nicht geprüft werden.');
    }
    if ((count ?? 0) >= ANON_BUILD_DAILY.max) {
      await completeAnonAudit(admin, requestId, { outcome: 'rate_limited', duration_ms: Date.now() - startedAt });
      return jsonError(429, 'RATE_LIMIT', 'Tageskontingent erreicht. Bitte morgen erneut versuchen oder ein Konto anlegen.');
    }
  }

  try {
    // ── Erzeugen ─────────────────────────────────────────────────────────
    // `parseBrief` erkennt Name, Branche und Leistungen aus dem Text.
    const brief = parseBrief(prompt, locale);
    const blueprint = synthesizeBlueprint(brief, {
      source: 'ai-builder',
      // Deterministisch erzeugt — es war keine generative KI beteiligt, also
      // wird auch keine dokumentiert (Art. 50 EU AI Act).
      model: null,
    });

    const contentSha256 = await canonicalHash(blueprint);
    const promptSha256 = await sha256Hex(prompt);
    const draftKey = newKey();
    const previewId = newKey();
    const expiresAt = new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // ── Entwurf ablegen ──────────────────────────────────────────────────
    //
    // Vor der Vorschau: Der Entwurf ist das, was später übernommen wird.
    // Scheitert er, gibt es nichts zu zeigen.
    const { error: draftErr } = await admin.from('siteos_anonymous_drafts').insert({
      draft_key: draftKey,
      blueprint,
      content_sha256: contentSha256,
      origin_model: null,
      prompt_sha256: promptSha256,
      preview_id: previewId,
      ip_hash: ipHash,
      expires_at: expiresAt,
    });
    if (draftErr) {
      await completeAnonAudit(admin, requestId, { outcome: 'error', error_code: 'DRAFT_WRITE_FAILED', duration_ms: Date.now() - startedAt });
      return jsonError(500, 'INTERNAL', 'Der Entwurf konnte nicht gespeichert werden.');
    }

    // ── Vorschau ablegen ─────────────────────────────────────────────────
    //
    // Getrennt und nicht zwingend: Fehlt die Vorschau-Umgebung oder schlägt
    // das Ablegen fehl, bleibt der Entwurf gültig und übernehmbar. Der
    // Aufrufer erfährt es über `preview_url: null` statt über einen Fehler,
    // der den Entwurf mit vernichten würde.
    let previewUrl: string | null = null;
    const previewOrigin = Deno.env.get('SITEOS_PREVIEW_ORIGIN');
    const previewToken = Deno.env.get('PREVIEW_WRITE_TOKEN');
    if (previewOrigin && previewToken) {
      try {
        const pages = renderSite(blueprint, {});
        const html = pages.find((p) => p.path === '/')?.html ?? pages[0]?.html ?? '';
        const res = await fetch(`${previewOrigin.replace(/\/$/, '')}/p/${previewId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${previewToken}` },
          body: JSON.stringify({ html, isolation: 'static' }),
        });
        if (res.ok) previewUrl = `${previewOrigin.replace(/\/$/, '')}/p/${previewId}`;
        else console.error('preview put failed:', res.status);
      } catch (e) {
        console.error('preview put threw:', (e as Error).message);
      }
    }

    await completeAnonAudit(admin, requestId, { outcome: 'success', duration_ms: Date.now() - startedAt });

    return jsonResponse({
      ok: true,
      // Der Schlüssel ist der einzige Zugang zum Entwurf. Er geht genau
      // einmal über die Leitung — an den, der ihn erzeugt hat.
      draft_key: draftKey,
      preview_id: previewId,
      preview_url: previewUrl,
      expires_at: expiresAt,
      content_sha256: contentSha256,
      blueprint,
    });
  } catch (e) {
    await completeAnonAudit(admin, requestId, {
      outcome: 'error',
      error_code: 'BUILD_FAILED',
      duration_ms: Date.now() - startedAt,
    });
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
