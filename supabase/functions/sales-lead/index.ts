// Sales-Lead-Capture for public conversion forms.
//
// POST /functions/v1/sales-lead (verify_jwt = false — public endpoint)
// Body: {
//   name?, email, company?, use_case?, message?, source?, intent?,
//   tier?, plan_key?, domains?, company_domain?, path?
// }
//
// Public leads are rate-limited, stored in public.sales_leads and optionally
// forwarded to the configured team webhook. Website-builder leads that
// explicitly requested the Starter offer also receive the three-month-free
// offer by email via the existing Resend configuration.
//
// Inquiry plans (purchaseMode === 'inquiry', e.g. enterprise / partner):
//   - plan_key is required (or tier that normalizes to a known inquiry key)
//   - source is normalized to `contact-sales`
// Non-inquiry callers (upgrade clicks, waitlist, starter offer) stay unchanged.
//
// ── Warteliste (mode='waitlist') ────────────────────────────────────────────
// Zusätzlich bedient dieser Endpunkt die Warteliste der Landingpage
// /warteliste. Das ist bewusst KEINE eigene Edge Function: das Supabase-
// Projekt hat sein Function-Limit erreicht, und ein bestehender öffentlicher
// Lead-Endpunkt deckt denselben Anwendungsfall ab (Kontaktdaten aus einem
// Landingpage-Formular). Eine eigene Function liesse sich nicht deployen.
//
//   POST /functions/v1/sales-lead        { mode: 'waitlist', email, … }
//        → { ok: true, position, already_registered? }
//   GET  /functions/v1/sales-lead?mode=waitlist
//        → { ok: true, count }   (nur die Summe, nie Einzeldaten)
//
// Wartelisten-Anmeldungen landen ausschliesslich in public.waitlist_signups —
// nie in sales_leads. Beide Pfade haben getrennte Rate-Limit-Budgets, damit
// eine Wartelisten-Anmeldung keine Sales-Anfrage blockiert und umgekehrt.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import {
  normalizePlanKey,
  planByKey,
  planById,
  publicLabelOf,
  computeQuote,
  quoteDimensionsFor,
  isQuotePlanId,
  type QuoteAnswers,
  type QuotePlanId,
} from '../_shared/pricing.generated.ts';
import { callProvider, ProviderError } from '../_shared/providers.ts';
import { getModelId } from '../_shared/modelSelection.ts';

// Preflight muss GET mit abdecken (Wartelisten-Zähler). Die bestehenden
// POST-Antworten behalten `corsHeaders` — der Unterschied ist ausschliesslich
// `Access-Control-Allow-Methods`, und das wertet der Browser nur auf die
// Preflight-Antwort aus. Bestehende Aufrufer sehen also unverändertes Verhalten.
const cors = buildCorsHeaders('GET, POST, OPTIONS');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = 'alerts@realsyncdynamicsai.de';

/** Max host length (DNS label budget) and list size for inquiry domains. */
const MAX_DOMAIN_LEN = 253;
const MAX_DOMAINS = 25;

/** Erlaubte Werte der Wartelisten-Spalten — Spiegel der CHECK-Constraints. */
// `bots` gehoert dazu, weil die Landingpage genau diesen Wert sendet
// (src/components/landing/WaitlistForm.tsx). Fehlte er hier, fiel jede
// Bot-Anmeldung auf `other` zurueck — ausgerechnet fuer das eine Modul, das
// noch nicht ausliefert und dessen Nachfrage gemessen werden sollte.
// ── Online-Preisrechner (/pricing/quote) ────────────────────────────────────

/** `source` jedes Leads aus dem Rechner. Der Submit-Schritt filtert darauf. */
const QUOTE_SOURCE = 'pricing-quote';

/** Ganzzahl aus beliebigem Input, auf ein Fenster geklemmt. */
function clampInt(raw: unknown, min: number, max: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.floor(n), min), max);
}

/**
 * Antworten aus dem Request in die Form bringen, die `computeQuote()` erwartet.
 *
 * Gibt `null` zurueck, wenn der Plan unbekannt ist — ein Betrag ohne Plan
 * haette keine Untergrenze. Alles andere wird bereinigt statt abgelehnt:
 * unbekannte Bausteine verwirft `computeQuote()` ohnehin, und ein Formular,
 * das ein Feld zu viel schickt, ist kein Angriff.
 */
function normalizeQuoteAnswers(raw: unknown): QuoteAnswers | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const planId = input.planId ?? input.plan_id;
  if (!isQuotePlanId(planId)) return null;

  const quantities: Record<string, number> = {};
  const rawQuantities = input.quantities;
  if (rawQuantities && typeof rawQuantities === 'object') {
    for (const [key, value] of Object.entries(rawQuantities as Record<string, unknown>)) {
      quantities[key.slice(0, 64)] = clampInt(value, 0, 1_000);
    }
  }

  const rawItems = input.contractItems ?? input.contract_items;
  const contractItems = Array.isArray(rawItems)
    ? rawItems.filter((v): v is string => typeof v === 'string').map((v) => v.slice(0, 64))
    : [];

  return { planId, quantities, contractItems };
}

interface QuoteQuestion {
  id: string;
  kind: 'addon' | 'contract';
  label: string;
  question: string;
  hint: string;
  unitEur: number;
  unit?: { label: string; step: string; max: number };
}

interface QuoteAiLog {
  generated: boolean;
  provider: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  reason?: string;
}

/**
 * Den individuellen Fragebogen erzeugen.
 *
 * Die KI formuliert die Fragen auf den geschilderten Kontext um — Branche,
 * Anzahl Organisationen, Sitz, Bestandssysteme. Was sie NICHT darf: eine
 * Dimension erfinden. Die erlaubten IDs kommen aus der Pricing-SSoT, und jede
 * zurueckgegebene ID, die nicht darin steht, wird verworfen. Ein Modell kann
 * so keinen Posten in den Preis schreiben, den es nicht gibt.
 *
 * Faellt der Provider aus oder ist kein Schluessel hinterlegt, bleibt es bei
 * den Standardfragen aus der SSoT. Die Seite funktioniert dann vollstaendig
 * weiter und nennt denselben Betrag — nur eben mit generischem Wortlaut. Das
 * ist der Grund, warum der Preis nicht aus dem Modell kommt.
 */
async function generateQuoteQuestions(
  planId: QuotePlanId,
  context: { industry: string; tenants: number; domains: number; country: string; systems: string },
  dimensions: ReturnType<typeof quoteDimensionsFor>,
): Promise<{ questions: QuoteQuestion[]; log: QuoteAiLog }> {
  const fallback: QuoteQuestion[] = dimensions.map((d) => ({
    id: d.id,
    kind: d.kind,
    label: d.label,
    question: d.question,
    hint: d.hint,
    unitEur: d.unitEur,
    unit: d.unit,
  }));

  const model = getModelId('haiku');
  const log: QuoteAiLog = { generated: false, provider: 'anthropic', model };

  const allowed = dimensions.map((d) => `${d.id} — ${d.label}`).join('\n');
  const systemPrompt = [
    'Du formulierst Fragen fuer einen Preisrechner einer EU-Governance-Plattform.',
    'Du bekommst eine feste Liste von Dimensionen. Formuliere zu JEDER Dimension',
    'genau eine Frage und einen kurzen Hinweis, zugeschnitten auf den Kontext des',
    'Interessenten (Branche, Groesse, Sitz, Bestandssysteme).',
    '',
    'Regeln:',
    '- Antworte ausschliesslich mit JSON: {"questions":[{"id":"...","question":"...","hint":"..."}]}',
    '- Verwende NUR die vorgegebenen ids. Erfinde keine.',
    '- Nenne KEINE Betraege, Preise oder Prozente. Der Preis wird nicht von dir berechnet.',
    '- Deutsch, Sie-Form, je Frage hoechstens 140 Zeichen, je Hinweis hoechstens 160.',
  ].join('\n');

  const userPrompt = [
    `Plan: ${planId}`,
    `Branche: ${context.industry || 'nicht angegeben'}`,
    `Organisationen/Mandanten: ${context.tenants || 'nicht angegeben'}`,
    `Domains: ${context.domains || 'nicht angegeben'}`,
    `Sitz: ${context.country || 'nicht angegeben'}`,
    `Bestandssysteme: ${context.systems || 'nicht angegeben'}`,
    '',
    'Dimensionen:',
    allowed,
  ].join('\n');

  try {
    const result = await callProvider({
      provider: 'anthropic',
      modelId: model,
      systemPrompt,
      userPrompt,
      maxTokens: 1_500,
      temperature: 0.5,
    });
    log.input_tokens = result.inputTokens;
    log.output_tokens = result.outputTokens;

    // Modelle rahmen JSON gern in Fliesstext. Den ersten Block nehmen statt
    // die Antwort zu verwerfen.
    const start = result.text.indexOf('{');
    const end = result.text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('keine JSON-Struktur in der Antwort');
    const parsed = JSON.parse(result.text.slice(start, end + 1)) as {
      questions?: Array<{ id?: unknown; question?: unknown; hint?: unknown }>;
    };

    const byId = new Map(fallback.map((q) => [q.id, q]));
    let replaced = 0;
    for (const item of parsed.questions ?? []) {
      const id = typeof item.id === 'string' ? item.id : '';
      const base = byId.get(id);
      // Unbekannte id → verwerfen. Das ist die Stelle, an der ein Modell
      // keinen eigenen Preisposten unterschieben kann.
      if (!base) continue;
      const question = typeof item.question === 'string' ? item.question.trim().slice(0, 200) : '';
      const hint = typeof item.hint === 'string' ? item.hint.trim().slice(0, 220) : '';
      if (!question) continue;
      byId.set(id, { ...base, question, hint: hint || base.hint });
      replaced += 1;
    }

    if (replaced === 0) throw new Error('keine verwertbare Frage in der Antwort');
    log.generated = true;
    // Reihenfolge der SSoT beibehalten — das Modell darf umformulieren,
    // nicht umsortieren.
    return { questions: fallback.map((q) => byId.get(q.id)!), log };
  } catch (err) {
    log.reason = err instanceof ProviderError ? `${err.code}: ${err.message}` : String(err);
    return { questions: fallback, log };
  }
}

const WAITLIST_INTERESTS = ['runtime', 'siteos', 'evidence', 'provenance', 'audit', 'bots', 'other'];
const WAITLIST_TEAM_SIZES = ['1-9', '10-49', '50-249', '250-999', '1000+'];
/** Wartelisten-Anmeldungen pro IP-Hash und Stunde. */
const WAITLIST_RATE_LIMIT = 5;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sendStarterOffer(email: string, name?: string | null, company?: string | null): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const greeting = name ? `Hallo ${name},` : 'Hallo,';
  const companyLine = company ? `<p>für <strong>${company}</strong> haben wir bereits den Website-Scan vorbereitet.</p>` : '';

  const html = `
    <html><body style="margin:0;background:#030712;color:#e5e7eb;font-family:Arial,sans-serif;line-height:1.6">
      <div style="max-width:620px;margin:0 auto;padding:32px 24px">
        <div style="border:1px solid #164e63;border-radius:16px;padding:28px;background:#07111f">
          <p style="color:#22d3ee;font-size:12px;letter-spacing:2px;font-weight:700">REALSYNCDYNAMICS.AI</p>
          <h1 style="font-size:30px;line-height:1.15;margin:18px 0 12px;color:#fff">Ihr Starter-Angebot: 3 Monate gratis</h1>
          <p>${greeting}</p>
          ${companyLine}
          <p>Sie haben Ihre Website prüfen lassen. Als nächsten Schritt bieten wir Ihnen das <strong>Starter-Paket für 3 Monate kostenlos</strong> an.</p>
          <p>Damit können Sie die nächsten Schritte aus dem Scan umsetzen und RealSyncDynamics.AI im laufenden Betrieb kennenlernen.</p>
          <p style="margin:28px 0"><a href="https://realsyncdynamicsai.de/pricing?offer=starter-3-months-free&utm_source=website-builder&utm_medium=email" style="display:inline-block;background:#22d3ee;color:#030712;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">Starter-Angebot ansehen</a></p>
          <p style="font-size:13px;color:#94a3b8">Wenn Sie diese E-Mails nicht mehr erhalten möchten, antworten Sie bitte auf diese Nachricht mit „Abmelden“.</p>
        </div>
        <p style="font-size:11px;color:#64748b;text-align:center;margin-top:18px">RealSync Dynamics.AI · EU-Hosting · DSGVO · EU AI Act</p>
      </div>
    </body></html>`;

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: email, subject: 'Ihr Starter-Angebot: 3 Monate gratis', html }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Resend API error: ${response.status} - ${await response.text()}`);
  }
}

/** Nur bekannte utm_*-Schlüssel übernehmen — kein Freitext-JSON aus dem Client. */
function pickUtm(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const val = (raw as Record<string, unknown>)[key];
    if (typeof val === 'string' && val.trim()) out[key] = val.trim().slice(0, 120);
  }
  return out;
}

/** Strip scheme/path/port noise; keep a host-like token capped at DNS length. */
function normalizeDomainHost(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.split(/[/?#]/)[0] ?? '';
  s = s.replace(/:\d+$/, '');
  s = s.slice(0, MAX_DOMAIN_LEN);
  return s || null;
}

/**
 * Accept `domains` as string (comma/whitespace/semicolon separated) or string[].
 * Dedupes, caps length and count. Empty input → [].
 */
function normalizeDomains(raw: unknown): string[] {
  const items: string[] = [];
  if (typeof raw === 'string') {
    for (const part of raw.split(/[\s,;]+/)) {
      if (part.trim()) items.push(part);
    }
  } else if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === 'string' && x.trim()) items.push(x);
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const host = normalizeDomainHost(item);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    out.push(host);
    if (out.length >= MAX_DOMAINS) break;
  }
  return out;
}

/** True when free-text fields signal Enterprise/Partner inquiry intent. */
function looksLikeEnterprisePartnerIntent(...parts: Array<string | null | undefined>): boolean {
  const hay = parts.filter(Boolean).join(' ').toLowerCase();
  return /\b(enterprise|partner|scale)\b/.test(hay);
}

function isContactSalesSource(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const s = raw.trim().toLowerCase();
  return s === 'contact-sales' || s === 'contact_sales';
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req, cors); if (preflight) return preflight;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const url = new URL(req.url);

  // ── GET ?mode=waitlist — aggregierter Zähler für die Landingpage ──────────
  // Liefert nur die Summe. Die Seite blendet den Zähler aus, wenn dieser Call
  // fehlschlägt — es wird nie eine Zahl geraten.
  if (req.method === 'GET') {
    if (url.searchParams.get('mode') !== 'waitlist') {
      return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only', cors);
    }
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { count, error } = await admin
      .from('waitlist_signups')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'invited', 'converted']);
    if (error) return jsonError(500, 'INTERNAL', error.message, cors);
    return jsonResponse({ ok: true, count: count ?? 0 }, 200, cors);
  }

  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only', cors);

  const text = await req.text();
  if (text.length > 8192) return jsonError(413, 'BODY_TOO_LARGE', 'max 8 KB');

  let body: {
    mode?: string;
    name?: string;
    email?: string;
    company?: string;
    use_case?: string;
    message?: string;
    source?: string;
    intent?: string;
    tier?: string;
    plan_key?: string;
    domains?: string | string[];
    company_domain?: string;
    path?: string;
    role?: string;
    team_size?: string;
    note?: string;
    referrer?: string;
    utm?: unknown;
    // mode='quote' (Online-Preisrechner). `domain_count` heisst bewusst nicht
    // `domains`: dieses Feld fuehrt oben eine Liste von Hostnamen, hier ist
    // eine Anzahl gemeint.
    action?: string;
    lead_id?: string;
    answers?: unknown;
    industry?: string;
    tenants?: number | string;
    domain_count?: number | string;
    country?: string;
    systems?: string;
  };
  try { body = JSON.parse(text); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return jsonError(400, 'INVALID_EMAIL', 'valid email required');
  if (email.length > 254) return jsonError(400, 'INVALID_EMAIL', 'email too long');

  const cap = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : null);
  // Wie cap(), aber Leerstring → null. Nur im Wartelisten-Zweig verwendet;
  // cap() bleibt unverändert, damit der bestehende Sales-Pfad exakt gleich bleibt.
  const capOrNull = (s: unknown, max: number) => cap(s, max) || null;
  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await sha256Hex(ipHeader);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // ── POST mode=waitlist — Anmeldung auf der Warteliste ─────────────────────
  // Eigener Zweig mit eigenem Rate-Limit-Budget; schreibt nie nach sales_leads,
  // damit die Sales-Pipeline nicht mit Wartelisten-Einträgen vermischt wird.
  if (body.mode === 'waitlist') {
    const { count: recent } = await admin
      .from('waitlist_signups').select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash).gte('created_at', oneHourAgo);
    if ((recent ?? 0) >= WAITLIST_RATE_LIMIT) {
      return jsonError(429, 'RATE_LIMITED', 'Zu viele Anmeldungen. Bitte später erneut versuchen.', cors);
    }

    const interestRaw = capOrNull(body.use_case, 32) ?? 'runtime';
    const interest = WAITLIST_INTERESTS.includes(interestRaw) ? interestRaw : 'other';
    const teamSizeRaw = capOrNull(body.team_size, 16);
    const teamSize = teamSizeRaw && WAITLIST_TEAM_SIZES.includes(teamSizeRaw) ? teamSizeRaw : null;

    // Idempotent: doppeltes Absenden ist kein Fehlerfall, sondern liefert die
    // bereits vergebene Position zurück.
    const { data: existing } = await admin
      .from('waitlist_signups').select('position')
      .eq('email', email).in('status', ['pending', 'invited', 'converted']).maybeSingle();
    if (existing) {
      return jsonResponse({ ok: true, position: existing.position, already_registered: true }, 200, cors);
    }

    const { data: row, error: wlError } = await admin.from('waitlist_signups').insert({
      email,
      company: capOrNull(body.company, 160),
      role: capOrNull(body.role, 120),
      interest,
      team_size: teamSize,
      note: capOrNull(body.note, 2000),
      source: capOrNull(body.source, 64) ?? 'warteliste',
      referrer: capOrNull(body.referrer, 500),
      utm: pickUtm(body.utm),
      ip_hash: ipHash,
      user_agent: capOrNull(req.headers.get('user-agent'), 500),
    }).select('position').single();

    if (wlError) {
      // Race: zwei parallele Requests derselben Adresse — der Unique-Index greift.
      if (wlError.code === '23505') {
        const { data: raced } = await admin
          .from('waitlist_signups').select('position')
          .eq('email', email).in('status', ['pending', 'invited', 'converted']).maybeSingle();
        if (raced) {
          return jsonResponse({ ok: true, position: raced.position, already_registered: true }, 200, cors);
        }
      }
      return jsonError(500, 'INTERNAL', wlError.message, cors);
    }

    return jsonResponse({ ok: true, position: row!.position }, 200, cors);
  }

  const { count } = await admin.from('sales_leads').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', oneHourAgo);
  if ((count ?? 0) >= 5) return jsonError(429, 'RATE_LIMITED', 'too many submissions, retry later');

  // ── POST mode=quote — Online-Rechner fuer Enterprise / Enterprise Plus ────
  //
  // Zwei Schritte, beide ueber diesen Zweig:
  //
  //   action='start'   Kontext rein → Lead anlegen, KI erzeugt den
  //                    individuellen Fragebogen, Fragen raus.
  //   action='submit'  Antworten rein → Betrag NEU rechnen, an denselben Lead
  //                    schreiben, Betrag raus.
  //
  // Warum der Betrag hier noch einmal gerechnet wird, obwohl die Seite ihn
  // schon anzeigt: was der Browser schickt, ist eine Behauptung. Beide Seiten
  // rufen `computeQuote()` aus derselben SSoT auf — weicht das Ergebnis ab,
  // gilt dieses hier, und die Antwort sagt es der Seite ausdruecklich.
  //
  // Warum kein eigener Endpunkt: das Supabase-Projekt ist beim
  // Function-Kontingent angestossen (siehe Kopf dieser Datei), und ein Lead
  // aus einem Preisrechner ist genau das, was diese Function ohnehin tut —
  // inklusive Rate-Limit, IP-Hash und `sales_leads`.
  if (body.mode === 'quote') {
    const action = body.action === 'submit' ? 'submit' : 'start';

    // ── submit ────────────────────────────────────────────────────────────
    if (action === 'submit') {
      const leadId = cap(body.lead_id, 64);
      if (!leadId) return jsonError(400, 'MISSING_LEAD', 'lead_id fehlt', cors);

      const answers = normalizeQuoteAnswers(body.answers);
      if (!answers) return jsonError(400, 'INVALID_ANSWERS', 'answers unvollstaendig oder unbekannter Plan', cors);

      const quote = computeQuote(answers);

      // Der Lead muss existieren UND aus dem Rechner stammen. Ohne die
      // zweite Bedingung liesse sich jeder fremde Lead mit einem Betrag
      // ueberschreiben, dessen ID man erraten hat.
      const { data: lead } = await admin
        .from('sales_leads').select('id, email, metadata')
        .eq('id', leadId).eq('source', QUOTE_SOURCE).maybeSingle();
      if (!lead) return jsonError(404, 'LEAD_NOT_FOUND', 'Fragebogen nicht gefunden', cors);

      const previous = (lead.metadata ?? {}) as Record<string, unknown>;
      const previousQuote = (previous.quote ?? {}) as Record<string, unknown>;
      const { error: updErr } = await admin
        .from('sales_leads')
        .update({
          plan_key: quote.planKey,
          metadata: {
            ...previous,
            quote: {
              ...previousQuote,
              status: 'requested',
              plan_id: quote.planId,
              plan_key: quote.planKey,
              public_label: quote.publicLabel,
              base_monthly_eur: quote.baseMonthlyEur,
              monthly_eur: quote.monthlyEur,
              lines: quote.lines,
              contract_items: quote.contractItems.map((c) => c.id),
              answers,
              fingerprint: quote.fingerprint,
              requested_at: new Date().toISOString(),
            },
          },
        })
        .eq('id', leadId);
      if (updErr) return jsonError(500, 'INTERNAL', updErr.message, cors);

      return jsonResponse({ ok: true, lead_id: leadId, quote }, 200, cors);
    }

    // ── start ─────────────────────────────────────────────────────────────
    const planId = typeof body.tier === 'string' ? body.tier.trim() : '';
    if (!isQuotePlanId(planId)) {
      return jsonError(400, 'INVALID_TIER', 'tier muss enterprise oder partner sein', cors);
    }

    const context = {
      industry: cap(body.industry, 120) ?? '',
      tenants: clampInt(body.tenants, 0, 10_000),
      domains: clampInt(body.domain_count, 0, 100_000),
      country: cap(body.country, 120) ?? '',
      systems: cap(body.systems, 1_000) ?? '',
    };

    const dimensions = quoteDimensionsFor(planId);
    const ai = await generateQuoteQuestions(planId, context, dimensions);

    const { data: lead, error: insErr } = await admin
      .from('sales_leads')
      .insert({
        email,
        company: cap(body.company, 200),
        name: cap(body.name, 200),
        source: QUOTE_SOURCE,
        use_case: 'pricing_quote',
        plan_key: planById(planId).planKey,
        path: cap(body.path, 500),
        user_agent: cap(req.headers.get('user-agent'), 500),
        ip_hash: ipHash,
        message: `Preisrechner ${publicLabelOf(planById(planId))} — Kontext: ${JSON.stringify(context).slice(0, 3_000)}`,
        metadata: {
          quote: {
            status: 'started',
            plan_id: planId,
            public_label: publicLabelOf(planById(planId)),
            base_monthly_eur: planById(planId).price.monthlyEur,
            context,
            questionnaire: ai.questions,
            // Der AI-Call wird mit dem Lead protokolliert: Anbieter, Modell,
            // Tokens und — falls er scheiterte — der Grund. Ohne diese Zeile
            // gaebe es einen Provider-Call ohne Spur.
            ai: ai.log,
            started_at: new Date().toISOString(),
          },
        },
      })
      .select('id')
      .single();
    if (insErr) return jsonError(500, 'INTERNAL', insErr.message, cors);

    return jsonResponse(
      {
        ok: true,
        lead_id: lead!.id,
        plan_id: planId,
        questions: ai.questions,
        ai_generated: ai.log.generated,
      },
      200,
      cors,
    );
  }


  const intent = cap(body.intent, 100);
  const tier = cap(body.tier, 50);
  const rawPlanKey = cap(body.plan_key, 64);
  const name = cap(body.name, 200);
  const company = cap(body.company, 200);
  const useCase = cap(body.use_case, 50);

  // Resolve canonical plan_key: explicit plan_key wins; else map tier when it
  // is a known key (scale→partner). Unknown free-text tiers stay as metadata.tier only.
  let planKey: string | null = null;
  if (rawPlanKey) {
    planKey = normalizePlanKey(rawPlanKey);
    if (!planKey) {
      return jsonError(400, 'INVALID_PLAN_KEY', `unbekannter plan_key: ${rawPlanKey}`, cors);
    }
  } else if (tier) {
    planKey = normalizePlanKey(tier);
  }

  const plan = planKey ? planByKey(planKey) : null;
  const isInquiryPlan = plan?.purchaseMode === 'inquiry';

  const sourceRaw = cap(body.source, 200);
  const contactSalesInquiry =
    isContactSalesSource(sourceRaw) &&
    looksLikeEnterprisePartnerIntent(intent, useCase, tier, rawPlanKey);

  // Enforce inquiry contract only when inquiry intent is present — never for
  // waitlist (handled above), starter offer, or generic upgrade/contact forms
  // that omit plan_key and do not signal enterprise/partner.
  if (isInquiryPlan || contactSalesInquiry) {
    if (!planKey) {
      return jsonError(400, 'PLAN_KEY_REQUIRED', 'plan_key required for inquiry leads', cors);
    }
    if (!isInquiryPlan) {
      return jsonError(
        400,
        'INVALID_PLAN_KEY',
        `plan_key ${planKey} is not an inquiry plan`,
        cors,
      );
    }
  }

  // Inquiry leads always land under contact-sales (accept + normalize).
  const source = isInquiryPlan || contactSalesInquiry
    ? 'contact-sales'
    : sourceRaw;

  const domains = normalizeDomains(body.domains);
  const companyDomainExplicit = typeof body.company_domain === 'string'
    ? normalizeDomainHost(body.company_domain)
    : null;
  const companyDomain = companyDomainExplicit ?? (domains[0] ?? null);
  // If company_domain was the only input, mirror it into domains for indexing.
  const domainsPersisted = domains.length > 0
    ? domains
    : (companyDomain ? [companyDomain] : []);

  const metadata: Record<string, unknown> = {
    ...(intent ? { intent } : {}),
    ...(tier ? { tier } : {}),
    ...(planKey ? { plan_key: planKey } : {}),
    ...(domainsPersisted.length ? { domains: domainsPersisted } : {}),
    ...(companyDomain ? { company_domain: companyDomain } : {}),
    ...(body.source === 'unified-entry' ? { marketing_consent: true } : {}),
  };

  const { data, error } = await admin.from('sales_leads').insert({
    name,
    email,
    company,
    use_case: useCase,
    message: cap(body.message, 4000),
    source,
    path: cap(body.path, 500),
    user_agent: cap(req.headers.get('user-agent'), 500),
    ip_hash: ipHash,
    company_domain: companyDomain,
    domains: domainsPersisted,
    metadata,
  }).select('id, created_at').single();

  if (error) return jsonError(500, 'INTERNAL', error.message);

  if (body.source === 'unified-entry' && intent === 'starter_3_months_free' && tier === 'starter') {
    try {
      await sendStarterOffer(email, name, company);
    } catch (emailError) {
      console.error('starter offer email failed:', emailError);
      // The lead is already safely captured. Do not turn an email-provider
      // failure into a lost lead or a duplicate form submission.
    }
  }

  const webhook = Deno.env.get('SALES_LEAD_WEBHOOK_URL');
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🎯 New sales lead\nEmail: ${email}\n` +
            (body.name ? `Name: ${body.name}\n` : '') +
            (body.company ? `Company: ${body.company}\n` : '') +
            (body.use_case ? `Use case: ${body.use_case}\n` : '') +
            (body.message ? `Message: ${body.message.slice(0, 500)}\n` : '') +
            (source ? `Source: ${source}\n` : '') +
            (intent ? `Intent: ${intent}\n` : '') +
            (tier ? `Tier: ${tier}\n` : '') +
            (planKey ? `Plan: ${planKey}\n` : '') +
            (companyDomain ? `Domain: ${companyDomain}\n` : '') +
            (domainsPersisted.length > 1 ? `Domains: ${domainsPersisted.join(', ')}\n` : '') +
            (body.path ? `Path: ${body.path}\n` : ''),
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      console.error('webhook failed:', (e as Error).message);
    }
  }

  return jsonResponse({
    ok: true,
    id: data?.id,
    created_at: data?.created_at,
    plan_key: planKey ?? undefined,
    offer_email_queued: body.source === 'unified-entry' && intent === 'starter_3_months_free',
  });
});
