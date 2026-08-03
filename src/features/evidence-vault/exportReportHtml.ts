/**
 * Renders an EvidenceExportBundle as a print-optimized HTML report.
 *
 * Mirrors the established pattern in `supabase/functions/audit-report-pdf`
 * (HTML print-optimized, no PDF-library dependency — a real binary PDF is
 * explicitly deferred there to a future Playwright microservice). This is
 * the same approach applied client-side: the bundle is already fetched by
 * exportEvidenceBundle(), so no new edge function or storage round-trip is
 * needed. The caller opens the returned HTML in a new tab; the browser's
 * native "Print → Save as PDF" produces the PDF half of the export.
 *
 * Pure function — no DOM access, so it's unit-testable without a browser.
 */
import type { EvidenceExportBundle, EvidenceExportEvent } from './evidenceVaultApi';

function escapeHtml(value: unknown): string {
  const s = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });
  } catch {
    return iso;
  }
}

const RISK_COLOR: Record<string, string> = {
  critical: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#3B82F6', info: '#6B7280',
};

function eventRow(e: EvidenceExportEvent): string {
  const color = RISK_COLOR[e.risk_level] ?? RISK_COLOR.info;
  return `<tr>
    <td style="padding:8px 10px;border-bottom:1px solid #1E1E28;font-family:monospace;font-size:11px;color:#9CA3AF;">${e.chain_index}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #1E1E28;">
      <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${color}22;color:${color};border:1px solid ${color}44;">${escapeHtml(e.risk_level).toUpperCase()}</span>
    </td>
    <td style="padding:8px 10px;border-bottom:1px solid #1E1E28;font-size:12px;color:#E2E2E2;">${escapeHtml(e.event_type)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #1E1E28;font-size:11px;color:#9CA3AF;">${fmtDate(e.created_at)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #1E1E28;font-family:monospace;font-size:10px;color:#6B7280;word-break:break-all;">${escapeHtml(e.event_hash).slice(0, 16)}…</td>
  </tr>`;
}

export function buildEvidenceExportReportHtml(bundle: EvidenceExportBundle): string {
  const generatedAt = new Date().toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Europe/Berlin' });
  const rows = bundle.events.map(eventRow).join('');

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Evidence Vault Audit-Export — ${escapeHtml(bundle.tenant_id)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0A0A0F;color:#E2E2E2;font-family:'Courier New',monospace;font-size:13px;line-height:1.6}@media print{body{background:#fff;color:#111}.no-print{display:none}}</style>
</head><body>
<div style="background:#13131A;border-bottom:2px solid #FFB800;padding:28px 40px;">
  <div style="font-size:10px;letter-spacing:.14em;color:#9CA3AF;text-transform:uppercase;margin-bottom:4px;">REALSYNCDYNAMICS.AI · EU-HOSTED COMPLIANCE ENGINE</div>
  <h1 style="font-size:22px;font-weight:700;">Evidence Vault Audit-Export</h1>
  <div style="color:#9CA3AF;font-size:12px;margin-top:4px;">Tenant ${escapeHtml(bundle.tenant_id)} · ${bundle.count} Event(s) · Zeitraum ${fmtDate(bundle.range.from)} – ${fmtDate(bundle.range.to)}</div>
</div>

<div style="padding:20px 40px;background:#13131A;border-bottom:1px solid #1E1E28;display:flex;flex-wrap:wrap;gap:22px;">
  <div><div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;">Redaction-Policy</div><b>${escapeHtml(bundle.redaction.policy)}</b></div>
  <div><div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;">PII-Treffer geschwärzt</div><b>${bundle.redaction.hits_total}</b></div>
  <div><div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;">Signatur-Algorithmus</div><b>${escapeHtml(bundle.verifier.algorithm)}</b></div>
</div>

<div style="padding:26px 40px;">
  <h2 style="font-size:13px;font-weight:600;color:#9CA3AF;letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;">Events (${bundle.events.length})</h2>
  ${bundle.events.length > 0 ? `<table style="width:100%;border-collapse:collapse;background:#13131A;border:1px solid #1E1E28;border-radius:8px;overflow:hidden;">
    <thead><tr style="background:#1E1E28;">
      <th style="padding:9px 10px;text-align:left;font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;">#</th>
      <th style="padding:9px 10px;text-align:left;font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;">Risiko</th>
      <th style="padding:9px 10px;text-align:left;font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;">Typ</th>
      <th style="padding:9px 10px;text-align:left;font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;">Zeitpunkt</th>
      <th style="padding:9px 10px;text-align:left;font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;">Event-Hash</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>` : `<div style="padding:20px;background:#13131A;border:1px solid #10B98133;border-radius:8px;color:#10B981;text-align:center;">Keine Events im gewählten Zeitraum.</div>`}
</div>

${bundle.tip ? `<div style="padding:0 40px 26px;">
  <h2 style="font-size:13px;font-weight:600;color:#9CA3AF;letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;">Chain-Tip (Integritäts-Anker)</h2>
  <div style="background:#13131A;border:1px solid #1E1E28;border-radius:8px;padding:16px;font-family:monospace;font-size:11px;">
    <div>chain_index: <b>${bundle.tip.chain_index}</b></div>
    <div style="word-break:break-all;margin-top:4px;">event_hash: ${escapeHtml(bundle.tip.event_hash)}</div>
    <div style="word-break:break-all;margin-top:4px;">signature: ${escapeHtml(bundle.tip.signature)}</div>
  </div>
</div>` : ''}

<div style="padding:0 40px 28px;">
  <h2 style="font-size:13px;font-weight:600;color:#9CA3AF;letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;">Verifikationsanleitung</h2>
  <ol style="padding-left:18px;color:#9CA3AF;font-size:12px;line-height:1.8;">
    ${bundle.verifier.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
  </ol>
</div>

<div style="padding:18px 40px;border-top:1px solid #1E1E28;font-size:11px;color:#9CA3AF;">
  Erstellt am ${generatedAt} · Format: HTML print-optimiert (Browser-Druckdialog → „Als PDF speichern" für die PDF-Variante).
</div>
<div style="padding:10px 40px;background:#13131A;border-top:1px solid #1E1E28;font-size:10px;color:#9CA3AF;text-align:center;">RealSyncDynamics.AI · EU-gehostet · Made in Germany</div>
</body></html>`;
}
