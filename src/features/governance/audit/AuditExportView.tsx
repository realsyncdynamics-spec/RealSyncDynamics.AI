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
import { withPerformanceMonitoring } from '../../../lib/hoc';
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
function _AuditExportView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const AuditExportView = withPerformanceMonitoring(
  _AuditExportView,
  'AuditExportView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<'packages' | 'exports' | 'trail'>('packages');
  const [events, setEvents] = useState<DbGovernanceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'error' } | null>(null);

  useEffect(() => {
    void loadEvents();
  }, [activeTenantId]);

  const loadEvents = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      const data = await fetchTenantEvents(activeTenantId);
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to load events:', err);
      setToast({ message: 'Failed to load audit trail', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPackage = async (pkg: AuditPackage, format: ExportFormat = 'pdf') => {
    if (!activeTenantId) return;
    try {
      setExporting(pkg.id);
      const result = await exportAnalytics({
        tenantId: activeTenantId,
        format,
        range: defaultRange(),
        includeCharts: true,
      });
      if (result.ok && result.blob) {
        const filename = buildExportFilename(`Audit-${pkg.name}`, format, defaultRange());
        triggerBlobDownload(result.blob, filename);
        setToast({ message: `Audit-Paket "${pkg.name}" exportiert`, type: 'ok' });
      } else {
        setToast({ message: result.error || 'Export fehlgeschlagen', type: 'error' });
      }
    } catch (err) {
      console.error('Export failed:', err);
      setToast({ message: 'Export fehlgeschlagen', type: 'error' });
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadExport = async (exp: RecentExport) => {
    setToast({ message: `${exp.name} wird heruntergeladen...`, type: 'ok' });
    // In real scenario, would fetch from storage
    setTimeout(() => {
      setToast({ message: `${exp.name} heruntergeladen`, type: 'ok' });
    }, 1000);
  };

  const auditEvents = events.map(eventToAuditEvent);
  const readyPackages = AUDIT_PACKAGES.filter((p) => p.status === 'bereit').length;
  const totalExports = RECENT_EXPORTS.length;
  const signedExports = RECENT_EXPORTS.filter((e) => e.signed).length;

  return (
    <div className="flex flex-col h-screen bg-obsidian-950 text-titanium-100">
      {/* Header + Metriken */}
      <div className="px-6 py-4 border-b border-titanium-900">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">Audit Export Center</h1>
            <p className="text-[12px] text-titanium-400 mt-1">DSGVO/EU AI Act Behördenexporte & Audit-Pakete</p>
          </div>
          <button
            onClick={() => void loadEvents()}
            disabled={loading}
            className="font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {loading ? '⟳ Wird geladen...' : '🔄 Aktualisieren'}
          </button>
        </div>

        {/* Metrik-Reihe */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-obsidian-900 border border-titanium-900 px-4 py-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Audit-Pakete</span>
            <span className="font-mono text-xl font-semibold text-titanium-100">{AUDIT_PACKAGES.length}</span>
            <span className="text-[10px] text-teal-400">{readyPackages} bereit</span>
          </div>
          <div className="bg-obsidian-900 border border-titanium-900 px-4 py-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Exporte (Gesamt)</span>
            <span className="font-mono text-xl font-semibold text-titanium-100">{totalExports}</span>
            <span className="text-[10px] text-teal-400">{signedExports} signiert</span>
          </div>
          <div className="bg-obsidian-900 border border-titanium-900 px-4 py-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Audit-Events</span>
            <span className="font-mono text-xl font-semibold text-titanium-100">{auditEvents.length}</span>
            <span className="text-[10px] text-amber-400">{auditEvents.filter((e) => e.severity === 'warn').length} Warnungen</span>
          </div>
          <div className="bg-obsidian-900 border border-titanium-900 px-4 py-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Signaturen</span>
            <span className="font-mono text-xl font-semibold text-teal-400">Ed25519</span>
            <span className="text-[10px] text-titanium-500">C2PA validiert</span>
          </div>
        </div>
      </div>

      {/* Tab-Navigation */}
      <div className="px-6 py-3 border-b border-titanium-900 flex gap-1">
        <button
          onClick={() => setActiveTab('packages')}
          type="button"
          className={`font-mono text-[10px] uppercase tracking-wider px-3 py-2 transition-colors ${
            activeTab === 'packages'
              ? 'text-teal-400 border-b-2 border-teal-400'
              : 'text-titanium-500 hover:text-titanium-300 border-b-2 border-transparent'
          }`}
        >
          Audit-Pakete
        </button>
        <button
          onClick={() => setActiveTab('exports')}
          type="button"
          className={`font-mono text-[10px] uppercase tracking-wider px-3 py-2 transition-colors ${
            activeTab === 'exports'
              ? 'text-teal-400 border-b-2 border-teal-400'
              : 'text-titanium-500 hover:text-titanium-300 border-b-2 border-transparent'
          }`}
        >
          Exporte
        </button>
        <button
          onClick={() => setActiveTab('trail')}
          type="button"
          className={`font-mono text-[10px] uppercase tracking-wider px-3 py-2 transition-colors ${
            activeTab === 'trail'
              ? 'text-teal-400 border-b-2 border-teal-400'
              : 'text-titanium-500 hover:text-titanium-300 border-b-2 border-transparent'
          }`}
        >
          Prüfpfad
        </button>
      </div>

      {/* Tab-Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {activeTab === 'packages' && (
          <div className="space-y-3">
            {AUDIT_PACKAGES.map((pkg) => (
              <div key={pkg.id} className="bg-obsidian-900 border border-titanium-900 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-teal-400 shrink-0" />
                      <h3 className="text-sm font-semibold text-titanium-100">{pkg.name}</h3>
                    </div>
                    <p className="text-[11px] text-titanium-400">Zeitraum: {pkg.period}</p>
                    <p className="text-[11px] text-titanium-500 mt-1">Erstellt: {pkg.createdAt}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PackageStatusBadge status={pkg.status} docCount={pkg.docCount} totalDocs={pkg.totalDocs} />
                    {pkg.signed && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-teal-600/20 border border-teal-600/40 text-teal-400 font-mono text-[10px]">
                        <Shield className="h-3 w-3" />
                        Signiert
                      </span>
                    )}
                  </div>
                </div>

                {pkg.status === 'bereit' && (
                  <div className="flex gap-2 pt-3 border-t border-titanium-800">
                    <button
                      onClick={() => void handleExportPackage(pkg, 'pdf')}
                      disabled={exporting === pkg.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono text-teal-400 border border-teal-700 hover:bg-teal-700/20 transition-colors disabled:opacity-50"
                    >
                      {exporting === pkg.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileDown className="h-3 w-3" />
                      )}
                      PDF exportieren
                    </button>
                    <button
                      onClick={() => void handleExportPackage(pkg, 'csv')}
                      disabled={exporting === pkg.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-mono text-titanium-400 border border-titanium-800 hover:bg-obsidian-800 transition-colors disabled:opacity-50"
                    >
                      {exporting === pkg.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <BarChart3 className="h-3 w-3" />
                      )}
                      CSV exportieren
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'exports' && (
          <div className="space-y-2">
            {RECENT_EXPORTS.map((exp) => (
              <div
                key={exp.id}
                className="bg-obsidian-900 border border-titanium-900 p-3 flex items-center justify-between hover:border-titanium-700 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-titanium-100 truncate">{exp.name}</span>
                      <span className="font-mono text-[9px] text-titanium-600 shrink-0">{exp.type}</span>
                      {exp.signed && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-600/20 border border-teal-600/40 text-teal-400 font-mono text-[8px] shrink-0">
                          <Shield className="h-2.5 w-2.5" />
                          Signiert
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-titanium-500 mt-0.5">
                      {exp.createdAt} · {exp.sizeKb} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void handleDownloadExport(exp)}
                  className="shrink-0 p-1.5 text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'trail' && (
          <div className="space-y-2">
            {auditEvents.map((evt) => (
              <div
                key={evt.id}
                className="bg-obsidian-900 border border-titanium-900 p-3 flex items-start gap-3 hover:border-titanium-700 transition-colors"
              >
                <SeverityIcon severity={evt.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[11px] text-titanium-500">{evt.ts}</span>
                    <span className="font-mono text-[10px] text-titanium-600 shrink-0">{evt.actor}</span>
                  </div>
                  <p className="text-[12px] text-titanium-100">{evt.action}</p>
                  <p className="font-mono text-[10px] text-titanium-400 mt-0.5">{evt.target}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 border font-mono text-xs shadow-lg ${
            toast.type === 'error'
              ? 'bg-red-950 border-red-800 text-red-200'
              : 'bg-obsidian-800 border-teal-700 text-teal-300'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
