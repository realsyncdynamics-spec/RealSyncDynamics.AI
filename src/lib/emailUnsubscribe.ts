/**
 * E-Mail-Abmeldung für `/api/sp-unsubscribe` und `/api/drip-unsubscribe` (Issue #2282).
 *
 * Läuft als Cloudflare-Pages-Function (`functions/api/*-unsubscribe.ts`), nie im Browser-Bundle.
 *
 * Verhalten:
 *  - GET/HEAD: reine Bestätigungsansicht. Kein Datenbankaufruf, keine Zustandsänderung —
 *    Linkscanner und Vorschau-Abrufe von Mail-Clients melden niemanden ab.
 *  - POST: tatsächliche Abmeldung über die RPC `email_unsubscribe_by_token`
 *    (SECURITY DEFINER, idempotent, liefert nichts zurück). Deckt sowohl das
 *    Formular der Bestätigungsansicht als auch RFC 8058 One-Click
 *    (`List-Unsubscribe=One-Click`) ab.
 *  - Keine Enumeration: gültiger, unbekannter und bereits abgemeldeter Token erhalten
 *    dieselbe Antwort. Nur ein formal kaputter oder fehlender Token bekommt einen
 *    neutralen Hinweis (das verrät nichts über Abonnenten).
 *  - `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, strikte CSP ohne
 *    externe Ressourcen: Der Token in der URL kann weder gecacht noch per Referer
 *    an Dritte abfließen.
 *
 * Zugriffsrechte: Die Function nutzt nur den öffentlichen anon-Key. Die Autorität
 * ist allein der 122-Bit-Zufallstoken (UUID v4) aus der Mail; der Abgleich findet
 * serverseitig in der Datenbank statt. Kein `service_role` außerhalb der Edge.
 */

export type UnsubscribeList = 'sp' | 'drip';

export interface UnsubscribeListConfig {
  list: UnsubscribeList;
  /** Pfad der Pages-Function (für Formular-Action). */
  path: string;
  /** Wovon abgemeldet wird — in der Ansicht angezeigt. */
  label: string;
}

export const UNSUBSCRIBE_LISTS: Record<UnsubscribeList, UnsubscribeListConfig> = {
  sp: {
    list: 'sp',
    path: '/api/sp-unsubscribe',
    label: 'Benachrichtigungen zu Änderungen bei Unterauftragsverarbeitern',
  },
  drip: {
    list: 'drip',
    path: '/api/drip-unsubscribe',
    label: 'Folge-E-Mails zu deinem Datenschutz-Check',
  },
};

/** Exakte Pfade, die per Token (nicht per Cookie) autorisiert sind. */
export const UNSUBSCRIBE_PATHS: readonly string[] = Object.values(UNSUBSCRIBE_LISTS).map((c) => c.path);

/**
 * Bewusst exakt (ohne Slash-Normalisierung): `/api/sp-unsubscribe/` trifft keine Function
 * und soll weiter den echten 404 statt einer 200-SPA-Shell bekommen.
 */
export function isUnsubscribePath(pathname: string): boolean {
  return UNSUBSCRIBE_PATHS.includes(pathname);
}

/** Tokens sind `gen_random_uuid()` — alles andere wird ohne DB-Aufruf verworfen. */
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length !== 36 || !TOKEN_RE.test(t)) return null;
  return t.toLowerCase();
}

/** Ruft die Abmelde-RPC auf. Muss werfen oder `false` liefern, wenn die DB nicht erreichbar ist. */
export type UnsubscribeRpc = (list: UnsubscribeList, token: string) => Promise<boolean>;

export const MAX_POST_BYTES = 8 * 1024;

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-store, max-age=0',
  pragma: 'no-cache',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)} · RealSync Dynamics</title>
<style>
body{margin:0;background:#0b0d10;color:#e6e8eb;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:560px;margin:10vh auto;padding:24px;border:1px solid #2a2f36;background:#11151a}
h1{font-size:20px;margin:0 0 12px}
p{margin:0 0 16px;color:#b8bec6}
.meta{font:12px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#7d8590;margin-bottom:8px}
button{background:#2563eb;color:#fff;border:0;border-radius:0;padding:10px 18px;font-weight:700;cursor:pointer}
button:focus{outline:2px solid #93c5fd;outline-offset:2px}
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

export function renderConfirmPage(cfg: UnsubscribeListConfig, token: string): string {
  return page(
    'Abmeldung bestätigen',
    `<div class="meta">E-Mail-Abmeldung</div>
<h1>Abmeldung bestätigen</h1>
<p>Du meldest dich ab von: <strong>${escapeHtml(cfg.label)}</strong>.</p>
<p>Erst der Klick auf die Schaltfläche führt die Abmeldung aus. Das bloße Öffnen dieses Links ändert nichts.</p>
<form method="post" action="${escapeHtml(cfg.path)}">
<input type="hidden" name="token" value="${escapeHtml(token)}">
<button type="submit">Jetzt abmelden</button>
</form>`,
  );
}

export function renderDonePage(cfg: UnsubscribeListConfig): string {
  return page(
    'Abmeldung verarbeitet',
    `<div class="meta">E-Mail-Abmeldung</div>
<h1>Abmeldung verarbeitet</h1>
<p>Wenn dieser Link zu einem aktiven Empfang gehörte, erhältst du ab sofort keine ${escapeHtml(cfg.label)} mehr.</p>
<p>Eine erneute Abmeldung ist nicht nötig.</p>`,
  );
}

export function renderInvalidPage(): string {
  return page(
    'Link unvollständig',
    `<div class="meta">E-Mail-Abmeldung</div>
<h1>Link unvollständig</h1>
<p>Dieser Abmeldelink ist unvollständig. Bitte öffne den Link direkt aus der E-Mail oder antworte auf die E-Mail mit der Bitte um Abmeldung.</p>`,
  );
}

export function renderUnavailablePage(): string {
  return page(
    'Vorübergehend nicht möglich',
    `<div class="meta">E-Mail-Abmeldung</div>
<h1>Vorübergehend nicht möglich</h1>
<p>Die Abmeldung konnte gerade nicht verarbeitet werden. Bitte versuche es in einigen Minuten erneut oder antworte auf die E-Mail mit der Bitte um Abmeldung.</p>`,
  );
}

function html(status: number, body: string | null, extra?: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...SECURITY_HEADERS, ...extra },
  });
}

async function readPostToken(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_POST_BYTES) return null;
  const ct = (request.headers.get('content-type') ?? '').toLowerCase();
  if (!ct.includes('application/x-www-form-urlencoded') && !ct.includes('multipart/form-data')) return null;
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_POST_BYTES) return null;
    const form = await new Response(buf, { headers: { 'content-type': ct } }).formData();
    return normalizeToken(form.get('token'));
  } catch {
    return null;
  }
}

/**
 * Zentraler Handler. `rpc` wird ausschließlich bei POST mit formal gültigem Token aufgerufen.
 */
export async function handleUnsubscribe(
  request: Request,
  cfg: UnsubscribeListConfig,
  rpc: UnsubscribeRpc,
): Promise<Response> {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const queryToken = normalizeToken(url.searchParams.get('token'));

  if (method === 'GET' || method === 'HEAD') {
    const status = queryToken ? 200 : 400;
    const body = queryToken ? renderConfirmPage(cfg, queryToken) : renderInvalidPage();
    return html(status, method === 'HEAD' ? null : body);
  }

  if (method !== 'POST') {
    return html(405, renderInvalidPage(), { allow: 'GET, HEAD, POST' });
  }

  // RFC 8058: Token steht in der List-Unsubscribe-URL, Body ist `List-Unsubscribe=One-Click`.
  // Bestätigungsformular: Token im Body. Query hat Vorrang.
  const token = queryToken ?? (await readPostToken(request));
  if (!token) return html(400, renderInvalidPage());

  let ok = false;
  try {
    ok = await rpc(cfg.list, token);
  } catch {
    ok = false;
  }
  if (!ok) return html(503, renderUnavailablePage(), { 'retry-after': '300' });
  return html(200, renderDonePage(cfg));
}

/** RPC-Aufruf über PostgREST mit dem öffentlichen anon-Key (keine Secrets). */
export function createRestUnsubscribeRpc(
  supabaseUrl: string,
  anonKey: string,
  fetchImpl: typeof fetch = fetch,
): UnsubscribeRpc {
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/email_unsubscribe_by_token`;
  return async (list, token) => {
    const resp = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Publishable Key nur als `apikey` (kein JWT im Authorization-Header) → Rolle anon.
        apikey: anonKey,
        prefer: 'return=minimal',
      },
      body: JSON.stringify({ p_list: list, p_token: token }),
    });
    await resp.body?.cancel().catch(() => {});
    return resp.ok;
  };
}
