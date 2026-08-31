// DSGVO-Audit-Tool — Lead-Magnet auf /audit (Chat-Hero + Klassisches Formular).
// Public endpoint — verify_jwt is disabled per-function via deploy.yml.
//
// POST /functions/v1/gdpr-audit   (verify_jwt = false; public endpoint)
// Body: { url: string, email?: string, company?: string, plan?: string, source?: string }
//
// The public optimizer path intentionally supports domain-only scans without
// collecting an email. Lead/audit email capture remains mandatory for the
// classic /audit lead-magnet path.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { evaluateAll, RULE_ENGINE_VERSION } from '../_shared/rules/evaluator.ts';
import { assessScanCoverage } from '../_shared/scan-coverage.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
// Die Pruef- und Bewertungslogik liegt bewusst in einem eigenen, Deno-freien
// Modul: So laesst sie sich aus Vitest heraus testen. Dass sie hier fehlte
// und niemand es merkte, war die Ursache des Ausfalls seit 2026-08-19.
import { runChecks, extractFacts, scoreReport, findPrivacyLink, type Issue } from './checks.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com','yahoo.com','outlook.com','hotmail.com','gmx.de','gmx.net',
  'web.de','icloud.com','live.com','protonmail.com','t-online.de',
]);
const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Abruf mit harter Zeitgrenze. Ohne sie haelt eine Zielseite, die nie
 * antwortet, die Edge Function bis zum Plattform-Timeout fest und der
 * Besucher sieht nur eine haengende Anzeige.
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // Ohne erkennbaren User-Agent liefern viele Seiten eine
        // Bot-Abwehrseite statt ihres echten Markups — der Scan wuerde dann
        // die Abwehrseite bewerten.
        'user-agent': 'Mozilla/5.0 (compatible; RealSyncDynamicsAI-Audit/1.0; +https://realsyncdynamicsai.de/methodik)',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'de-DE,de;q=0.9,en;q=0.8',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Fuegt die gelesenen Body-Chunks zu einem Puffer zusammen. */
function concat(chunks: Uint8Array[]): Uint8Array {
  const gesamt = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(gesamt);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.byteLength; }
  return out;
}

/**
 * Prueft die beiden Pflichtunterseiten, die von der Startseite verlinkt sind.
 *
 * Der Free Audit bleibt bewusst flach: nur Impressum und Datenschutz, nur
 * wenn verlinkt, mit kurzer Zeitgrenze. Ein tiefer Crawl gehoert in den
 * bezahlten Scan und waere hier ein unangekuendigter Lastfaktor auf fremden
 * Servern.
 */
async function scanSubpages(url: string, html: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const privacyHref = findPrivacyLink(html);
  if (!privacyHref) return issues;

  let ziel: string;
  try { ziel = new URL(privacyHref, url).toString(); } catch { return issues; }
  // Nur auf derselben Site — ein externer Link ist nicht unsere Pruefflaeche.
  try {
    if (new URL(ziel).hostname !== new URL(url).hostname) return issues;
  } catch { return issues; }

  try {
    const resp = await fetchWithTimeout(ziel, 8_000);
    if (!resp.ok) return issues;
    const text = (await resp.text()).slice(0, 500_000);

    // Positivbefund: Die Rule Engine fragt `page.privacy_policy.mentions_avv`
    // ab, und `extractFacts` liest den Wert aus genau dieser Kennung.
    if (/auftragsverarbeit|auftragsdatenverarbeit|art\.?\s*28\s*dsgvo|\bavv\b/i.test(text)) {
      issues.push({
        id: 'privacy_mentions_avv',
        severity: 'info',
        title: 'Auftragsverarbeitung in der Datenschutzerklaerung erwaehnt',
        detail: 'Die Datenschutzerklaerung nennt die Auftragsverarbeitung nach Art. 28 DSGVO.',
      });
    }

    if (!/verantwortlich|controller/i.test(text)) {
      issues.push({
        id: 'privacy_no_controller',
        severity: 'medium',
        title: 'Verantwortlicher nicht benannt',
        detail: 'In der Datenschutzerklaerung wurde keine Angabe zum Verantwortlichen gefunden.',
        paragraph_ref: 'Art. 13 Abs. 1 lit. a DSGVO',
      });
    }

    if (!/betroffenenrecht|auskunftsrecht|widerspruchsrecht|recht auf loeschung|recht auf löschung/i.test(text)) {
      issues.push({
        id: 'privacy_no_data_subject_rights',
        severity: 'medium',
        title: 'Betroffenenrechte nicht aufgefuehrt',
        detail: 'Die Datenschutzerklaerung nennt keine Betroffenenrechte (Auskunft, Loeschung, Widerspruch).',
        paragraph_ref: 'Art. 13 Abs. 2 lit. b DSGVO',
      });
    }
  } catch {
    // Unterseite nicht lesbar — kein Befund. Ein Timeout auf einer
    // Unterseite ist kein Datenschutzmangel und darf den Score nicht druecken.
  }
  return issues;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let body: { url?: string; email?: string; company?: string; plan?: string; source?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const url = (body.url ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const company = (body.company ?? '').trim().slice(0, 200) || null;
  const isOptimizerScan = body.source === 'optimizer';

  const ALLOWED_PLANS = new Set(['free', 'starter', 'growth', 'agency', 'enterprise']);
  const planRaw = (body.plan ?? '').trim().toLowerCase();
  const plan = ALLOWED_PLANS.has(planRaw) ? planRaw : null;
  const sourceTag = (body.source ?? '').trim().slice(0, 200) || null;
  const leadSource = sourceTag ?? 'audit_lp';

  if (!url || !URL_RE.test(url)) return jsonError(400, 'INVALID_URL', 'valid http(s) URL required');
  if (!isOptimizerScan && (!email || !EMAIL_RE.test(email))) {
    return jsonError(400, 'INVALID_EMAIL', 'valid email required');
  }
  if (email.length > 254) return jsonError(400, 'INVALID_EMAIL', 'email too long');
  if (url.length > 1000) return jsonError(400, 'INVALID_URL', 'url too long');

  // Reject email addresses submitted as URL, and free-email domains
  let parsedHost = '';
  try { parsedHost = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* handled below */ }
  if (EMAIL_RE.test(parsedHost) || FREE_EMAIL_DOMAINS.has(parsedHost)) {
    return jsonError(400, 'INVALID_URL', 'E-Mail-Adressen können nicht geprüft werden. Bitte Domain angeben.');
  }
  if (parsedHost === 'localhost' || IP_RE.test(parsedHost)) {
    return jsonError(400, 'INVALID_URL', 'Lokale Adressen und IP-Adressen sind nicht erlaubt.');
  }

  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await sha256Hex(ipHeader);

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // Rate-limit: 5 audits per ip_hash per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('gdpr_audits').select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', oneHourAgo);
  if ((count ?? 0) >= 5) return jsonError(429, 'RATE_LIMITED', 'too many audits, retry later');

  let domain = '';
  try { domain = new URL(url).hostname.toLowerCase(); }
  catch { return jsonError(400, 'INVALID_URL', 'unparsable url'); }

  // Fetch target — 10s timeout, max 1MB
  let html = '';
  let status: number | null = null;
  let headers: Headers | null = null;
  let fetchError: string | null = null;
  try {
    const resp = await fetchWithTimeout(url, 10_000);
    status = resp.status;
    headers = resp.headers;
    if (resp.ok || (status >= 300 && status < 400)) {
      const reader = resp.body?.getReader();
      if (reader) {
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (total < 1_000_000) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
          total += value.byteLength;
        }
        await reader.cancel();
        html = new TextDecoder('utf-8', { fatal: false }).decode(concat(chunks));
      }
    }
  } catch (e) {
    fetchError = (e as Error).message ?? 'fetch failed';
  }

  const issues: Issue[] = runChecks(url, html, headers, status, fetchError);
  const subpages = await scanSubpages(url, html);
  for (const sub of subpages) issues.push(sub);

  if (status !== null && !fetchError) {
    const facts = extractFacts(url, html, headers, issues);
    const ruleFindings = evaluateAll(facts);
    for (const f of ruleFindings) {
      const dupKey = `rule:${f.rule_id}`;
      if (issues.some((i) => i.id === dupKey)) continue;
      issues.push({
        id: dupKey,
        severity: f.severity,
        title: f.title,
        detail: `${f.description} · Quelle: Rule Engine ${RULE_ENGINE_VERSION}.`,
        paragraph_ref: f.norms.join(' · '),
      });
    }
  }

  const coverageInfo = assessScanCoverage(html, status, fetchError);
  if (coverageInfo.coverage === 'limited' && coverageInfo.reason === 'client_rendered_shell') {
    issues.push({
      id: 'scan_coverage_limited',
      severity: 'info',
      title: 'Scan-Reichweite eingeschränkt (client-gerenderte Seite)',
      detail: coverageInfo.notice!,
    });
  }

  const { score, severity } = scoreReport(issues);

  // Only lead-magnet submissions create sales_leads. The optimizer performs a
  // domain-only public scan and must never require or invent an email address.
  const planTag = plan ? ` · plan=${plan}` : '';
  let leadId: string | null = null;
  if (!isOptimizerScan) {
    const { data: leadRow } = await admin.from('sales_leads').insert({
      name: null,
      email,
      company,
      use_case: 'compliance',
      message: `Audit-LP: ${url} → score ${score}/100 (${severity})${planTag}`,
      source: leadSource,
      path: '/audit',
      user_agent: req.headers.get('user-agent')?.slice(0, 500),
      ip_hash: ipHash,
    }).select('id').single();
    leadId = leadRow?.id ?? null;
  }

  const { data: auditRow, error: auditErr } = await admin.from('gdpr_audits').insert({
    url,
    domain,
    email: email || null,
    company,
    score,
    severity,
    issues: issues as unknown as Record<string, unknown>[],
    fetched_status: status,
    fetched_html_bytes: html.length,
    fetched_at: status !== null ? new Date().toISOString() : null,
    fetch_error: fetchError,
    user_agent: req.headers.get('user-agent')?.slice(0, 500),
    ip_hash: ipHash,
    sales_lead_id: leadId,
  }).select('id').single();
  if (auditErr) return jsonError(500, 'INTERNAL', auditErr.message);

  return jsonResponse({
    ok: true,
    audit_id: auditRow!.id,
    created_at: new Date().toISOString(),
    email: email || null,
    score,
    severity,
    domain,
    issues,
    fetched_status: status,
    fetched: status !== null && fetchError === null,
    fetch_error: fetchError,
    coverage: coverageInfo.coverage,
    coverage_notice: coverageInfo.notice,
    methodology: {
      audit_engine: '2026.05.1',
      rule_engine: RULE_ENGINE_VERSION,
    },
  });
});

// ─── Heuristik-Checks ─────────────────────────────────────────────────────

