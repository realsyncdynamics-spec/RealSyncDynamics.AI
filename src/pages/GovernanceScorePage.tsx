/**
 * GovernanceScorePage — interaktiver Governance Complexity Score (GCS).
 *
 * Route: /governance-score (Alias: /governance-complexity-score)
 *
 * Der Nutzer wählt pro Dimension eine Option; daraus berechnet `computeGcs`
 * live Score, Level, Governance Coverage, Risiken und das empfohlene Paket.
 * Botschaft: Der Nutzer kauft Governance-Abdeckung — nicht „Anzahl Webseiten".
 *
 * Self-Serve-Disziplin: empfohlenes Paket verlinkt auf den bestehenden,
 * buchbaren Checkout (Stripe bleibt unverändert). CTA-Strings aus `CTA`.
 *
 * Design: „European Enterprise Trust" (Petrol/Teal, rounded-chip/card/panel,
 * Monospace für Metadaten).
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Activity, AlertTriangle, Gauge, Landmark } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import { CTA } from '../content/runtimeVocab';
import { tierById } from '../config/pricing';
import {
  GCS_DIMENSIONS,
  GCS_LEVELS,
  computeGcs,
  type GcsAnswers,
} from '../config/gcs';

export function GovernanceScorePage() {
  usePageMeta({
    title: 'Governance Complexity Score — passende Governance-Abdeckung | RealSyncDynamics.AI',
    description:
      'Ermitteln Sie Ihren Governance Complexity Score aus Branche, Datenkategorien, KI-Nutzung, ' +
      'Drittanbietern, Tracking und Dokumentationspflichten — und sehen Sie die passende ' +
      'Governance-Abdeckung statt einer Anzahl Webseiten.',
    url: 'https://RealSyncDynamicsAI.de/governance-score',
  });

  const [answers, setAnswers] = useState<GcsAnswers>({});
  const [multiTenant, setMultiTenant] = useState(false);

  const result = useMemo(() => computeGcs(answers, { multiTenant }), [answers, multiTenant]);
  const level = GCS_LEVELS[result.level];
  const tier = tierById(result.recommended.tierId);
  const answeredCount = Object.keys(answers).length;
  const recommendedHref = tier?.cta.href ?? '/pricing';

  function select(dimId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [dimId]: value }));
  }

  return (
    <>
      <Navbar />
      <main className="bg-obsidian-950 text-titanium-100 pt-14">
        {/* Hero */}
        <section className="border-b border-titanium-900 px-4 sm:px-6 py-14 sm:py-20">
          <div className="max-w-5xl mx-auto">
            <p className="inline-flex items-center gap-2 rounded-chip border border-petrol-500/40 bg-petrol-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-petrol-300 mb-5">
              <Gauge className="h-3.5 w-3.5" /> Governance Complexity Score
            </p>
            <h1 className="font-display font-bold tracking-tight text-titanium-50 text-3xl sm:text-4xl leading-[1.1] max-w-3xl">
              Sie kaufen keine Anzahl Webseiten. Sie kaufen Governance-Abdeckung.
            </h1>
            <p className="mt-5 text-base text-titanium-300 max-w-2xl leading-relaxed">
              Ein Friseur mit fünf Webseiten hat oft weniger Governance-Aufwand als eine
              Arztpraxis mit einer Webseite. Beantworten Sie acht Fragen — der Governance
              Complexity Score zeigt Ihre Komplexität und das passende Paket.
            </p>
          </div>
        </section>

        {/* Assessment + Ergebnis */}
        <section className="px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            {/* Fragen */}
            <div className="lg:col-span-2 space-y-6">
              {GCS_DIMENSIONS.map((dim) => (
                <fieldset key={dim.id} className="rounded-card border border-titanium-800 bg-obsidian-900 p-5">
                  <legend className="font-display font-semibold text-titanium-50 text-[15px] px-1">
                    {dim.question}
                  </legend>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-3 mt-1">
                    {dim.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {dim.options.map((opt) => {
                      const active = answers[dim.id] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => select(dim.id, opt.value)}
                          aria-pressed={active}
                          className={`rounded-chip border px-3 py-2 text-sm text-left transition-colors ${
                            active
                              ? 'border-petrol-400 bg-petrol-500/15 text-petrol-100'
                              : 'border-titanium-800 bg-obsidian-950 text-titanium-300 hover:border-titanium-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              {/* Multi-Mandant-Toggle */}
              <label className="flex items-start gap-3 rounded-card border border-titanium-800 bg-obsidian-900 p-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiTenant}
                  onChange={(e) => setMultiTenant(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-petrol-400"
                />
                <span>
                  <span className="block font-display font-semibold text-titanium-50 text-[15px]">
                    Wir betreuen mehrere Mandanten / Kundenorganisationen
                  </span>
                  <span className="block text-sm text-titanium-400 mt-0.5">
                    Multi-Mandant, White-Label und eigene Governance-Policies → Enterprise.
                  </span>
                </span>
              </label>
            </div>

            {/* Ergebnis (sticky) */}
            <aside className="lg:col-span-1">
              <div className="lg:sticky lg:top-20 space-y-4">
                {/* Score */}
                <div className="rounded-panel border border-titanium-800 bg-obsidian-900 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">
                      Governance Complexity Score
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-chip border border-petrol-500/40 bg-petrol-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-petrol-300">
                      {level.label}
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="font-display font-bold text-5xl tabular text-titanium-50">{result.score}</span>
                    <span className="font-mono text-titanium-600 text-sm mb-1.5">/ 100</span>
                  </div>
                  {/* Score-Balken */}
                  <div className="mt-4 h-2 w-full rounded-chip bg-obsidian-950 border border-titanium-800 overflow-hidden">
                    <div
                      className="h-full bg-petrol-400 transition-all duration-300"
                      style={{ width: `${result.score}%` }}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-ai-cyan-400" /> Coverage {result.coverage}%
                    </span>
                    <span>{answeredCount}/{GCS_DIMENSIONS.length} beantwortet</span>
                  </div>
                </div>

                {/* Risiken */}
                <div className="rounded-card border border-titanium-800 bg-obsidian-900 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500 mb-3 inline-flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--color-risk-medium)]" /> Komplexitätstreiber
                  </p>
                  {result.risks.length === 0 ? (
                    <p className="text-sm text-titanium-500">
                      Noch keine erhöhten Treiber erkannt — beantworten Sie die Fragen für eine genaue Einschätzung.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {result.risks.map((r) => (
                        <li key={r.dimension} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--color-risk-medium)] shrink-0" />
                          <span>
                            <span className="text-titanium-200">{r.label}: </span>
                            <span className="text-titanium-400">{r.note}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Empfohlenes Paket */}
                <div className="rounded-panel border border-petrol-500/30 bg-obsidian-900 p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-petrol-300 mb-2">
                    Empfohlenes Paket
                  </p>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h2 className="font-display font-bold text-2xl text-titanium-50">{result.recommended.name}</h2>
                    {tier && (
                      <span className="font-display font-semibold text-titanium-100">
                        {tier.priceEur > 0 ? `${tier.priceString} €` : tier.priceString}
                        {tier.priceEur > 0 && <span className="text-titanium-600 text-xs font-mono"> {tier.priceSuffix}</span>}
                      </span>
                    )}
                  </div>
                  {tier && (
                    <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-3">
                      Buchbar als Tarif {tier.name}
                    </p>
                  )}
                  <p className="text-sm text-titanium-400 leading-relaxed mb-4">{result.recommended.coverage}</p>
                  <ul className="space-y-1.5 mb-5">
                    {result.recommended.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm text-titanium-300">
                        <ShieldCheck className="h-3.5 w-3.5 text-petrol-300 shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={recommendedHref}
                    className="flex items-center justify-center gap-2 rounded-chip bg-petrol-400 text-obsidian-950 px-5 py-3 text-sm font-semibold hover:bg-petrol-300 transition-colors"
                  >
                    {result.recommended.id === 'enterprise' ? CTA.enterprise : CTA.startTrial}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/pricing"
                    className="mt-2 flex items-center justify-center gap-2 rounded-chip border border-titanium-700 text-titanium-200 px-5 py-2.5 text-sm font-medium hover:border-titanium-500 transition-colors"
                  >
                    Alle Pakete vergleichen
                  </Link>
                </div>

                <p className="text-[11px] text-titanium-600 leading-relaxed px-1">
                  Die Empfehlung ist eine Orientierung auf Basis Ihrer Angaben und ersetzt keine
                  Rechtsberatung. Governance läuft als kontinuierlicher Prozess, nicht als Einmal-Audit.
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* Querverweis */}
        <section className="border-t border-titanium-900 px-4 sm:px-6 py-12">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-wider text-titanium-500">
            <Link to="/digitale-souveraenitaet" className="hover:text-petrol-300 inline-flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" /> Digitale Souveränität</Link>
            <Link to="/ai-act" className="hover:text-petrol-300 inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> AI-Act-Governance</Link>
            <Link to="/pricing" className="hover:text-petrol-300 inline-flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> Pakete</Link>
          </div>
        </section>
      </main>
    </>
  );
}
