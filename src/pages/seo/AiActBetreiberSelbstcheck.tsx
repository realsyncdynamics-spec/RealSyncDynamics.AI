import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Copy, Lock, Repeat, RotateCcw } from 'lucide-react';
import { BETREIBER_PFLICHTEN, RECHTSSTAND, type BetreiberPflicht } from '../../content/aiActBetreiberpflichten';
import { CTA } from '../../content/runtimeVocab';

/**
 * /ai-act-betreiberpflichten/selbstcheck — 12 Prüffragen zu Art. 26 (+ Art. 25),
 * Lückenbericht mit nächsten Schritten. Läuft rein im Browser: kein Request,
 * kein Storage — die Antworten verlassen die Seite nicht.
 */

type Antwort = 'ja' | 'teilweise' | 'nein' | 'na';

const OPTIONEN: { value: Antwort; label: string }[] = [
  { value: 'ja', label: 'Ja' },
  { value: 'teilweise', label: 'Teilweise' },
  { value: 'nein', label: 'Nein' },
  { value: 'na', label: 'Trifft nicht zu' },
];

const PUNKTE: Record<Exclude<Antwort, 'na'>, number> = { ja: 1, teilweise: 0.5, nein: 0 };

interface Auswertung {
  quote: number;
  erfuellt: number;
  anwendbar: number;
  luecken: { pflicht: BetreiberPflicht; antwort: 'teilweise' | 'nein' }[];
  rollenrisiko: boolean;
}

function auswerten(antworten: Record<string, Antwort>): Auswertung {
  let summe = 0;
  let anwendbar = 0;
  const luecken: Auswertung['luecken'] = [];
  for (const pflicht of BETREIBER_PFLICHTEN) {
    const a = antworten[pflicht.id];
    if (!a || a === 'na') continue;
    anwendbar += 1;
    summe += PUNKTE[a];
    if (a !== 'ja') luecken.push({ pflicht, antwort: a });
  }
  // „Nein“ zuerst, innerhalb gleicher Antwort in Gesetzesreihenfolge.
  luecken.sort((x, y) => (x.antwort === y.antwort ? 0 : x.antwort === 'nein' ? -1 : 1));
  return {
    quote: anwendbar === 0 ? 0 : summe / anwendbar,
    erfuellt: anwendbar - luecken.length,
    anwendbar,
    luecken,
    rollenrisiko: antworten.rollencheck === 'nein' || antworten.rollencheck === 'teilweise',
  };
}

function einstufung(quote: number): { label: string; text: string; textFarbe: string; rahmen: string } {
  if (quote >= 0.85) {
    return {
      label: 'Gut aufgestellt',
      text: 'Die meisten Prüfpunkte sind abgedeckt. Halten Sie die Nachweise aktuell und prüfen Sie die offenen Punkte unten.',
      textFarbe: 'text-emerald-300',
      rahmen: 'border-emerald-800',
    };
  }
  if (quote >= 0.5) {
    return {
      label: 'Lücken schließen',
      text: 'Die Grundlagen stehen, einzelne Pflichten sind noch offen. Bis zum Stichtag ist Zeit, sie geordnet zu schließen.',
      textFarbe: 'text-amber-300',
      rahmen: 'border-amber-800',
    };
  }
  return {
    label: 'Grundlagen aufbauen',
    text: 'Mehrere Pflichten sind noch nicht organisiert. Beginnen Sie mit Inventar, Aufsicht und Protokollen; darauf bauen die übrigen Punkte auf.',
    textFarbe: 'text-red-300',
    rahmen: 'border-red-800',
  };
}

function berichtAlsText(a: Auswertung): string {
  const zeilen = [
    `Art.-26-Selbstcheck (AI Act), Stand ${RECHTSSTAND}`,
    `Erfüllungsgrad: ${Math.round(a.quote * 100)} % (${a.anwendbar} anwendbare Prüfpunkte)`,
    '',
    a.luecken.length === 0 ? 'Keine offenen Punkte.' : 'Offene Punkte:',
    ...a.luecken.map(
      ({ pflicht, antwort }) =>
        `- [${antwort === 'nein' ? 'offen' : 'teilweise'}] ${pflicht.norm} ${pflicht.titel}: ${pflicht.massnahme}`,
    ),
    '',
    'Selbsteinschätzung, keine Rechtsberatung. realsyncdynamicsai.de/ai-act-betreiberpflichten',
  ];
  return zeilen.join('\n');
}

export function AiActBetreiberSelbstcheck() {
  const [antworten, setAntworten] = useState<Record<string, Antwort>>({});
  const [zeigeErgebnis, setZeigeErgebnis] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const ergebnisRef = useRef<HTMLElement>(null);

  const beantwortet = BETREIBER_PFLICHTEN.filter((p) => antworten[p.id]).length;
  const vollstaendig = beantwortet === BETREIBER_PFLICHTEN.length;
  const auswertung = useMemo(() => auswerten(antworten), [antworten]);

  function setze(id: string, a: Antwort) {
    setAntworten((prev) => ({ ...prev, [id]: a }));
    setKopiert(false);
  }

  function auswerte() {
    setZeigeErgebnis(true);
    requestAnimationFrame(() => {
      ergebnisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      ergebnisRef.current?.focus({ preventScroll: true });
    });
  }

  function zuruecksetzen() {
    setAntworten({});
    setZeigeErgebnis(false);
    setKopiert(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(berichtAlsText(auswertung));
      setKopiert(true);
    } catch {
      setKopiert(false);
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/ai-act-betreiberpflichten" aria-label="Zurück zu den Betreiberpflichten" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <ClipboardCheck className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Art.-26-Selbstcheck</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Selbstcheck: <span className="text-security-400">Betreiberpflichten nach Art. 26</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Zwölf Fragen, rund fünf Minuten. Am Ende steht ein Lückenbericht mit den nächsten Schritten.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-xs text-titanium-400">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Läuft vollständig im Browser. Ihre Antworten werden weder gespeichert noch übertragen.
            </p>
          </div>

          <div className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none text-sm text-titanium-300 leading-relaxed">
            Die Fragen beziehen sich auf <strong className="text-titanium-50">Hochrisiko-KI-Systeme</strong>. Wenn Sie
            nicht wissen, ob Ihr Einsatz dazu zählt, klären Sie das zuerst mit dem{' '}
            <Link to="/ai-act-klassifikator?source=betreiber-selbstcheck" className="text-security-400 hover:text-security-300">AI-Act-Klassifikator</Link>.
            Beantworten Sie die Fragen für Ihre Hochrisiko-Systeme insgesamt; „Teilweise“ heißt: für einige Systeme ja, für andere nicht.
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (vollstaendig) auswerte();
            }}
            className="space-y-4"
          >
            {BETREIBER_PFLICHTEN.map((p, i) => (
              <fieldset key={p.id} className="p-4 sm:p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
                <legend className="sr-only">{`Frage ${i + 1}: ${p.titel}`}</legend>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2" aria-hidden="true">
                  <span className="font-mono text-xs text-titanium-500">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display font-bold text-titanium-50 text-sm">{p.titel}</span>
                  <span className="font-mono text-[11px] text-emerald-300">{p.norm}</span>
                </div>
                <p className="text-sm text-titanium-200 leading-relaxed mb-3">{p.frage}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {OPTIONEN.map((o) => {
                    const aktiv = antworten[p.id] === o.value;
                    return (
                      <label
                        key={o.value}
                        className={`flex items-center justify-center gap-2 px-3 py-2 border text-sm cursor-pointer rounded-none focus-within:ring-2 focus-within:ring-security-500 ${
                          aktiv
                            ? 'border-security-500 bg-security-500/15 text-titanium-50 font-bold'
                            : 'border-titanium-800 text-titanium-300 hover:border-titanium-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name={p.id}
                          value={o.value}
                          checked={aktiv}
                          onChange={() => setze(p.id, o.value)}
                          className="sr-only"
                        />
                        {o.label}
                      </label>
                    );
                  })}
                </div>
                {p.nurOeffentlich && (
                  <p className="mt-2 text-xs text-titanium-500">Für private Unternehmen: „Trifft nicht zu“ wählen.</p>
                )}
              </fieldset>
            ))}

            <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-obsidian-950/95 backdrop-blur border-t border-titanium-900 sm:border-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="text-sm text-titanium-400" aria-live="polite">
                {beantwortet} von {BETREIBER_PFLICHTEN.length} beantwortet
              </div>
              <button
                type="submit"
                disabled={!vollstaendig}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 disabled:bg-obsidian-800 disabled:text-titanium-500 disabled:cursor-not-allowed text-white text-sm font-bold rounded-none"
              >
                Auswertung anzeigen <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>

          {zeigeErgebnis && vollstaendig && (
            <Ergebnis
              refEl={ergebnisRef}
              auswertung={auswertung}
              kopiert={kopiert}
              onKopieren={kopieren}
              onReset={zuruecksetzen}
            />
          )}

          <p className="text-xs text-titanium-500 leading-relaxed">
            Selbsteinschätzung auf Basis der VO (EU) 2024/1689 in der Fassung der VO (EU) 2026/1744, Stand {RECHTSSTAND}.
            Ersetzt keine Rechtsberatung. Alle Pflichten im Detail:{' '}
            <Link to="/ai-act-betreiberpflichten" className="text-security-400 hover:text-security-300">AI Act Betreiberpflichten</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

function Ergebnis({
  refEl,
  auswertung,
  kopiert,
  onKopieren,
  onReset,
}: {
  refEl: React.RefObject<HTMLElement | null>;
  auswertung: Auswertung;
  kopiert: boolean;
  onKopieren: () => void;
  onReset: () => void;
}) {
  const stufe = einstufung(auswertung.quote);
  return (
    <section ref={refEl} tabIndex={-1} aria-labelledby="ergebnis" className="space-y-6 outline-none scroll-mt-6">
      <div className={`p-6 sm:p-8 bg-obsidian-900 border rounded-none ${stufe.rahmen}`}>
        <h2 id="ergebnis" className="font-display font-bold text-titanium-50 text-2xl mb-1">Ihr Ergebnis</h2>
        {auswertung.anwendbar === 0 ? (
          <p className="text-sm text-titanium-300">
            Sie haben alle Punkte mit „Trifft nicht zu“ beantwortet. Setzen Sie keine Hochrisiko-KI ein, gelten die
            Pflichten aus Art. 26 nicht. Prüfen Sie das im Zweifel mit dem Klassifikator.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
              <span className="font-display font-bold text-4xl text-titanium-50">{Math.round(auswertung.quote * 100)} %</span>
              <span className={`text-sm font-bold uppercase tracking-wider ${stufe.textFarbe}`}>{stufe.label}</span>
            </div>
            <p className="text-sm text-titanium-300 leading-relaxed">{stufe.text}</p>
            <p className="mt-2 text-xs text-titanium-500">
              {auswertung.erfuellt} von {auswertung.anwendbar} anwendbaren Prüfpunkten vollständig erfüllt.
            </p>
          </>
        )}
      </div>

      {auswertung.rollenrisiko && (
        <div className="p-5 bg-obsidian-900 border border-amber-800 rounded-none flex items-start gap-3">
          <Repeat className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-titanium-300 leading-relaxed">
            <strong className="text-titanium-50">Prüfen Sie zuerst Ihre Rolle.</strong> Wenn Sie ein System unter eigener
            Marke anbieten, wesentlich verändert oder für einen hochriskanten Zweck umgewidmet haben, gelten Sie nach
            Art. 25 als Anbieter. Dann kommen die Anbieterpflichten nach Art. 16 hinzu, und dieser Check deckt nur einen
            Teil Ihrer Pflichten ab.{' '}
            <Link to="/ai-act-betreiberpflichten#rollenwechsel" className="text-security-400 hover:text-security-300">Mehr zum Rollenwechsel</Link>
          </div>
        </div>
      )}

      {auswertung.luecken.length > 0 ? (
        <div>
          <h3 className="font-display font-bold text-titanium-50 text-lg mb-3">Offene Punkte und nächste Schritte</h3>
          <ol className="space-y-3">
            {auswertung.luecken.map(({ pflicht, antwort }) => (
              <li key={pflicht.id} className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider border rounded-none ${
                      antwort === 'nein' ? 'text-red-300 border-red-900' : 'text-amber-300 border-amber-900'
                    }`}
                  >
                    {antwort === 'nein' ? 'Offen' : 'Teilweise'}
                  </span>
                  <span className="font-display font-bold text-titanium-50 text-sm">{pflicht.titel}</span>
                  <span className="font-mono text-[11px] text-emerald-300">{pflicht.norm}</span>
                </div>
                <p className="text-sm text-titanium-300 leading-relaxed">{pflicht.massnahme}</p>
                {pflicht.realsync && (
                  <p className="mt-1.5 text-xs text-security-300">Unterstützung in RealSync: {pflicht.realsync}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        auswertung.anwendbar > 0 && (
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Keine offenen Punkte.
          </p>
        )
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <Link to="/app?source=art26-selbstcheck" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
          {CTA.startTrial} <ArrowRight className="h-4 w-4" />
        </Link>
        <button type="button" onClick={onKopieren} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
          <Copy className="h-4 w-4" aria-hidden="true" /> {kopiert ? 'Kopiert' : 'Bericht kopieren'}
        </button>
        <button type="button" onClick={onReset} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Neu beginnen
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{kopiert ? 'Bericht in die Zwischenablage kopiert.' : ''}</p>
    </section>
  );
}
