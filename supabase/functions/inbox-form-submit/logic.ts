// Logik von `inbox-form-submit` (PR C, Schritt 3) — ohne Deno- und
// Supabase-Importe, damit vitest sie direkt prüfen kann
// (test/edge/inbox-form-submit.test.ts). Liegt im Function-Verzeichnis statt
// in `_shared/`: eine Änderung dort schaltet `deploy.yml` auf `deploy_all`.
//
// Ablauf einer Formular-Anfrage
//   1. Honeypot gefüllt  → Antwort wie Erfolg, nichts wird geschrieben.
//   2. Rate-Limit        → 429, nichts wird geschrieben.
//   3. Validierung       → 400 mit Feldname, nichts wird geschrieben.
//   4. `resolve_site_inbox(site_ref)` (fail-closed, Schritt 1) → sonst 404.
//   5. Konversation (Kanal `form`, Status `open` = „Neu“) + Intake schreiben.
//
// Doppelte Absendung
//   Das Formular schickt eine zufällige Nonce mit. Sie wird als
//   `external_ref = 'form:<nonce>'` gespeichert; der bestehende eindeutige
//   Index `uq_bot_conversations_bot_ref (bot_id, external_ref)` lässt pro Bot
//   genau eine Konversation je Nonce zu. Eine zweite Absendung trifft auf
//   `23505` und wird als Erfolg beantwortet, ohne eine zweite Anfrage
//   anzulegen. Fehlt nach einem Abbruch der Intake, ergänzt die
//   Wiederholung ihn (Intake-Primärschlüssel = Konversation, ebenfalls
//   eindeutig). Die Nonce ist ein Idempotenzschlüssel, kein Schutz gegen
//   Bots — dafür sind Honeypot und Rate-Limit da.
//
// Was hier bewusst NICHT passiert
//   * Kein KI-Aufruf. Die Anfrage landet unverändert im Posteingang.
//   * Kein Mandant, kein Bot, keine Einwilligung aus dem Request-Body: Der
//     Mandant kommt ausschließlich aus `resolve_site_inbox`. `einwilligung_at`
//     bleibt leer (offene Entscheidung, siehe PR).
//   * Der Terminwunsch ist ein Wunsch. Es wird nichts gebucht und nichts als
//     bestätigter Termin geführt.
//   * Keine Kontaktdaten in Logs. Geloggt werden nur Fehlercodes.

import { checkAnonRateLimit } from '../_shared/anonRateLimit.ts';

/** Obergrenze des Request-Bodys. Alle Felder zusammen liegen deutlich darunter. */
export const MAX_BODY_BYTES = 16 * 1024;

/** Feldgrenzen = CHECK-Constraints von `bot_conversation_intake`. */
export const LIMITS = {
  anliegen: 4000,
  kontakt_name: 200,
  kontakt_telefon: 50,
  kontakt_email: 320,
  terminwunsch: 500,
} as const;

/** Je Quelle (IP-Hash) und Seite: 5 Absendungen in 10 Minuten. */
export const RATE_LIMIT_PER_SOURCE = { max: 5, windowMs: 10 * 60_000, bucket: 'inbox-form:src' } as const;
/** Je Seite insgesamt: 30 Absendungen in 10 Minuten (bremst Fluten über viele Quellen). */
export const RATE_LIMIT_PER_SITE = { max: 30, windowMs: 10 * 60_000, bucket: 'inbox-form:site' } as const;

const SITE_REF_RE = /^[A-Za-z0-9_-]{24}$/;
const NONCE_RE = /^[A-Za-z0-9_-]{16,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\/.\- ]{5,50}$/;

/** Name des Honeypot-Felds (gleich wie im Governance-Scan, `funnel-lead.ts`). */
export const HONEYPOT_FIELD = 'company_website';

export interface FormInput {
  siteRef: string;
  nonce: string;
  anliegen: string;
  kontaktName: string | null;
  kontaktTelefon: string | null;
  kontaktEmail: string | null;
  terminwunsch: string | null;
  terminwunschZeit: string | null;
}

export type ValidationResult =
  | { ok: true; input: FormInput }
  | { ok: false; field: string };

export function isHoneypotTripped(body: Record<string, unknown>): boolean {
  const v = body[HONEYPOT_FIELD];
  return typeof v === 'string' && v.trim().length > 0;
}

/** Steuerzeichen außer Zeilenumbruch und Tab entfernen, Ränder trimmen. */
function clean(v: string): string {
  // deno-lint-ignore no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

/** Optionales Textfeld: fehlend/leer → null; falscher Typ oder zu lang → Fehler. */
function optionalText(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return undefined;
  const s = clean(v);
  if (s.length === 0) return null;
  return s.length > max ? undefined : s;
}

export function validateFormBody(body: Record<string, unknown>): ValidationResult {
  const siteRef = body.site_ref;
  if (typeof siteRef !== 'string' || !SITE_REF_RE.test(siteRef)) return { ok: false, field: 'site_ref' };

  const nonce = body.nonce;
  if (typeof nonce !== 'string' || !NONCE_RE.test(nonce)) return { ok: false, field: 'nonce' };

  const anliegen = optionalText(body.anliegen, LIMITS.anliegen);
  if (!anliegen) return { ok: false, field: 'anliegen' };

  const kontaktName = optionalText(body.kontakt_name, LIMITS.kontakt_name);
  if (kontaktName === undefined) return { ok: false, field: 'kontakt_name' };

  const kontaktTelefon = optionalText(body.kontakt_telefon, LIMITS.kontakt_telefon);
  if (kontaktTelefon === undefined || (kontaktTelefon !== null && !PHONE_RE.test(kontaktTelefon))) {
    return { ok: false, field: 'kontakt_telefon' };
  }

  const kontaktEmail = optionalText(body.kontakt_email, LIMITS.kontakt_email);
  if (kontaktEmail === undefined || (kontaktEmail !== null && !EMAIL_RE.test(kontaktEmail))) {
    return { ok: false, field: 'kontakt_email' };
  }

  // Ohne Rückkanal kann niemand die Anfrage beantworten.
  if (!kontaktTelefon && !kontaktEmail) return { ok: false, field: 'kontakt' };

  const terminwunsch = optionalText(body.terminwunsch, LIMITS.terminwunsch);
  if (terminwunsch === undefined) return { ok: false, field: 'terminwunsch' };

  let terminwunschZeit: string | null = null;
  if (body.terminwunsch_zeit !== undefined && body.terminwunsch_zeit !== null && body.terminwunsch_zeit !== '') {
    if (typeof body.terminwunsch_zeit !== 'string' || body.terminwunsch_zeit.length > 40) {
      return { ok: false, field: 'terminwunsch_zeit' };
    }
    const t = new Date(body.terminwunsch_zeit);
    if (Number.isNaN(t.getTime())) return { ok: false, field: 'terminwunsch_zeit' };
    terminwunschZeit = t.toISOString();
  }

  return {
    ok: true,
    input: {
      siteRef,
      nonce,
      anliegen,
      kontaktName,
      kontaktTelefon,
      kontaktEmail: kontaktEmail ? kontaktEmail.toLowerCase() : null,
      terminwunsch,
      terminwunschZeit,
    },
  };
}

/**
 * Rate-Limit vor jedem Datenbankzugriff. Zählt Quelle und Seite getrennt;
 * die Seite wird nur gezählt, wenn die Quelle noch Kontingent hat, damit eine
 * einzelne Quelle das Seitenkontingent nicht allein aufbraucht.
 */
export function checkFormRateLimit(sourceHash: string, siteRef: string): boolean {
  const perSource = checkAnonRateLimit(`${siteRef}:${sourceHash}`, RATE_LIMIT_PER_SOURCE);
  if (!perSource.allowed) return false;
  return checkAnonRateLimit(siteRef, RATE_LIMIT_PER_SITE).allowed;
}

/** `external_ref` der Konversation — Idempotenzschlüssel je Bot. */
export function formExternalRef(nonce: string): string {
  return `form:${nonce}`;
}

// ── Datenbank ────────────────────────────────────────────────────────────

type DbError = { code?: string; message?: string } | null;

/** Minimale Client-Form — supabase-js (service_role) erfüllt sie, Tests mocken sie. */
export interface InboxDbClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: DbError }>;
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(cols: string): { single(): PromiseLike<{ data: unknown; error: DbError }> };
    } & PromiseLike<{ error: DbError }>;
    select(cols: string): {
      eq(col: string, val: string): {
        eq(col: string, val: string): { maybeSingle(): PromiseLike<{ data: unknown; error: DbError }> };
      };
    };
  };
}

export interface ResolvedInbox {
  bindingId: string;
  tenantId: string;
  botId: string;
  websiteProjectId: string;
}

export type ResolveResult =
  | { ok: true; inbox: ResolvedInbox }
  | { ok: false; reason: 'not_found' | 'error'; code?: string };

/** Fail-closed: jede Abweichung (keine Zeile, Fehler, kaputte Form) → kein Eingang. */
export async function resolveInbox(db: InboxDbClient, siteRef: string): Promise<ResolveResult> {
  const { data, error } = await db.rpc('resolve_site_inbox', { p_site_ref: siteRef });
  if (error) return { ok: false, reason: 'error', code: error.code };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== 'object') return { ok: false, reason: 'not_found' };
  const r = row as Record<string, unknown>;
  const ids = [r.binding_id, r.tenant_id, r.bot_id, r.website_project_id];
  if (!ids.every((v) => typeof v === 'string' && v.length > 0)) return { ok: false, reason: 'error' };
  return {
    ok: true,
    inbox: {
      bindingId: r.binding_id as string,
      tenantId: r.tenant_id as string,
      botId: r.bot_id as string,
      websiteProjectId: r.website_project_id as string,
    },
  };
}

export type SubmitResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; reason: 'error'; stage: 'conversation' | 'lookup' | 'intake'; code?: string };

const UNIQUE_VIOLATION = '23505';

export async function submitFormRequest(
  db: InboxDbClient,
  inbox: ResolvedInbox,
  input: FormInput,
  now: Date,
): Promise<SubmitResult> {
  const externalRef = formExternalRef(input.nonce);
  const nowIso = now.toISOString();

  let conversationId: string | null = null;
  let duplicate = false;

  const conv = await db
    .from('bot_conversations')
    .insert({
      tenant_id: inbox.tenantId,
      bot_id: inbox.botId,
      channel: 'form',
      status: 'open',
      external_ref: externalRef,
      contact_label: input.kontaktName,
      last_message_at: nowIso,
      metadata: {
        source: 'site_form',
        site_inbox_binding_id: inbox.bindingId,
        website_project_id: inbox.websiteProjectId,
      },
    })
    .select('id')
    .single();

  if (conv.error) {
    if (conv.error.code !== UNIQUE_VIOLATION) {
      return { ok: false, reason: 'error', stage: 'conversation', code: conv.error.code };
    }
    // Gleiche Nonce schon angekommen: bestehende Konversation desselben Bots.
    duplicate = true;
    const existing = await db
      .from('bot_conversations')
      .select('id')
      .eq('bot_id', inbox.botId)
      .eq('external_ref', externalRef)
      .maybeSingle();
    const id = (existing.data as { id?: unknown } | null)?.id;
    if (existing.error || typeof id !== 'string') {
      return { ok: false, reason: 'error', stage: 'lookup', code: existing.error?.code };
    }
    conversationId = id;
  } else {
    const id = (conv.data as { id?: unknown } | null)?.id;
    if (typeof id !== 'string') return { ok: false, reason: 'error', stage: 'conversation' };
    conversationId = id;
  }

  const intake = await db.from('bot_conversation_intake').insert({
    conversation_id: conversationId,
    tenant_id: inbox.tenantId,
    anliegen: input.anliegen,
    kontakt_name: input.kontaktName,
    kontakt_telefon: input.kontaktTelefon,
    kontakt_email: input.kontaktEmail,
    terminwunsch: input.terminwunsch,
    terminwunsch_zeit: input.terminwunschZeit,
    quelle: 'form',
  });

  // 23505: Intake zu dieser Konversation existiert schon (Doppelabsendung).
  if (intake.error && intake.error.code !== UNIQUE_VIOLATION) {
    return { ok: false, reason: 'error', stage: 'intake', code: intake.error.code };
  }
  return { ok: true, duplicate };
}

/** Schalter: Ohne `INBOX_FORM_SUBMIT_ENABLED=true` nimmt die Function nichts an. */
export function formSubmitEnabled(flag: string | undefined | null): boolean {
  return flag === 'true';
}
