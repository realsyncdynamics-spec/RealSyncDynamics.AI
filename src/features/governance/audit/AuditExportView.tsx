// AuditExportView — Audit-Export der Governance-Daten des Mandanten.
// Exporte laufen über die governance-analytics-export Edge Function (user JWT),
// der Audit-Trail kommt aus governance_events.
//
// Früher zeigte die Seite fest eingetragene Audit-Pakete („DSGVO 360° Audit
// Q2 2026 · 47 Dokumente · C2PA-signiert“), eine erfundene Export-Historie und
// bei leerem Verlauf einen Beispiel-Audit-Trail — alles wie Mandantendaten.
// „Behörden-Bundle“ und „WP-Bundle“ luden dieselbe Datei unter anderem Namen,
// und das PDF der Function ist bislang ein 4-Byte-Stub. Geblieben ist, was
// der Server wirklich liefert: der KPI-Verlauf als CSV (governance_kpi_range).
import { useState, useEffect, type ReactNode } from 'react';
import { fetchTenantEvents, type DbGovernanceEvent } from '../governanceApi';
import {
  FileDown,
  CheckCircle,
  Clock,
  BarChart3,
  AlertCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  exportAnalytics,
  triggerBlobDownload,
  buildExportFilename,
  defaultRange,
  type ExportFormat,
} from './auditExportApi';

// ── Typen ──────────────────────────────────────────────────────────────────
interface AuditEvent {
  id: string;
  ts: string;
  actor: string;
  action: string;
  target: string;
  severity: 'info' | 'warn' | 'ok';
}

type TrailState =
  | { status: 'loading' }
  | { status: 'no-tenant' }
  | { status: 'ready'; events: AuditEvent[] }
  | { status: 'error' };

const EXPORTS: ReadonlyArray<{ label: string; sub: string; format: ExportFormat; icon: ReactNode; color: string }> = [
  { label: 'KPI-Verlauf (CSV)', sub: 'Governance-Kennzahlen der letzten 90 Tage · ab Starter', format: 'csv', icon: <BarChart3 className="h-4 w-4" />, color: 'text-teal-400' },
];

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
export function AuditExportView() {
  const { activeTenantId } = useTenant();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'error' } | null>(null);
  const [trail, setTrail] = useState<TrailState>({ status: 'loading' });

  useEffect(() => {
    if (!activeTenantId) {
      setTrail({ status: 'no-tenant' });
      return;
    }
    let cancelled = false;
    setTrail({ status: 'loading' });
    fetchTenantEvents(activeTenantId, 20)
      .then((evs) => { if (!cancelled) setTrail({ status: 'ready', events: evs.map(eventToAuditEvent) }); })
      .catch(() => { if (!cancelled) setTrail({ status: 'error' }); });
    return () => { cancelled = true; };
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
        <h1 className="text-lg font-display font-semibold text-titanium-100 tracking-tight">
          Audit Export
        </h1>
        <p className="font-mono text-xs text-titanium-500 mt-0.5">
          KPI-Verlauf als CSV · Prüfpfad der Governance-Ereignisse
        </p>
      </div>

      {/* Exporte */}
      <div className="grid grid-cols-1 divide-x divide-titanium-900 border-b border-titanium-900 shrink-0">
        {EXPORTS.map(({ icon, label, sub, color, format }) => (
          <button
            key={label}
            type="button"
            onClick={() => runExport(label, format, `tile-${label}`)}
            disabled={busy === `tile-${label}`}
            className="flex flex-col items-center justify-center gap-1.5 py-4 px-4 hover:bg-obsidian-900 transition-colors group disabled:opacity-50"
          >
            <span className={`${color} group-hover:scale-110 transition-transform`}>
              {busy === `tile-${label}` ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-titanium-100">
              <FileDown className="h-3 w-3" aria-hidden="true" /> {label}
            </span>
            <span className="font-mono text-[9px] text-titanium-600">{sub}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-titanium-600 mb-3">
          Prüfpfad
        </h2>
        {trail.status === 'loading' && (
          <p className="flex items-center gap-2 text-xs text-titanium-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Wird geladen …
          </p>
        )}
        {trail.status === 'no-tenant' && (
          <p className="text-xs text-titanium-500">Kein aktiver Mandant. Bitte einen Mandanten auswählen, um den Prüfpfad zu sehen.</p>
        )}
        {trail.status === 'error' && (
          <p className="text-xs text-red-300">Der Prüfpfad konnte nicht geladen werden. Bitte später erneut versuchen.</p>
        )}
        {trail.status === 'ready' && trail.events.length === 0 && (
          <p className="text-xs text-titanium-500">
            Noch keine Governance-Ereignisse. Sie entstehen automatisch, sobald Scans laufen oder KI-Systeme erfasst werden.
          </p>
        )}
        {trail.status === 'ready' && trail.events.length > 0 && (
          <div className="space-y-0 border border-titanium-900">
            {trail.events.map((event, idx) => (
              <div
                key={event.id}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-obsidian-800 transition-colors ${
                  idx < trail.events.length - 1 ? 'border-b border-titanium-900' : ''
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
