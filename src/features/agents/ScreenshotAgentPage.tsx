import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';

// ─── Typen aus der DB-Schema-Migration (screenshot_reports) ──────────────────

interface ScreenshotReport {
  id: string;
  tenant_id: string;
  user_id: string | null;
  image_url: string | null;
  detected_issue: string | null;
  severity: string | null;
  suggested_fix: string | null;
  linked_issue_id: string | null;
  created_at: string;
}

// ─── Tab-Konfiguration ────────────────────────────────────────────────────────

type TabId = 'upload' | 'reports' | 'queue' | 'patterns';

const TABS: { id: TabId; label: string }[] = [
  { id: 'upload', label: 'Screenshot melden' },
  { id: 'reports', label: 'Erkannte Probleme' },
  { id: 'queue', label: 'Issue-Queue' },
  { id: 'patterns', label: 'Wiederkehrende Muster' },
];

const CATEGORIES = [
  'UI-Bug',
  'Checkout-Bug',
  'Routing-Bug',
  'Frontend-Bug',
  'Backend/API-Bug',
  'Datenbank-Bug',
  'Stripe/Webhook-Bug',
  'DNS/Deployment-Bug',
  'UX-Verbesserung',
];

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'border-rose-900 text-rose-400',
  high: 'border-amber-800 text-amber-400',
  medium: 'border-yellow-800 text-yellow-400',
  low: 'border-green-800 text-green-400',
};

function SeverityDot({ severity }: { severity: string | null }) {
  const cls = SEVERITY_DOT[severity?.toLowerCase() ?? ''] ?? 'bg-titanium-600';
  return <span className={`inline-block h-2 w-2 shrink-0 ${cls}`} aria-hidden="true" />;
}

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span className="text-titanium-600">—</span>;
  const cls = SEVERITY_BADGE[severity.toLowerCase()] ?? 'border-titanium-800 text-titanium-400';
  return (
    <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 border ${cls}`}>
      {severity}
    </span>
  );
}

// ─── Lade-/Fehler-/Leerzustände ───────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-titanium-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Lade Daten…</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-titanium-500 py-8 text-center">{label}</p>;
}

function StatBox({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="border border-titanium-800 bg-obsidian-950 p-4">
      <p className="font-mono text-2xl text-titanium-50">{value ?? '—'}</p>
      <p className="text-[11px] uppercase tracking-widest text-titanium-500 mt-1">{label}</p>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function ScreenshotAgentPage() {
  const { activeTenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<TabId>('upload');

  // Screenshot melden
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Meldungen (für reports, queue und patterns gemeinsam geladen)
  const [reports, setReports] = useState<ScreenshotReport[] | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Meldungen laden (tenant-isoliert, letzte 50) — Basis für drei Tabs
  useEffect(() => {
    if (activeTab === 'upload' || !activeTenantId) return;
    let cancelled = false;
    setReports(null);
    setReportsError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('screenshot_reports')
          .select('id, tenant_id, user_id, image_url, detected_issue, severity, suggested_fix, linked_issue_id, created_at')
          .eq('tenant_id', activeTenantId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!cancelled) {
          if (error) setReportsError(error.message);
          else setReports(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setReportsError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId, reloadKey]);

  // Meldung einreichen: Der Storage-Bucket für Screenshot-Uploads ist noch
  // nicht konfiguriert — die Meldung wird ohne Bild als Prüfpfad-Eintrag
  // in screenshot_reports erfasst (image_url = null). Kategorie und
  // Beschreibung landen strukturiert in detected_issue.
  async function handleSubmit() {
    if (!activeTenantId || !description.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { error } = await getSupabase()
        .from('screenshot_reports')
        .insert({
          tenant_id: activeTenantId,
          image_url: null,
          detected_issue: `[${category}] ${description.trim()}`,
          severity: 'medium',
        });
      if (error) {
        setSubmitError(error.message);
      } else {
        setSubmitted(true);
        setFile(null);
        setDescription('');
        setCategory(CATEGORIES[0]);
        setReloadKey((k) => k + 1);
      }
    } catch (e) {
      setSubmitError((e as Error)?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Abgeleitete Sichten für Queue und Muster
  const queue = (reports ?? []).filter(
    (r) => !r.linked_issue_id && ['critical', 'high'].includes(r.severity?.toLowerCase() ?? ''),
  );
  const total = reports?.length ?? null;
  const criticalCount = reports?.filter((r) => r.severity?.toLowerCase() === 'critical').length ?? null;
  const highCount = reports?.filter((r) => r.severity?.toLowerCase() === 'high').length ?? null;
  const withFixCount = reports?.filter((r) => !!r.suggested_fix).length ?? null;

  return (
    <div className="space-y-6">
      {/* Navigation zurück */}
      <Link
        to="/app/agents"
        className="inline-flex items-center gap-1.5 text-xs text-titanium-400 hover:text-titanium-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Zurück zu Agents
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-9 w-9 border border-titanium-800 bg-obsidian-950 text-cyan-400">
          <Camera className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-titanium-50">Screenshot &amp; Issue Fix Agent</h1>
            <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-amber-700 text-amber-400">
              Beta
            </span>
          </div>
          <p className="text-xs text-titanium-500">
            Screenshot → Analyse → Issue → Fix-Vorschlag
          </p>
        </div>
      </div>

      {/* Tab-Leiste */}
      <div className="flex border-b border-titanium-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors ' +
              (activeTab === tab.id
                ? 'border-[#0052FF] text-titanium-50'
                : 'border-transparent text-titanium-400 hover:text-titanium-200 hover:border-titanium-600')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Screenshot melden */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && (
            <div className="border border-titanium-800 bg-obsidian-950 p-4 space-y-4">
              {submitted ? (
                <>
                  <div className="flex items-start gap-2 text-sm text-green-300 bg-green-950/40 border border-green-900 p-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Deine Meldung wurde erfasst. Der Screenshot &amp; Issue Fix Agent
                      analysiert das Problem und ergänzt einen Lösungsvorschlag —
                      sichtbar unter „Erkannte Probleme".
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="text-xs text-titanium-400 hover:text-titanium-100 underline"
                  >
                    Weitere Meldung einreichen
                  </button>
                </>
              ) : (
                <>
                  {/* Datei-Auswahl als Hard-Edge-Dropfläche */}
                  <label
                    htmlFor="screenshot-file"
                    className="flex flex-col items-center justify-center gap-2 border border-dashed border-titanium-700 bg-obsidian-900 p-8 cursor-pointer hover:border-[#0052FF] transition-colors"
                  >
                    <Camera className="h-6 w-6 text-titanium-500" />
                    <span className="text-sm text-titanium-300">
                      {file ? file.name : 'Screenshot hierher ziehen oder auswählen'}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-titanium-600">
                      PNG · JPG · WEBP
                    </span>
                    <input
                      id="screenshot-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  <div className="flex items-start gap-2 text-xs text-titanium-400 border border-titanium-800 bg-obsidian-900 p-3">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-titanium-500" />
                    <span>
                      Screenshot-Upload wird aktiviert, sobald der Storage-Bucket
                      konfiguriert ist — die Meldung wird ohne Bild gespeichert.
                    </span>
                  </div>

                  <div>
                    <label htmlFor="screenshot-description" className="block text-xs font-mono uppercase tracking-widest text-titanium-500 mb-1">
                      Beschreibung des Problems
                    </label>
                    <textarea
                      id="screenshot-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="z. B. Der Checkout-Button reagiert auf der Pricing-Seite nicht."
                      className="w-full bg-obsidian-900 border border-titanium-800 text-sm text-titanium-100 p-3 placeholder:text-titanium-600 focus:outline-none focus:border-[#0052FF]"
                    />
                  </div>

                  <div>
                    <label htmlFor="screenshot-category" className="block text-xs font-mono uppercase tracking-widest text-titanium-500 mb-1">
                      Kategorie
                    </label>
                    <select
                      id="screenshot-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-obsidian-900 border border-titanium-800 text-sm text-titanium-100 p-2.5 focus:outline-none focus:border-[#0052FF]"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {submitError && <ErrorState message={submitError} />}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !description.trim()}
                    className="px-4 py-2 text-sm font-medium bg-[#0052FF] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                  >
                    {submitting ? 'Wird gesendet…' : 'Meldung einreichen'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Erkannte Probleme */}
      {activeTab === 'reports' && (
        <div>
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && reports === null && !reportsError && <LoadingState />}
          {reportsError && <ErrorState message={reportsError} />}
          {reports !== null && reports.length === 0 && (
            <EmptyState label="Noch keine Probleme erkannt — reiche einen Screenshot ein, um die Analyse zu starten." />
          )}
          {reports !== null && reports.length > 0 && (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="border border-titanium-800 bg-obsidian-950 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="mt-1.5"><SeverityDot severity={r.severity} /></span>
                      <p className="text-sm text-titanium-200 break-words">
                        {r.detected_issue ?? '—'}
                      </p>
                    </div>
                    {r.linked_issue_id && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 border border-titanium-800 text-titanium-400 shrink-0">
                        {r.linked_issue_id}
                      </span>
                    )}
                  </div>
                  {r.suggested_fix && (
                    <div className="border border-titanium-800 bg-obsidian-900 p-3">
                      <p className="text-[11px] font-mono uppercase tracking-widest text-titanium-500 mb-1">
                        Lösungsvorschlag
                      </p>
                      <p className="text-xs text-titanium-300">{r.suggested_fix}</p>
                    </div>
                  )}
                  <p className="font-mono text-[10px] text-titanium-500">{formatDate(r.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Issue-Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && (
            <>
              <div className="flex items-start gap-2 text-sm text-titanium-400 border border-titanium-800 bg-obsidian-950 p-3">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-titanium-500" />
                <span>
                  Kritische und hohe Meldungen warten auf Übergabe an den Issue Fix
                  Agent. GitHub-Issues werden erstellt, sobald die GitHub-Integration
                  konfiguriert ist.
                </span>
              </div>
              {reports === null && !reportsError && <LoadingState />}
              {reportsError && <ErrorState message={reportsError} />}
              {reports !== null && queue.length === 0 && (
                <EmptyState label="Keine offenen kritischen oder hohen Meldungen in der Queue." />
              )}
              {reports !== null && queue.length > 0 && (
                <div className="border border-titanium-800 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-titanium-800 text-left">
                        <th className="px-3 py-2 text-[11px] font-mono uppercase tracking-widest text-titanium-500">Severity</th>
                        <th className="px-3 py-2 text-[11px] font-mono uppercase tracking-widest text-titanium-500">Problem</th>
                        <th className="px-3 py-2 text-[11px] font-mono uppercase tracking-widest text-titanium-500">Gemeldet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-titanium-900">
                      {queue.map((r) => (
                        <tr key={r.id} className="hover:bg-obsidian-900 transition-colors">
                          <td className="px-3 py-2 whitespace-nowrap"><SeverityBadge severity={r.severity} /></td>
                          <td className="px-3 py-2 text-titanium-200">{r.detected_issue ?? '—'}</td>
                          <td className="px-3 py-2 font-mono text-[10px] text-titanium-500 whitespace-nowrap">
                            {formatDate(r.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Wiederkehrende Muster */}
      {activeTab === 'patterns' && (
        <div className="space-y-4">
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && (
            <>
              {reportsError && <ErrorState message={reportsError} />}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatBox value={total} label="Gesamt" />
                <StatBox value={criticalCount} label="Kritisch" />
                <StatBox value={highCount} label="Hoch" />
                <StatBox value={withFixCount} label="Mit Fix-Vorschlag" />
              </div>
              <div className="border border-titanium-800 bg-obsidian-950 p-4">
                <h2 className="text-sm font-semibold text-titanium-100 mb-2">Muster-Analyse</h2>
                <p className="text-sm text-titanium-400">
                  Wiederkehrende Fehlerbilder werden erkannt und in
                  Automatisierungs-Vorschläge überführt: Häuft sich dieselbe
                  Fehlerkategorie, schlägt der Automation Agent einen dauerhaften
                  Workflow vor (z. B. automatischer Smoke-Test nach jedem Deploy).
                  Jede Meldung fließt als Prüfpfad-Eintrag in die Analyse ein.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
