// audit-report-pdf — DSGVO-Audit-Nachweis-Report Edge Function
// POST /functions/v1/audit-report-pdf  { audit_id: uuid }
// Auth: Bearer JWT (eigener Audit) oder ohne (Super-Admin via SRK)
// Output: ECHTES PDF (application/pdf) in Storage + 24h Signed-URL.
//         Integritaet: SHA-256 Content-Hash + (falls Signing-Key gesetzt)
//         HMAC-SHA256-Signatur, im Footer eingebettet und in der Antwort.
//
// Selbst-enthalten (pdf-lib, Deno) — kein Playwright/3rd-Party-Service noetig.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { applyPolicy, sumHits, type RedactionPolicy } from '../_shared/redact.ts';

// Owner-Daten (email/company/domain des Audit-Anforderers) bleiben Klartext.
// Geschwaerzt werden NUR die issues[].title/detail/paragraph_ref — dort
// koennen URLs/Form-Inhalte/Cookie-Werte fremder Domains stecken, die der
// Scanner einsammelt und die nicht in einem geteilten Report landen sollen.
const REDACTION_POLICY: RedactionPolicy = 'third_party_only';
const ENGINE_VERSION = '2026.05.0';

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

// Druck-/PDF-optimierte Palette: heller Hintergrund, dunkle Schrift.
const SEV: Record<string, string> = {
  critical: 'KRITISCH', high: 'HOCH', medium: 'MITTEL', low: 'NIEDRIG', info: 'INFO', pass: 'BESTANDEN',
};
const SEV_HEX: Record<string, string> = {
  critical: '#DC2626', high: '#EA580C', medium: '#D97706', low: '#2563EB', info: '#6B7280', pass: '#059669',
};

function severityHex(severity: string): string {
  return SEV_HEX[severity] ?? '#6B7280';
}
function severityLabel(severity: string): string {
  return SEV[severity] ?? severity.toUpperCase();
}

// '#RRGGBB' → pdf-lib rgb()
function hexRgb(h: string) {
  const n = h.replace('#', '');
  return rgb(
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  );
}

// ── Krypto: Content-Hash (SHA-256) + Signatur (HMAC-SHA256) ──────────────────
function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)));
}
async function hmacSha256Hex(keyBytes: Uint8Array, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data)));
}

/**
 * Kanonische Repraesentation des Audits fuer den Content-Hash. Stabil und
 * unabhaengig von Storage-/Render-Details, damit der Hash reproduzierbar ist.
 */
function canonicalAudit(a: AuditRow): string {
  return JSON.stringify({
    id: a.id,
    url: a.url,
    domain: a.domain,
    score: a.score,
    severity: a.severity,
    issues: a.issues.map((i) => ({
      severity: i.severity, title: i.title, detail: i.detail, paragraph_ref: i.paragraph_ref ?? null,
    })),
    engine: ENGINE_VERSION,
  });
}

// ── PDF-Rendering ────────────────────────────────────────────────────────────
interface SignatureInfo {
  contentHash: string;
  signature: string | null;
  signed: boolean;
}

async function buildPdf(audit: AuditRow, reportUrl: string, sig: SignatureInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`DSGVO-Audit-Report — ${audit.domain}`);
  doc.setProducer('RealSyncDynamics.AI Compliance Engine');
  doc.setCreator('RealSyncDynamics.AI');

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const W = 595.28, H = 841.89; // A4 portrait
  const M = 44;                  // Rand
  const contentW = W - 2 * M;

  const ink = hexRgb('#111827');
  const muted = hexRgb('#6B7280');
  const line = hexRgb('#E5E7EB');

  const pages: ReturnType<typeof doc.addPage>[] = [];
  let page = doc.addPage([W, H]);
  pages.push(page);
  let y = H - M;

  const ensure = (space: number) => {
    if (y - space < M + 36) {
      page = doc.addPage([W, H]);
      pages.push(page);
      y = H - M;
    }
  };

  const wrap = (text: string, f: typeof font, size: number, maxW: number): string[] => {
    const out: string[] = [];
    for (const para of (text || '').split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      let cur = '';
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (f.widthOfTextAtSize(test, size) > maxW && cur) { out.push(cur); cur = w; }
        else cur = test;
      }
      out.push(cur);
    }
    return out.length ? out : [''];
  };

  // ── Kopf ──
  page.drawText('REALSYNCDYNAMICS.AI · EU-HOSTED COMPLIANCE ENGINE', {
    x: M, y, size: 8, font: mono, color: muted,
  });
  y -= 22;
  page.drawText('DSGVO-Audit-Report', { x: M, y, size: 22, font: bold, color: ink });
  // Score rechts
  const scoreHex = audit.score >= 80 ? '#059669' : audit.score >= 50 ? '#D97706' : audit.score >= 30 ? '#EA580C' : '#DC2626';
  const scoreStr = String(audit.score);
  const scoreSize = 30;
  const scoreW = bold.widthOfTextAtSize(scoreStr, scoreSize);
  page.drawText(scoreStr, { x: W - M - scoreW, y: y - 4, size: scoreSize, font: bold, color: hexRgb(scoreHex) });
  page.drawText('Score / 100', { x: W - M - bold.widthOfTextAtSize('Score / 100', 8), y: y - 16, size: 8, font: mono, color: muted });
  y -= 20;
  for (const ln of wrap(audit.url, font, 10, contentW - 90)) {
    page.drawText(ln, { x: M, y, size: 10, font, color: muted });
    y -= 13;
  }
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: hexRgb('#FFB800') });
  y -= 20;

  // ── Meta-Zeile ──
  const meta: Array<[string, string]> = [
    ['Domain', audit.domain],
    ...(audit.company ? [['Unternehmen', audit.company] as [string, string]] : []),
    ['Datum', new Date(audit.created_at).toLocaleDateString('de-DE')],
    ['Schweregrad', severityLabel(audit.severity)],
    ['Engine', ENGINE_VERSION],
  ];
  let mx = M;
  const colW = contentW / Math.min(meta.length, 5);
  for (const [k, v] of meta) {
    page.drawText(k.toUpperCase(), { x: mx, y, size: 7, font: mono, color: muted });
    for (const ln of wrap(v, bold, 10, colW - 8).slice(0, 2)) {
      page.drawText(ln, { x: mx, y: y - 13, size: 10, font: bold, color: ink });
    }
    mx += colW;
  }
  y -= 40;

  // ── Zusammenfassung ──
  const sectionHeader = (label: string) => {
    ensure(40);
    page.drawText(label.toUpperCase(), { x: M, y, size: 9, font: bold, color: muted });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: line });
    y -= 16;
  };

  sectionHeader('Zusammenfassung');
  const statsByLevel = ['critical', 'high', 'medium', 'low', 'info']
    .map((level) => ({ level, count: audit.issues.filter((i) => i.severity === level).length }))
    .filter((x) => x.count > 0);
  if (statsByLevel.length === 0) {
    page.drawText('Keine Befunde', { x: M, y, size: 11, font: bold, color: hexRgb('#059669') });
    y -= 18;
  } else {
    let sx = M;
    for (const { level, count } of statsByLevel) {
      const txt = `${count} ${severityLabel(level)}`;
      const w = bold.widthOfTextAtSize(String(count), 11) + font.widthOfTextAtSize(` ${severityLabel(level)}`, 10) + 16;
      if (sx + w > W - M) { sx = M; y -= 18; }
      page.drawText(String(count), { x: sx, y, size: 11, font: bold, color: hexRgb(severityHex(level)) });
      page.drawText(` ${severityLabel(level)}`, { x: sx + bold.widthOfTextAtSize(String(count), 11), y, size: 10, font, color: muted });
      sx += w + 8;
      void txt;
    }
    y -= 20;
  }
  for (const ln of wrap(
    `Automatisch erstellt durch RealSyncDynamics.AI Compliance Engine v${ENGINE_VERSION}. Dokumentiert den DSGVO-Status von ${audit.domain} und kann als technischer Nachweis gegenüber Datenschutzbeauftragten und Aufsichtsbehörden verwendet werden. Hinweis: Kein Ersatz für rechtliche Beratung.`,
    font, 9.5, contentW,
  )) {
    ensure(14);
    page.drawText(ln, { x: M, y, size: 9.5, font, color: muted });
    y -= 13;
  }
  y -= 12;

  // ── Befunde ──
  sectionHeader(`Befunde (${audit.issues.length})`);
  if (audit.issues.length === 0) {
    page.drawText('Keine Compliance-Probleme gefunden.', { x: M, y, size: 11, font: bold, color: hexRgb('#059669') });
    y -= 18;
  } else {
    for (const issue of audit.issues) {
      const titleLines = wrap(issue.title, bold, 11, contentW - 96);
      const detailLines = wrap(issue.detail, font, 9.5, contentW - 96);
      const refLines = issue.paragraph_ref ? 1 : 0;
      const blockH = 16 + titleLines.length * 13 + detailLines.length * 12 + refLines * 13 + 10;
      ensure(blockH);
      const top = y;
      // Severity-Badge
      const badge = severityLabel(issue.severity);
      page.drawText(badge, { x: M, y: top - 2, size: 9, font: bold, color: hexRgb(severityHex(issue.severity)) });
      // Inhalt (eingerückt)
      const tx = M + 88;
      let ty = top;
      for (const ln of titleLines) { page.drawText(ln, { x: tx, y: ty, size: 11, font: bold, color: ink }); ty -= 13; }
      for (const ln of detailLines) { page.drawText(ln, { x: tx, y: ty, size: 9.5, font, color: muted }); ty -= 12; }
      if (issue.paragraph_ref) {
        page.drawText(issue.paragraph_ref, { x: tx, y: ty, size: 9, font: mono, color: hexRgb('#B45309') });
        ty -= 13;
      }
      y = ty - 8;
      page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.5, color: line });
      y -= 6;
    }
  }

  // ── Sofortmassnahmen ──
  const urgent = audit.issues.filter((i) => ['critical', 'high'].includes(i.severity));
  if (urgent.length > 0) {
    y -= 6;
    sectionHeader(`Sofortmassnahmen (${urgent.length})`);
    urgent.forEach((issue, idx) => {
      const lines = wrap(issue.title, bold, 10, contentW - 24);
      ensure(lines.length * 13 + 6);
      page.drawText(`${idx + 1}.`, { x: M, y, size: 10, font: bold, color: hexRgb(severityHex(issue.severity)) });
      let ty = y;
      for (const ln of lines) { page.drawText(ln, { x: M + 20, y: ty, size: 10, font: bold, color: ink }); ty -= 13; }
      if (issue.paragraph_ref) {
        page.drawText(issue.paragraph_ref, { x: M + 20, y: ty, size: 9, font: mono, color: hexRgb('#B45309') });
        ty -= 13;
      }
      y = ty - 4;
    });
  }

  // ── Footer auf allen Seiten (inkl. Hash + Signatur + Seitenzahl) ──
  const generatedAt = new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });
  const total = pages.length;
  pages.forEach((p, i) => {
    let fy = M + 4;
    p.drawLine({ start: { x: M, y: fy + 30 }, end: { x: W - M, y: fy + 30 }, thickness: 0.5, color: line });
    const sigLabel = sig.signed
      ? `HMAC-SHA256: ${sig.signature!.slice(0, 32)}…`
      : 'unsigniert (kein Signing-Key konfiguriert)';
    p.drawText(`SHA-256: ${sig.contentHash.slice(0, 48)}…`, { x: M, y: fy + 18, size: 7, font: mono, color: muted });
    p.drawText(sigLabel, { x: M, y: fy + 9, size: 7, font: mono, color: muted });
    p.drawText(`Audit-ID: ${audit.id} · Erstellt ${generatedAt}`, { x: M, y: fy, size: 7, font: mono, color: muted });
    const pageStr = `Seite ${i + 1} / ${total}`;
    p.drawText(pageStr, { x: W - M - mono.widthOfTextAtSize(pageStr, 7), y: fy, size: 7, font: mono, color: muted });
    p.drawText('RealSyncDynamics.AI · EU-gehostet · Made in Germany', {
      x: W - M - mono.widthOfTextAtSize('RealSyncDynamics.AI · EU-gehostet · Made in Germany', 7),
      y: fy + 9, size: 7, font: mono, color: muted,
    });
    void reportUrl;
  });

  return await doc.save();
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
    .select('id,url,domain,email,company,score,severity,issues,fetched_status,fetched_at,created_at')
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

  // Integritaet: Hash ueber den (redigierten) Berichtsinhalt + optionale Signatur.
  const contentHash = await sha256Hex(canonicalAudit(redactedAudit));
  const signingKeyText = Deno.env.get('AUDIT_REPORT_SIGNING_KEY')
    ?? Deno.env.get('EVIDENCE_VAULT_SIGNING_KEY');
  const signed = !!signingKeyText;
  const signature = signed
    ? await hmacSha256Hex(new TextEncoder().encode(signingKeyText!), `${contentHash}:${auditId}`)
    : null;

  const storagePath = `audit-reports/${auditId}.pdf`;
  const { data: existing } = await admin.storage.from('documents').list('audit-reports', { search: `${auditId}.pdf` });
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildPdf(redactedAudit, `https://realsyncdynamicsai.de/audit/report/${auditId}`, { contentHash, signature, signed });
  } catch (e) {
    return errorJson(500, 'PDF_RENDER_FAILED', e instanceof Error ? e.message : 'render error');
  }
  const { error: upErr } = await admin.storage.from('documents')
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true, cacheControl: '3600' });
  if (upErr) return errorJson(500, 'UPLOAD_FAILED', upErr.message);
  const { data: signedUrl, error: signErr } = await admin.storage.from('documents').createSignedUrl(storagePath, 86400);
  if (signErr || !signedUrl) return errorJson(500, 'SIGNED_URL_FAILED', signErr?.message ?? 'unknown');
  await admin.from('gdpr_audits').update({
    methodology: {
      audit_engine: ENGINE_VERSION,
      report_generated_at: new Date().toISOString(),
      report_storage_path: storagePath,
      report_format: 'pdf',
      content_hash_sha256: contentHash,
      signature_hmac_sha256: signature,
      signed,
    },
  }).eq('id', auditId);
  // Redaction-Audit: pro Report eine Zeile, auch bei 0 Treffern.
  await admin.from('pii_redaction_log').insert({
    function_name: 'audit-report-pdf',
    policy_applied: REDACTION_POLICY,
    correlation_id: auditId,
    hits_total: sumHits(issueHits),
    hits_by_category: issueHits,
    payload_bytes: pdfBytes.byteLength,
  });
  const issueStats = (audit.issues as Issue[]).reduce((acc, i) => { acc[i.severity] = (acc[i.severity] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  return okJson({
    ok: true,
    audit_id: auditId,
    domain: audit.domain,
    score: audit.score,
    severity: audit.severity,
    report_url: signedUrl.signedUrl,
    storage_path: storagePath,
    issue_count: (audit.issues as Issue[]).length,
    issue_stats: issueStats,
    generated_at: new Date().toISOString(),
    format: 'pdf',
    content_hash: contentHash,
    signature,
    signed,
    already_existed: (existing?.length ?? 0) > 0,
    note: signed
      ? 'Signiertes PDF (HMAC-SHA256 über SHA-256-Content-Hash).'
      : 'PDF mit SHA-256-Content-Hash. Signatur inaktiv: AUDIT_REPORT_SIGNING_KEY/EVIDENCE_VAULT_SIGNING_KEY nicht gesetzt.',
  });
});
