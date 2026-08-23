/**
 * `/scan` — der Einstieg des Trichters.
 *
 * Landingpage → **kostenloser Scan** → Ergebnis → Konto → Dashboard.
 *
 * Diese Seite hat genau eine Aufgabe: eine Adresse entgegennehmen und den
 * Scan starten. Sie erklärt, was geprüft wird, und sie verspricht nichts,
 * was der Bericht nicht hält — kein „wir machen Sie DSGVO-konform", sondern
 * „wir zeigen Ihnen, was von aussen sichtbar ist".
 *
 * Gestaltung nach `CLAUDE.md` §10: ausschliesslich vorhandene Klassen und
 * Tokens (`landing-theme.ts`, `surface-panel`), keine neue Optik.
 */
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Loader2, Lock, ShieldCheck, Snowflake } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { EdgeFunctionAvailabilityNotice } from '../components/landing/EdgeFunctionAvailabilityNotice';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_SANS,
  LANDING_SERIF,
} from '../components/landing/landing-theme';
import { postEdgeFunction } from '../lib/edgeFunction';
import { rememberScanSession } from '../lib/scanSession';
import { SCAN_FUNCTIONS } from '../config/scan-funnel';

interface ScanResponse {
  ok: true;
  scan_id: string | null;
  persisted: boolean;
  report: { domain: string; overallScore: number };
}

/** Was der Scan prüft — dieselben sechs Kategorien wie im Bericht. */
const GEPRUEFT: readonly (readonly [string, string])[] = [
  ['DSGVO & Datenschutz', 'Cookies vor Einwilligung, Drittanbieter, fremd geladene Schriften, Pflichtangaben.'],
  ['EU AI Act', 'Eingebundene KI-Dienste und Chat-Assistenten sowie der Transparenzhinweis nach Art. 50.'],
  ['Sicherheit', 'Verschlüsselung und Schutz-Header nach OWASP.'],
  ['Barrierefreiheit', 'Sprachauszeichnung, Alternativtexte, Formularbeschriftungen, Gliederung.'],
  ['SEO & Auffindbarkeit', 'Titel, Beschreibung, Überschriften, Canonical, strukturierte Daten.'],
  ['Technik & Nutzererlebnis', 'Antwortzeiten, Übertragungsvolumen, mobile Darstellung.'],
];

export function PublicScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [domain, setDomain] = useState(searchParams.get('domain') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Die Startseite reicht die Eingabe über `?domain=` weiter. Wer von dort
  // kommt, hat seine Adresse bereits getippt und soll sie nicht erneut
  // eingeben müssen.
  useEffect(() => {
    const fromUrl = searchParams.get('domain');
    if (fromUrl) setDomain(fromUrl);
  }, [searchParams]);

  const startScan = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (domain.trim() === '') {
      setError('Bitte geben Sie die Adresse Ihrer Website ein.');
      return;
    }

    setLoading(true);
    try {
      // Die Normalisierung („firma.de" → „https://firma.de") und die
      // Zielprüfung liegen serverseitig. Der Browser schickt die Eingabe
      // unverändert — eine Prüfung im Client wäre eine zweite Wahrheit
      // neben der, die zählt.
      const data = await postEdgeFunction<ScanResponse>(
        'public-site-scan',
        { url: domain.trim() },
        { requireAuth: false },
      );

      if (data.scan_id) {
        rememberScanSession({ scanId: data.scan_id, domain: data.report.domain });
        navigate(`/scan/ergebnis?scan=${encodeURIComponent(data.scan_id)}`);
        return;
      }

      // Der Bericht steht, konnte aber nicht abgelegt werden. Er ist trotzdem
      // etwas wert — die Ergebnisseite zeigt ihn aus dem Verlaufszustand.
      navigate('/scan/ergebnis', { state: { report: data.report } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Der Scan konnte nicht gestartet werden.');
      setLoading(false);
    }
  };

  return (
    <div
      className="landing-context min-h-screen text-white antialiased"
      style={{ backgroundColor: LANDING_BG, fontFamily: LANDING_SANS }}
    >
      <SEOHead
        title="Website kostenlos scannen — DSGVO, EU AI Act, SEO & Sicherheit"
        description="Kostenloser Website-Scan: DSGVO, EU AI Act, Sicherheit, Barrierefreiheit, SEO und Technik in einer Analyse. Ohne Account, Ergebnis in unter einer Minute."
        canonical="/scan"
      />

      <header className="border-b border-white/10">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Snowflake className="h-6 w-6" strokeWidth={1.5} style={{ color: LANDING_ACCENT }} />
            <span className="text-base font-semibold tracking-tight sm:text-lg">
              RealSync <span className="font-normal text-white/80">Dynamics.AI</span>
            </span>
          </Link>
          <Link to="/welcome" className="text-sm text-white/65 transition-colors hover:text-white">
            Login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[.25em]" style={{ color: LANDING_ACCENT }}>
          Kostenloser Website-Scan
        </p>
        <h1
          className="mt-4 text-4xl leading-[1.05] tracking-[-.03em] sm:text-5xl"
          style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
        >
          Was sieht ein Prüfer auf Ihrer Website?
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/65">
          Adresse eingeben, Ergebnis ansehen. Wir prüfen, was Ihre Website
          ausliefert — DSGVO, EU AI Act, Sicherheit, Barrierefreiheit, SEO und
          Technik. Kein Konto nötig, um das Ergebnis zu sehen.
        </p>

        <form onSubmit={startScan} className="mt-9">
          <label htmlFor="scan-domain" className="block text-sm font-medium text-white/70">
            Adresse Ihrer Website
          </label>
          <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-white/15 bg-black/35 p-2 backdrop-blur-xl sm:flex-row">
            <input
              id="scan-domain"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="z. B. firma.de"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              disabled={loading}
              autoFocus={domain === ''}
              aria-describedby="scan-hinweis"
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Website wird geprüft …
                </>
              ) : (
                <>
                  Kostenlos scannen <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          </div>
          <p id="scan-hinweis" className="mt-2 text-[11px] text-white/40">
            Wir rufen die Seite einmal öffentlich ab — wie ein Besucher. Kein
            Zugang, keine Anmeldedaten, keine Änderung an Ihrer Website.
          </p>

          {error !== '' && (
            <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}
        </form>

        <EdgeFunctionAvailabilityNotice
          className="mt-6"
          functions={SCAN_FUNCTIONS}
          title="Der Scan-Dienst ist noch nicht ausgerollt."
          detail="Die Analyse liegt im Repository, das zugehörige Backend läuft aber noch nicht in Produktion. Bis zum Deployment liefert dieses Formular einen Fehler statt eines Berichts."
        />

        <section className="mt-16">
          <h2 className="text-2xl tracking-tight" style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}>
            Was geprüft wird
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {GEPRUEFT.map(([titel, text]) => (
              <div key={titel} className="surface-panel rounded-2xl p-5">
                <h3 className="text-sm font-semibold tracking-wide">{titel}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: LANDING_ACCENT }} aria-hidden />
            <p className="text-sm leading-relaxed text-white/55">
              Wir speichern <strong className="font-semibold text-white/75">kein HTML</strong> Ihrer
              Seite — nur die abgeleiteten Befunde und Kennzahlen.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: LANDING_ACCENT }} aria-hidden />
            <p className="text-sm leading-relaxed text-white/55">
              Nicht übernommene Ergebnisse werden nach sieben Tagen gelöscht.
            </p>
          </div>
        </section>

        <p className="mt-12 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/35">
          Der Scan ist eine automatisierte Analyse des ausgelieferten HTML. Er
          ersetzt keine Rechtsberatung und trifft keine Aussage über die
          Rechtskonformität Ihrer Website.
        </p>
      </main>
    </div>
  );
}

export default PublicScanPage;
