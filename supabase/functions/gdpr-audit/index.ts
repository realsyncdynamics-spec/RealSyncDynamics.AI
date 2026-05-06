// DSGVO-Audit-Tool — Lead-Magnet auf /audit.
//
// POST /functions/v1/gdpr-audit   (verify_jwt = false; public endpoint)
// Body: { url: string, email: string, company?: string }
//
// 1. Validate inputs + rate-limit (5/h per IP-hash, like sales-lead)
// 2. Fetch target URL server-side (no CORS)
// 3. Run heuristic checks against headers + HTML
// 4. Score 0-100, classify severity
// 5. Insert sales_leads row (source='audit_lp') + gdpr_audits row
// 6. Return report JSON for UI display

import { createClient } from 'jsr:@supabase/supabase-js@2';

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

  let body: { url?: string; email?: string; company?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const url = (body.url ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const company = (body.company ?? '').trim().slice(0, 200) || null;

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
  const { score, severity } = scoreReport(issues);

  // Insert sales_lead
  const { data: leadRow } = await admin.from('sales_leads').insert({
    name: null,
    email,
    company,
    use_case: 'compliance',
    message: `Audit-LP: ${url} → score ${score}/100 (${severity})`,
    source: 'audit_lp',
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
  if (!h?.get('content-security-policy')) {
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
    issues.push({
      id: 'no_imprint_link',
      severity: 'critical',
      title: 'Kein Impressum-Link gefunden',
      detail: 'Impressum ist nach § 5 TMG / § 18 MStV Pflicht für gewerbliche Websites in Deutschland.',
      paragraph_ref: '§ 5 TMG / § 18 MStV',
    });
  }

  // ── Tracker ohne sichtbares Consent-Banner ──
  const hasGA = /google-analytics\.com|googletagmanager\.com|gtag\(/i.test(html);
  const hasMeta = /connect\.facebook\.net|fbq\(/i.test(html);
  const hasLI = /snap\.licdn\.com|lintrk\(/i.test(html);
  const hasHotjar = /static\.hotjar\.com|hotjar/i.test(html);
  const hasConsent = /(cookie[\s-]?banner|cookieconsent|cookieyes|usercentrics|borlabs|cookiebot|onetrust|klaro|tarteaucitron)/i.test(html);

  if ((hasGA || hasMeta || hasLI || hasHotjar) && !hasConsent) {
    const trackers = [hasGA && 'Google Analytics', hasMeta && 'Meta Pixel', hasLI && 'LinkedIn Insight', hasHotjar && 'Hotjar'].filter(Boolean).join(', ');
    issues.push({
      id: 'tracker_no_consent',
      severity: 'critical',
      title: `Tracker ohne sichtbares Consent-Banner: ${trackers}`,
      detail: 'EuGH (C-673/17) + BGH-Urteil „Cookie II" (2020): Tracker, die nicht technisch notwendig sind, brauchen aktives Opt-In. Verstoß = bis 4% Jahresumsatz.',
      paragraph_ref: 'DSGVO Art. 6 Abs. 1, § 25 TTDSG',
    });
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
  if (/clarity\.ms|window\.clarity/i.test(html) && !hasConsent) {
    issues.push({
      id: 'clarity_no_consent',
      severity: 'high',
      title: 'Microsoft Clarity ohne sichtbares Consent-Banner',
      detail: 'Clarity zeichnet Mausbewegungen + Klicks auf (Session-Replay) — laut BfDI „besondere Eingriffsintensität". Aktives Opt-In zwingend erforderlich.',
      paragraph_ref: '§ 25 TTDSG',
    });
  }

  // ── TikTok / Pinterest Pixel ohne Consent ──
  const hasTikTok = /analytics\.tiktok\.com|ttq\(/i.test(html);
  const hasPinterest = /pinimg\.com\/ct\/|pintrk\(/i.test(html);
  if ((hasTikTok || hasPinterest) && !hasConsent) {
    const trackers = [hasTikTok && 'TikTok Pixel', hasPinterest && 'Pinterest Tag'].filter(Boolean).join(', ');
    issues.push({
      id: 'social_pixel_no_consent',
      severity: 'critical',
      title: `Social-Media-Pixel ohne Consent: ${trackers}`,
      detail: 'TikTok + Pinterest übertragen ins Drittland (CN/US) ohne SCC. Höchstes Risiko-Profil.',
      paragraph_ref: 'DSGVO Art. 44',
    });
  }

  // ── Reverse-IP-Tracker (Lead-Generation à la Albacross/Leadfeeder) ──
  if (/albacross|leadfeeder|leadinfo|dealfront|wisepops/i.test(html)) {
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
        'User-Agent': 'Mozilla/5.0 (compatible; RealSyncDynamicsAuditBot/1.0; +https://realsyncdynamicsai.de)',
      },
    });
  } finally {
    clearTimeout(t);
  }
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
