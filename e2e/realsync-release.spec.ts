/**
 * RealSync Release E2E — Freigabe-Gate für Frontend, Login und Telefon-Bot-Webhook.
 *
 * Läuft über `.github/workflows/realsync-release-e2e.yml`; die Auswahl erfolgt über
 * Tags im Testtitel (`--grep "@smoke"`, `"@smoke|@security"`, `"@phone-bot"`).
 *
 * Konfiguration (alle optional außer dort, wo der Workflow sie verlangt):
 *   E2E_BASE_URL / TEST_BASE_URL   Ziel-Frontend (Playwright `baseURL`)
 *   E2E_TEST_EMAIL / _PASSWORD     Testkonto mit Passwort (Supabase password grant)
 *   E2E_PHONE_WEBHOOK_URL          öffentliche URL von `bot-voice-webhook`, exakt wie bei
 *                                  Twilio hinterlegt (= TWILIO_WEBHOOK_URL der Function)
 *   E2E_PHONE_WEBHOOK_SECRET       Signaturschlüssel des Webhooks (Twilio Auth Token)
 *   E2E_PHONE_NUMBER               angerufene Testnummer (E.164), gebunden an einen
 *                                  Testmandanten in `voice_number_bindings`
 *   E2E_SUPABASE_URL / _ANON_KEY   abweichendes Supabase-Projekt (Standard: Produktion)
 *   E2E_REQUIRE_CONFIG=true        fehlende Konfiguration ist ein Fehler statt Skip
 *                                  (Release- und Nachtlauf; fail-closed, kein Scheinbestehen)
 *
 * Der Webhook-Test löst keinen KI-Aufruf aus: Der erste Hit ohne `SpeechResult` spricht
 * nur die Begrüßung. Die Reservierung wird danach per Status-Callback `completed` mit
 * Dauer 0 abgeschlossen, damit kein Kontingent hängen bleibt.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { createHmac, randomBytes } from 'node:crypto';
import { PRODUCTION_SUPABASE_ANON_KEY, PRODUCTION_SUPABASE_URL } from '../src/lib/supabaseUrl';

const env = (name: string): string => (process.env[name] ?? '').trim();

const REQUIRE_CONFIG = env('E2E_REQUIRE_CONFIG') === 'true';
const SUPABASE_URL = (env('E2E_SUPABASE_URL') || PRODUCTION_SUPABASE_URL).replace(/\/$/, '');
const SUPABASE_ANON_KEY = env('E2E_SUPABASE_ANON_KEY') || PRODUCTION_SUPABASE_ANON_KEY;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

/**
 * Fehlende Konfiguration: im Release-/Nachtlauf ein harter Fehler, sonst ein
 * sichtbarer Skip mit Begründung (z. B. Fork-PR ohne Secrets).
 */
function requireConfig(names: string[]): void {
  const missing = names.filter((n) => !env(n));
  if (missing.length === 0) return;
  const message = `Konfiguration fehlt: ${missing.join(', ')}`;
  if (REQUIRE_CONFIG) throw new Error(`${message} (E2E_REQUIRE_CONFIG=true)`);
  test.skip(true, message);
}

/** Twilio-Signatur: Base64(HMAC-SHA1(AuthToken, URL + sortierte name+wert-Paare)). */
function twilioSignature(secret: string, url: string, params: URLSearchParams): string {
  const pairs = [...params.entries()].sort(([ak, av], [bk, bv]) =>
    ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0,
  );
  const payload = url + pairs.map(([k, v]) => k + v).join('');
  return createHmac('sha1', secret).update(payload, 'utf8').digest('base64');
}

function inboundCallParams(callSid: string, extra: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams({
    AccountSid: env('E2E_TWILIO_ACCOUNT_SID') || `AC${'0'.repeat(32)}`,
    ApiVersion: '2010-04-01',
    CallSid: callSid,
    CallStatus: 'ringing',
    Direction: 'inbound',
    From: '+4915100000000',
    To: env('E2E_PHONE_NUMBER') || '+4930000000000',
    ...extra,
  });
}

async function postForm(
  request: APIRequestContext,
  url: string,
  params: URLSearchParams,
  signature?: string,
) {
  return request.post(url, {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(signature ? { 'x-twilio-signature': signature } : {}),
    },
    data: params.toString(),
    failOnStatusCode: false,
    maxRedirects: 0,
  });
}

test.describe('RealSync Release', () => {
  test('P0 @smoke @security: Production frontend is reachable', async ({ page, baseURL }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response, 'keine Antwort vom Frontend').not.toBeNull();
    expect(response!.status(), `HTTP-Status von ${baseURL}/`).toBeLessThan(400);

    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });

    // Kein Server-Geheimnis im ausgelieferten HTML (VITE_* ist öffentlich, Service-Role nie).
    const html = await response!.text();
    expect(html).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY|sk_live_/i);

    // Sicherheitsheader aus public/_headers gelten nur hinter Cloudflare, nicht in `vite preview`.
    if (baseURL?.startsWith('https://')) {
      const headers = response!.headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['strict-transport-security'] ?? '').toContain('max-age=');
      expect(
        headers['x-frame-options'] ?? headers['content-security-policy'] ?? '',
        'Clickjacking-Schutz (X-Frame-Options oder CSP frame-ancestors)',
      ).toMatch(/SAMEORIGIN|DENY|frame-ancestors/i);
    }

    expect(pageErrors, 'unbehandelte JS-Fehler beim Laden').toEqual([]);
  });

  test('P1 @smoke @auth: Login and workspace access works', async ({ page, request }) => {
    requireConfig(['E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD']);

    // Die UI meldet per Magic Link an; der Test nutzt den Passwort-Grant desselben
    // Supabase-Auth-Dienstes und übergibt die Session wie der Client (localStorage).
    const tokenRes = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      data: { email: env('E2E_TEST_EMAIL'), password: env('E2E_TEST_PASSWORD') },
      failOnStatusCode: false,
    });
    expect(tokenRes.status(), 'Supabase-Anmeldung des Testkontos').toBe(200);
    const session = await tokenRes.json();
    expect(session.access_token, 'access_token fehlt').toBeTruthy();
    expect(session.user?.email?.toLowerCase()).toBe(env('E2E_TEST_EMAIL').toLowerCase());
    // supabase-js verwirft gespeicherte Sessions ohne expires_at.
    session.expires_at ??= Math.floor(Date.now() / 1000) + Number(session.expires_in ?? 3600);

    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session)] as const,
    );

    await page.goto('/app/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Sitzung wird geprueft')).toHaveCount(0, { timeout: 20_000 });

    // Das Testkonto hat Mandant, abgeschlossenes Onboarding und gültiges Abo; jede
    // Umleitung (/welcome, /app/onboarding, /checkout/…) heißt: kein Workspace-Zugang.
    await expect(page, 'Umleitung statt Workspace (Session, Mandant, Onboarding oder Abo)').toHaveURL(
      /\/app\/dashboard(\?|#|$)/,
      { timeout: 20_000 },
    );
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('P1 @phone-bot: Phone webhook accepts a simulated inbound call', async ({ request }) => {
    requireConfig(['E2E_PHONE_WEBHOOK_URL', 'E2E_PHONE_WEBHOOK_SECRET', 'E2E_PHONE_NUMBER']);
    const url = env('E2E_PHONE_WEBHOOK_URL');
    const secret = env('E2E_PHONE_WEBHOOK_SECRET');
    const callSid = `CA${randomBytes(16).toString('hex')}`;

    // Erster Hit eines Anrufs: Begrüßung + Spracheingabe, kein KI-Aufruf.
    const ring = inboundCallParams(callSid);
    const res = await postForm(request, url, ring, twilioSignature(secret, url, ring));
    const body = await res.text();

    expect(res.status(), `Webhook-Antwort: ${body.slice(0, 300)}`).toBe(200);
    expect(res.headers()['content-type'] ?? '').toContain('xml');
    expect(body).toContain('<Response>');
    expect(body, 'Nummer nicht an einen Testmandanten gebunden (voice_number_bindings)').not.toContain(
      'nicht vergeben',
    );
    expect(body, 'Anruf abgelehnt (Bot inaktiv, Feature-Gate oder Kontingent)').not.toContain('<Reject');
    expect(body).toContain('<Gather');
    expect(body).toContain('<Say');

    // Aufräumen: Endzustand mit Dauer 0 schließt die Reservierung idempotent ab.
    const done = inboundCallParams(callSid, { CallStatus: 'completed', CallDuration: '0' });
    const settle = await postForm(request, url, done, twilioSignature(secret, url, done));
    expect(settle.status(), 'Status-Callback (Abrechnung der Reservierung)').toBe(200);
  });

  test('P1 @phone-bot @security: Phone webhook rejects unauthorized requests', async ({ request }) => {
    requireConfig(['E2E_PHONE_WEBHOOK_URL']);
    const url = env('E2E_PHONE_WEBHOOK_URL');
    const params = inboundCallParams(`CA${randomBytes(16).toString('hex')}`);

    // 1. Ohne Signatur → 403, keine TwiML.
    const unsigned = await postForm(request, url, params);
    expect(unsigned.status(), 'Anfrage ohne X-Twilio-Signature').toBe(403);
    expect(await unsigned.text()).not.toContain('<Gather');

    // 2. Mit falschem Schlüssel signiert → 403.
    const forged = await postForm(request, url, params, twilioSignature('falscher-schluessel', url, params));
    expect(forged.status(), 'Anfrage mit gefälschter Signatur').toBe(403);
    expect(await forged.text()).not.toContain('<Gather');

    // 3. Gültig signiert, danach Parameter manipuliert (anderer Mandant über `To`) → 403.
    if (env('E2E_PHONE_WEBHOOK_SECRET')) {
      const signature = twilioSignature(env('E2E_PHONE_WEBHOOK_SECRET'), url, params);
      const tampered = new URLSearchParams(params);
      tampered.set('To', '+4930999999999');
      const res = await postForm(request, url, tampered, signature);
      expect(res.status(), 'Signatur passt nicht mehr zu den Parametern').toBe(403);
    }

    // 4. JSON-Modus ohne Supabase-JWT → 401; tenant_id aus dem Body zählt nicht.
    const json = await request.post(url, {
      headers: { 'content-type': 'application/json' },
      data: { tenant_id: '00000000-0000-0000-0000-000000000000', bot_id: 'e2e', message: 'Hallo' },
      failOnStatusCode: false,
    });
    expect([401, 403], `JSON-Modus ohne JWT lieferte ${json.status()}`).toContain(json.status());

    // 5. Nur POST.
    const get = await request.get(url, { failOnStatusCode: false });
    expect([401, 403, 405], `GET lieferte ${get.status()}`).toContain(get.status());
  });
});
