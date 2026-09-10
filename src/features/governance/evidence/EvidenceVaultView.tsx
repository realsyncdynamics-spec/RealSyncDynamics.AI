/**
 * Evidence Vault — Governance Operating System
 * Hauptansicht für DSGVO- und EU-AI-Act-Nachweise.
 * Kein Demo-Fallback: ohne Login leer, nach Login nur Mandanten-Daten.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../../core/access/TenantProvider';
import { fetchTenantEvents, fetchTenantEvidence, type DbGovernanceEvent, type DbGovernanceEvidence } from '../governanceApi';
import { listTimeline } from '../../evidence-vault/evidenceVaultApi';
import {
  exportAnalytics,
  triggerBlobDownload,
  buildExportFilename,
  defaultRange,
  type ExportFormat,
} from '../audit/auditExportApi';
import {
  Camera,
  Shield,
  FileText,
  Activity,
  Edit,
  Cpu,
  Download,
  Bot,
  User,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  Eye,
  GitCompare,
  Plus,
  Minus,
  Loader2,
} from 'lucide-react';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';
import {
  computeVaultMetrics,
  EMPTY_VAULT_METRICS,
  eventToAuditEntry,
  eventToChangeEntry,
  mergeTimeline,
  timelineToSnapshot,
  type AuditEntry,
  type AuditOutcome,
  type ActorType,
  type ChangeEntry,
  type ChangeSeverity,
  type ChangeType,
  type EvidenceItem,
  type EvidenceType,
  type Snapshot,
  type VaultMetrics,
} from './evidenceVaultData';

function evidenceTypeConfig(type: EvidenceType): { color: string; icon: ReactNode } {
  switch (type) {
    case 'Screenshot':        return { color: 'text-teal-400',   icon: <Camera className="h-4 w-4" /> };
    case 'Scan Report':       return { color: 'text-blue-400',   icon: <Shield className="h-4 w-4" /> };
    case 'Document':          return { color: 'text-amber-400',  icon: <FileText className="h-4 w-4" /> };
    case 'Network Trace':     return { color: 'text-purple-400', icon: <Activity className="h-4 w-4" /> };
    case 'Policy Change':     return { color: 'text-orange-400', icon: <Edit className="h-4 w-4" /> };
    case 'AI Classification': return { color: 'text-pink-400',   icon: <Cpu className="h-4 w-4" /> };
  }
}

function outcomeConfig(outcome: AuditOutcome): { color: string; icon: ReactNode } {
  switch (outcome) {
    case 'success': return { color: 'text-teal-400',   icon: <CheckCircle className="h-3.5 w-3.5" /> };
    case 'warning': return { color: 'text-amber-400',  icon: <AlertTriangle className="h-3.5 w-3.5" /> };
    case 'error':   return { color: 'text-red-400',    icon: <XCircle className="h-3.5 w-3.5" /> };
  }
}

function actorIcon(type: ActorType): ReactNode {
  switch (type) {
    case 'agent':  return <Bot className="h-3.5 w-3.5 text-teal-400" />;
    case 'user':   return <User className="h-3.5 w-3.5 text-blue-400" />;
    case 'system': return <Settings className="h-3.5 w-3.5 text-titanium-500" />;
  }
}

function changeTypeConfig(type: ChangeType): { color: string; bgColor: string } {
  switch (type) {
    case 'Neu':      return { color: 'text-teal-300',   bgColor: 'bg-teal-950 border-teal-800'   };
    case 'Geändert': return { color: 'text-amber-300',  bgColor: 'bg-amber-950 border-amber-800'  };
    case 'Entfernt': return { color: 'text-red-300',    bgColor: 'bg-red-950 border-red-800'      };
    case 'Erkannt':  return { color: 'text-purple-300', bgColor: 'bg-purple-950 border-purple-800' };
  }
}

function severityColor(severity: ChangeSeverity): string {
  switch (severity) {
    case 'critical': return 'text-red-400';
    case 'high':     return 'text-orange-400';
    case 'medium':   return 'text-amber-400';
    case 'low':      return 'text-blue-400';
  }
}

function C2paBadge() {
  return (
    <span className="text-[9px] font-mono bg-teal-950 border border-teal-800 text-teal-300 px-1.5 py-0.5 whitespace-nowrap">
      C2PA
    </span>
  );
}

function EmptyTab({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="py-16 flex flex-col items-center gap-2 text-center px-6">
      <FileText className="h-7 w-7 text-titanium-700" />
      <p className="text-sm text-titanium-200">{title}</p>
      <p className="text-[11px] font-mono text-titanium-500 max-w-md">{hint}</p>
    </div>
  );
}

interface EvidenceHandlers {
  onExport: (prefix: string, format: ExportFormat, key: string) => void;
  onViewEvidence: (item: EvidenceItem) => void;
  onCompare: () => void;
  onShowTimeline: () => void;
  busy: string | null;
}

function TimelineTab({ items, loading, handlers }: { items: EvidenceItem[]; loading: boolean; handlers: EvidenceHandlers }) {
  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-2 font-mono text-sm text-titanium-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Nachweise werden geladen…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyTab
        title="Noch keine Nachweise"
        hint="Die Timeline zeigt nur Herkunftsnachweise dieses Mandanten. Keine Demo-Daten."
      />
    );
  }
  return (
    <div className="divide-y divide-titanium-900">
      {items.map((item) => {
        const cfg = evidenceTypeConfig(item.type);
        return (
          <div key={item.id} className="flex gap-4 px-4 py-3 hover:bg-obsidian-900/60 group">
            <div className="w-36 shrink-0 pt-0.5">
              <span className="font-mono text-[11px] text-titanium-500 whitespace-nowrap">{item.ts}</span>
            </div>
            <div className={`shrink-0 pt-0.5 ${cfg.color}`}>{cfg.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-sm font-semibold text-titanium-50 leading-tight">{item.title}</span>
                {item.c2pa && <C2paBadge />}
              </div>
              <p className="text-[11px] text-titanium-400 mt-0.5 leading-relaxed">{item.description}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-[10px] text-titanium-600">{item.source}</span>
                <span className="text-titanium-800">·</span>
                <span className="font-mono text-[10px] text-teal-700">{item.domain}</span>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5 min-w-[160px]">
              <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${cfg.color}`}>
                {item.type}
              </span>
              <span className="font-mono text-[10px] text-titanium-500">{item.hash}</span>
              <button
                onClick={() => handlers.onViewEvidence(item)}
                className="text-[10px] font-mono text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Ansehen
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SnapshotsTab({ snapshots, loading, handlers }: { snapshots: Snapshot[]; loading: boolean; handlers: EvidenceHandlers }) {
  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-2 font-mono text-sm text-titanium-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Snapshots werden geladen…
      </div>
    );
  }
  if (snapshots.length === 0) {
    return (
      <EmptyTab
        title="Noch keine Snapshots"
        hint="Snapshots kommen aus evidence_vault_timeline dieses Mandanten."
      />
    );
  }
  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {snapshots.map((snap) => (
        <div key={snap.id} className="border border-titanium-900 bg-obsidian-900/40 flex flex-col">
          <div className="bg-obsidian-950 border-b border-titanium-900 h-28 flex flex-col items-center justify-center gap-1">
            <Camera className="h-5 w-5 text-titanium-700" />
            <span className="font-mono text-[11px] text-titanium-600">{snap.domain}</span>
            <span className="font-mono text-[9px] text-titanium-700 uppercase tracking-wider">
              v{snap.version}{snap.onHold ? ' · HOLD' : ''}
            </span>
          </div>
          <div className="px-3 pt-2.5 pb-1">
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-[11px] text-titanium-100 font-semibold break-all">{snap.domain}</span>
              {snap.c2pa && <C2paBadge />}
            </div>
            <span className="font-mono text-[10px] text-titanium-500">{snap.date}</span>
          </div>
          <div className="px-3 py-2">
            <span className="font-mono text-[10px] text-titanium-500 break-all">{snap.hash}</span>
          </div>
          <div className="border-t border-titanium-900 px-3 py-2 flex items-center gap-2">
            <button
              onClick={() => handlers.onExport(`Snapshot-${snap.domain}`, 'pdf', `snap-${snap.id}`)}
              disabled={handlers.busy === `snap-${snap.id}`}
              className="flex-1 text-[10px] font-mono text-titanium-400 hover:text-titanium-200 border border-titanium-900 hover:border-titanium-700 py-1 flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {handlers.busy === `snap-${snap.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}Herunterladen
            </button>
            <button
              onClick={handlers.onCompare}
              className="flex-1 text-[10px] font-mono text-titanium-400 hover:text-titanium-200 border border-titanium-900 hover:border-titanium-700 py-1 flex items-center justify-center gap-1"
            >
              <GitCompare className="h-3 w-3" />Vergleichen
            </button>
            <button
              onClick={handlers.onShowTimeline}
              className="flex-1 text-[10px] font-mono text-teal-500 hover:text-teal-300 border border-teal-900 hover:border-teal-700 py-1 flex items-center justify-center gap-1"
            >
              <Eye className="h-3 w-3" />Nachweis
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditTrailTab({ entries, loading }: { entries: AuditEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-2 font-mono text-sm text-titanium-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Prüfpfad wird geladen…
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <EmptyTab
        title="Noch kein Prüfpfad"
        hint="Der Prüfpfad entsteht aus governance_events dieses Mandanten."
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 border-b border-titanium-900">
            <th className="text-left py-2.5 px-4">Zeitstempel</th>
            <th className="text-left py-2.5 px-3">Akteur</th>
            <th className="text-left py-2.5 px-3">Aktion</th>
            <th className="text-left py-2.5 px-3">Ziel</th>
            <th className="text-center py-2.5 px-4">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-titanium-900">
          {entries.map((entry) => {
            const outcome = outcomeConfig(entry.outcome);
            return (
              <tr key={entry.id} className="hover:bg-obsidian-900/40">
                <td className="py-2.5 px-4 font-mono text-[11px] text-titanium-400 whitespace-nowrap">{entry.ts}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    {actorIcon(entry.actorType)}
                    <span className="text-[12px] text-titanium-200">{entry.actor}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-[12px] text-titanium-100">{entry.action}</td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-titanium-400">{entry.target}</td>
                <td className="py-2.5 px-4">
                  <div className={`flex items-center justify-center gap-1 ${outcome.color}`}>
                    {outcome.icon}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChangeTrackingTab({ changes, loading }: { changes: ChangeEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-2 font-mono text-sm text-titanium-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Änderungen werden geladen…
      </div>
    );
  }
  if (changes.length === 0) {
    return (
      <EmptyTab
        title="Keine dokumentierten Änderungen"
        hint="Change Tracking listet nur Ereignisse mit before/after im Payload."
      />
    );
  }
  return (
    <div className="divide-y divide-titanium-900">
      {changes.map((change) => {
        const typeCfg = changeTypeConfig(change.type);
        return (
          <div key={change.id} className="px-4 py-3 hover:bg-obsidian-900/40">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[12px] font-semibold text-titanium-50">{change.artifact}</span>
                  <span className={`text-[9px] font-mono border px-1.5 py-0.5 ${typeCfg.bgColor} ${typeCfg.color}`}>
                    {change.type}
                  </span>
                  <span className={`text-[10px] font-mono font-semibold uppercase ${severityColor(change.severity)}`}>
                    {change.severity}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-titanium-500 mb-2">{change.field}</div>
                <div className="space-y-1">
                  {change.before !== null && (
                    <div className="flex items-start gap-2 bg-red-950/30 border border-red-900/50 px-2 py-1">
                      <Minus className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                      <span className="font-mono text-[11px] text-red-300">{change.before}</span>
                    </div>
                  )}
                  {change.after !== null && (
                    <div className="flex items-start gap-2 bg-teal-950/30 border border-teal-900/50 px-2 py-1">
                      <Plus className="h-3 w-3 text-teal-400 shrink-0 mt-0.5" />
                      <span className="font-mono text-[11px] text-teal-300">{change.after}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-mono text-[10px] text-titanium-600">{change.ts}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const QUICK_EXPORTS: { label: string; icon: ReactNode; format: ExportFormat }[] = [
  { label: 'PDF Paket',           icon: <FileText className="h-3.5 w-3.5" />, format: 'pdf' },
  { label: 'CSV Evidence',        icon: <Activity className="h-3.5 w-3.5" />, format: 'csv' },
  { label: 'JSON-LD (DSR)',       icon: <Package className="h-3.5 w-3.5" />, format: 'csv' },
  { label: 'Behörden-Bundle',     icon: <Shield className="h-3.5 w-3.5" />, format: 'pdf' },
  { label: 'Wirtschaftsprüfer-ZIP', icon: <Download className="h-3.5 w-3.5" />, format: 'pdf' },
];

function ExportsTab({ handlers }: { handlers: EvidenceHandlers }) {
  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-3">Schnell-Export</h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_EXPORTS.map((qe) => (
            <button
              key={qe.label}
              onClick={() => handlers.onExport(qe.label, qe.format, `qe-${qe.label}`)}
              disabled={handlers.busy === `qe-${qe.label}`}
              className="flex items-center gap-2 border border-titanium-900 hover:border-teal-700 bg-obsidian-900 hover:bg-obsidian-800 px-3 py-2 text-[11px] font-mono text-titanium-300 hover:text-titanium-100 transition-colors disabled:opacity-50"
            >
              <span className="text-teal-500">{handlers.busy === `qe-${qe.label}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : qe.icon}</span>
              {qe.label}
            </button>
          ))}
        </div>
      </div>
      <EmptyTab
        title="Keine Export-Historie in dieser Ansicht"
        hint="Exporte laufen über den Audit-Export. Es gibt hier keine Demo-Jobs und keine erfundenen Bundles."
      />
    </div>
  );
}

type TabId = 'timeline' | 'snapshots' | 'audittrail' | 'changes' | 'exports';

const TABS: { id: TabId; label: string }[] = [
  { id: 'timeline',   label: 'Timeline'        },
  { id: 'snapshots',  label: 'Snapshots'       },
  { id: 'audittrail', label: 'Prüfpfad'        },
  { id: 'changes',    label: 'Change Tracking' },
  { id: 'exports',    label: 'Exports'         },
];

function _EvidenceVaultView() {
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const { activeTenantId } = useTenant();
  const navigate = useNavigate();
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [metrics, setMetrics] = useState<VaultMetrics>(EMPTY_VAULT_METRICS);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'error' } | null>(null);

  function showToast(msg: string, tone: 'ok' | 'error' = 'ok') {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    if (!activeTenantId) {
      setItems([]);
      setSnapshots([]);
      setAudit([]);
      setChanges([]);
      setMetrics(EMPTY_VAULT_METRICS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchTenantEvents(activeTenantId, 50).catch(() => [] as DbGovernanceEvent[]),
      fetchTenantEvidence(activeTenantId, 50).catch(() => [] as DbGovernanceEvidence[]),
      listTimeline(activeTenantId).catch(() => []),
    ]).then(([events, evidence, timeline]) => {
      if (cancelled) return;
      setItems(mergeTimeline(events, evidence));
      setSnapshots(timeline.map((entry) => timelineToSnapshot(entry)));
      setAudit(events.map((e) => eventToAuditEntry(e)));
      setChanges(events.map((e) => eventToChangeEntry(e)).filter((c): c is ChangeEntry => c !== null));
      setMetrics(computeVaultMetrics(evidence));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTenantId]);

  async function runExport(prefix: string, format: ExportFormat, key: string) {
    if (!activeTenantId) {
      showToast('Kein aktiver Mandant — bitte anmelden.', 'error');
      return;
    }
    setBusy(key);
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

  const handlers: EvidenceHandlers = {
    busy,
    onExport: (prefix, format, key) => void runExport(prefix, format, key),
    onViewEvidence: (item) => {
      if (item.eventId) navigate(`/app/events/${item.eventId}`);
      else showToast('Dieser Nachweis hat kein hinterlegtes Ereignis.', 'error');
    },
    onCompare: () => setActiveTab('changes'),
    onShowTimeline: () => setActiveTab('timeline'),
  };

  const metricTiles = [
    { label: 'Nachweise geladen', value: String(metrics.total) },
    { label: 'Mit Hash',          value: String(metrics.signed) },
    { label: 'Diese Woche',       value: String(metrics.thisWeek) },
    { label: 'Letzter Nachweis',  value: metrics.lastCreated },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-obsidian-950 text-titanium-100">
      <div className="shrink-0 border-b border-titanium-900 bg-obsidian-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-sm tracking-tight text-titanium-50">
              Evidence Vault
            </h1>
            <p className="text-[11px] text-titanium-500 mt-0.5">
              Herkunftsnachweise · DSGVO · EU AI Act · nur Mandantendaten
            </p>
          </div>
          <button
            onClick={() => runExport('Evidence-Vault', 'csv', 'hdr-export')}
            disabled={busy === 'hdr-export'}
            className="flex items-center gap-2 border border-teal-800 hover:border-teal-600 bg-teal-950/40 hover:bg-teal-950 px-3 py-1.5 text-[11px] font-mono text-teal-300 hover:text-teal-100 transition-colors disabled:opacity-50"
          >
            {busy === 'hdr-export' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Evidence exportieren
          </button>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 border-b border-titanium-900">
        {metricTiles.map((m, i) => (
          <div
            key={m.label}
            className={`px-4 py-3 ${i < metricTiles.length - 1 ? 'border-r border-titanium-900' : ''}`}
          >
            <div className="font-display font-bold text-lg tabular-nums text-titanium-50">{m.value}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="shrink-0 flex border-b border-titanium-900 bg-obsidian-900">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2.5 text-[12px] font-mono uppercase tracking-wider border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-teal-400 text-titanium-50'
                : 'border-transparent text-titanium-500 hover:text-titanium-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'timeline'   && <TimelineTab items={items} loading={loading} handlers={handlers} />}
        {activeTab === 'snapshots'  && <SnapshotsTab snapshots={snapshots} loading={loading} handlers={handlers} />}
        {activeTab === 'audittrail' && <AuditTrailTab entries={audit} loading={loading} />}
        {activeTab === 'changes'    && <ChangeTrackingTab changes={changes} loading={loading} />}
        {activeTab === 'exports'    && <ExportsTab handlers={handlers} />}
      </div>

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

export const EvidenceVaultView = withPerformanceMonitoring(
  _EvidenceVaultView,
  'EvidenceVaultView',
  { threshold: 500, maxRenders: 10 },
);
