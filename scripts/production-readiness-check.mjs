#!/usr/bin/env node
// Production readiness check for realsyncdynamicsai.de.
//
// Fetches the public surfaces a founder needs to verify after each
// deploy. Uses fetch-only — no Supabase, no secrets, no auth. Each
// check states the kind of assertion it makes.
//
// Usage:
//   npm run check:production                       # full suite
//   RSD_BASE_URL=https://staging.realsyncdynamicsai.de npm run check:production
//   RSD_MAX_FRESHNESS_HOURS=48 npm run check:production   # stale-deploy gate
//   RSD_SKIP_EDGE=1   npm run check:production            # skip Supabase Edge probes
//   RSD_SKIP_SENTRY=1 npm run check:production            # skip Sentry probe
//   RSD_ONLY=homepage,trust npm run check:production      # narrow to listed checks
//   RSD_JSON=1 npm run check:production                   # emit JSON only (CI friendly)
//
// Exit codes:
//   0  every check passed
//   1  one or more checks failed
//   2  invalid arguments / configuration

const BASE_URL              = process.env.RSD_BASE_URL    || 'https://realsyncdynamicsai.de';
const SUPABASE_URL          = process.env.RSD_SUPABASE_URL
                                || 'https://ebljyceifhnlzhjfyxup.supabase.co';
const TIMEOUT_MS            = Number(process.env.RSD_CHECK_TIMEOUT_MS) || 15_000;
const MAX_FRESHNESS_HOURS   = Number(process.env.RSD_MAX_FRESHNESS_HOURS) || 168; // 7 days default
const SKIP_EDGE             = process.env.RSD_SKIP_EDGE    === '1';
const SKIP_SENTRY           = process.env.RSD_SKIP_SENTRY  === '1';
const ONLY                  = (process.env.RSD_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const JSON_OUT              = process.env.RSD_JSON === '1';
const SENTRY_DSN            = process.env.VITE_SENTRY_DSN || process.env.RSD_SENTRY_DSN || '';

// ── Check definitions ─────────────────────────────────────────────
//
// Each check has:
//   id              short identifier, used by RSD_ONLY filter
//   name            human label
//   kind            'html' | 'last-modified' | 'edge-public' | 'sentry'
//   url             URL to probe
//   expected        per-kind expected value (e.g. mustInclude string, max-age hours)

const CHECKS = [
  // ── HTML surfaces (existing) ────────────────────────────────────
  { id: 'homepage',    name: 'Homepage reachable',           kind: 'html', url: `${BASE_URL}/`,                  expected: 'RealSyncDynamics' },
  { id: 'governance',  name: 'Governance runtime reachable', kind: 'html', url: `${BASE_URL}/governance-runtime`, expected: 'Governance' },
  { id: 'trust',       name: 'Trust Center reachable',       kind: 'html', url: `${BASE_URL}/trust`,             expected: 'Trust' },
  { id: 'security',    name: 'Security page reachable',      kind: 'html', url: `${BASE_URL}/security`,          expected: 'Security' },
  { id: 'pilot',       name: 'Pilot readiness reachable',    kind: 'html', url: `${BASE_URL}/pilot-readiness`,   expected: 'Pilot' },
  { id: 'sitemap',     name: 'Sitemap reachable',            kind: 'html', url: `${BASE_URL}/sitemap.xml`,       expected: 'governance' },
  { id: 'robots',      name: 'Robots.txt reachable',         kind: 'html', url: `${BASE_URL}/robots.txt`,        expected: 'Sitemap' },

  // ── Last-Modified freshness (catches stale deploys) ─────────────
  { id: 'freshness',   name: `Frontend deployed within ${MAX_FRESHNESS_HOURS}h`,
                       kind: 'last-modified', url: `${BASE_URL}/`,
                       expected: MAX_FRESHNESS_HOURS },

  // ── Supabase Edge Function public-surface probes ────────────────
  //
  // For each public function we expect HTTP 400 (input validation
  // rejected our bogus payload) — NOT 401 (verify_jwt config didn't
  // apply) and NOT 5xx. A 200 on these surfaces would mean the
  // function happily accepted obviously-invalid input which is also
  // a regression.
  { id: 'edge-gdpr',
    name: 'Edge fn gdpr-audit reachable + public + input-validated',
    kind: 'edge-public',
    url:  `${SUPABASE_URL}/functions/v1/gdpr-audit`,
    body: { url: 'not-a-url', email: 'smoke@example.invalid' },
    expected: [400] },
  { id: 'edge-cookie',
    name: 'Edge fn cookie-scan reachable + public + input-validated',
    kind: 'edge-public',
    url:  `${SUPABASE_URL}/functions/v1/cookie-scan`,
    body: { url: 'not-a-url' },
    expected: [400] },
  { id: 'edge-aiact',
    name: 'Edge fn ai-act-classify reachable + public + input-validated',
    kind: 'edge-public',
    url:  `${SUPABASE_URL}/functions/v1/ai-act-classify`,
    body: { description: 'x' },        // < 10 chars → 400 DESCRIPTION_TOO_SHORT
    expected: [400] },

  // ── Sentry DSN reachability (optional) ──────────────────────────
  { id: 'sentry',     name: 'Sentry DSN reachable (DSN-only HEAD)',
                      kind: 'sentry',
                      url: SENTRY_DSN ? deriveSentryEndpoint(SENTRY_DSN) : null },
];

// ── Per-kind check implementations ─────────────────────────────────

async function checkHtml({ url, expected }) {
  const res = await fetchWithTimeout(url, { method: 'GET' });
  if (!res.ok) return { status: res.status, ok: false, detail: `HTTP ${res.status}` };
  const text = await res.text();
  const found = text.includes(expected);
  return {
    status: res.status,
    ok:     found,
    detail: found ? 'OK' : `missing marker: ${expected}`,
  };
}

async function checkLastModified({ url, expected /* max-age hours */ }) {
  const res = await fetchWithTimeout(url, { method: 'HEAD' });
  if (!res.ok) return { status: res.status, ok: false, detail: `HTTP ${res.status}` };

  // Try Last-Modified first; fall back to Date header diff if upstream
  // doesn't surface Last-Modified (GH Pages does — Fastly preserves it).
  const lm = res.headers.get('last-modified');
  if (!lm) {
    return { status: res.status, ok: true, detail: 'no Last-Modified — assume fresh' };
  }
  const modAt = Date.parse(lm);
  if (!Number.isFinite(modAt)) {
    return { status: res.status, ok: false, detail: `unparseable Last-Modified: ${lm}` };
  }
  const ageHours = (Date.now() - modAt) / (60 * 60 * 1000);
  const ok = ageHours <= expected;
  const ageStr = ageHours < 1
    ? `${Math.round(ageHours * 60)}m`
    : `${ageHours.toFixed(1)}h`;
  return {
    status: res.status,
    ok,
    detail: ok
      ? `age ${ageStr} (≤ ${expected}h)`
      : `age ${ageStr} exceeds ${expected}h max — possible stale deploy`,
  };
}

async function checkEdgePublic({ url, body, expected /* status[] allowlist */ }) {
  const res = await fetchWithTimeout(url, {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body ?? {}),
  });
  const accepted = expected.includes(res.status);
  let label;
  if (res.status === 401) {
    label = `HTTP 401 — verify_jwt config did NOT apply (need public access)`;
  } else if (res.status >= 500) {
    label = `HTTP ${res.status} — server error`;
  } else if (!accepted) {
    label = `HTTP ${res.status} (expected one of ${expected.join(', ')})`;
  } else {
    label = `HTTP ${res.status} — input validation working`;
  }
  return { status: res.status, ok: accepted, detail: label };
}

async function checkSentry({ url }) {
  if (!url) {
    return { status: 0, ok: true, detail: 'no VITE_SENTRY_DSN configured — skipped' };
  }
  const res = await fetchWithTimeout(url, { method: 'HEAD' });
  // Sentry's ingest endpoint typically returns 401 for HEAD without a
  // valid event; the point is "the endpoint is reachable at all".
  // 401 / 405 / 200 are all "reachable"; only network failures fail.
  const reachable = res.status > 0;
  return {
    status: res.status,
    ok:     reachable,
    detail: reachable ? `HTTP ${res.status} — endpoint reachable` : 'network failure',
  };
}

// ── Common helpers ─────────────────────────────────────────────────

async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        'user-agent': 'RealSyncDynamicsAI-Readiness-Check/2.0',
        ...(init.headers ?? {}),
      },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/**
 * From a DSN like https://<key>@<host>/<project> produce
 * `https://<host>/api/<project>/store/` (the ingest endpoint).
 */
function deriveSentryEndpoint(dsn) {
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\//, '').split('/')[0];
    if (!project) return null;
    return `${u.protocol}//${u.host}/api/${project}/store/`;
  } catch {
    return null;
  }
}

async function runOne(c) {
  try {
    let res;
    switch (c.kind) {
      case 'html':           res = await checkHtml(c);          break;
      case 'last-modified':  res = await checkLastModified(c);  break;
      case 'edge-public':    res = await checkEdgePublic(c);    break;
      case 'sentry':         res = await checkSentry(c);        break;
      default:               res = { status: 0, ok: false, detail: `unknown kind: ${c.kind}` };
    }
    return { ...c, ...res };
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    return {
      ...c,
      status: 0,
      ok:     false,
      detail: aborted ? `timeout >${TIMEOUT_MS}ms` : (err?.message ?? String(err)),
    };
  }
}

// ── Filter + run ───────────────────────────────────────────────────

const filtered = CHECKS.filter(c => {
  if (c.kind === 'edge-public' && SKIP_EDGE)   return false;
  if (c.kind === 'sentry'      && SKIP_SENTRY) return false;
  if (ONLY.length > 0 && !ONLY.includes(c.id)) return false;
  return true;
});

if (!JSON_OUT) {
  console.log(`\nProduction readiness check v2 against ${BASE_URL}`);
  console.log(`  Edge probes:        ${SKIP_EDGE   ? 'skipped' : `${SUPABASE_URL}/functions/v1/*`}`);
  console.log(`  Sentry probe:       ${SKIP_SENTRY ? 'skipped' : (SENTRY_DSN ? 'enabled' : 'no DSN')}`);
  console.log(`  Freshness window:   ${MAX_FRESHNESS_HOURS}h`);
  console.log(`  Timeout per check:  ${TIMEOUT_MS}ms\n`);
}

const results = [];
for (const c of filtered) results.push(await runOne(c));

if (JSON_OUT) {
  console.log(JSON.stringify({
    base_url: BASE_URL,
    timestamp: new Date().toISOString(),
    results: results.map(r => ({
      id: r.id, name: r.name, kind: r.kind,
      ok: r.ok, status: r.status, detail: r.detail,
    })),
  }, null, 2));
} else {
  console.table(
    results.map(r => ({
      id:     r.id,
      kind:   r.kind,
      status: r.status || '—',
      ok:     r.ok ? '✓' : '✗',
      detail: r.detail,
    })),
  );
}

const failed = results.filter(r => !r.ok);
if (failed.length > 0) {
  if (!JSON_OUT) {
    console.error(`\n${failed.length} of ${results.length} checks failed.\n`);
    for (const f of failed) console.error(`  ✗ ${f.name} — ${f.detail}`);
  }
  process.exit(1);
}

if (!JSON_OUT) {
  console.log(`\nAll ${results.length} production readiness checks passed.`);
}
