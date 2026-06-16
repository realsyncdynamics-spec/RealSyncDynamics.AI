#!/usr/bin/env -S node --experimental-strip-types
// QA Governance — Dogfooding-Check: ruft die öffentliche `gdpr-audit`
// Edge Function gegen die eigenen Marketing-/Legal-Seiten auf und prüft,
// dass die Rule Engine dort keine `critical`-Befunde meldet.
//
// Deckt ab (über die bestehende Rule Engine in
// supabase/functions/_shared/rules/{gdpr,ai-act}.json + die Heuristiken in
// gdpr-audit/index.ts):
//   - DSGVO Art. 13 (Datenschutzerklärung-Link)
//   - Impressum / § 5 TMG-Pflichtfelder
//   - Consent-Banner + gleichwertige "Ablehnen"-Option
//   - Tracking vor Consent (GA/Meta/LinkedIn/TikTok/Hotjar/Clarity)
//   - Security-Header (HSTS, CSP, X-Frame-Options)
//   - Third-Party-/Reverse-IP-Tracker
//   - EU-AI-Act-Hinweise (Chatbot-Disclosure etc.)
//
// Usage:
//   tsx scripts/qa-governance.ts
//   RSD_BASE_URL=https://staging.realsyncdynamicsai.de tsx scripts/qa-governance.ts
//
// Exit code 1, wenn eine geprüfte Seite einen 'critical'-Befund hat.

const BASE_URL     = (process.env.RSD_BASE_URL ?? 'https://realsyncdynamicsai.de').replace(/\/$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'https://ebljyceifhnlzhjfyxup.supabase.co').replace(/\/$/, '');
const TIMEOUT_MS   = Number(process.env.RSD_GOVERNANCE_TIMEOUT_MS) || 30_000;

// Eigene Seiten, gegen die der Audit laufen soll. '/' deckt das
// Marketing-Layout (Cookie-Banner, Tracker) ab.
const TARGET_PATHS = (process.env.RSD_GOVERNANCE_PATHS ?? '/,/pricing,/audit,/datenschutz,/impressum')
  .split(',').map((p) => p.trim()).filter(Boolean);

interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
}

interface AuditResponse {
  ok: boolean;
  score?: number;
  severity?: string;
  issues?: Issue[];
  error?: { code: string; message: string };
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init ?? {}), signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function auditPath(path: string): Promise<{ path: string; ok: boolean; detail: string; critical: Issue[] }> {
  const target = `${BASE_URL}${path}`;
  const url = `${SUPABASE_URL}/functions/v1/gdpr-audit`;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: target, email: 'qa-governance@realsyncdynamicsai.de', source: 'qa_governance' }),
    });
    const body = (await res.json()) as AuditResponse;
    if (!body.ok) {
      return { path, ok: false, detail: `HTTP ${res.status} — ${body.error?.code ?? 'unknown'}: ${body.error?.message ?? ''}`, critical: [] };
    }
    const critical = (body.issues ?? []).filter((i) => i.severity === 'critical');
    const ok = critical.length === 0;
    const detail = ok
      ? `score=${body.score}/100, severity=${body.severity}`
      : `score=${body.score}/100 — ${critical.length} kritische(r) Befund(e): ${critical.map((i) => i.id).join(', ')}`;
    return { path, ok, detail, critical };
  } catch (e) {
    return { path, ok: false, detail: (e as Error).message, critical: [] };
  }
}

async function main() {
  console.log(`\nQA Governance (Dogfooding)\n  BASE_URL=${BASE_URL}\n  SUPABASE_URL=${SUPABASE_URL}\n  PATHS=${TARGET_PATHS.join(', ')}\n`);

  const results = [];
  for (const path of TARGET_PATHS) {
    const r = await auditPath(path);
    results.push(r);
    const tag = r.ok ? '✓' : '✗';
    const color = r.ok ? '\x1b[32m' : '\x1b[31m';
    console.log(`${color}${tag}\x1b[0m  ${path} — ${r.detail}`);
    for (const issue of r.critical) {
      console.log(`     - [critical] ${issue.id}: ${issue.title}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} Seiten ohne kritische Befunde.`);
  if (failed.length > 0) {
    console.error('\nFehlgeschlagen:');
    for (const f of failed) console.error(`  - ${f.path}: ${f.detail}`);
    process.exit(1);
  }
}

main();
