import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Info, ShieldCheck } from 'lucide-react';
import {
  ALL_MODULES,
  checkoutHrefForPlan,
  formatLimit,
  formatPriceEur,
  moduleAvailabilityLabel,
  type AddOnId,
  type PlanId,
} from '@/shared/pricing';
import { BETA, BETA_PUBLIC_OFFER, betaSignupHref, isBetaPlan } from '../config/beta';
import { PRICING_TAX_NOTE_STANDARD } from '../config/pricing';
import { COMPANY } from '../config/company';
import { SEOHead } from '../components/SEOHead';
import { HandoffTopBar } from '../components/handoff/HandoffTopBar';
import {
  CONFIGURABLE_PLANS,
  estimateMonthlyQuote,
  fitsTenantCapacity,
  offeredAddonsForPlan,
  yearlySelectable,
} from '../features/billing/planConfiguratorModel';

/**
 * Öffentlicher Plan-Konfigurator — bewusst ein Read-only-Preisrechner:
 * keine lokalen Stripe-Price-IDs, kein clientseitiger Kauf von Add-ons,
 * kein verfrühtes Jahresabo und kein Versprechen mehrerer Tenant-Slots.
 * Aktivierung erfolgt ausschließlich über die vorhandenen Checkout-/Beta-
 * Routen; spätere Add-on-Buchung über die serverseitige Marketplace-Funktion.
 */
export default function PlanKonfigurator() {
  const [params] = useSearchParams();
  const initialPlan = CONFIGURABLE_PLANS.find((p) => p.id === params.get('plan')) ?? CONFIGURABLE_PLANS[0];
  const [planId, setPlanId] = useState<PlanId>(initialPlan.id);
  const [selectedAddons, setSelectedAddons] = useState<AddOnId[]>([]);
  const [requiredTenants, setRequiredTenants] = useState(1);

  const plan = CONFIGURABLE_PLANS.find((p) => p.id === planId) ?? CONFIGURABLE_PLANS[0];
  const addons = useMemo(() => offeredAddonsForPlan(plan), [plan]);
  const quote = useMemo(() => estimateMonthlyQuote(plan, selectedAddons), [plan, selectedAddons]);
  const capacityFits = fitsTenantCapacity(plan, requiredTenants);
  const beta = BETA_PUBLIC_OFFER && isBetaPlan(plan.id);
  const yearlyAvailable = yearlySelectable(plan);
  const activationHref = beta
    ? betaSignupHref(plan.id, 'plan-konfigurator')
    : checkoutHrefForPlan(plan, { source: 'plan-konfigurator' });

  const selectPlan = (id: PlanId) => {
    setPlanId(id);
    // Kein Auslaufen einer Add-on-Auswahl in einen nicht berechtigten Plan.
    setSelectedAddons([]);
  };

  const toggleAddon = (id: AddOnId) => {
    setSelectedAddons((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  return (
    <>
      <SEOHead />
      <div className="min-h-screen bg-obsidian text-titanium-50">
        <HandoffTopBar active="navPricing" />
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
          <div className="mb-10">
            <Link to="/pricing" className="text-sm text-titanium-400 hover:text-titanium-100">
              ← Alle Tarife
            </Link>
            <p className="mt-7 font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
              RealSyncDynamics.AI / Tarife
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
              Konfigurieren Sie Ihren Plan.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-titanium-400">
              Wählen Sie die passende Governance-Runtime, prüfen Sie den Umfang und
              stellen Sie optionale Module zusammen. Alle Beträge stammen aus dem
              bestehenden Produktkatalog.
            </p>
          </div>

          {BETA_PUBLIC_OFFER && (
            <div role="status" className="mb-7 border-l-2 border-amber-400 bg-amber-400/10 px-4 py-4 text-sm text-titanium-200">
              <strong className="text-amber-300">Offene Beta bis {BETA.endsLabel}.</strong>
              {' '}Für die berechtigten Pläne fallen in dieser Zeit keine Gebühren an.
              Keine Kreditkarte, kein Abo und keine automatische Umwandlung in ein kostenpflichtiges Abo.
              Die untenstehenden Listenpreise sind nur eine Orientierung für die Zeit nach der Beta.
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-10">
              <section aria-labelledby="plan-step">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                  <h2 id="plan-step" className="text-xl font-semibold">01 / Tarif wählen</h2>
                  <div className="flex border border-titanium-700 text-sm" aria-label="Abrechnungszeitraum">
                    <span className="bg-titanium-100 px-4 py-2 font-semibold text-obsidian">Monatlich</span>
                    <span
                      title={yearlyAvailable ? 'Für diesen Tarif vorhanden, hier derzeit nicht buchbar' : 'Jahres-Checkout noch nicht eingerichtet'}
                      className="cursor-not-allowed px-4 py-2 text-titanium-500"
                      aria-disabled="true"
                    >
                      Jährlich · demnächst
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CONFIGURABLE_PLANS.map((candidate) => {
                    const selected = candidate.id === plan.id;
                    return (
                      <label
                        key={candidate.id}
                        className={[
                          'block cursor-pointer border p-5 transition-colors',
                          selected
                            ? 'border-sky-400 bg-sky-400/10'
                            : 'border-titanium-800 bg-obsidian-900 hover:border-titanium-500',
                        ].join(' ')}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="selected-plan"
                            checked={selected}
                            onChange={() => selectPlan(candidate.id)}
                            className="accent-sky-400"
                            data-testid={'config-plan-' + candidate.id}
                          />
                          <span className="text-lg font-semibold">{candidate.name}</span>
                        </div>
                        <p className="mt-3 font-mono text-xl text-titanium-100">
                          {BETA_PUBLIC_OFFER && isBetaPlan(candidate.id) ? formatPriceEur(0) : formatPriceEur(candidate.price.monthlyEur)}
                          <span className="ml-1 text-xs text-titanium-400">/ Monat</span>
                        </p>
                        {BETA_PUBLIC_OFFER && isBetaPlan(candidate.id) && (
                          <p className="mt-1 text-xs text-titanium-400">
                            Beta, danach Listenpreis {formatPriceEur(candidate.price.monthlyEur)}/Monat
                          </p>
                        )}
                        <p className="mt-3 text-sm leading-6 text-titanium-400">{candidate.outcomeHeadline}</p>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="scope-step">
                <h2 id="scope-step" className="mb-5 text-xl font-semibold">02 / Leistungsumfang prüfen</h2>
                <div className="border border-titanium-800 bg-obsidian-900 p-5">
                  <label htmlFor="required-tenants" className="block text-sm font-medium text-titanium-200">
                    Wie viele getrennte Organisationen/Mandanten möchten Sie verwalten?
                  </label>
                  <p className="mb-3 mt-1 text-xs text-titanium-500">
                    Dies ist eine Bedarfsprüfung, kein bestellbarer Kundenslot und kein Preisaufschlag.
                  </p>
                  <input
                    id="required-tenants"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    value={requiredTenants}
                    onChange={(e) => setRequiredTenants(Number(e.target.value))}
                    className="w-32 border border-titanium-600 bg-obsidian px-3 py-2 font-mono text-titanium-50"
                  />
                  <p
                    role="status"
                    className={'mt-3 text-sm ' + (capacityFits ? 'text-emerald-300' : 'text-amber-300')}
                    data-testid="config-capacity"
                  >
                    {capacityFits
                      ? 'Ihr Bedarf liegt innerhalb des angegebenen Mandantenkontingents.'
                      : 'Der gewählte Plan deckt diese Anzahl getrennten Mandanten nicht ab. Bitte höheren Umfang wählen.'}
                  </p>
                  <div className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {[
                      ['Mandanten', plan.limits.tenants],
                      ['Domains', plan.limits.domains],
                      ['KI-Bots', plan.limits.bots],
                      ['Antworten / Monat', plan.limits.answersPerMonth],
                      ['Automationsläufe / Monat', plan.limits.automationRunsPerMonth],
                      ['Evidence-Speicher (GB)', plan.limits.evidenceStorageGb],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3 border-b border-titanium-800 pb-2 text-sm">
                        <span className="text-titanium-400">{label}</span>
                        <span className="font-mono text-titanium-100">{formatLimit(Number(value))}</span>
                      </div>
                    ))}
                  </div>
                  <details className="mt-6 text-sm">
                    <summary className="cursor-pointer font-semibold text-sky-300">Module und Status ansehen</summary>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {plan.modules.map((id) => {
                        const module = ALL_MODULES.find((m) => m.id === id);
                        if (!module) return null;
                        return (
                          <li key={id} className="flex gap-2 text-titanium-300">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden />
                            {module.name} {moduleAvailabilityLabel(module.availability)}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-3 text-xs text-titanium-500">
                      Preview und Roadmap sind keine Zusage produktiver Verfügbarkeit.
                    </p>
                  </details>
                </div>
              </section>

              <section aria-labelledby="addons-step">
                <h2 id="addons-step" className="mb-2 text-xl font-semibold">03 / Optionale Add-ons</h2>
                <p className="mb-5 text-sm text-titanium-400">
                  Preisvorschau ohne Bestellung. Buchbar sind Add-ons erst für einen
                  berechtigten Mandanten mit wirksamem Abo im Bereich „Mein Plan“,
                  sofern ein gültiger Stripe-Preis hinterlegt ist.
                </p>
                {addons.length === 0 ? (
                  <div className="border border-titanium-800 bg-obsidian-900 p-5 text-sm text-titanium-400">
                    Für diesen Tarif werden aktuell keine separaten Add-ons für Neukunden angeboten.
                    Der enthaltene Funktionsumfang bleibt bestehen.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addons.map((addon) => (
                      <div key={addon.id} className="border border-titanium-800 bg-obsidian-900 p-5">
                        <label className="flex cursor-pointer items-start gap-4">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-sky-400"
                            checked={selectedAddons.includes(addon.id)}
                            onChange={() => toggleAddon(addon.id)}
                            data-testid={'config-addon-' + addon.id}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{addon.name}</span>
                            <span className="mt-1 block text-sm leading-6 text-titanium-400">{addon.description}</span>
                          </span>
                          <span className="shrink-0 text-right font-mono text-sm text-titanium-100">
                            + {formatPriceEur(addon.priceEur)}
                            <span className="block text-xs text-titanium-500">/ Monat</span>
                          </span>
                        </label>
                        <details className="ml-8 mt-3 text-xs text-titanium-400">
                          <summary className="cursor-pointer text-sky-300">Leistungen &amp; Preisdetails</summary>
                          <ul className="mt-2 list-inside list-disc space-y-1">
                            {addon.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                          </ul>
                          <p className="mt-2">{addon.priceNote}</p>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Ihre Konfiguration">
              <div className="border border-sky-500/60 bg-obsidian-900 p-6">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-sky-400">Ihre Konfiguration</p>
                <h2 className="mt-3 text-2xl font-bold">{plan.name}</h2>
                <div className="mt-6 space-y-3 border-b border-titanium-700 pb-5 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-titanium-400">Tarif / Monat</span><span>{formatPriceEur(quote.baseMonthlyEur)}</span></div>
                  {quote.addons.map((addon) => (
                    <div key={addon.id} className="flex justify-between gap-3">
                      <span className="text-titanium-400">{addon.name}</span>
                      <span>{formatPriceEur(addon.priceEur)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3"><span className="text-titanium-400">Add-ons gesamt</span><span>{formatPriceEur(quote.addonsMonthlyEur)}</span></div>
                </div>
                <p className="mt-5 text-xs text-titanium-400">
                  Unverbindliches Listenpreis-Szenario pro Monat
                </p>
                <p className="mt-1 font-mono text-3xl font-bold" data-testid="config-total">
                  {formatPriceEur(quote.totalMonthlyEur)}
                </p>
                {beta && (
                  <p className="mt-2 text-sm text-emerald-300">
                    Aktueller Beta-Tarif: 0 € bis {BETA.endsLabel}; keine automatische kostenpflichtige Verlängerung.
                  </p>
                )}
                {!capacityFits && (
                  <p className="mt-4 flex gap-2 text-sm text-amber-300">
                    <Info className="h-4 w-4 shrink-0" aria-hidden />
                    Gewählte Mandantenzahl überschreitet das Kontingent.
                  </p>
                )}
                <Link
                  to={capacityFits ? activationHref : '/enterprise-konfigurator'}
                  className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 bg-sky-500 px-4 py-3 text-center text-sm font-semibold text-obsidian hover:bg-sky-400"
                  data-testid="config-next"
                >
                  {capacityFits ? (beta ? 'Kostenlosen Beta-Zugang starten' : 'Tarif auswählen') : 'Individuellen Umfang prüfen'}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                {quote.addons.length > 0 && (
                  <p className="mt-3 text-xs leading-5 text-amber-200">
                    Die Add-ons werden durch diesen Schritt nicht gebucht oder reserviert.
                    Aktivierung und verbindlicher Preis werden später im Dashboard geprüft.
                  </p>
                )}
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-titanium-500">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Der verbindliche Preis und die Berechtigungen werden ausschließlich serverseitig ermittelt.
                </p>
              </div>
              <p className="mt-4 text-xs leading-5 text-titanium-500">
                {COMPANY.taxMode === 'EXEMPT' ? 'Steuerhinweis entsprechend Ihrer Buchungsunterlagen.' : PRICING_TAX_NOTE_STANDARD}
                {' '}Telefonie kann zusätzliche nutzungsabhängige Gebühren auslösen.
              </p>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}
