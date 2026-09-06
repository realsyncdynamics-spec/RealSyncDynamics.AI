import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Loader2, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import {
  listShadowDivergences, shadowReadiness,
  type ShadowDivergence, type ShadowReadinessRow,
} from './gatesApi';

/**
 * /app/governance/shadow — Beobachtungsbetrieb (Plan §7).
 *
 * Diese Seite beantwortet genau eine Frage: **Kann man die
 * Enforcement-Schalter guten Gewissens umlegen?**
 *
 * Sie ist so gebaut, dass sie diese Frage nicht versehentlich mit „ja"
 * beantwortet. Ein Kanal, der nie etwas geschrieben hat, erscheint als
 * **unbeobachtet** — nicht als unauffällig. Genau dieser Unterschied fehlte
 * am 2026-09-04, als der Publish Gate tagelang nichts protokollierte, weil
 * sein Aufruf falsch war und der Fehler in einem `catch` verschwand. Eine
 * Auswertung, die nur vorhandene Zeilen gruppiert, hätte damals „keine
 * Divergenzen" gezeigt.
 *
 * Nur vorhandene Komponenten, Klassen und Tokens (§10.2 des Design-Freeze).
 */
function _ShadowReadinessView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const ShadowReadinessView = withPerformanceMonitoring(
  _ShadowReadinessView,
  'ShadowReadinessView',
  { threshold: 500, maxRenders: 10 },
);

/**
 * Welcher Schalter zu welchem Kanal gehört.
 *
 * Der **Zustand** des Schalters steht bewusst nicht hier: Er ist eine
 * Umgebungsvariable der Edge Functions und im Browser nicht lesbar. Ihn zu
 * raten oder aus einer Vermutung anzuzeigen wäre dieselbe Sorte Behauptung,
 * die diese Seite gerade aufdecken soll.
 */
const SWITCH_OF: Record<string, string> = {
  'ai-gateway': 'AI_GATEWAY_ENFORCEMENT',
  'siteos_publish': 'SITEOS_PUBLISH_PDP',
  'bot-chat': 'BOT_PDP_ENFORCEMENT',
  'bot-whatsapp': 'BOT_PDP_ENFORCEMENT',
  'bot-voice': 'BOT_PDP_ENFORCEMENT',
  'm365-audit': 'M365_PDP_ENFORCEMENT',
  'governance-ingest': '— (Alt-Pfad, rechnet nur mit)',
  'telemetry-ai-event': '— (Alt-Pfad, rechnet nur mit)',
};

function tage(von: string | null, bis: string | null): string {
  if (!von || !bis) return '—';
  const d = (new Date(bis).getTime() - new Date(von).getTime()) / 86_400_000;
  if (d < 1) return '< 1 Tag';
  return `${Math.floor(d)} Tage`;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState<ShadowReadinessRow[]>([]);
  const [divergences, setDivergences] = useState<ShadowDivergence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activeTenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [r, d] = await Promise.all([
        shadowReadiness(activeTenantId),
        listShadowDivergences(activeTenantId),
      ]);
      setRows(r);
      setDivergences(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => { void reload(); }, [reload]);

  const unbeobachtet = rows.filter((r) => !r.beobachtet);
  const lockerer = rows.reduce((n, r) => n + Number(r.v2_lockerer ?? 0), 0);
  const wuerdeSperren = rows.reduce((n, r) => n + Number(r.wuerde_sperren ?? 0), 0);
  const unbekannt = rows.reduce((n, r) => n + Number(r.unbekannt ?? 0), 0);

  return (
    <div className="min-h-screen bg-obsidian text-titanium">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/start" className="text-slate-400 hover:text-titanium">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5" /> Beobachtungsbetrieb
          </h1>
        </div>

        <p className="text-sm text-slate-400 max-w-3xl">
          Alle Enforcement-Schalter stehen auf Beobachtung: Die Richtlinien werden
          mitgerechnet und protokolliert, gesperrt wird nichts. Diese Seite ist die
          Grundlage für die Entscheidung, wann das endet — und sie soll diese
          Entscheidung nicht leichter aussehen lassen, als sie ist.
        </p>

        {/* Der Befund, der die Entscheidung blockiert, steht oben. */}
        {!loading && unbeobachtet.length > 0 && (
          <div className="border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-200">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">
                  {unbeobachtet.length} von {rows.length} Kanälen sind nicht beobachtet.
                </p>
                <p className="text-amber-300/80">
                  Kein Eintrag heißt <strong>nicht</strong> „keine Abweichung". Es heißt
                  zuerst: nachsehen, ob überhaupt geschrieben wird. Entweder lief über
                  diesen Kanal kein Verkehr, oder das Protokollieren ist kaputt — von
                  außen sieht beides gleich aus. Am 2026-09-04 war es das Zweite, beim
                  Publish Gate, tagelang unbemerkt.
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && lockerer > 0 && (
          <div className="border border-rose-800 bg-rose-950/20 p-4 text-sm text-rose-200">
            <div className="flex gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">
                  {lockerer}× hätte die neue Engine <strong>lockerer</strong> entschieden
                  als die alte.
                </p>
                <p className="text-rose-300/80">
                  Das ist der schwerere Fall: Er betrifft nicht die Arbeitsfähigkeit nach
                  dem Umschalten, sondern die Zusage von heute. Jeder dieser Fälle gehört
                  einzeln erklärt, bevor umgeschaltet wird.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="border border-rose-800 bg-rose-950/20 p-3 text-sm text-rose-200">{error}</div>
        )}

        {/* ── Stand je Kanal ─────────────────────────────────────────────── */}
        <section className="border border-slate-800 bg-slate-950/40">
          <header className="px-4 py-3 border-b border-slate-800 text-sm font-medium">
            Stand je Kanal (letzte 30 Tage)
          </header>
          {loading ? (
            <div className="p-4 flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> lädt …
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500 uppercase tracking-wider">
                  <tr className="border-b border-slate-800">
                    <th className="text-left font-normal px-4 py-2">Kanal</th>
                    <th className="text-left font-normal px-4 py-2">Schalter</th>
                    <th className="text-right font-normal px-4 py-2">Einträge</th>
                    <th className="text-right font-normal px-4 py-2">Zeitraum</th>
                    <th className="text-right font-normal px-4 py-2">Divergenzen</th>
                    <th className="text-right font-normal px-4 py-2">v2 strenger</th>
                    <th className="text-right font-normal px-4 py-2">v2 lockerer</th>
                    <th className="text-right font-normal px-4 py-2">würde sperren</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.source}
                      className={`border-b border-slate-900 ${r.beobachtet ? '' : 'bg-amber-950/10'}`}
                    >
                      <td className="px-4 py-2 font-mono">
                        <span className="inline-flex items-center gap-1.5">
                          {r.beobachtet
                            ? <Eye className="h-3 w-3 text-slate-500" />
                            : <EyeOff className="h-3 w-3 text-amber-400" />}
                          {r.source}
                        </span>
                        {!r.beobachtet && (
                          <div className="text-amber-400 mt-0.5">unbeobachtet</div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-500">
                        {SWITCH_OF[r.source] ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{r.eintraege}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500">
                        {tage(r.erste, r.letzte)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{r.divergenzen}</td>
                      <td className="px-4 py-2 text-right font-mono text-amber-300">
                        {r.v2_strenger || '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-rose-300">
                        {r.v2_lockerer || '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{r.wuerde_sperren || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500 space-y-1">
            <p>
              <strong className="text-slate-400">„würde sperren"</strong> zählt die Fälle,
              in denen die neue Engine <span className="font-mono">block</span> oder{' '}
              <span className="font-mono">require_approval</span> entschieden hätte — also
              das, was ein Umschalten auf <span className="font-mono">enforce</span> gekostet
              hätte.
            </p>
            <p>
              Der <strong className="text-slate-400">Zustand</strong> der Schalter steht
              nicht hier: Er ist eine Umgebungsvariable der Edge Functions und im Browser
              nicht lesbar. Eine geratene Anzeige wäre genau die Sorte Behauptung, die diese
              Seite aufdecken soll.
            </p>
            {unbekannt > 0 && (
              <p className="text-amber-300">
                {unbekannt} Einträge tragen ein Verdikt, das die Rangordnung nicht kennt —
                vermutlich ein neues Vokabular, das in{' '}
                <span className="font-mono">pdp_verdict_rank</span> fehlt.
              </p>
            )}
          </div>
        </section>

        {/* ── Die Abweichungen selbst ────────────────────────────────────── */}
        <section className="border border-slate-800 bg-slate-950/40">
          <header className="px-4 py-3 border-b border-slate-800 text-sm font-medium">
            Abweichungen im Einzelnen
          </header>
          {!loading && divergences.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">
              Keine Abweichung protokolliert.{' '}
              {unbeobachtet.length > 0 && (
                <span className="text-amber-300">
                  Das sagt allerdings wenig, solange {unbeobachtet.length} Kanäle gar nicht
                  beobachtet werden.
                </span>
              )}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500 uppercase tracking-wider">
                  <tr className="border-b border-slate-800">
                    <th className="text-left font-normal px-4 py-2">Zeitpunkt</th>
                    <th className="text-left font-normal px-4 py-2">Kanal</th>
                    <th className="text-left font-normal px-4 py-2">Alt-Engine</th>
                    <th className="text-left font-normal px-4 py-2">PDP v2</th>
                    <th className="text-left font-normal px-4 py-2">Snapshot</th>
                  </tr>
                </thead>
                <tbody>
                  {divergences.map((d) => (
                    <tr key={d.id} className="border-b border-slate-900">
                      <td className="px-4 py-2 font-mono whitespace-nowrap">
                        {new Date(d.created_at).toLocaleString('de-DE')}
                      </td>
                      <td className="px-4 py-2 font-mono">{d.source}</td>
                      <td className="px-4 py-2 font-mono text-slate-400">
                        {d.legacy_status ?? '— (keine)'}
                      </td>
                      <td className="px-4 py-2 font-mono">{d.v2_status ?? '—'}</td>
                      <td className="px-4 py-2 font-mono text-slate-600">
                        {d.snapshot_version ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
            <span className="font-mono">— (keine)</span> bei der Alt-Engine heißt: Auf
            diesem Kanal hat vor der Anbindung überhaupt keine Engine entschieden. Dort ist
            jede Nicht-Zustimmung von v2 eine neue Sperre, keine Abweichung von einer
            früheren.
          </div>
        </section>

        {wuerdeSperren > 0 && (
          <p className="text-xs text-slate-500">
            Insgesamt hätte <span className="font-mono text-slate-300">{wuerdeSperren}</span>{' '}
            {wuerdeSperren === 1 ? 'Vorgang' : 'Vorgänge'} im Durchsetzbetrieb angehalten
            oder eine Freigabe verlangt.
          </p>
        )}
      </div>
    </div>
  );
}
