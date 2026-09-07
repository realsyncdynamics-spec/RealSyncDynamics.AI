import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Loader2, ShieldOff, Plug, Eye, RefreshCw,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import { ENFORCEMENT_CLASSES } from '../../../shared/enforcement-classes';
import {
  configureM365, disconnectM365, listM365Events, loadM365Connection,
  m365ReactionSummary, testM365,
  type M365AuditEvent, type M365Connection, type M365ReactionSummaryRow,
} from './gatesApi';

/**
 * /app/governance/microsoft365 — Microsoft 365 als nachgelagerte Anbindung (P2-2).
 *
 * Die Seite hat eine Aufgabe, die über das Anzeigen von Daten hinausgeht: Sie
 * muss verhindern, dass jemand diese Anbindung für eine Schranke hält. Klasse C
 * heißt, dass Microsoft Graph die Ereignisse erst nach der Handlung liefert.
 * Es gibt hier keinen Punkt, an dem etwas angehalten werden könnte.
 *
 * Deshalb steht die Grenze oben und nicht in einer Fußnote, und deshalb hat die
 * Ereignisliste eine eigene Spalte für den Fall, dass eine Richtlinie sperren
 * wollte und es nicht ging. Ohne diese Spalte sähe eine nicht durchsetzbare
 * Regel genauso aus wie eine nicht vorhandene.
 *
 * Nur vorhandene Komponenten, Klassen und Tokens (§10.2 des Design-Freeze).
 */
function _Microsoft365View() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const Microsoft365View = withPerformanceMonitoring(
  _Microsoft365View,
  'Microsoft365View',
  { threshold: 500, maxRenders: 10 },
);

const VERDICT_LABEL: Record<M365AuditEvent['verdict'], string> = {
  log_only: 'protokolliert',
  warn: 'Hinweis',
  react: 'Reaktion',
};

const VERDICT_TONE: Record<M365AuditEvent['verdict'], string> = {
  log_only: 'border-slate-700 text-slate-300',
  warn: 'border-amber-700 text-amber-300',
  react: 'border-rose-700 text-rose-300',
};

const PDP_STATUS_LABEL: Record<M365AuditEvent['pdp_status'], string> = {
  consulted: 'Richtlinie geprüft',
  not_enforcing: 'Prüfung abgeschaltet',
  unavailable: 'Prüfung nicht erreichbar',
};

function Inner() {
  const { activeTenantId } = useTenant();
  const [conn, setConn] = useState<M365Connection | null>(null);
  const [events, setEvents] = useState<M365AuditEvent[]>([]);
  const [summary, setSummary] = useState<M365ReactionSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [form, setForm] = useState({ azure_tenant_id: '', client_id: '', client_secret: '' });

  const reload = useCallback(async () => {
    if (!activeTenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [c, e, s] = await Promise.all([
        loadM365Connection(activeTenantId),
        listM365Events(activeTenantId),
        m365ReactionSummary(activeTenantId),
      ]);
      setConn(c);
      setEvents(e);
      setSummary(s);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => { void reload(); }, [reload]);

  const onConfigure = async () => {
    if (!activeTenantId) return;
    setBusy(true); setError(null); setNote(null);
    try {
      await configureM365(activeTenantId, form);
      // Das Geheimnis wird nicht im Zustand gehalten: Es ist versiegelt
      // gespeichert und wird hier nie wieder gebraucht.
      setForm({ azure_tenant_id: '', client_id: '', client_secret: '' });
      setNote('Anbindung gespeichert. Verbindung prüfen, um sie zu bestätigen.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    if (!activeTenantId || !conn) return;
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await testM365(activeTenantId, conn.id);
      setNote(res.ok
        ? `Verbindung steht${res.primary_domain ? ` (Hauptdomäne: ${String(res.primary_domain)})` : ''}.`
        : `Verbindung fehlgeschlagen: ${String(res.error ?? 'unbekannt')}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prüfung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (!activeTenantId || !conn) return;
    setBusy(true); setError(null); setNote(null);
    try {
      await disconnectM365(activeTenantId, conn.id);
      setNote('Zugangsdaten gelöscht. Die festgestellten Ereignisse bleiben als Prüfpfad erhalten.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trennen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const downgraded = summary.reduce((n, r) => n + Number(r.herabgestuft ?? 0), 0);
  const classC = ENFORCEMENT_CLASSES.C;

  return (
    <div className="min-h-screen bg-obsidian text-titanium">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/connectors" className="text-slate-400 hover:text-titanium">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Plug className="h-5 w-5" /> Microsoft 365
          </h1>
          <span
            title={`${classC.titel} — ${classC.bedeutung}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-amber-700 text-amber-300 rounded-none font-mono text-[10px] uppercase tracking-wider"
          >
            <ShieldOff className="h-3 w-3" /> Klasse C
          </span>
        </div>

        {/* Die Grenze steht oben, nicht in einer Fußnote. */}
        <div className="border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-200">
          <div className="flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Diese Anbindung kann nichts verhindern.</p>
              <p className="text-amber-300/80">
                Microsoft Graph liefert Prüfereignisse erst, nachdem die Handlung geschehen
                ist. Was hier möglich ist: feststellen, belegen, melden, eskalieren. Ein
                echter Block bräuchte Microsoft Purview DLP oder eine Netzwerk- bzw.
                Geräteebene — beides ist nicht Teil dieses Produkts.
              </p>
              {downgraded > 0 && (
                <p className="text-amber-100">
                  <strong>{downgraded}</strong>{' '}
                  {downgraded === 1 ? 'Ereignis' : 'Ereignisse'} in den letzten 30 Tagen, bei
                  {downgraded === 1 ? ' dem' : ' denen'} eine Richtlinie sperren wollte und es
                  hier nicht ging.
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="border border-rose-800 bg-rose-950/20 p-3 text-sm text-rose-200">{error}</div>
        )}
        {note && (
          <div className="border border-slate-700 bg-slate-900/40 p-3 text-sm text-slate-200">{note}</div>
        )}

        {/* ── Verbindung ─────────────────────────────────────────────────── */}
        <section className="border border-slate-800 bg-slate-950/40">
          <header className="px-4 py-3 border-b border-slate-800 text-sm font-medium">
            Verbindung
          </header>
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> lädt …
              </div>
            ) : conn ? (
              <div className="space-y-3 text-sm">
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Azure-Mandant</dt>
                    <dd className="font-mono text-xs break-all">{conn.azure_tenant_id}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Anwendung</dt>
                    <dd className="font-mono text-xs break-all">{conn.client_id}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Hauptdomäne</dt>
                    <dd className="font-mono text-xs">{conn.primary_domain ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Status</dt>
                    <dd className="font-mono text-xs">{conn.status}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Protokolle</dt>
                    <dd className="font-mono text-xs">{conn.streams.join(', ')}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Letzter Abruf</dt>
                    <dd className="font-mono text-xs">
                      {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString('de-DE') : 'noch keiner'}
                    </dd>
                  </div>
                </dl>
                {conn.last_error && (
                  <p className="text-rose-300 text-xs font-mono">{conn.last_error}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button" onClick={onTest} disabled={busy}
                    className="inline-flex items-center gap-2 border border-slate-700 px-3 py-1.5 text-xs hover:border-slate-500 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Verbindung prüfen
                  </button>
                  <button
                    type="button" onClick={onDisconnect} disabled={busy}
                    className="inline-flex items-center gap-2 border border-slate-700 px-3 py-1.5 text-xs hover:border-rose-700 disabled:opacity-50"
                  >
                    Zugangsdaten löschen
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Nötig ist eine App-Registrierung in Azure mit den Anwendungsberechtigungen{' '}
                  <span className="font-mono">AuditLog.Read.All</span> und{' '}
                  <span className="font-mono">Directory.Read.All</span> samt Zustimmung des
                  Administrators. Das Geheimnis wird serverseitig versiegelt und ist danach
                  nicht mehr auslesbar — auch nicht hier.
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    value={form.azure_tenant_id}
                    onChange={(e) => setForm({ ...form, azure_tenant_id: e.target.value })}
                    placeholder="Verzeichnis-ID (GUID)"
                    className="bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs font-mono"
                  />
                  <input
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    placeholder="Anwendungs-ID (GUID)"
                    className="bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs font-mono"
                  />
                  <input
                    value={form.client_secret} type="password" autoComplete="off"
                    onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                    placeholder="Geheimnis"
                    className="bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <button
                  type="button" onClick={onConfigure} disabled={busy || !form.client_secret}
                  className="inline-flex items-center gap-2 border border-slate-700 px-3 py-1.5 text-xs hover:border-slate-500 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                  Anbindung speichern
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Festgestellte Ereignisse ───────────────────────────────────── */}
        <section className="border border-slate-800 bg-slate-950/40">
          <header className="px-4 py-3 border-b border-slate-800 text-sm font-medium flex items-center gap-2">
            <Eye className="h-4 w-4" /> Festgestellte Ereignisse
          </header>
          {events.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">
              Noch nichts festgestellt. Der Abholjob läuft stündlich; ein erster Lauf greift
              24 Stunden zurück.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500 uppercase tracking-wider">
                  <tr className="border-b border-slate-800">
                    <th className="text-left font-normal px-4 py-2">Zeitpunkt</th>
                    <th className="text-left font-normal px-4 py-2">Vorgang</th>
                    <th className="text-left font-normal px-4 py-2">Handelnder</th>
                    <th className="text-left font-normal px-4 py-2">Bewertung</th>
                    <th className="text-left font-normal px-4 py-2">Nicht durchsetzbar</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-slate-900 align-top">
                      <td className="px-4 py-2 font-mono whitespace-nowrap">
                        {new Date(e.occurred_at).toLocaleString('de-DE')}
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-mono">{e.activity_kind}</span>
                        <span className="text-slate-500"> · {e.result}</span>
                        {e.signals.length > 0 && (
                          <div className="text-slate-500 font-mono">{e.signals.join(', ')}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {e.actor_external ? 'extern' : 'intern'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-1.5 py-0.5 border ${VERDICT_TONE[e.verdict]} font-mono text-[10px] uppercase tracking-wider`}>
                          {VERDICT_LABEL[e.verdict]}
                        </span>
                        <div className="text-slate-500">{PDP_STATUS_LABEL[e.pdp_status]}</div>
                      </td>
                      <td className="px-4 py-2">
                        {e.verdict_downgraded_from ? (
                          <span className="text-amber-300">
                            Richtlinie wollte „{e.verdict_downgraded_from}"
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
