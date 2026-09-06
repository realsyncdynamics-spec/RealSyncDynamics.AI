import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Lightbulb, ShieldCheck } from 'lucide-react';
import { PLANS, ADDONS, planById, addonsFor, type AddOn } from '@/shared/pricing';

/**
 * Enterprise-Konfigurator — individueller Preis ohne Vertriebsgespräch.
 *
 * ## Warum diese Seite existiert
 *
 * Enterprise ist `purchaseMode: 'inquiry'`. Bisher endete der Weg dorthin in
 * einem Formular oder einem `mailto:` — der Interessent erfuhr seinen Preis
 * erst durch einen Menschen. Das widerspricht der Positionierung
 * („Tools statt Beratung", `runtimeVocab.ts`). Der Konfigurator rechnet den
 * Preis aus den Antworten des Fragenkatalogs sofort aus.
 *
 * ## Woher die Zahlen kommen
 *
 * Ausschliesslich aus `shared/pricing.ts` — kein Betrag ist hier erfunden:
 *
 * - Grundpreis: `planById('enterprise').price.monthlyEur`
 * - Bausteine: `addonsFor('enterprise')`, also genau die Add-ons, die die
 *   SSoT für Enterprise freigibt, mit ihren dortigen Beträgen
 *
 * Ändert sich ein Preis in der SSoT, ändert sich diese Seite mit. Das ist der
 * Grund, warum hier nichts hart codiert steht.
 *
 * ## Was bewusst NICHT bepreist wird
 *
 * Mengen jenseits der Enterprise-Kontingente (Domains, Mandanten) tragen
 * keinen Betrag. Für Vertragspläne ist laut `CLAUDE.md` §7 der Vertrag die
 * kanonische Quelle, nicht die Preisseite — eine Zahl zu behaupten, die
 * nirgends hinterlegt ist, wäre eine Erfindung. Solche Angaben gehen als
 * Vertragspunkte in die Anfrage ein und sind als solche ausgewiesen.
 */

/** Eine Frage des Katalogs. Jede Antwort hängt an einem realen Add-on. */
interface Question {
  addonId: string;
  question: string;
  /** Was der Baustein für den Kunden bedeutet — nicht was er technisch ist. */
  hint: string;
  /** Mengen-Baustein (mehrfach buchbar) statt Ja/Nein. */
  unit?: { label: string; step: string; max: number };
}

const QUESTIONS: Question[] = [
  {
    addonId: 'agency_bot_pack',
    question: 'Brauchen Sie mehr Governance-Bots als die 20 aus Enterprise?',
    hint: 'Jeder Baustein bringt fünf weitere produktive Bots.',
    unit: { label: 'Bausteine', step: '+5 Bots', max: 10 },
  },
  {
    addonId: 'response_pack',
    question: 'Brauchen Sie mehr als 50.000 Bot-Antworten pro Monat?',
    hint: 'Jeder Baustein bringt 5.000 weitere Antworten pro Monat.',
    unit: { label: 'Bausteine', step: '+5.000 Antworten', max: 20 },
  },
  {
    addonId: 'voice',
    question: 'Soll ein Sprachkanal über Telefonie dazukommen?',
    hint: 'Ein- und ausgehende Anrufe mit IVR, mehrsprachig.',
  },
  {
    addonId: 'compliance_pack',
    question: 'Brauchen Sie den erweiterten Prüfpfad mit Human-Review?',
    hint: 'AI-Act-Risiko-Tagging je Inferenz, Quartalsbericht als PDF.',
  },
];

/** Vertragspunkte: gehen in die Anfrage ein, tragen aber bewusst keinen Preis. */
const CONTRACT_ITEMS = [
  { id: 'domains', label: 'Mehr als 25 Domains' },
  { id: 'onprem', label: 'On-Premise- oder eigener EU-VPS-Betrieb' },
  { id: 'sso', label: 'SSO / SCIM gegen Ihr Verzeichnis' },
  { id: 'sla', label: 'SLA mit garantierter Reaktionszeit' },
];

function formatEur(value: number): string {
  return value.toLocaleString('de-DE');
}

export default function EnterpriseKonfigurator() {
  const enterprise = planById('enterprise');
  const basePrice = enterprise.price.monthlyEur;

  // Nur Bausteine, die die SSoT für Enterprise freigibt.
  const availableAddons = useMemo<AddOn[]>(() => addonsFor('enterprise'), []);
  // Bewusst `string` als Schlüssel: Die Mengen-Zustände kommen aus
  // `Object.entries` und sind dort immer `string`, nicht `AddOnId`.
  const addonById = useMemo(
    () => new Map<string, AddOn>(ADDONS.map((a) => [a.id, a])),
    [],
  );

  const questions = useMemo(
    () => QUESTIONS.filter((q) => availableAddons.some((a) => a.id === q.addonId)),
    [availableAddons],
  );

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [contractItems, setContractItems] = useState<Record<string, boolean>>({});
  const [suggestion, setSuggestion] = useState('');
  const [suggestionSent, setSuggestionSent] = useState(false);

  const addonTotal = useMemo(
    () =>
      Object.entries(quantities).reduce((sum, [id, qty]) => {
        const addon = addonById.get(id);
        return addon ? sum + addon.priceEur * qty : sum;
      }, 0),
    [quantities, addonById],
  );

  const monthlyTotal = basePrice + addonTotal;

  const chosenContractItems = CONTRACT_ITEMS.filter((c) => contractItems[c.id]);

  // Die Konfiguration reist als Klartext in die Anfrage — das Formular liest
  // `intent`, deshalb geht die Zusammenfassung dort hinein.
  const requestHref = useMemo(() => {
    const parts = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => `${addonById.get(id)?.name ?? id}×${qty}`);
    const summary = [
      `Enterprise ${formatEur(monthlyTotal)} EUR/Monat`,
      ...parts,
      ...chosenContractItems.map((c) => c.label),
    ].join(', ');
    const params = new URLSearchParams({
      tier: 'enterprise',
      source: 'enterprise-konfigurator',
      intent: summary.slice(0, 100),
    });
    return `/contact-sales?${params.toString()}`;
  }, [quantities, chosenContractItems, monthlyTotal, addonById]);

  const suggestionHref = useMemo(() => {
    const params = new URLSearchParams({
      source: 'enterprise-konfigurator',
      intent: suggestion.trim().slice(0, 100) || 'Verbesserungsvorschlag',
    });
    return `/contact-sales?${params.toString()}`;
  }, [suggestion]);

  const setQuantity = (id: string, value: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, value) }));
  };

  return (
    <div className="min-h-screen bg-obsidian text-titanium">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">

        <header className="mb-12">
          <Link to="/pricing" className="text-sm text-titanium/50 hover:text-titanium transition">
            ← Alle Tarife
          </Link>
          <h1
            className="text-4xl sm:text-5xl font-bold mt-4 mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Enterprise — Ihr Preis, sofort
          </h1>
          <p className="text-lg text-titanium/70 max-w-2xl">
            Beantworten Sie vier Fragen und Sie sehen Ihren monatlichen Preis. Ohne
            Termin, ohne Rückruf, ohne Wartezeit.
          </p>
        </header>

        <div className="glass-petrol rounded-lg p-5 mb-10 flex gap-3">
          <ShieldCheck className="h-5 w-5 text-petrol shrink-0 mt-0.5" />
          <p className="text-sm text-titanium/80">
            Enterprise enthält <strong className="text-titanium">alle Funktionen des
            Agency-Tarifs</strong> und darüber hinaus White-Label bis auf Dashboard-Ebene,
            Multi-Tenant-Verwaltung und den vollständigen Prüfpfad. Die folgenden
            Bausteine kommen obendrauf.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">

          {/* Fragenkatalog */}
          <div className="lg:col-span-2 space-y-4">
            {questions.map((q) => {
              const addon = addonById.get(q.addonId);
              if (!addon) return null;
              const qty = quantities[q.addonId] ?? 0;
              const active = qty > 0;

              return (
                <div
                  key={q.addonId}
                  className={`bg-slate-900/80 backdrop-blur p-5 rounded-lg border transition ${
                    active ? 'border-security-blue/50' : 'border-titanium/20 hover:border-titanium/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="font-bold text-titanium mb-1">{q.question}</h2>
                      <p className="text-sm text-titanium/60">{q.hint}</p>
                      <p className="text-xs font-mono uppercase tracking-wider text-titanium/40 mt-2">
                        {formatEur(addon.priceEur)} € {addon.priceNote}
                      </p>
                    </div>

                    {q.unit ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          aria-label={`${addon.name}: ${q.unit.label} verringern`}
                          onClick={() => setQuantity(q.addonId, qty - 1)}
                          disabled={qty === 0}
                          className="w-9 h-9 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition text-lg leading-none"
                        >
                          −
                        </button>
                        <span className="w-10 text-center font-mono text-titanium">{qty}</span>
                        <button
                          type="button"
                          aria-label={`${addon.name}: ${q.unit.label} erhöhen`}
                          onClick={() => setQuantity(q.addonId, Math.min(q.unit!.max, qty + 1))}
                          disabled={qty >= q.unit.max}
                          className="w-9 h-9 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition text-lg leading-none"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setQuantity(q.addonId, active ? 0 : 1)}
                        className={`shrink-0 px-4 py-2 rounded text-sm font-bold transition ${
                          active
                            ? 'bg-gradient-to-r from-security-blue to-petrol text-obsidian'
                            : 'bg-slate-800 hover:bg-slate-700 text-titanium'
                        }`}
                      >
                        {active ? 'Ausgewählt' : 'Hinzufügen'}
                      </button>
                    )}
                  </div>

                  {q.unit && qty > 0 && (
                    <p className="text-xs text-titanium/50 mt-3">
                      {qty} × {q.unit.step}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Vertragspunkte — bewusst ohne Betrag */}
            <div className="bg-slate-900/80 backdrop-blur p-5 rounded-lg border border-titanium/20">
              <h2 className="font-bold text-titanium mb-1">Was gehört noch in Ihren Vertrag?</h2>
              <p className="text-sm text-titanium/60 mb-4">
                Diese Punkte legen wir im Vertrag fest — sie tragen deshalb hier keinen
                Betrag. Wir behaupten keine Zahl, die noch nicht vereinbart ist.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {CONTRACT_ITEMS.map((item) => {
                  const checked = Boolean(contractItems[item.id]);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={checked}
                      onClick={() =>
                        setContractItems((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className={`flex items-center gap-2 text-left text-sm px-3 py-2 rounded border transition ${
                        checked
                          ? 'border-petrol/60 bg-petrol/10 text-titanium'
                          : 'border-titanium/15 hover:border-titanium/35 text-titanium/70'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                          checked ? 'bg-petrol border-petrol' : 'border-titanium/30'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-obsidian" />}
                      </span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Ergebnis */}
          <aside className="lg:col-span-1">
            <div className="bg-slate-900/80 backdrop-blur p-6 rounded-lg border border-security-blue/30 lg:sticky lg:top-8">
              <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-2">
                Ihr Preis
              </p>
              <p
                className="text-4xl font-bold bg-gradient-to-r from-petrol to-security-blue bg-clip-text text-transparent mb-1"
                data-testid="enterprise-total"
              >
                {formatEur(monthlyTotal)} €
              </p>
              <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-5">
                pro Monat
              </p>

              <dl className="space-y-2 text-sm border-t border-titanium/15 pt-4 mb-5">
                <div className="flex justify-between gap-3">
                  <dt className="text-titanium/60">Enterprise-Grundpreis</dt>
                  <dd className="font-mono text-titanium shrink-0">{formatEur(basePrice)} €</dd>
                </div>
                {Object.entries(quantities)
                  .filter(([, qty]) => qty > 0)
                  .map(([id, qty]) => {
                    const addon = addonById.get(id);
                    if (!addon) return null;
                    return (
                      <div key={id} className="flex justify-between gap-3">
                        <dt className="text-titanium/60">
                          {addon.name}
                          {qty > 1 && ` × ${qty}`}
                        </dt>
                        <dd className="font-mono text-titanium shrink-0">
                          {formatEur(addon.priceEur * qty)} €
                        </dd>
                      </div>
                    );
                  })}
                {chosenContractItems.map((c) => (
                  <div key={c.id} className="flex justify-between gap-3">
                    <dt className="text-titanium/60">{c.label}</dt>
                    <dd className="font-mono text-titanium/50 shrink-0 text-xs">nach Vertrag</dd>
                  </div>
                ))}
              </dl>

              <Link
                to={requestHref}
                className="block text-center w-full bg-gradient-to-r from-security-blue to-petrol hover:from-blue-600 hover:to-teal-700 text-obsidian font-bold py-3 rounded transition"
              >
                Enterprise anfragen
              </Link>
              <p className="text-xs text-titanium/40 mt-3">
                Ihre Auswahl reist mit — Sie müssen sie nicht noch einmal erklären.
              </p>
            </div>
          </aside>
        </div>

        {/* Anfrage & Verbesserungsvorschlag */}
        <section className="mt-12 bg-slate-900/80 backdrop-blur p-6 rounded-lg border border-titanium/20">
          <div className="flex items-start gap-3 mb-4">
            <Lightbulb className="h-5 w-5 text-petrol shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-titanium">
                Fehlt Ihnen etwas? Sagen Sie es uns.
              </h2>
              <p className="text-sm text-titanium/60">
                Individuelle Anforderung oder Verbesserungsvorschlag — beides landet
                direkt bei uns, ohne Umweg.
              </p>
            </div>
          </div>

          <textarea
            value={suggestion}
            onChange={(e) => {
              setSuggestion(e.target.value);
              setSuggestionSent(false);
            }}
            rows={3}
            maxLength={500}
            placeholder="Was brauchen Sie, das es hier noch nicht gibt?"
            aria-label="Individuelle Anfrage oder Verbesserungsvorschlag"
            className="w-full bg-obsidian/60 border border-titanium/20 focus:border-security-blue/60 rounded p-3 text-sm text-titanium placeholder:text-titanium/30 outline-none transition mb-3"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={suggestionHref}
              onClick={() => setSuggestionSent(true)}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-titanium font-bold py-2.5 px-5 rounded text-sm transition"
            >
              Anfrage &amp; Vorschlag senden
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-xs text-titanium/40">
              {suggestionSent
                ? 'Wird im Formular vorausgefüllt.'
                : `${suggestion.length}/500 Zeichen`}
            </span>
          </div>
        </section>

        <p className="text-xs text-titanium/40 mt-8">
          Alle Beträge netto zzgl. USt. Grundpreis und Bausteine stammen aus dem
          Produktkatalog ({PLANS.length} Produkte); Änderungen dort wirken hier
          unmittelbar.
        </p>
      </div>
    </div>
  );
}
