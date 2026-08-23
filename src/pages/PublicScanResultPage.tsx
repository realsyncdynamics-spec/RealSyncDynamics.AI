/**
 * `/scan/ergebnis` — das Ergebnis des kostenlosen Scans.
 *
 * Das ist die Seite, an der sich der Trichter entscheidet. Sie muss drei
 * Dinge gleichzeitig leisten:
 *
 *   1. **Nutzen vor Bezahlung.** Der Besucher sieht seinen echten Score,
 *      seine echten Kategorien und seine schwersten Befunde im Klartext —
 *      mit Norm und Behebungshinweis. Keine Bezahlschranke davor.
 *   2. **Einen Grund für das Konto.** Was nicht in der Vorschau steht, wird
 *      als Anzahl ausgewiesen, nicht verschwiegen. Das Konto liefert die
 *      vollständige Liste, die Verlaufsbeobachtung und die Umsetzung.
 *   3. **Keine Rechtsaussage.** Der Bericht sagt, was beobachtet wurde. Die
 *      Formulierungen kommen aus `report.ts` und sind dort als Test
 *      festgenagelt — diese Seite erfindet keine eigenen.
 *
 * Nicht indexieren: Das Ergebnis gehört dem Besucher, nicht der Suche.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Loader2, Lock, Snowflake } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_SANS,
  LANDING_SERIF,
} from '../components/landing/landing-theme';
import { postEdgeFunction } from '../lib/edgeFunction';
import { readScanSession, rememberScanSession, resolveScanId } from '../lib/scanSession';
import { SCAN_ENTRY_PATH, SCAN_REGISTER_PATH, SCAN_SAVE_CTA } from '../config/scan-funnel';
import type { PublicScanReport } from '../../supabase/functions/_shared/public-scan/report';

interface ResultResponse {
  ok: true;
  scan_id: string;
  claimed: boolean;
  report: PublicScanReport;
}

/** Farbstufen des Scores. Grün nur dort, wo wirklich nichts auffiel. */
function scoreTone(score: number): string {
  if (score >= 90) return 'text-emerald-300';
  if (score >= 75) return 'text-amber-200';
  if (score >= 50) return 'text-orange-300';
  return 'text-red-300';
}

function severityLabel(severity: string): { text: string; className: string } {
  switch (severity) {
    case 'critical': return { text: 'Kritisch', className: 'border-red-500/40 bg-red-500/10 text-red-200' };
    case 'high': return { text: 'Hoch', className: 'border-orange-500/40 bg-orange-500/10 text-orange-200' };
    case 'medium': return { text: 'Mittel', className: 'border-amber-500/40 bg-amber-500/10 text-amber-200' };
    case 'low': return { text: 'Gering', className: 'border-white/20 bg-white/5 text-white/60' };
    default: return { text: 'Hinweis', className: 'border-white/20 bg-white/5 text-white/60' };
  }
}

export function PublicScanResultPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Ein Bericht kann auf zwei Wegen hier ankommen: über die Kennung (der
  // Regelfall) oder im Verlaufszustand, wenn das Ablegen fehlschlug. Der
  // zweite Weg ist flüchtig — beim Neuladen ist er weg, und dann greift
  // wieder die Kennung.
  const uebergeben = (location.state as { report?: PublicScanReport } | null)?.report ?? null;

  const [report, setReport] = useState<PublicScanReport | null>(uebergeben);
  const [loading, setLoading] = useState(uebergeben === null);
  const [error, setError] = useState('');

  const scanId = resolveScanId(searchParams);

  const laden = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await postEdgeFunction<ResultResponse>(
        'public-site-scan/result',
        { scan_id: id },
        { requireAuth: false },
      );
      setReport(data.report);
      rememberScanSession({ scanId: data.scan_id, domain: data.report.domain });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Der Bericht konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (uebergeben !== null) return;
    if (scanId === null) {
      setLoading(false);
      setError('Kein Scan ausgewählt.');
      return;
    }
    void laden(scanId);
  }, [scanId, uebergeben, laden]);

  const speichern = () => {
    const sitzung = readScanSession();
    const ziel = sitzung
      ? `${SCAN_REGISTER_PATH}?scan=${encodeURIComponent(sitzung.scanId)}`
      : SCAN_REGISTER_PATH;
    navigate(ziel);
  };

  return (
    <div
      className="landing-context min-h-screen text-white antialiased"
      style={{ backgroundColor: LANDING_BG, fontFamily: LANDING_SANS }}
    >
      {/* Das Ergebnis gehört dem Besucher — es hat in keinem Index etwas zu suchen. */}
      <SEOHead title="Ihr Scan-Ergebnis" canonical="/scan/ergebnis" noIndex />

      <header className="border-b border-white/10">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Snowflake className="h-6 w-6" strokeWidth={1.5} style={{ color: LANDING_ACCENT }} />
            <span className="text-base font-semibold tracking-tight sm:text-lg">
              RealSync <span className="font-normal text-white/80">Dynamics.AI</span>
            </span>
          </Link>
          <Link to={SCAN_ENTRY_PATH} className="text-sm text-white/65 transition-colors hover:text-white">
            Weitere Website prüfen
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-14">
        {loading && (
          <div className="flex items-center gap-3 text-white/60">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <p>Bericht wird geladen …</p>
          </div>
        )}

        {!loading && error !== '' && (
          <div className="surface-panel rounded-2xl p-8">
            <h1 className="text-2xl" style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}>
              Kein Bericht vorhanden
            </h1>
            <p className="mt-3 text-white/60">{error}</p>
            <Link
              to={SCAN_ENTRY_PATH}
              className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition"
              style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
            >
              Website jetzt prüfen <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        )}

        {!loading && report !== null && <Bericht report={report} onSpeichern={speichern} />}
      </main>
    </div>
  );
}

function Bericht({ report, onSpeichern }: { report: PublicScanReport; onSpeichern: () => void }) {
  const gefunden = report.counts.critical + report.counts.medium + report.counts.opportunity;

  return (
    <>
      {/* ── Kopf: Score und Einordnung ──────────────────────────────── */}
      <section className="grid gap-8 border-b border-white/10 pb-10 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center sm:text-left">
          <p className="font-mono text-[10px] uppercase tracking-[.25em] text-white/40">Gesamtergebnis</p>
          <p className={`mt-2 text-7xl font-semibold tabular-nums ${scoreTone(report.overallScore)}`}>
            {report.overallScore}
            <span className="text-2xl text-white/30"> / 100</span>
          </p>
        </div>
        <div>
          <h1 className="text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}>
            Analyse für <span style={{ color: LANDING_ACCENT }}>{report.domain}</span>
          </h1>
          <p className="mt-3 text-white/60">
            {gefunden === 0
              ? 'Im ausgelieferten HTML wurden keine Auffälligkeiten festgestellt.'
              : `Wir haben ${gefunden} Punkte gefunden, die sich verbessern lassen.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Zaehler wert={report.counts.critical} text="kritisch" className="border-red-500/40 bg-red-500/10 text-red-200" />
            <Zaehler wert={report.counts.medium} text="mittel" className="border-amber-500/40 bg-amber-500/10 text-amber-200" />
            <Zaehler wert={report.counts.opportunity} text="Optimierungsmöglichkeiten" className="border-white/20 bg-white/5 text-white/60" />
          </div>
        </div>
      </section>

      {report.coverage === 'limited' && (
        <p role="note" className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[.07] p-4 text-sm leading-relaxed text-amber-100/80">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          {/* Ohne diesen Hinweis läse sich eine misslungene Messung als
              makelloses Ergebnis — der gefährlichste Fehler dieser Seite. */}
          Der Abruf hat kaum auswertbaren Inhalt geliefert. Das Ergebnis ist
          deshalb nur eingeschränkt aussagekräftig — etwa bei einer
          Weiterleitungsseite oder einem vorgeschalteten Schutzwall.
        </p>
      )}

      {/* ── Kategorien ──────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl tracking-tight" style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}>
          Ergebnis je Bereich
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.categories.map((kategorie) => (
            <div key={kategorie.id} className="surface-panel rounded-2xl p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold tracking-wide">{kategorie.label}</h3>
                <span className={`text-2xl font-semibold tabular-nums ${scoreTone(kategorie.score)}`}>
                  {kategorie.score}
                </span>
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${kategorie.score}%`, backgroundColor: LANDING_ACCENT }}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/50">{kategorie.verdictText}</p>
              {kategorie.findingCount > 0 && (
                <p className="mt-1 font-mono text-[10px] tracking-wide text-white/35">
                  {kategorie.findingCount} Befund(e)
                  {kategorie.criticalCount > 0 && `, davon ${kategorie.criticalCount} schwer`}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Erkannte Technik ────────────────────────────────────────── */}
      {(report.technologies.length > 0 || report.aiTools.length > 0 || report.chatWidgets.length > 0) && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-wide text-white/70">Erkannte Technologie</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...report.technologies, ...report.aiTools, ...report.chatWidgets].map((name) => (
              <span key={name} className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[11px] text-white/55">
                {name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Befunde im Klartext ─────────────────────────────────────── */}
      {report.preview.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl tracking-tight" style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}>
            Die wichtigsten Befunde
          </h2>
          <div className="mt-6 space-y-3">
            {report.preview.map((befund) => {
              const stufe = severityLabel(befund.severity);
              return (
                <article key={befund.code} className="surface-panel rounded-2xl p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${stufe.className}`}>
                      {stufe.text}
                    </span>
                    <span className="font-mono text-[10px] tracking-wide text-white/35">{befund.reference}</span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold leading-snug">{befund.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{befund.remediation}</p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Was das Konto zusätzlich liefert ────────────────────────── */}
      <section className="mt-10 surface-panel rounded-2xl p-8">
        <div className="flex items-start gap-3">
          {report.lockedCount > 0
            ? <Lock className="mt-1 h-5 w-5 shrink-0" style={{ color: LANDING_ACCENT }} aria-hidden />
            : <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />}
          <div>
            <h2 className="text-xl tracking-tight" style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}>
              {report.lockedCount > 0
                ? `${report.lockedCount} weitere Befunde im Bericht`
                : 'Ergebnis sichern und beobachten'}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              Im Arbeitsbereich sehen Sie die vollständige Liste mit Norm und
              Behebungshinweis, behalten den Verlauf im Blick und können die
              Umsetzung, die laufende Überwachung und weitere Module dazubuchen.
            </p>
            <button
              type="button"
              onClick={onSpeichern}
              className="mt-6 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition"
              style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
            >
              {SCAN_SAVE_CTA} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <p className="mt-3 text-[11px] text-white/35">
              Ihre Analyse wird dem neuen Arbeitsbereich zugeordnet. Kein
              Zahlungsmittel nötig.
            </p>
          </div>
        </div>
      </section>

      {/* ── Haftungshinweis ─────────────────────────────────────────── */}
      <section className="mt-10 flex items-start gap-3 border-t border-white/10 pt-6">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/30" aria-hidden />
        <div className="text-xs leading-relaxed text-white/35">
          <p>{report.disclaimer}</p>
          <p className="mt-2 font-mono">
            Auswertung {report.engineVersion} · geprüft am{' '}
            {new Date(report.scannedAt).toLocaleString('de-DE')} · HTTP {report.httpStatus}
          </p>
        </div>
      </section>
    </>
  );
}

function Zaehler({ wert, text, className }: { wert: number; text: string; className: string }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 ${className}`}>
      <strong className="font-semibold tabular-nums">{wert}</strong> {text}
    </span>
  );
}

export default PublicScanResultPage;
