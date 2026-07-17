// AuditExportView — Audit-Ready Export Center
// DSGVO/EU AI Act Behördenexporte + Audit-Pakete
// Exporte laufen über die governance-analytics-export Edge Function (user JWT).
import React, { useState, useEffect } from 'react';
import { fetchTenantEvents, type DbGovernanceEvent } from '../governanceApi';
import {
  ClipboardCheck,
  Package,
  FileDown,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Shield,
  Briefcase,
  BarChart3,
  AlertCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';
import {
  exportAnalytics,
  triggerBlobDownload,
  buildExportFilename,
  defaultRange,
  type ExportFormat,
} from './auditExportApi';

// ── Typen ──────────────────────────────────────────────────────────────────
type PackageStatus = 'bereit' | 'in-vorbereitung' | 'archiviert';

interface AuditPackage {
  id: string;
  name: string;
  status: PackageStatus;
  docCount: number;
  totalDocs?: number;
  signed: boolean;
  createdAt: string;
  period: string;
}

interface RecentExport {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  signed: boolean;
  sizeKb: number;
}

interface AuditEvent {
  id: string;
  ts: string;
  actor: string;
  action: string;
  target: string;
  severity: 'info' | 'warn' | 'ok';
}

// ── Mock-Daten ─────────────────────────────────────────────────────────────
const AUDIT_PACKAGES: AuditPackage[] = [
  {
    id: 'dsgvo-q2',
    name: 'DSGVO 360° Audit Q2 2026',
    status: 'bereit',
    docCount: 47,
    signed: true,
    createdAt: '15.06.2026',
    period: 'Apr – Jun 2026',
  },
  {
    id: 'ai-act-readiness',
    name: 'EU AI Act Readiness Assessment',
    status: 'in-vorbereitung',
    docCount: 12,
    totalDocs: 18,
    signed: false,
    createdAt: '12.06.2026',
    period: 'Stand 16.06.2026',
  },
  {
    id: 'cookie-compliance',
    name: 'Cookie Compliance Export',
    status: 'bereit',
    docCount: 8,
    signed: true,
    createdAt: '10.06.2026',
    period: 'Mai – Jun 2026',
  },
];

const RECENT_EXPORTS: RecentExport[] = [
  { id: 'e1', name: 'DSE-Export Q2', type: 'PDF', createdAt: '15.06.2026 09:12', signed: true, sizeKb: 245 },
  { id: 'e2', name: 'VVT Vollständig', type: 'PDF', createdAt: '14.06.2026 16:30', signed: true, sizeKb: 189 },
  { id: 'e3', name: 'Cookie Evidence CSV', type: 'CSV', createdAt: '13.06.2026 11:00', signed: false, sizeKb: 58 },
  { id: 'e4', name: 'Behörden-Bundle BSI', type: 'ZIP', createdAt: '10.06.2026 14:22', signed: true, sizeKb: 1240 },
  { id: 'e5', name: 'Wirtschaftsprüfer-Bundle', type: 'ZIP', createdAt: '09.06.2026 09:00', signed: true, sizeKb: 876 },
];

const AUDIT_TRAIL: AuditEvent[] = [
  { id: 't1', ts: 'Heute 10:01', actor: 'Evidence Agent', action: 'Snapshot erstellt',     target: 'website:example.com', severity: 'ok' },
  { id: 't2', ts: 'Heute 09:32', actor: 'DSGVO Agent',    action: 'Scan abgeschlossen',    target: 'DSE v3.2',            severity: 'ok' },
  { id: 't3', ts: 'Heute 09:14', actor: 'Cookie Agent',   action: '2 Findings erkannt',    target: 'Meta Pixel',          severity: 'warn' },
  { id: 't4', ts: 'Gestern 16:30', actor: 'AVV Agent',    action: 'Dokument aktualisiert', target: 'AVV-Vorlage v2.1',    severity: 'ok' },
  { id: 't5', ts: 'Gestern 14:00', actor: 'Audit Agent',  action: 'Report exportiert',     target: 'Q2-Audit-Paket',      severity: 'ok' },
  { id: 't6', ts: '14.06. 11:20', actor: 'Risk Agent',    action: 'Risiko eskaliert',      target: 'DSFA: CV-Screening',  severity: 'warn' },
  { id: 't7', ts: '13.06. 09:00', actor: 'TOM Agent',     action: 'TOM-Check bestanden',   target: 'Verschlüsselung',     severity: 'ok' },
  { id: 't8', ts: '12.06. 15:45', actor: 'Incident Agent', action: 'Incident geschlossen', target: 'INC-2026-004',        severity: 'info' },
  { id: 't9', ts: '11.06. 08:30', actor: 'Audit Agent',   action: 'Behörden-Export bereit', target: 'BSI-Bundle',         severity: 'ok' },
  { id: 't10', ts: '10.06. 17:00', actor: 'AI Act Agent', action: 'Hochrisiko bestätigt',  target: 'KI-System: Recruiter', severity: 'warn' },
];

// ── Package Status Badge ───────────────────────────────────────────────────
function PackageStatusBadge({ status, docCount, totalDocs }: { status: PackageStatus; docCount: number; totalDocs?: number }) {
  if (status === 'bereit') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-600/20 border border-teal-600/40 text-teal-400 font-mono text-[10px]">
        <CheckCircle className="h-3 w-3" />
        Bereit · {docCount} Dokumente
      </span>
    );
  }
  if (status === 'in-vorbereitung') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-600/20 border border-amber-600/40 text-amber-400 font-mono text-[10px]">
        <Clock className="h-3 w-3" />
        In Vorbereitung · {docCount}/{totalDocs} Dokumente
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-obsidian-800 border border-titanium-800 text-titanium-500 font-mono text-[10px]">
      <Clock className="h-3 w-3" />
      Archiviert
    </span>
  );
}

// ── Severity Icon ──────────────────────────────────────────────────────────
function SeverityIcon({ severity }: { severity: AuditEvent['severity'] }) {
  if (severity === 'ok')   return <CheckCircle className="h-3.5 w-3.5 text-teal-400 shrink-0" />;
  if (severity === 'warn') return <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  return <Clock className="h-3.5 w-3.5 text-titanium-500 shrink-0" />;
}

function eventToAuditEvent(e: DbGovernanceEvent): AuditEvent {
  const diffMs  = Date.now() - new Date(e.created_at).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const ts = diffMin < 60
    ? `vor ${diffMin} Min.`
    : diffMin < 1440
      ? `vor ${Math.floor(diffMin / 60)} Std.`
      : `vor ${Math.floor(diffMin / 1440)} Tag${Math.floor(diffMin / 1440) !== 1 ? 'en' : ''}`;
  const severity: AuditEvent['severity'] =
    e.risk_level === 'critical' || e.risk_level === 'high' ? 'warn' :
    e.risk_level === 'low' || e.risk_level === 'info'      ? 'ok'   : 'info';
  return {
    id:       e.id,
    ts,
    actor:    e.actor_email ?? e.event_source,
    action:   e.event_type,
    target:   e.title,
    severity,
  };
}

// ── AuditExportView ────────────────────────────────────────────────────────
function Inner() {
  const { activeTenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<'pakete' | 'verlauf'>('pakete');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'error' } | null>(null);
  const [trail, setTrail] = useState<AuditEvent[]>(AUDIT_TRAIL);

  useEffect(() => {
    if (!activeTenantId) return;
    fetchTenantEvents(activeTenantId, 20).then((evs) => {
      if (evs.length > 0) setTrail(evs.map(eventToAuditEvent));
    }).catch(() => {/* keep mock */});
  }, [activeTenantId]);

  function showToast(msg: string, tone: 'ok' | 'error' = 'ok') {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  }

  async function runExport(prefix: string, format: ExportFormat, busyKey: string) {
    if (!activeTenantId) {
      showToast('Kein aktiver Mandant — bitte anmelden.', 'error');
      return;
    }
    setBusy(busyKey);
    const range = defaultRange();
    try {
      const res = await exportAnalytics({ tenantId: activeTenantId, format, range });
      if (!res.ok || !res.blob) {
        showToast(res.error ?? 'Export fehlgeschlagen.', 'error');
        return;
      }
      triggerBlobDownload(res.blob, buildExportFilename(prefix, format, range));
      showToast(`${prefix} (${format.toUpperCase()}) exportiert.`);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col h-full bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <div className="border-b border-titanium-900 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-semibold text-titanium-100 tracking-tight">
              Audit Export
            </h1>
            <p className="font-mono text-xs text-titanium-500 mt-0.5">
              Audit-Ready Reports · C2PA-signiert · Behörden- und Wirtschaftsprüfer-Bundle
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runExport('Evidence-Export', 'csv', 'hdr-csv')}
              disabled={busy === 'hdr-csv'}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-50"
            >
              {busy === 'hdr-csv' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              CSV Evidence Export
            </button>
            <button
              onClick={() => runExport('Audit-Paket', 'pdf', 'hdr-pdf')}
              disabled={busy === 'hdr-pdf'}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono bg-teal-600 text-white hover:bg-teal-500 transition-colors disabled:opacity-50"
            >
              {busy === 'hdr-pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
              PDF Paket exportieren
            </button>
          </div>
        </div>
      </div>

      {/* Quick Export Buttons */}
      <div className="grid grid-cols-4 divide-x divide-titanium-900 border-b border-titanium-900 shrink-0">
        {([
          { icon: <FileText className="h-4 w-4" />, label: 'PDF Paket', sub: 'Vollständiger Audit', color: 'text-teal-400', format: 'pdf' as ExportFormat },
          { icon: <BarChart3 className="h-4 w-4" />, label: 'CSV Evidence', sub: 'Evidence-Rohdaten', color: 'text-blue-400', format: 'csv' as ExportFormat },
          { icon: <Shield className="h-4 w-4" />, label: 'Behörden-Export', sub: 'BSI / DSB Format', color: 'text-amber-400', format: 'pdf' as ExportFormat },
          { icon: <Briefcase className="h-4 w-4" />, label: 'WP-Bundle', sub: 'Wirtschaftsprüfer', color: 'text-violet-400', format: 'pdf' as ExportFormat },
        ]).map(({ icon, label, sub, color, format }) => (
          <button
            key={label}
            onClick={() => runExport(label, format, `tile-${label}`)}
            disabled={busy === `tile-${label}`}
            className="flex flex-col items-center justify-center gap-1.5 py-4 px-4 hover:bg-obsidian-900 transition-colors group disabled:opacity-50"
          >
            <span className={`${color} group-hover:scale-110 transition-transform`}>
              {busy === `tile-${label}` ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            </span>
            <span className="text-xs font-semibold text-titanium-100">{label}</span>
            <span className="font-mono text-[9px] text-titanium-600">{sub}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-titanium-900 shrink-0">
        {(['pakete', 'verlauf'] as const).map((tab) => {
          const labels = { pakete: 'Audit-Pakete', verlauf: 'Letzte Exporte & Audit-Trail' };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 text-xs font-mono border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-teal-400 text-teal-400'
                  : 'border-transparent text-titanium-500 hover:text-titanium-300'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'pakete' && (
          <div className="space-y-4">
            {AUDIT_PACKAGES.map((pkg) => (
              <div key={pkg.id} className="bg-obsidian-900 border border-titanium-900 hover:border-titanium-700 transition-colors">
                <div className="flex items-start justify-between gap-4 p-4 border-b border-titanium-900">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 flex items-center justify-center bg-obsidian-800 border border-titanium-800 shrink-0">
                      <ClipboardCheck className="h-4 w-4 text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-titanium-100">{pkg.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="font-mono text-[10px] text-titanium-500">{pkg.period}</span>
                        {pkg.signed && (
                          <span className="font-mono text-[10px] text-teal-400 flex items-center gap-1">
                            <CheckCircle className="h-2.5 w-2.5" />
                            C2PA-signiert
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <PackageStatusBadge status={pkg.status} docCount={pkg.docCount} totalDocs={pkg.totalDocs} />
                </div>
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className="font-mono text-[10px] text-titanium-600">Erstellt: {pkg.createdAt}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => runExport(pkg.name, 'pdf', `pkg-pdf-${pkg.id}`)}
                      disabled={pkg.status !== 'bereit' || busy === `pkg-pdf-${pkg.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busy === `pkg-pdf-${pkg.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      PDF herunterladen
                    </button>
                    <button
                      onClick={() => runExport(`${pkg.name}-Behoerde`, 'pdf', `pkg-auth-${pkg.id}`)}
                      disabled={pkg.status !== 'bereit' || busy === `pkg-auth-${pkg.id}`}
                      title="Erzeugt das Behörden-Bundle zum Versand"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-teal-400 border border-teal-700 hover:bg-teal-700/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busy === `pkg-auth-${pkg.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                      Behörden-Bundle
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'verlauf' && (
          <div className="space-y-6">
            {/* Letzte Exporte */}
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-titanium-600 mb-3">
                Letzte Exporte
              </h2>
              <div className="bg-obsidian-900 border border-titanium-900 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-titanium-900">
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] text-titanium-600 uppercase">Name</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] text-titanium-600 uppercase">Typ</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] text-titanium-600 uppercase">Erstellt</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] text-titanium-600 uppercase">Signiert</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] text-titanium-600 uppercase">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-titanium-900">
                    {RECENT_EXPORTS.map((exp) => (
                      <tr key={exp.id} className="hover:bg-obsidian-800 transition-colors">
                        <td className="px-4 py-3 text-titanium-100">{exp.name}</td>
                        <td className="px-4 py-3 font-mono text-titanium-400">{exp.type}</td>
                        <td className="px-4 py-3 font-mono text-titanium-500">{exp.createdAt}</td>
                        <td className="px-4 py-3">
                          {exp.signed ? (
                            <span className="text-teal-400 font-mono text-[10px] flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> C2PA
                            </span>
                          ) : (
                            <span className="text-titanium-600 font-mono text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => runExport(exp.name, exp.type.toLowerCase() === 'csv' ? 'csv' : 'pdf', `exp-${exp.id}`)}
                            disabled={busy === `exp-${exp.id}`}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono text-titanium-300 border border-titanium-800 hover:bg-obsidian-800 transition-colors ml-auto disabled:opacity-50"
                          >
                            {busy === `exp-${exp.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Trail */}
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-titanium-600 mb-3">
                Audit-Trail
              </h2>
              <div className="space-y-0 border border-titanium-900">
                {trail.map((event, idx) => (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-obsidian-800 transition-colors ${
                      idx < trail.length - 1 ? 'border-b border-titanium-900' : ''
                    }`}
                  >
                    <SeverityIcon severity={event.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-titanium-100">{event.action}</span>
                        <span className="font-mono text-[10px] text-titanium-500 truncate">{event.target}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-titanium-600">{event.actor}</span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-titanium-600 shrink-0">{event.ts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 border font-mono text-xs shadow-lg ${
          toast.tone === 'error' ? 'bg-red-950 border-red-800 text-red-200' : 'bg-obsidian-800 border-teal-700 text-teal-300'
        }`}>
          {toast.tone === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function _AuditExportView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const AuditExportView = withPerformanceMonitoring(
  _AuditExportView,
  'AuditExportView',
  { threshold: 500, maxRenders: 10 }
);
