// DSGVO-Audit-Tool — Lead-Magnet auf /audit (Chat-Hero + Klassisches Formular).
// Public endpoint — verify_jwt is disabled per-function via deploy.yml.
//
// POST /functions/v1/gdpr-audit   (verify_jwt = false; public endpoint)
// Body: { url: string, email: string, company?: string, plan?: string, source?: string }
//
// 1. Validate inputs + rate-limit (5/h per IP-hash, like sales-lead)
// 2. Fetch target URL server-side (no CORS)
// 3. Run heuristic checks against headers + HTML
// 4. Score 0-100, classify severity
// 5. Insert sales_leads row (source='audit_lp' default, overridden when caller
//    provides one — e.g. 'pricing' from /audit?plan=agency&source=pricing) +
//    gdpr_audits row. Plan tag is appended to the lead message for downstream
//    routing without requiring a schema change.
// 6. Return report JSON for UI display

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { evaluateAll, RULE_ENGINE_VERSION } from '../_shared/rules/evaluator.ts';
import { isLikelyGermanJurisdiction } from '../_shared/jurisdiction.ts';
import { stripPolicyDeclarations, effectiveCspValue } from '../_shared/tracker-detection.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  paragraph_ref?: string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let body: { url?: string; email?: string; company?: string; plan?: string; source?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const url = (body.url ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const company = (body.company ?? '').trim().slice(0, 200) || null;

  const ALLOWED_PLANS = new Set(['free', 'starter', 'growth', 'agency', 'enterprise']);
  const planRaw = (body.plan ?? '').trim().toLowerCase();
  const plan = ALLOWED_PLANS.has(planRaw) ? planRaw : null;
  const sourceTag = (body.source ?? '').trim().slice(0, 200) || null;
  const leadSource = sourceTag ?? 'audit_lp';

  if (!url || !URL_RE.test(url))     return jsonError(400, 'INVALID_URL', 'valid http(s) URL required');
  if (!email || !EMAIL_RE.test(email)) return jsonError(400, 'INVALID_EMAIL', 'valid email required');
  if (email.length > 254)               return jsonError(400, 'INVALID_EMAIL', 'email too long');
  if (url.length > 1000)                return jsonError(400, 'INVALID_URL', 'url too long');

  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await sha256Hex(ipHeader);

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // Rate-limit: 5 audits per ip_hash per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('gdpr_audits').select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', oneHourAgo);
  if ((count ?? 0) >= 5) return jsonError(429, 'RATE_LIMITED', 'too many audits, retry later');

  // Parse domain
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

  // Scan subpages (/datenschutz + /impressum) — best-effort, non-blocking.
  // Findings are merged into the issue list with prefixed IDs to avoid
  // collisions with homepage findings.
  const subpages = await scanSubpages(url, html);
  for (const sub of subpages) issues.push(sub);

  // Rule Engine pass — additive zur bestehenden runChecks-Logik.
  // Evaluiert versionierte JSON-Regeln aus _shared/rules/{gdpr,ai-act}.json
  // gegen extrahierte facts. Findings werden in das Issue-Format konvertiert
  // und an die bestehenden Issues angehängt. Engine-Version landet in der
  // Response für Reproduzierbarkeit.
  if (status !== null && !fetchError) {
    const facts = extractFacts(url, html, headers, issues);
    const ruleFindings = evaluateAll(facts);
    for (const f of ruleFindings) {
      // Skip duplicates (Rule Engine kann ID-Overlap mit hardcoded checks haben)
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

  const { score, severity } = scoreReport(issues);

  // Insert sales_lead — preserve plan/source attribution from caller
  // (e.g. /audit?plan=agency&source=pricing) so /pricing-driven leads stay
  // distinguishable from generic free-audit signups in the inbox.
  const planTag = plan ? ` · plan=${plan}` : '';
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

  // Insert audit row
  const { data: auditRow, error: auditErr } = await admin.from('gdpr_audits').insert({
    url,
    domain,
    email,
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
    sales_lead_id: leadRow?.id ?? null,
  }).select('id').single();
  if (auditErr) return jsonError(500, 'INTERNAL', auditErr.message);

  return json({
    ok: true,
    audit_id: auditRow!.id,
    score,
    severity,
    domain,
    issues,
    fetched_status: status,
    fetched: status !== null && fetchError === null,
    fetch_error: fetchError,
    methodology: {
      // 2026.05.1 — Tracker-Detection ignoriert CSP-Allowlist + Resource-Hints
      // (Fix gegen identische False-Positive-Befunde / fixen 28/100-Score).
      audit_engine: '2026.05.1',
      rule_engine: RULE_ENGINE_VERSION,
    },
  });
});

// ─── Heuristik-Checks ─────────────────────────────────────────────────────

function runChecks(url: string, html: string, h: Headers | null, status: number | null, fetchError: string | null): Issue[] {
  const issues: Issue[] = [];
  const lc = html.toLowerCase();

  if (fetchError || status === null) {
    issues.push({
      id: 'fetch_failed',
      severity: 'high',
      title: 'Site nicht erreichbar',
      detail: `Wir konnten Deine Seite nicht laden: ${fetchError ?? 'unknown'}. Wenn die Site live ist, prüfe DNS / Firewall / WAF-Block.`,
    });
    return issues;
  }

  if (status >= 400) {
    issues.push({
      id: 'http_error',
      severity: 'high',
      title: `HTTP ${status} bei Page-Aufruf`,
      detail: 'Die Site liefert einen Fehler-Status. Audit war eingeschränkt.',
    });
  }

  // ── HTTPS + Security Headers ──
  if (!url.startsWith('https://')) {
    issues.push({
      id: 'no_https',
      severity: 'critical',
      title: 'Keine HTTPS-Verschlüsselung',
      detail: 'Datenübertragung im Klartext = direkter DSGVO Art. 32 Verstoß. „Stand der Technik" verlangt TLS.',
      paragraph_ref: 'DSGVO Art. 32 Abs. 1 lit. a',
    });
  }
  if (!h?.get('strict-transport-security')) {
    issues.push({
      id: 'no_hsts',
      severity: 'medium',
      title: 'HSTS-Header fehlt',
      detail: 'Strict-Transport-Security verhindert Downgrade-Angriffe auf HTTP. Empfohlen: max-age=31536000; includeSubDomains.',
    });
  }
  // CSP zählt auch, wenn per <meta http-equiv="Content-Security-Policy">
  // ausgeliefert — der Browser setzt das für script-src/style-src/etc. durch
  // (relevant z. B. bei GitHub-Pages-Hosting, wo keine HTTP-Header gesetzt
  // werden können). Nur frame-ancestors/sandbox/report-uri wirken per Meta
  // nicht — der Clickjacking-Check unten bleibt deshalb header-basiert.
  const cspValue = effectiveCspValue(h?.get('content-security-policy'), html);
  if (!cspValue) {
    issues.push({
      id: 'no_csp',
      severity: 'low',
      title: 'Content-Security-Policy fehlt',
      detail: 'CSP-Header verhindert XSS und unautorisierte Tracker. Wichtig wenn Du externe Skripte einbettest.',
    });
  }
  if (!h?.get('x-frame-options') && !h?.get('content-security-policy')?.toLowerCase().includes('frame-ancestors')) {
    issues.push({
      id: 'no_xframe',
      severity: 'low',
      title: 'Clickjacking-Schutz fehlt',
      detail: 'X-Frame-Options oder CSP frame-ancestors fehlt — fremde Seiten können Deine Site iframen.',
    });
  }

  // ── DSGVO-Pflichtelemente ──
  if (!/datenschutz|privacy/i.test(html)) {
    issues.push({
      id: 'no_privacy_link',
      severity: 'critical',
      title: 'Kein Datenschutz-Link gefunden',
      detail: 'Datenschutzerklärung ist Pflicht (Art. 13 DSGVO). Im Footer / Hauptnavigation muss ein Link vorhanden sein.',
      paragraph_ref: 'DSGVO Art. 13',
    });
  }
  if (!/impressum|imprint/i.test(html)) {
    // § 5 TMG / § 18 MStV sind deutsches Recht — gilt nur für Anbieter in
    // DE/AT/CH (oder mit DE-Niederlassung). Bei ausländischen Sites
    // melden wir den fehlenden Link informativ, ohne den Compliance-Score
    // zu drücken und ohne abmahnbare Schein-Aussage. Für extraterritorial
    // wirkendes EU-Recht (DSGVO Art. 13) bleiben die Privacy-Checks
    // unverändert hart.
    const deJurisdiction = isLikelyGermanJurisdiction(url, html);
    issues.push(
      deJurisdiction
        ? {
            id: 'no_imprint_link',
            severity: 'critical',
            title: 'Kein Impressum-Link gefunden',
            detail: 'Impressum ist nach § 5 TMG / § 18 MStV Pflicht für gewerbliche Websites in Deutschland.',
            paragraph_ref: '§ 5 TMG / § 18 MStV',
          }
        : {
            id: 'no_imprint_link_non_de',
            severity: 'info',
            title: 'Kein Impressum-Link (DE-spezifisch)',
            detail: 'Die Site weist keine deutschen Anbieter-Signale auf (TLD, lang-Attribut, Rechtsform). § 5 TMG / § 18 MStV gilt nur für Anbieter in Deutschland — dieser Befund ist daher informativ.',
            paragraph_ref: '§ 5 TMG / § 18 MStV',
          },
    );
  }

  // ── Tracker ohne sichtbares Consent-Banner ──
  // WICHTIG: Tracker-Detection läuft gegen `trackerHtml` — Roh-HTML OHNE
  // CSP-Allowlist + Resource-Hints. Eine in der Content-Security-Policy
  // erlaubte Domain (script-src https://www.googletagmanager.com …) bedeutet
  // NICHT, dass der Tracker geladen wird; früher erzeugte genau das die
  // identischen False-Positive-Befunde (GA/Meta/TikTok/LinkedIn) und den
  // fixen 28/100-Score. Echte `<script src>`-Tags und Runtime-Aufrufe
  // (gtag(/fbq(/ttq(/_paq) bleiben erhalten.
  const trackerHtml = stripPolicyDeclarations(html);
  const hasGA = /google-analytics\.com|googletagmanager\.com|gtag\(/i.test(trackerHtml);
  const hasMeta = /connect\.facebook\.net|fbq\(/i.test(trackerHtml);
  const hasLI = /snap\.licdn\.com|lintrk\(/i.test(trackerHtml);
  const hasHotjar = /static\.hotjar\.com|hotjar/i.test(trackerHtml);
  // Matomo / Piwik signature. We pick up explicit script paths (matomo.js,
  // piwik.js, matomo.php) and the runtime _paq global to catch self-hosted
  // installations behind custom domains.
  const hasMatomo = /matomo\.js|piwik\.js|matomo\.php|_paq\b/i.test(trackerHtml);
  // Heuristic: visible client-side trace of Matomo cookies (pk_id / pk_ses
  // / pk_ref) in the HTML payload, which indicates the cookies are likely
  // being set without the cookieless `disableCookies` configuration.
  const hasMatomoCookieHint = /\bpk_id\b|\bpk_ses\b|\bpk_ref\b/i.test(trackerHtml);
  const hasConsent = /(cookie[\s-]?banner|cookieconsent|cookieyes|usercentrics|borlabs|cookiebot|onetrust|klaro|tarteaucitron)/i.test(html);

  if ((hasGA || hasMeta || hasLI || hasHotjar) && !hasConsent) {
    const trackers = [hasGA && 'Google Analytics', hasMeta && 'Meta Pixel', hasLI && 'LinkedIn Insight', hasHotjar && 'Hotjar'].filter(Boolean).join(', ');
    issues.push({
      id: 'tracker_no_consent',
      severity: 'critical',
      title: `Tracker ohne sichtbares Consent-Banner: ${trackers}`,
      detail: 'EuGH (C-673/17) + BGH „Cookie II" (2020): Nicht-essenzielle Tracker setzen aktives Opt-In voraus (DSGVO Art. 6, § 25 TTDSG). Technische Beobachtung — rechtliche Würdigung durch DSB/Fachjurist erforderlich.',
      paragraph_ref: 'DSGVO Art. 6 Abs. 1, § 25 TTDSG',
    });
  }

  if (hasMatomo) {
    if (hasMatomoCookieHint) {
      issues.push({
        id: 'matomo_cookies_pre_consent',
        severity: 'medium',
        title: 'Matomo-Cookies vor Einwilligung erkannt',
        detail: 'Matomo-Cookies oder Tracking-Indikatoren (pk_id / pk_ses / pk_ref) wurden vor einer erkennbaren Einwilligung gefunden. Prüfen Sie, ob Consent erforderlich ist oder ob cookieless Tracking (disableCookies vor trackPageView) korrekt konfiguriert wurde.',
        paragraph_ref: 'DSGVO Art. 6 Abs. 1, § 25 TTDSG',
      });
    } else {
      issues.push({
        id: 'matomo_detected',
        severity: 'info',
        title: 'Matomo Analytics erkannt',
        detail: 'Matomo kann datenschutzfreundlich betrieben werden. Prüfen Sie, ob IP-Masking, Cookie-Deaktivierung, Datenminimierung, Opt-out und Datenschutzhinweis korrekt konfiguriert sind. Siehe /resources/matomo-dsgvo-konfiguration für einen Konfigurations-Leitfaden.',
      });
    }
  }
  if (hasGA && !/anonymizeip|gtag.*anonymize_ip/i.test(html)) {
    issues.push({
      id: 'ga_no_ip_anon',
      severity: 'high',
      title: 'Google Analytics ohne IP-Anonymisierung',
      detail: 'Auch mit Consent: Datenübertragung in die USA (Schrems-II) erfordert IP-Anonymisierung als Mindest-Zusatz-Maßnahme.',
      paragraph_ref: 'EuGH C-311/18 (Schrems II)',
    });
  }

  // ── Cookies vor Consent ──
  const setCookieHeader = h?.get('set-cookie') ?? '';
  const cookieCount = setCookieHeader.split(/,(?=[^;]+=)/).length;
  if (setCookieHeader && cookieCount > 1) {
    issues.push({
      id: 'cookies_pre_consent',
      severity: 'high',
      title: `${cookieCount} Cookies bei erstem Aufruf gesetzt (vor Consent)`,
      detail: 'Bei initialem GET sollten nur technisch notwendige Cookies (Session, CSRF) gesetzt werden. Tracking-Cookies erst nach explizitem Consent.',
      paragraph_ref: '§ 25 TTDSG',
    });
  }

  // ── Form-Felder mit Email — aber kein Consent-Hinweis ──
  if (/<input[^>]+type=["']?email["']?/i.test(html)) {
    if (!/(einwilligung|consent|datenschutz.*hinweis|wir verarbeiten)/i.test(html)) {
      issues.push({
        id: 'form_no_consent',
        severity: 'medium',
        title: 'Email-Formular ohne sichtbaren DSGVO-Hinweis',
        detail: 'Bei jedem Formular mit personenbezogenen Daten muss ein Hinweis auf Verarbeitung + Verlinkung zur Datenschutzerklärung sichtbar sein.',
        paragraph_ref: 'DSGVO Art. 13',
      });
    }
  }

  // ── Mixed Content ──
  if (url.startsWith('https://') && /<(img|script|link|iframe)[^>]+src=["']http:\/\//i.test(html)) {
    issues.push({
      id: 'mixed_content',
      severity: 'medium',
      title: 'Mixed Content (HTTP-Ressourcen auf HTTPS-Site)',
      detail: 'HTTP-Ressourcen auf HTTPS-Page = Browser-Warnung, möglicher MITM-Vektor.',
    });
  }

  // ── AVV / DPA Hinweis ──
  if (!/auftragsverarbeitung|avv|dpa|data.processing.agreement/i.test(html) && (hasGA || hasMeta)) {
    issues.push({
      id: 'no_avv_mention',
      severity: 'low',
      title: 'Kein AVV-Hinweis erkennbar bei externen Verarbeitern',
      detail: 'Mit externen Tools (GA, Meta) brauchst Du AVVs nach Art. 28 DSGVO. Üblicherweise in der Datenschutzerklärung referenziert.',
      paragraph_ref: 'DSGVO Art. 28',
    });
  }

  // ── Cookie-Banner ohne Reject-Option (heuristisch) ──
  if (hasConsent && /accept[ -]?all|alle akzeptieren/i.test(html) && !/reject|ablehnen|nur (technisch|notwendig|essentiell)/i.test(html)) {
    issues.push({
      id: 'consent_no_reject',
      severity: 'high',
      title: 'Cookie-Banner ohne gleichwertige „Ablehnen"-Option',
      detail: 'BfDI: „Accept All" muss eine ebenbürtige „Alle ablehnen" daneben haben. Dark Pattern = unwirksamer Consent.',
      paragraph_ref: 'EDSA Guidelines 03/2022',
    });
  }

  // ── Microsoft Clarity ohne Consent ──
  if (/clarity\.ms|window\.clarity/i.test(trackerHtml) && !hasConsent) {
    issues.push({
      id: 'clarity_no_consent',
      severity: 'high',
      title: 'Microsoft Clarity ohne sichtbares Consent-Banner',
      detail: 'Clarity zeichnet Mausbewegungen + Klicks auf (Session-Replay) — laut BfDI „besondere Eingriffsintensität". Aktives Opt-In zwingend erforderlich.',
      paragraph_ref: '§ 25 TTDSG',
    });
  }

  // ── TikTok / Pinterest Pixel ohne Consent ──
  const hasTikTok = /analytics\.tiktok\.com|ttq\(/i.test(trackerHtml);
  const hasPinterest = /pinimg\.com\/ct\/|pintrk\(/i.test(trackerHtml);
  if ((hasTikTok || hasPinterest) && !hasConsent) {
    const trackers = [hasTikTok && 'TikTok Pixel', hasPinterest && 'Pinterest Tag'].filter(Boolean).join(', ');
    issues.push({
      id: 'social_pixel_no_consent',
      severity: 'critical',
      title: `Social-Media-Pixel ohne Consent: ${trackers}`,
      detail: 'TikTok/Pinterest-Pixel impliziert Datentransfer in Drittländer (CN/US). Standardvertragsklauseln (SCC) bzw. Angemessenheitsbeschluss erforderlich (DSGVO Art. 44 ff.). Garantien sind im Scan nicht beobachtbar — DSB/Fachjurist sollte den Transfer prüfen.',
      paragraph_ref: 'DSGVO Art. 44',
    });
  }

  // ── Reverse-IP-Tracker (Lead-Generation à la Albacross/Leadfeeder) ──
  if (/albacross|leadfeeder|leadinfo|dealfront|wisepops/i.test(trackerHtml)) {
    issues.push({
      id: 'reverse_ip_tracker',
      severity: 'critical',
      title: 'Reverse-IP / B2B-Tracker erkannt',
      detail: 'Albacross/Leadfeeder/etc. identifizieren Firmen anhand IP-Adresse — DSK-Beschluss 2023: ohne Einwilligung der Betroffenen unzulässig (Profilbildung). Hohe Bußgelder.',
      paragraph_ref: 'DSGVO Art. 6 + 22, DSK 2023',
    });
  }

  // ── Newsletter-Signup ohne Double-Opt-In-Hinweis ──
  if (/newsletter|abonnier|subscribe/i.test(html) && /<input[^>]+type=["']?email["']?/i.test(html)) {
    if (!/(double.opt.in|bestätigung|confirm.*email|verifizierung)/i.test(html)) {
      issues.push({
        id: 'newsletter_no_doi',
        severity: 'medium',
        title: 'Newsletter-Anmeldung ohne erkennbaren Double-Opt-In',
        detail: 'BGH (Az. I ZR 218/07): Werbe-Emails brauchen DOI-Bestätigung. Single-Opt-In = Wettbewerbsverstoß + Abmahnrisiko.',
        paragraph_ref: '§ 7 UWG',
      });
    }
  }

  // ── HTML-lang-Attribut ──
  if (!/<html[^>]+lang=/i.test(html)) {
    issues.push({
      id: 'no_html_lang',
      severity: 'low',
      title: '<html lang="…"> Attribut fehlt',
      detail: 'BITV / WCAG 2.1: Sprache muss maschinenlesbar deklariert sein für Screenreader. Bei Behörden = Pflicht (BFSG ab 2025).',
      paragraph_ref: 'BFSG / BITV 2.0',
    });
  }

  // ── Open Graph für Social-Sharing ──
  if (!/<meta[^>]+property=["']og:title["']/i.test(html)) {
    issues.push({
      id: 'no_og_tags',
      severity: 'info',
      title: 'Keine Open-Graph-Tags',
      detail: 'Wenn Dein Link auf LinkedIn/WhatsApp gepostet wird, sieht er aus wie ein Lottoschein-URL — ohne Vorschau-Bild oder Beschreibung.',
    });
  }

  // ── Meta-Refresh-Redirect (anti-pattern) ──
  if (/<meta[^>]+http-equiv=["']?refresh["']?/i.test(html)) {
    issues.push({
      id: 'meta_refresh',
      severity: 'low',
      title: 'Meta-Refresh-Redirect verwendet',
      detail: 'WCAG 2.1: Auto-Redirects via meta-refresh sind problematisch für Screenreader-User. Server-Redirect (301) bevorzugen.',
      paragraph_ref: 'BITV 2.0 / WCAG 2.2.1',
    });
  }

  return issues;
}

function scoreReport(issues: Issue[]): { score: number; severity: 'critical' | 'high' | 'medium' | 'low' | 'pass' } {
  const weights = { critical: 25, high: 12, medium: 6, low: 2, info: 0 };
  const deduction = issues.reduce((sum, i) => sum + (weights[i.severity] ?? 0), 0);
  const score = Math.max(0, 100 - deduction);

  let severity: 'critical' | 'high' | 'medium' | 'low' | 'pass';
  if (issues.some(i => i.severity === 'critical')) severity = 'critical';
  else if (issues.some(i => i.severity === 'high')) severity = 'high';
  else if (issues.some(i => i.severity === 'medium')) severity = 'medium';
  else if (issues.some(i => i.severity === 'low')) severity = 'low';
  else severity = 'pass';

  return { score, severity };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // realistic UA so sites with bot-blocks behave normally
        'User-Agent': 'Mozilla/5.0 (compatible; RealSyncDynamicsAuditBot/1.0; +https://RealSyncDynamicsAI.de)',
      },
    });
  } finally {
    clearTimeout(t);
  }
}

// ─── Subpage-Scan: /datenschutz + /impressum ─────────────────────────────
// Findet Befunde, die nur auf den dedizierten Legal-Pages stehen:
// - AVV-Auflistung der Auftragsverarbeiter (Art. 28)
// - DSB-Kontakt (Art. 37+38)
// - Verarbeitungs-Zwecke (Art. 13 lit. c)
// - Beschwerderecht (Art. 13 lit. d)
// - Drittlandtransfer-Hinweise (Art. 44)
// - Impressum-Pflichtfelder (§ 5 TMG)
async function scanSubpages(baseUrl: string, baseHtml: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const base = new URL(baseUrl);

  // Discover privacy + imprint URLs from homepage links
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{0,80})<\/a>/gi;
  const candidates: { kind: 'privacy' | 'imprint'; url: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(baseHtml)) !== null) {
    const href = m[1];
    const text = m[2].toLowerCase();
    let resolved: string;
    try { resolved = new URL(href, base).toString(); } catch { continue; }
    if (new URL(resolved).hostname !== base.hostname) continue; // same-domain only
    if (/datenschutz|privacy|privacy-policy/i.test(href + text)) {
      candidates.push({ kind: 'privacy', url: resolved });
    } else if (/impressum|imprint|legal-notice/i.test(href + text)) {
      candidates.push({ kind: 'imprint', url: resolved });
    }
  }

  // Try common fallback paths if not linked
  for (const fallback of ['/datenschutz', '/datenschutzerklaerung', '/privacy', '/legal/privacy']) {
    if (!candidates.some(c => c.kind === 'privacy')) {
      candidates.push({ kind: 'privacy', url: new URL(fallback, base).toString() });
    }
  }
  for (const fallback of ['/impressum', '/imprint', '/legal/imprint']) {
    if (!candidates.some(c => c.kind === 'imprint')) {
      candidates.push({ kind: 'imprint', url: new URL(fallback, base).toString() });
    }
  }

  // Take first valid privacy + imprint, fetch in parallel
  const seenKinds = new Set<string>();
  const targets = candidates.filter(c => {
    if (seenKinds.has(c.kind)) return false;
    seenKinds.add(c.kind);
    return true;
  });

  const fetched = await Promise.all(
    targets.map(async (t) => {
      try {
        const resp = await fetchWithTimeout(t.url, 5000);
        if (!resp.ok) return { kind: t.kind, html: '', status: resp.status };
        const reader = resp.body?.getReader();
        if (!reader) return { kind: t.kind, html: '', status: resp.status };
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (total < 500_000) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
          total += value.byteLength;
        }
        await reader.cancel();
        const html = new TextDecoder('utf-8', { fatal: false }).decode(concat(chunks));
        return { kind: t.kind, html, status: resp.status };
      } catch {
        return { kind: t.kind, html: '', status: 0 };
      }
    }),
  );

  for (const f of fetched) {
    if (!f.html || f.status !== 200) continue;
    const lc = f.html.toLowerCase();

    if (f.kind === 'privacy') {
      // Auftragsverarbeiter / Sub-Prozessor-Liste
      if (!/auftragsverarbeit|sub.?prozessor|sub.?processor|art\.\s*28/i.test(lc)) {
        issues.push({
          id: 'sub_privacy_no_avv_list',
          severity: 'high',
          title: 'Datenschutzerklärung nennt keine Auftragsverarbeiter',
          detail: 'Art. 13 Abs. 1 lit. e: jeder Empfänger personenbezogener Daten muss namentlich genannt werden. „Wir nutzen Cookies" reicht nicht.',
          paragraph_ref: 'DSGVO Art. 13 Abs. 1 lit. e',
        });
      }

      // Datenschutzbeauftragter
      if (!/datenschutzbeauftragt|data.protection.officer|dsb|dpo/i.test(lc)) {
        issues.push({
          id: 'sub_privacy_no_dpo_contact',
          severity: 'medium',
          title: 'Kein DSB-Kontakt in Datenschutzerklärung',
          detail: 'Bei DSB-Pflicht (>20 Personen mit personenbez. Daten regelmäßig befasst, oder Kerntätigkeit „umfangreiche Verarbeitung") muss Name + Email des DSB genannt sein.',
          paragraph_ref: 'DSGVO Art. 37 + 38, § 38 BDSG',
        });
      }

      // Beschwerderecht bei Aufsichtsbehörde
      if (!/beschwerde|aufsichtsbehörde|beschwerderecht/i.test(lc)) {
        issues.push({
          id: 'sub_privacy_no_complaint_right',
          severity: 'medium',
          title: 'Kein Hinweis auf Beschwerderecht bei Aufsichtsbehörde',
          detail: 'Pflicht-Hinweis nach Art. 13 Abs. 2 lit. d: Betroffene haben das Recht, sich bei einer Aufsichtsbehörde zu beschweren.',
          paragraph_ref: 'DSGVO Art. 13 Abs. 2 lit. d',
        });
      }

      // Drittland-Transfer-Hinweis
      if (/usa|united states|drittland|third country|amerika/i.test(lc)
          && !/standardvertragsklausel|standard contractual clauses|sccs?|adäquanzbeschluss|tadpf|data privacy framework/i.test(lc)) {
        issues.push({
          id: 'sub_privacy_third_country_no_legal_basis',
          severity: 'high',
          title: 'Drittlandtransfer erwähnt, aber keine Rechtsgrundlage',
          detail: 'Bei US/Drittland-Hinweis muss SCCs oder DPF (Data Privacy Framework) als Rechtsgrundlage genannt sein.',
          paragraph_ref: 'DSGVO Art. 44–46',
        });
      }
    }

    if (f.kind === 'imprint') {
      // Impressum-Pflichtfelder § 5 TMG
      const hasName = /\b(GmbH|UG|AG|GbR|KG|e\.K\.|inhaber|geschäftsführer)\b/i.test(lc);
      const hasAddress = /\b(straße|str\.|allee|platz|weg|gasse)\s+\d/i.test(f.html);
      const hasContact = /(\bemail\b|@|tel\.|telefon|phone)/i.test(lc);

      if (!hasName) {
        issues.push({
          id: 'sub_imprint_no_legal_form',
          severity: 'critical',
          title: 'Impressum nennt keine Rechtsform',
          detail: 'Pflicht nach § 5 Abs. 1 Nr. 1 TMG: vollständige Angabe der Firma inkl. Rechtsform (GmbH, UG, e.K. etc.) bzw. Inhaber-Name bei Einzelunternehmen.',
          paragraph_ref: '§ 5 Abs. 1 Nr. 1 TMG',
        });
      }
      if (!hasAddress) {
        issues.push({
          id: 'sub_imprint_no_address',
          severity: 'critical',
          title: 'Impressum hat keine ladungsfähige Anschrift',
          detail: 'Pflicht nach § 5 Abs. 1 Nr. 1 TMG. Postfach reicht nicht.',
          paragraph_ref: '§ 5 Abs. 1 Nr. 1 TMG',
        });
      }
      if (!hasContact) {
        issues.push({
          id: 'sub_imprint_no_contact',
          severity: 'high',
          title: 'Impressum ohne unmittelbaren Kontaktweg',
          detail: 'Pflicht nach § 5 Abs. 1 Nr. 2 TMG: Email + Telefon müssen genannt sein.',
          paragraph_ref: '§ 5 Abs. 1 Nr. 2 TMG',
        });
      }
    }
  }

  return issues;
}

/**
 * Facts-Extraktion für Rule Engine.
 *
 * Konvertiert html + Headers + bestehende Issues in das fact-Dictionary,
 * gegen das die JSON-Regeln (gdpr.json + ai-act.json) evaluiert werden.
 * Static-Analyse — Server-Side-Tracking nicht erkannt (siehe /grenzen).
 */
function extractFacts(
  url: string,
  html: string,
  _headers: Headers | null,
  issues: Issue[],
): Record<string, unknown> {
  const lc = html.toLowerCase();
  // Tracker-Detection gegen CSP-/Hint-bereinigtes HTML (siehe runChecks):
  // eine in der CSP-Allowlist erlaubte Domain ist kein geladener Tracker.
  const trackerLc = stripPolicyDeclarations(html).toLowerCase();

  // Tracker-Detection via URL-Patterns im HTML
  const ga = /googletagmanager\.com\/gtag\/js|google-analytics\.com\/g\/collect|google-analytics\.com\/analytics\.js/.test(trackerLc);
  const meta = /connect\.facebook\.net\/.+\/fbevents\.js|www\.facebook\.com\/tr/.test(trackerLc);
  const tiktok = /analytics\.tiktok\.com/.test(trackerLc);
  const linkedin = /snap\.licdn\.com\/li\.lms-analytics|px\.ads\.linkedin\.com/.test(trackerLc);
  const hotjar = /static\.hotjar\.com|script\.hotjar\.com/.test(trackerLc);
  const gFonts = /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(trackerLc);
  const gtm = /googletagmanager\.com\/gtm\.js/.test(trackerLc);

  // Consent-Banner-Heuristik (statische DOM-Detection ist begrenzt)
  const consentKeywords = ['cookie', 'einwilligung', 'consent', 'datenschutz', 'akzeptieren', 'ablehnen'];
  const consentBannerLikely = consentKeywords.some((k) => lc.includes(k));
  // Einfache Heuristik für 3-Button-Pattern: prüft ob "ablehnen" und "akzeptieren" beide existieren
  const rejectBtnPresent = /(ablehnen|alle ablehnen|reject|nur notwendige)/i.test(lc);
  const acceptBtnPresent = /(akzeptieren|alle akzeptieren|accept all)/i.test(lc);
  const rejectEqualProminence = consentBannerLikely && rejectBtnPresent && acceptBtnPresent;

  // Pflicht-Page-Existenz (basiert auf Subpages-Check der bereits ran)
  const privacyMissing = issues.some((i) => i.id.startsWith('subpage_privacy_') || i.id === 'privacy_no_link');
  const impressumMissing = issues.some((i) => i.id.startsWith('subpage_impressum_') || i.id === 'impressum_no_link');

  return {
    tracker: {
      google_analytics: { detected: ga },
      meta_pixel: { detected: meta },
      tiktok_pixel: { detected: tiktok },
      linkedin_insight: { detected: linkedin },
      hotjar: { detected: hotjar },
      google_tag_manager: { detected: gtm },
      any_external: ga || meta || tiktok || linkedin || hotjar || gtm,
    },
    asset: {
      google_fonts: { dynamic: gFonts },
    },
    consent: {
      banner: {
        detected: consentBannerLikely,
        reject_button_equal_prominence: rejectEqualProminence,
      },
      detected_before_load: false,
      required: true,
    },
    page: {
      privacy_policy: {
        url_found: !privacyMissing,
        mentions_avv: lc.includes('auftragsverarbeit') || lc.includes('art. 28') || lc.includes('avv'),
      },
      impressum: { url_found: !impressumMissing },
    },
    // AI-Act-Use-Case-facts: aus Static-HTML nicht ableitbar, daher false-Default
    ai_use_case: {
      detects_emotion: false,
      scoring: false,
      is_chatbot: /chatbot|chatbase|intercom\.io|drift\.com|tidio/i.test(lc),
      disclosure_visible: false,
      uses_foundation_model_directly: false,
      purpose: '',
      context: '',
      actor: '',
    },
    // Engine-Version-Tag für Audit-Trail
    audit_engine: { version: RULE_ENGINE_VERSION, scanned_at: new Date().toISOString(), url },
  };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
