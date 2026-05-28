// audit-report-pdf — DSGVO-Audit-Nachweis-Report Edge Function
// POST /functions/v1/audit-report-pdf  { audit_id: uuid }
// Auth: Bearer JWT (eigener Audit) oder ohne (Super-Admin via SRK)
// Output: HTML-Report in Storage + 24h Signed-URL
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { applyPolicy, sumHits, type RedactionPolicy } from '../_shared/redact.ts';
import { resolveBranding, DEFAULT_BRANDING, type Branding } from '../_shared/branding.ts';

// Owner-Daten (email/company/domain des Audit-Anforderers) bleiben Klartext.
// Geschwaerzt werden NUR die issues[].title/detail/paragraph_ref — dort
// koennen URLs/Form-Inhalte/Cookie-Werte fremder Domains stecken, die der
// Scanner einsammelt und die nicht in einem geteilten Report landen sollen.
const REDACTION_POLICY: RedactionPolicy = 'third_party_only';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  paragraph_ref?: string;
}
interface AuditRow {
  id: string;
  url: string;
  domain: string;
  email: string;
  company: string | null;
  score: number;
  severity: string;
  issues: Issue[];
  fetched_status: number | null;
  fetched_at: string | null;
  created_at: string;
}

// Severity-Farben sind konstant über alle Brands (Ampel-Semantik darf
// nicht per Kunden-Branding gekippt werden — sonst sind Reports nicht
// mehr vergleichbar). Nur bg / card / border / accent sind brand-bar.
const C_BASE = {
  bg: '#0A0A0F', card: '#13131A', border: '#1E1E28', text: '#E2E2E2', muted: '#9CA3AF',
  critical: '#EF4444', high: '#F97316', medium: '#F59E0B',
  low: '#3B82F6', info: '#6B7280', pass: '#10B981',
};
function paletteFor(branding: Branding) {
  return { ...C_BASE, accent: branding.primaryColor };
}
const SEV: Record<string, string> = {
  critical: 'KRITISCH', high: 'HOCH', medium: 'MITTEL', low: 'NIEDRIG', info: 'INFO', pass: 'BESTANDEN',
};

function severityColor(C: ReturnType<typeof paletteFor>, severity: string): string {
  return (C as Record<string, string>)[severity] ?? C.muted;
}
function severityMeta(C: ReturnType<typeof paletteFor>, severity: string): { label: string; color: string } {
  return { label: SEV[severity] ?? severity.toUpperCase(), color: severityColor(C, severity) };
}
function escapeHtml(s: string | null | undefined): string {
  return s?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') ?? '';
}

function buildHtml(audit: AuditRow, reportUrl: string, branding: Branding = DEFAULT_BRANDING): string {
  const C = paletteFor(branding);
  const scoreColor = audit.score >= 80 ? C.pass : audit.score >= 50 ? C.medium : audit.score >= 30 ? C.high : C.critical;
  const generatedAt = new Date().toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Europe/Berlin' });
  const statsByLevel = ['critical', 'high', 'medium', 'low', 'info']
    .map(level => ({ level, count: audit.issues.filter(i => i.severity === level).length }))
    .filter(x => x.count > 0);
  const statsHtml = statsByLevel.map(({ level, count }) => {
    const { label, color } = severityMeta(C, level);
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:999px;background:${color}18;border:1px solid ${color}44;margin:3px;"><b style="color:${color};">${count}</b><span style="color:${C.muted};font-size:11px;">${label}</span></span>`;
  }).join('');
  const rows = audit.issues.map(issue => {
    const { label, color } = severityMeta(C, issue.severity);
    return `<tr><td style="padding:10px 12px;border-bottom:1px solid ${C.border};vertical-align:top;width:110px;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${color}22;color:${color};border:1px solid ${color}44;">${label}</span></td><td style="padding:10px 12px;border-bottom:1px solid ${C.border};vertical-align:top;"><b style="color:${C.text};font-size:13px;">${escapeHtml(issue.title)}</b><br><span style="color:${C.muted};font-size:12px;">${escapeHtml(issue.detail)}</span>${issue.paragraph_ref ? `<br><code style="color:${C.accent};font-size:11px;background:${C.accent}18;padding:1px 5px;border-radius:3px;">${escapeHtml(issue.paragraph_ref)}</code>` : ''}</td></tr>`;
  }).join('');
  const urgent = audit.issues.filter(i => ['critical', 'high'].includes(i.severity));
  const actionsHtml = urgent.length > 0 ? `<div style="padding:0 40px 28px;"><h2 style="font-size:13px;font-weight:600;color:${C.muted};letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;">Sofortmassnahmen (${urgent.length})</h2><div style="background:${C.card};border:1px solid ${C.border};border-radius:8px;padding:20px;">${urgent.map((issue, idx) => `<div style="display:flex;gap:12px;margin-bottom:${idx < urgent.length - 1 ? '14px' : '0'};"><div style="width:24px;height:24px;border-radius:50%;background:${severityColor(C, issue.severity)}22;border:1px solid ${severityColor(C, issue.severity)}55;display:flex;align-items:center;justify-content:center;color:${severityColor(C, issue.severity)};font-weight:700;font-size:11px;flex-shrink:0;">${idx + 1}</div><div><b style="color:${C.text};">${escapeHtml(issue.title)}</b>${issue.paragraph_ref ? `<code style="display:block;color:${C.accent};font-size:11px;margin-top:2px;">${escapeHtml(issue.paragraph_ref)}</code>` : ''}</div></div>`).join('')}</div></div>` : '';
  const logoHtml = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.brandName)}" style="max-height:36px;max-width:180px;margin-bottom:8px;display:block;">`
    : '';
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>DSGVO-Audit-Report — ${escapeHtml(audit.domain)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:${C.bg};color:${C.text};font-family:'Courier New',monospace;font-size:13px;line-height:1.6}@media print{body{background:#fff;color:#111}}</style></head><body>
<div style="background:${C.card};border-bottom:2px solid ${C.accent};padding:28px 40px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;"><div>${logoHtml}<div style="font-size:10px;letter-spacing:.14em;color:${C.muted};text-transform:uppercase;margin-bottom:4px;">${escapeHtml(branding.headerTagline)}</div><h1 style="font-size:22px;font-weight:700;color:${C.text};">DSGVO-Audit-Report</h1><div style="color:${C.muted};font-size:12px;margin-top:4px;">${escapeHtml(audit.url)}</div></div><div style="text-align:right;"><div style="font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.1em;">Compliance-Score</div><div style="font-size:52px;font-weight:700;color:${scoreColor};line-height:1;">${audit.score}</div><div style="font-size:11px;color:${C.muted};">von 100</div></div></div>
<div style="padding:18px 40px;background:${C.card};border-bottom:1px solid ${C.border};display:flex;flex-wrap:wrap;gap:22px;"><div><div style="font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.08em;">Domain</div><b>${escapeHtml(audit.domain)}</b></div>${audit.company ? `<div><div style="font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.08em;">Unternehmen</div><b>${escapeHtml(audit.company)}</b></div>` : ''}<div><div style="font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.08em;">Datum</div><b>${new Date(audit.created_at).toLocaleDateString('de-DE')}</b></div><div><div style="font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.08em;">Schweregrad</div><b style="color:${severityColor(C, audit.severity)};text-transform:uppercase;">${audit.severity}</b></div><div><div style="font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.08em;">Engine</div><b>2026.05.0</b></div></div>
<div style="padding:26px 40px;"><h2 style="font-size:13px;font-weight:600;color:${C.muted};letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;">Zusammenfassung</h2><div style="margin-bottom:14px;">${statsHtml || '<span style="color:' + C.pass + '">Keine Befunde</span>'}</div><div style="color:${C.muted};font-size:12px;line-height:1.7;">Automatisch erstellt durch ${escapeHtml(branding.brandName)} Compliance Engine v2026.05.0. Dokumentiert den DSGVO-Status von <b style="color:${C.text};">${escapeHtml(audit.domain)}</b> und kann als technischer Nachweis gegenüber Datenschutzbeauftragten und Aufsichtsbehörden verwendet werden.<br><b style="color:${C.text};">Hinweis:</b> Kein Ersatz für rechtliche Beratung.</div></div>
<div style="padding:0 40px 28px;"><h2 style="font-size:13px;font-weight:600;color:${C.muted};letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;">Befunde (${audit.issues.length})</h2>${audit.issues.length > 0 ? `<table style="width:100%;border-collapse:collapse;background:${C.card};border:1px solid ${C.border};border-radius:8px;overflow:hidden;"><thead><tr style="background:${C.border};"><th style="padding:9px 12px;text-align:left;font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.08em;width:110px;">Schweregrad</th><th style="padding:9px 12px;text-align:left;font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.08em;">Befund</th></tr></thead><tbody>${rows}</tbody></table>` : `<div style="padding:20px;background:${C.card};border:1px solid ${C.pass}33;border-radius:8px;color:${C.pass};text-align:center;">Keine Compliance-Probleme gefunden.</div>`}</div>
${actionsHtml}
<div style="padding:18px 40px;border-top:1px solid ${C.border};display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;"><div style="font-size:11px;color:${C.muted};">Erstellt am ${generatedAt} · Audit-ID: <code style="color:${C.text};">${escapeHtml(audit.id)}</code></div><div style="font-size:11px;color:${C.muted};"><a href="${escapeHtml(reportUrl)}" style="color:${C.accent};text-decoration:none;">Online-Report →</a></div></div>
<div style="padding:10px 40px;background:${C.card};border-top:1px solid ${C.border};font-size:10px;color:${C.muted};text-align:center;">${escapeHtml(branding.footerText)} · ${escapeHtml(branding.supportEmail)}</div>
</body></html>`;
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
}
function errorJson(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorJson(405, 'BAD_REQUEST', 'POST only');
  const SUPA = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  let body: { audit_id?: string };
  try { body = await req.json(); } catch { return errorJson(400, 'BAD_JSON', 'invalid json'); }
  const auditId = (body.audit_id ?? '').trim();
  if (!UUID_RE.test(auditId)) return errorJson(400, 'INVALID_AUDIT_ID', 'valid uuid required');
  const admin = createClient(SUPA, SRK, { auth: { persistSession: false } });
  const jwt = req.headers.get('authorization')?.replace('Bearer ', '').trim() ?? '';
  let callerEmail: string | null = null;
  if (jwt) {
    const uc = createClient(SUPA, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: { user } } = await uc.auth.getUser();
    callerEmail = user?.email ?? null;
  }
  const { data: audit, error: auditErr } = await admin.from('gdpr_audits')
    .select('id,url,domain,email,company,score,severity,issues,fetched_status,fetched_at,created_at,tenant_id')
    .eq('id', auditId).single();
  if (auditErr || !audit) return errorJson(404, 'NOT_FOUND', 'audit not found');
  if (callerEmail && callerEmail.toLowerCase() !== audit.email.toLowerCase()) {
    const { data: profile } = await admin.from('profiles').select('is_super_admin')
      .eq('id', (await admin.auth.admin.getUserByEmail(callerEmail)).data.user?.id ?? '').single();
    if (!profile?.is_super_admin) return errorJson(403, 'FORBIDDEN', 'not your audit');
  }
  // PII-Redaction nur auf den issues-Teilbaum. Owner-Felder (email, company,
  // domain) bleiben Klartext — der Bericht ist fuer den Owner selbst.
  const { redacted: redactedIssues, hits: issueHits } = applyPolicy(
    audit.issues as Issue[], REDACTION_POLICY);
  const redactedAudit = { ...audit, issues: redactedIssues } as AuditRow;
  // White-Label-Branding: nur wenn audit.tenant_id gesetzt UND der Tenant
  // das whitelabel.reports-Entitlement hat. Sonst DEFAULT_BRANDING.
  const branding = await resolveBranding(admin, (audit as { tenant_id?: string }).tenant_id ?? null);
  const storagePath = `audit-reports/${auditId}.html`;
  const { data: existing } = await admin.storage.from('documents').list('audit-reports', { search: `${auditId}.html` });
  const htmlBytes = new TextEncoder().encode(buildHtml(redactedAudit, `https://realsyncdynamicsai.de/audit/report/${auditId}`, branding));
  const { error: upErr } = await admin.storage.from('documents')
    .upload(storagePath, htmlBytes, { contentType: 'text/html; charset=utf-8', upsert: true, cacheControl: '3600' });
  if (upErr) return errorJson(500, 'UPLOAD_FAILED', upErr.message);
  const { data: signed, error: signErr } = await admin.storage.from('documents').createSignedUrl(storagePath, 86400);
  if (signErr || !signed) return errorJson(500, 'SIGNED_URL_FAILED', signErr?.message ?? 'unknown');
  await admin.from('gdpr_audits').update({
    methodology: { audit_engine: '2026.05.0', report_generated_at: new Date().toISOString(), report_storage_path: storagePath },
  }).eq('id', auditId);
  // Redaction-Audit: pro Report eine Zeile, auch bei 0 Treffern.
  await admin.from('pii_redaction_log').insert({
    function_name: 'audit-report-pdf',
    policy_applied: REDACTION_POLICY,
    correlation_id: auditId,
    hits_total: sumHits(issueHits),
    hits_by_category: issueHits,
    payload_bytes: htmlBytes.byteLength,
  });
  const issueStats = (audit.issues as Issue[]).reduce((acc, i) => { acc[i.severity] = (acc[i.severity] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  return okJson({
    ok: true,
    audit_id: auditId,
    domain: audit.domain,
    score: audit.score,
    severity: audit.severity,
    report_url: signed.signedUrl,
    storage_path: storagePath,
    issue_count: (audit.issues as Issue[]).length,
    issue_stats: issueStats,
    generated_at: new Date().toISOString(),
    format: 'html',
    already_existed: (existing?.length ?? 0) > 0,
    note: 'HTML print-optimiert. Echtes PDF via Playwright-Microservice in Phase 2.',
  });
});
