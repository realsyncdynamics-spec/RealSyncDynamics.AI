#!/usr/bin/env -S node --experimental-strip-types
// QA Smoke Test — fetch-only health/contract probes against the public
// surface + Supabase Edge Functions. No Playwright.
// Designed for post-deploy verification.
//
// Keine Nutzer-Sitzung, kein Geheimnis: Der einzige Schlüssel ist der
// öffentliche Anon-Key (SUPABASE_ANON_KEY, liegt ohnehin im Frontend-Bundle).
// Die beiden Autorisierungs-Proben brauchen ihn, weil sie gerade belegen,
// dass er allein NICHT genügt.
//
// Usage:
//   tsx scripts/qa-smoke-test.ts
//   SUPABASE_URL=https://x.supabase.co RSD_BASE_URL=https://x.de tsx scripts/qa-smoke-test.ts
//
// Exit code 1 if any test FAILs.

const BASE_URL     = process.env.RSD_BASE_URL ?? 'https://realsyncdynamicsai.de';
const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'https://ebljyceifhnlzhjfyxup.supabase.co').replace(/\/$/,  '');
const TIMEOUT_MS   = Number(process.env.RSD_SMOKE_TIMEOUT_MS) || 15_000;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY ?? '';

interface Result {
  name: string;
  ok: boolean;
  status?: number;
  detail: string;
}

interface Probe {
  name: string;
  run: () => Promise<Result>;
}

const probes: Probe[] = [
  {
    name: '/audit reachable',
    run: async () => fetchAndExpect(`${BASE_URL}/audit`, (r) => r.ok && (r as { body: string }).body.includes('RealSyncDynamics')),
  },
  {
    name: '/pricing reachable',
    run: async () => fetchAndExpect(`${BASE_URL}/pricing`, (r) => r.ok && (r as { body: string }).body.includes('Free Audit')),
  },
  {
    name: '/integrations/shopify reachable',
    run: async () => fetchAndExpect(`${BASE_URL}/integrations/shopify`, (r) => r.ok),
  },
  {
    name: 'gdpr-audit · valid URL returns audit_id + score',
    run: async () => postFn('gdpr-audit', { url: 'https://example.de', email: 'test@example.com' }, (status, body) => {
      if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
      if (typeof body !== 'object' || body == null) return { ok: false, detail: 'response not an object' };
      const b = body as Record<string, unknown>;
      if (typeof b.audit_id !== 'string') return { ok: false, detail: 'missing audit_id' };
      if (typeof b.score !== 'number') return { ok: false, detail: 'missing score' };
      if (!Array.isArray(b.issues)) return { ok: false, detail: 'missing issues array' };
      return { ok: true, detail: `audit_id=${(b.audit_id as string).slice(0, 8)}… score=${b.score}` };
    }),
  },
  {
    name: 'gdpr-audit · empty URL returns 400',
    run: async () => postFn('gdpr-audit', { url: '', email: 'test@example.com' }, (status) =>
      ({ ok: status === 400, detail: `expected 400, got ${status}` })),
  },
  {
    name: 'gdpr-audit · invalid email returns 400',
    run: async () => postFn('gdpr-audit', { url: 'https://example.de', email: 'not-an-email' }, (status) =>
      ({ ok: status === 400, detail: `expected 400, got ${status}` })),
  },
  {
    name: 'shopify-install · no shop param returns 400',
    run: async () => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/shopify-install`;
        const res = await fetchWithTimeout(url);
        return { name: '', ok: res.status === 400, status: res.status, detail: `expected 400, got ${res.status}` };
      } catch (e) {
        return { name: '', ok: false, detail: (e as Error).message };
      }
    },
  },
  {
    name: 'stripe-checkout · without auth returns 401',
    run: async () => postFn('stripe-checkout', { planKey: 'starter' }, (status) =>
      ({ ok: status === 401, detail: `expected 401, got ${status}` }), false),
  },
  {
    name: 'stripe-webhook · without signature returns 400',
    run: async () => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'evt_test', type: 'noop' }),
        });
        return { name: '', ok: res.status === 400, status: res.status, detail: `expected 400, got ${res.status}` };
      } catch (e) {
        return { name: '', ok: false, detail: (e as Error).message };
      }
    },
  },
  // ── Der Anon-Key ist keine Autorisierung ────────────────────────────────
  //
  // Der öffentliche Anon-Key liegt im Frontend-Bundle und ist ein gültiges
  // JWT. `verify_jwt = true` in config.toml lässt ihn deshalb passieren —
  // die Plattform-Einstellung ist ein Vorfilter gegen tokenlose Aufrufe,
  // kein Autorisierungs-Tor. Am 2026-09-27 gegen die deployten Functions
  // gemessen: ohne Header 401, MIT Anon-Key erreichten beide Functions ihre
  // eigene Validierung (HTTP 400). Genau darauf beruhten #1392, #1615 und
  // #1627.
  //
  // Diese beiden Proben sind der Laufzeit-Nachweis dafür, dass die
  // Mitgliedschaftsprüfung wirklich VOR der Arbeit steht. Sie sind bis zum
  // Deploy von #1615/#1627 rot — das ist gewollt und der Punkt.
  //
  // Die Körper sind so gewählt, dass sie auf KEINEM Stand Arbeit auslösen:
  // ohne Fix endet der Aufruf in der Feldprüfung (400), mit Fix im Resolver
  // (401). Kein Provider-Call, kein Schreibvorgang, keine Kosten.
  {
    name: 'optimize-analyze · Anon-Key allein reicht nicht (401, nicht 400)',
    run: async () => {
      if (!ANON_KEY) return anonKeyFehlt();
      return postFn('optimize-analyze', {}, (status) => ({
        ok: status === 401,
        detail: status === 400
          ? 'HTTP 400 — der Aufruf hat die Validierung der Function erreicht, die Autorisierung greift also nicht vor der Arbeit (#1615 nicht deployed)'
          : `erwartet 401, erhalten ${status}`,
      }));
    },
  },
  {
    name: 'website-maintenance-agent · Anon-Key allein reicht nicht (401, nicht 400)',
    run: async () => {
      if (!ANON_KEY) return anonKeyFehlt();
      // 'scan-seo' passiert die Aktions-Prüfung; ohne Fix bleibt der Aufruf
      // an der project_id hängen (400), mit Fix am Resolver (401).
      return postFn('website-maintenance-agent', { action: 'scan-seo' }, (status) => ({
        ok: status === 401,
        detail: status === 400
          ? 'HTTP 400 — der Aufruf hat die Feldprüfung der Aktion erreicht, die Autorisierung greift also nicht vor der Arbeit (#1627 nicht deployed)'
          : `erwartet 401, erhalten ${status}`,
      }));
    },
  },
  {
    name: 'governance-agent · without acknowledge_us_routing returns 412',
    run: async () => postFn('governance-agent', { op: 'chat', tenant_id: '00000000-0000-0000-0000-000000000000', message: 'hi' }, (status) =>
      ({ ok: status === 401 || status === 412, detail: `expected 401/412, got ${status}` }), false),
  },
  {
    name: 'health · returns status field',
    run: async () => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/health`;
        const res = await fetchWithTimeout(url);
        let parsed: unknown = null;
        try { parsed = await res.json(); } catch { /* ignore */ }
        const status = (parsed as Record<string, unknown> | null)?.status;
        const ok = (res.status === 200 || res.status === 503) && (status === 'ok' || status === 'degraded' || status === 'down');
        return { name: '', ok, status: res.status, detail: ok ? `status=${status}` : `unexpected response (HTTP ${res.status})` };
      } catch (e) {
        return { name: '', ok: false, detail: (e as Error).message };
      }
    },
  },
  {
    name: 'cookie-scan · valid URL returns score + severity',
    run: async () => postFn('cookie-scan', { url: 'https://example.com' }, (status, body) => {
      if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
      if (typeof body !== 'object' || body == null) return { ok: false, detail: 'response not an object' };
      const b = body as Record<string, unknown>;
      if (typeof b.score !== 'number') return { ok: false, detail: 'missing score' };
      if (typeof b.severity !== 'string') return { ok: false, detail: 'missing severity' };
      return { ok: true, detail: `score=${b.score} severity=${b.severity}` };
    }, false),
  },
  {
    name: 'cookie-scan · invalid URL returns 400',
    run: async () => postFn('cookie-scan', { url: 'not-a-url' }, (status) =>
      ({ ok: status === 400, detail: `expected 400, got ${status}` }), false),
  },
  {
    name: 'newsletter-subscribe · invalid email returns 400',
    run: async () => postFn('newsletter-subscribe', { email: 'not-an-email' }, (status) =>
      ({ ok: status === 400, detail: `expected 400, got ${status}` }), false),
  },
];

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init ?? {}), signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchAndExpect(url: string, predicate: (r: { ok: boolean; status: number; body: string }) => boolean): Promise<Result> {
  try {
    const res = await fetchWithTimeout(url, { headers: { 'user-agent': 'RealSyncDynamicsAI-Smoke/1.0' } });
    const body = await res.text();
    const ok = predicate({ ok: res.ok, status: res.status, body });
    return { name: '', ok, status: res.status, detail: ok ? 'OK' : `HTTP ${res.status}, body matched=false` };
  } catch (e) {
    return { name: '', ok: false, detail: (e as Error).message };
  }
}

/**
 * Ohne den öffentlichen Anon-Key ist der Nachweis nicht zu führen: `postFn`
 * schickte dann gar keinen Header, die Plattform antwortete 401 — und die
 * Probe bestünde aus dem falschen Grund. Ein stilles Bestehen ist bei einer
 * Sicherheitsprobe der schlechteste Ausgang, deshalb gilt der fehlende
 * Schlüssel als Fehlschlag mit benanntem Grund.
 */
function anonKeyFehlt(): Result {
  return {
    name: '',
    ok: false,
    detail: 'SUPABASE_ANON_KEY nicht gesetzt — ohne ihn belegt die Probe nichts (der Schlüssel ist öffentlich)',
  };
}

async function postFn(
  fnName: string,
  body: Record<string, unknown>,
  check: (status: number, parsed: unknown) => { ok: boolean; detail: string },
  withAuth = true,
): Promise<Result> {
  const url = `${SUPABASE_URL}/functions/v1/${fnName}`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (withAuth && ANON_KEY) headers.authorization = `Bearer ${ANON_KEY}`;
  try {
    const res = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) });
    let parsed: unknown = null;
    try { parsed = await res.json(); } catch { /* may be text body */ }
    const result = check(res.status, parsed);
    return { name: '', ok: result.ok, status: res.status, detail: result.detail };
  } catch (e) {
    return { name: '', ok: false, detail: (e as Error).message };
  }
}

async function main() {
  console.log(`\nQA Smoke Test\n  BASE_URL=${BASE_URL}\n  SUPABASE_URL=${SUPABASE_URL}\n`);
  const results: Result[] = [];
  for (const p of probes) {
    const r = await p.run();
    r.name = p.name;
    results.push(r);
    const tag = r.ok ? '✓' : '✗';
    const color = r.ok ? '\x1b[32m' : '\x1b[31m';
    console.log(`${color}${tag}\x1b[0m  ${p.name} — ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.error('\nFailures:');
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main();
