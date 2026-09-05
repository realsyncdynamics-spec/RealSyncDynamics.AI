import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, Loader2, Anchor, Download, CheckCircle2, XCircle,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import {
  createAnchor, listAnchors, markAnchorExported, verifyChain,
  type ChainVerifyResult, type EvidenceAnchor,
} from './gatesApi';

/**
 * /app/governance/evidence — Integrität der Beweiskette (P1-6).
 *
 * Zwei Fragen, die ein Prüfer stellt, und die diese Seite beantwortet:
 * „Ist die Kette unversehrt?" (nachrechnen, nicht glauben) und „Können Sie
 * belegen, dass sie schon vor drei Monaten so aussah?" (Anker).
 *
 * Die Seite sagt ausdrücklich, was ein Anker NICHT leistet, solange er die
 * Plattform nicht verlässt — ein Beweismittel, das nur beim Beweispflichtigen
 * liegt, überzeugt niemanden.
 */
function _EvidenceIntegrityView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const EvidenceIntegrityView = withPerformanceMonitoring(
  _EvidenceIntegrityView,
  'EvidenceIntegrityView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [anchors, setAnchors] = useState<EvidenceAnchor[] | null>(null);
  const [verification, setVerification] = useState<ChainVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!activeTenantId) { setAnchors([]); return; }
    setError(null); setAnchors(null);
    const res = await listAnchors(activeTenantId);
    if (!res.ok) { setError(res.error?.message ?? 'Anker konnten nicht geladen werden'); setAnchors([]); }
    else setAnchors(res.anchors ?? []);
  }, [activeTenantId]);

  useEffect(() => { void reload(); }, [reload]);

  async function onVerify() {
    if (!activeTenantId) return;
    setBusy(true); setError(null); setVerification(null);
    const res = await verifyChain(activeTenantId);
    setBusy(false);
    if (!res.ok) { setError(res.error?.message ?? 'Prüfung fehlgeschlagen'); return; }
    setVerification(res);
  }

  async function onCreate() {
    if (!activeTenantId) return;
    setBusy(true); setError(null);
    const res = await createAnchor(activeTenantId);
    setBusy(false);
    if (!res.ok) { setError(res.error?.message ?? 'Anker konnte nicht gesetzt werden'); return; }
    void reload();
  }

  async function onExport(a: EvidenceAnchor) {
    if (!activeTenantId) return;
    const note = window.prompt('Wohin wurde der Anker gesichert? (z. B. „Ablage Wirtschaftsprüfung 2026")');
    if (note === null) return;
    setBusy(true); setError(null);
    const res = await markAnchorExported(activeTenantId, a.id, note || undefined);
    setBusy(false);
    if (!res.ok) { setError(res.error?.message ?? 'Vermerk fehlgeschlagen'); return; }
    void reload();
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Beweiskette</div>
              <div className="text-[11px] text-titanium-400 font-medium">Unversehrtheit prüfen und Prüfpunkte sichern</div>
            </div>
          </div>
        </div>
        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
          >
            {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
          </select>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus.</div>
        ) : (
          <>
            {/* ── Kette nachrechnen ── */}
            <section className="border border-titanium-900 bg-obsidian-900/60 p-3 mb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-mono uppercase tracking-wider text-titanium-300">Unversehrtheit</div>
                  <p className="text-[11px] text-titanium-400 mt-1 max-w-xl">
                    Rechnet jeden Eintrag der Kette neu und vergleicht ihn mit dem gespeicherten
                    Hash. Weicht einer ab, wurde er nach dem Schreiben verändert.
                  </p>
                </div>
                <button
                  onClick={onVerify}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors disabled:opacity-50 shrink-0"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Kette prüfen
                </button>
              </div>
              {verification && (
                <div className="mt-3 flex items-start gap-2 text-[12px]">
                  {verification.intact ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-titanium-300">
                        {verification.checked} Einträge geprüft — Kette unversehrt.
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-red-300">
                        {verification.broken_count} von {verification.checked} Einträgen weichen ab.
                        Erster Bruch bei Index {verification.first_broken_index}. Alles danach ist Folgefehler —
                        dort ansetzen.
                      </span>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* ── Anker ── */}
            <section className="border border-titanium-900 bg-obsidian-900/60 p-3">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-titanium-300">
                    <Anchor className="h-3.5 w-3.5" /> Prüfpunkte
                  </div>
                  <p className="text-[11px] text-titanium-400 mt-1 max-w-xl">
                    Ein Anker hält fest, wo die Kette zu einem Zeitpunkt endete. Wird die Historie
                    später verändert, passt der Anker nicht mehr.{' '}
                    <span className="text-amber-300">
                      Sein Beweiswert entsteht erst, wenn Sie ihn aus der Plattform heraus sichern —
                      ein Beleg, der nur beim Beweispflichtigen liegt, überzeugt keinen Prüfer.
                    </span>
                  </p>
                </div>
                <button
                  onClick={onCreate}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors disabled:opacity-50 shrink-0"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Anchor className="h-4 w-4" />} Anker setzen
                </button>
              </div>

              {anchors === null ? (
                <div className="flex items-center gap-2 text-titanium-500 text-sm py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Lade Prüfpunkte…
                </div>
              ) : anchors.length === 0 ? (
                <p className="text-[11px] text-titanium-500">
                  Noch kein Prüfpunkt gesetzt. Ohne Anker lässt sich später nicht belegen,
                  wie die Kette zu einem früheren Zeitpunkt aussah.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {anchors.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 border border-titanium-900/70 p-2">
                      <div className="min-w-0 text-[11px]">
                        <span className="font-mono text-titanium-200">Index {a.chain_index}</span>
                        <span className="text-titanium-600"> · {a.event_count} Einträge</span>
                        <span className="text-titanium-600"> · {new Date(a.created_at).toLocaleString('de-DE')}</span>
                        <div className="text-titanium-500 mt-0.5">
                          {a.signature_alg
                            ? <>signiert ({a.signature_alg}{a.signing_key_id ? `, ${a.signing_key_id}` : ''})</>
                            : <span className="text-amber-300">unsigniert — kein Signaturschlüssel konfiguriert</span>}
                          {a.exported_at
                            ? <> · gesichert am {new Date(a.exported_at).toLocaleDateString('de-DE')}
                                {a.export_note ? ` (${a.export_note})` : ''}</>
                            : <span className="text-amber-300"> · noch nicht gesichert</span>}
                        </div>
                      </div>
                      {!a.exported_at && (
                        <button
                          onClick={() => onExport(a)}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-2 py-1 border border-titanium-900 hover:border-amber-500 text-titanium-300 hover:text-amber-200 text-[11px] font-semibold rounded-none transition-colors disabled:opacity-50 shrink-0"
                        >
                          <Download className="h-3 w-3" /> Als gesichert vermerken
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
