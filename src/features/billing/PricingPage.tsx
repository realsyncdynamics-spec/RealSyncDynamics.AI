import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resolveAuditContext, withAuditContext } from '../../core/onboarding/funnelContext';
import { Check, Sparkles, Award } from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import '../../styles/governance-os-handoff.css';
import { HandoffTopBar } from '../../components/handoff/HandoffTopBar';
import { useLang } from '../../i18n/useLang';
import { COMPANY } from '../../config/company';
import {
  SELLABLE_PRICING_TIERS, PRICING_TRUST_NOTE, PRICING_TAX_NOTE, CALCULABLE_PRICING_TIERS,
  formatPriceEur, tierById, planById, PLANS,
  type PricingTier,
} from '../../config/pricing';

// COMMERCIAL-SSOT: temporary production hotfix.
// Canonical source migration tracked in Phase 2.
// Die Trial-Fussnote wird aus der SSoT abgeleitet statt als Liste gepflegt —
// ein Plan, dessen `trialDays` auf 0 geht, verschwindet damit automatisch aus
// dem Versprechen. Frueher stand hier „Starter, Growth, Agency und Enterprise",
// obwohl Enterprise manuell fakturiert wird und keinen Self-Service-Trial hat.
const TRIAL_PLAN_NAMES: string[] = PLANS
  .filter((p) => p.purchaseMode === 'checkout' && p.trialDays > 0)
  .map((p) => p.name);
const TRIAL_DAYS: number = PLANS.find((p) => p.trialDays > 0)?.trialDays ?? 14;
const TRIAL_PLAN_LIST: string = TRIAL_PLAN_NAMES.length > 1
  ? `${TRIAL_PLAN_NAMES.slice(0, -1).join(', ')} und ${TRIAL_PLAN_NAMES.at(-1)}`
  : (TRIAL_PLAN_NAMES[0] ?? '');
import { PricingRoiExampleSection } from '../../components/sections/PricingRoiExampleSection';
import { GovernanceBotsSection } from '../../components/pricing/GovernanceBotsSection';
import { CostCalculator } from '../../components/pricing/CostCalculator';
import { RuntimePipeline } from '../../components/pricing/RuntimePipeline';
import { DeveloperSection } from '../../components/pricing/DeveloperSection';
import { PlanComparisonMatrix } from '../../components/pricing/PlanFeatureGroups';
import { GovernanceModuleMatrix } from '../../components/pricing/GovernanceModuleMatrix';

/**
 * /pricing — öffentliche Preisseite der AI Governance Runtime.
 *
 * Sämtliche Plan-Daten (Preise, Limits, Module, Berechtigungen, Features)
 * stammen aus der SSoT `shared/pricing.ts`. Diese Datei enthält KEINE
 * eigenen Preise, Limits oder Feature-Listen — sie rendert nur.
 *
 * Kopf und Karten folgen dem Governance-OS-Handoff v2 (§ 4): fünf Karten
 * (Free Audit + die buchbaren Monats-Abos), Monatlich/Jährlich-Umschalter.
 * Die Jahresabrechnung ist nicht buchbar (`yearlyCheckoutUnavailable`,
 * Registry `pricing-yearly` = coming-soon): im Jahresmodus stehen die
 * Jahresbeträge aus `planById().price.yearlyEur` mit „Jährlich · Coming
 * Soon", die Buchung bleibt monatlich. Details je Plan (Limits, Module,
 * Feature-Gruppen) stehen in der Vergleichsmatrix und auf /pricing/<id>.
 */

type Billing = 'monthly' | 'yearly';

/**
 * Ersparnis der Jahresvariante in Prozent, aus der SSoT gerechnet (kleinster
 * Wert über alle Pläne mit Festpreis — „mindestens").
 */
const YEARLY_SAVING_PERCENT: number | null = (() => {
  const savings = CALCULABLE_PRICING_TIERS.flatMap((tier) => {
    const { yearlyEur: yearly, monthlyEur: monthly } = planById(tier.plan.id).price;
    return yearly && monthly ? [Math.round((1 - yearly / (12 * monthly)) * 100)] : [];
  });
  return savings.length ? Math.min(...savings) : null;
})();


export function PricingPage() {
  // Deep-Link von Startseite/Audit: ?plan=<id> hebt das gewählte Paket hervor
  // und scrollt es in den Blick — so bleibt der Weg zur Paket-Auswahl eindeutig.
  const [params] = useSearchParams();
  const selectedPlan = params.get('plan');
  const { t } = useLang();
  const [billing, setBilling] = useState<Billing>('monthly');
  useEffect(() => {
    if (!selectedPlan) return;
    const el = document.getElementById(`plan-${selectedPlan}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedPlan]);

  return (
    <>
      <SEOHead />
      <div className="rs-ui rs-page">
        <HandoffTopBar active="navPricing" />
        <section className="rs-pricing" aria-labelledby="pricing-heading">
          <div className="mx-auto max-w-[1400px]">
            <div className="rs-pricing__head">
              <div>
                <h1 id="pricing-heading" className="rs-pricing__title">{t('pricingTitle')}</h1>
                <p className="rs-pricing__sub">{t('pricingSub')}</p>
              </div>
              <BillingToggle billing={billing} onChange={setBilling} />
            </div>
            {billing === 'yearly' && (
              <p className="rs-pricing__yearly-note" role="status" data-testid="pricing-yearly-note">
                <span className="rs-pill rs-pill--cyan">{t('yearlyComingSoon')}</span>
                {t('yearlyNote')}
              </p>
            )}
            <div className="rs-pricing__grid">
              <FreeAuditCard />
              {SELLABLE_PRICING_TIERS.map((tier) => (
                <TierCard key={tier.id} tier={tier} billing={billing} selected={tier.id === selectedPlan} />
              ))}
            </div>
            <div className="rs-pricing__foot">
              <p>{PRICING_TRUST_NOTE}</p>
              <p>
                Free Audit kostenlos · kein Account nötig · {TRIAL_PLAN_LIST}:{' '}
                {TRIAL_DAYS} Tage kostenlos testen — keine Kosten bis Tag {TRIAL_DAYS + 1}, monatlich kündbar ·
                {' '}Enterprise: nach Anfrage, kein Self-Service-Trial
              </p>
              <p data-testid="pricing-tax-note">
                {COMPANY.taxMode === 'EXEMPT' ? t('pricingFoot') : `Alle Preise in EUR. ${PRICING_TAX_NOTE}`}
              </p>
            </div>
          </div>
        </section>
      </div>
      <div className="bg-hero-only flex flex-col text-titanium-50">
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Disclaimer */}
          <div className="mt-10 max-w-3xl mx-auto p-5 bg-obsidian-900/60 border border-silver-700/30 border-l-2 border-l-titanium-200 rounded-none">
            <div className="flex items-start gap-3">
              <Award className="h-4 w-4 text-titanium-100 mt-0.5 shrink-0" />
              <p className="text-sm text-silver-300 leading-relaxed">
                Unsere Outputs sind methodisch und technisch fundiert — aber kein Ersatz für individuelle Rechtsberatung.
                <strong className="text-titanium-200"> Wir versprechen kein "100 % rechtssicher"</strong>, weil das niemand seriös kann.
                Generierte Dokumente empfehlen wir anwaltlich prüfen zu lassen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Runtime-Architektur — dieselbe Kette wie auf der Landingpage */}
      <RuntimePipeline />

      {/* Vergleich nach den vier Feature-Gruppen */}
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-2">
              Leistungsumfang
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
              Vier Bereiche, sechs Pläne
            </h2>
            <p className="text-sm text-titanium-400 max-w-2xl leading-relaxed">
              Alle Leistungen sind in vier Bereiche gegliedert: Audit &amp; Evidence,
              AI Governance, Automation &amp; Ops sowie Multi Tenant &amp; Reseller.
            </p>
          </div>
          <PlanComparisonMatrix />
        </div>
      </section>

      {/* Cost Calculator — Interactive estimation tool */}
      <CostCalculator />

      {/* Beispielhafte Kostenrechnung — Procurement-Anker, klar als Beispiel
          gekennzeichnet, keine Einsparzusagen. */}
      <PricingRoiExampleSection />

      {/* Governance-Bots Section — Bot-Quotas + Add-ons */}
      <GovernanceBotsSection />

      {/* Differenzierer */}
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-900/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
              Kritische Differenzierer
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Was uns von anderen Tools unterscheidet
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-titanium-900">
            {[
              {
                title: 'Consent-Timing-Analyse',
                body: 'Wir messen exakt, welche Requests VOR dem ersten Nutzer-Klick feuern — mit echtem Playwright-Headless-Browser. Pre-Consent-Tracking ist die häufigste DSGVO-Schwachstelle und unser primärer Runtime-Detection-Anker.',
              },
              {
                title: 'Auto-Remediation (nicht nur Audit)',
                body: 'Nicht nur "hier ist das Problem". Sondern: hier ist der Fix-Code, den Sie einfügen können. Script-Blocking, Consent-Injection, Font-Self-Hosting — alles automatisiert.',
              },
              {
                title: 'Continuous Runtime-Monitoring (Coming Soon)',
                body: 'Dauerhafte Domain-Überwachung ist Roadmap (Registry: Coming Soon). Einmal-/Public-Scans laufen live; wiederkehrendes tägliches Drift-Monitoring und Alerts sind geplant — kein bereits laufender Dauerbetrieb.',
              },
              {
                title: 'Nachweisbarkeit (Audit-Trails)',
                body: 'PDFs, Logs, Zeitstempel, Evidence Vault. Wenn der Datenschutzbeauftragte oder die Aufsichtsbehörde fragt: Sie können beweisen, was wann geprüft wurde.',
              },
            ].map((d) => (
              <div key={d.title} className="bg-obsidian-950 p-6 sm:p-7">
                <h3 className="font-display font-bold text-titanium-50 text-base mb-2">{d.title}</h3>
                <p className="text-sm text-titanium-400 leading-relaxed">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Governance OS Browser — Module-Matrix */}
      <GovernanceModuleMatrix />

      {/* Developer Experience — API, SDKs, OpenAPI, Webhooks, CI/CD */}
      <DeveloperSection />

      {/* FAQ */}
      <section id="pricing-faq" className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">FAQ</div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Häufige Fragen zu den Preisen
            </h2>
          </div>
          <div className="space-y-3">
            {[
              {
                q: 'Brauche ich einen Account um zu starten?',
                a: 'Für Free Audit nicht — Sie geben nur die Domain ein und bekommen sofort den Risk-Score. Für alle kostenpflichtigen Tiers legen wir nach Buchung gemeinsam einen Account für Ihr Team an.',
              },
              {
                q: 'Was ist Consent-Timing-Analyse?',
                a: 'Unsere Playwright-Engine lädt Ihre Website im echten Headless-Browser und protokolliert jeden Netzwerk-Request mit präzisem Timestamp — vor und nach dem ersten Klick. So sehen wir, ob Google Analytics, Meta Pixel oder andere Tracker geladen werden, bevor der Nutzer eingewilligt hat. Pre-Consent-Tracking ist die häufigste Schwachstelle im DSGVO-Setup und der Anker, an dem unsere Runtime-Drift-Detection täglich aufsetzt.',
              },
              {
                q: 'Was ist "Auto-Remediation" genau?',
                a: 'Für erkannte Probleme liefern wir konkrete technische Fixes: Script-Tags mit type="text/plain" und data-consent-Attribut, Consent-Banner-Code-Snippets, Google-Fonts-Self-Hosting-Script, YouTube-NoCookie-Umstellung. Kein LLM-generiertes "schreib eine Datenschutzerklärung", sondern strukturierte Regel-Engine → Template-System.',
              },
              {
                q: 'Was unterscheidet Agency von Growth?',
                a: 'Agency richtet sich an Agenturen und Dienstleister: bis zu 10 Domains, White-Label-Berichte, Scheduler, Bulk Jobs und REST-API. Growth bleibt der Ein-Mandanten-Plan mit täglichem Monitoring und Risk Register. Agency startet self-service über Stripe Checkout (699 €/Monat). Multi-Org mit SSO und vertraglichem SLA läuft über Enterprise (/contact-sales).',
              },
              {
                q: 'Was bedeutet "Priority Support" im Agency-Paket?',
                a: 'Priority Support bedeutet: dedizierter Ansprechpartner per E-Mail mit garantierter Antwort innerhalb von 8 Stunden (Werktage). Für kritische Compliance-Fragen (aktiver Aufsichtsbehörden-Kontakt) eskalieren wir auf 4-Stunden-Response. Kontakt: support@realsyncdynamicsai.de mit Betreff [AGENCY].',
              },
              {
                q: 'Wie viele Kundenseiten kann ich im Agency-Paket verwalten?',
                a: '10 Kundenseiten (Domains) sind enthalten; weitere Domains können einzeln hinzugebucht werden. Jede Domain bekommt ihr eigenes Monitoring-Dashboard, White-Label-Report und API-Endpunkt.',
              },
              {
                q: 'Gibt es einen AVV (Auftragsverarbeitungsvertrag)?',
                a: 'Ja. Als Auftragsverarbeiter stellen wir Ihnen und Ihren Kunden einen EU-konformen AVV bereit. Er ist ab Buchung automatisch aktiv und kann unter /legal/avv eingesehen und heruntergeladen werden.',
              },
              {
                q: 'Wie kündige ich?',
                a: 'Monatlich, formlos per E-Mail an support@realsyncdynamicsai.de. Keine Mindestlaufzeit. Daten und Reports bleiben Ihnen 90 Tage exportierbar erhalten.',
              },
              {
                q: 'Was ist der Enterprise Evidence Vault?',
                a: 'Ein unveränderliches Archiv aller Scans, Findings, Fix-Bestätigungen und Dokumente — mit kryptografischen Zeitstempeln. Wenn Sie einer Aufsichtsbehörde nachweisen müssen, dass Sie zu einem bestimmten Datum compliant waren, liefert der Vault den Beweis.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group p-5 bg-obsidian-900/60 border border-silver-700/30 hover:border-titanium-200/60 rounded-none transition-colors"
              >
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                  <span className="font-display font-bold text-titanium-50 text-base leading-snug">{item.q}</span>
                  <span className="text-titanium-100 text-xl leading-none transition-transform group-open:rotate-45 select-none">+</span>
                </summary>
                <p className="text-sm text-silver-300 leading-relaxed mt-3">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-silver-700/40 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-wider text-silver-500">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-titanium-100" />
            <span>© 2026 RealSync Dynamics · Made in Germany</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/cookie-scanner" className="hover:text-titanium-50 text-titanium-100">Cookie-Scanner · Free</Link>
            <Link to="/ai-act-workflows" className="hover:text-titanium-50 text-titanium-100">AI-Act Inventar · Beta</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-50">Datenschutz</Link>
            <Link to="/impressum" className="hover:text-titanium-50">Impressum</Link>
            <Link to="/legal/terms" className="hover:text-titanium-50">AGB</Link>
            <Link to="/legal/widerruf" className="hover:text-titanium-50">Widerruf</Link>
            <Link to="/legal/avv" className="hover:text-titanium-50">AVV</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-50">Sub-Processors</Link>
            <Link to="/legal/methodology" className="hover:text-titanium-50">Methodik</Link>
            <Link to="/security" className="hover:text-titanium-50">Security</Link>
            <Link to="/status" className="hover:text-titanium-50">Status</Link>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}

function BillingToggle({ billing, onChange }: { billing: Billing; onChange: (b: Billing) => void }) {
  const { t } = useLang();
  return (
    <div className="rs-segment" role="group" aria-label={t('billingToggle')}>
      <button type="button" aria-pressed={billing === 'monthly'} onClick={() => onChange('monthly')}>
        {t('monthly')}
      </button>
      <button
        type="button"
        aria-pressed={billing === 'yearly'}
        onClick={() => onChange('yearly')}
        data-testid="pricing-billing-yearly"
      >
        {t('yearly')}
        {YEARLY_SAVING_PERCENT !== null && (
          <span className="rs-segment__save">−{YEARLY_SAVING_PERCENT} %</span>
        )}
      </button>
    </div>
  );
}

function FeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="rs-price-card__features">
      {items.map((item) => (
        <li key={item}>
          <Check size={14} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Kostenloser Einstieg — Preis, Label und Ziel aus der SSoT (`tierById('free')`). */
function FreeAuditCard() {
  const { t } = useLang();
  const free = tierById('free');
  if (!free) return null;
  return (
    <div className="rs-price-card" data-testid="pricing-free-audit" id="plan-free">
      <div className="rs-price-card__head">
        <h2 className="rs-price-card__name">{free.name}</h2>
      </div>
      <div className="rs-price-card__price">
        <span className="rs-price-card__amount">{formatPriceEur(free.priceEur)}</span>
        <span className="rs-price-card__suffix">{free.priceSuffix}</span>
      </div>
      <p className="rs-price-card__tagline">{free.tagline}</p>
      <FeatureList items={free.bullets.slice(0, 5)} />
      <div className="rs-price-card__cta">
        <Link to={free.cta.href} className="rs-btn rs-btn--outline rs-btn--h40" data-testid="pricing-book-free">
          {free.cta.label}
        </Link>
      </div>
    </div>
  );
}

function TierCard({ tier, billing, selected = false }: { tier: PricingTier; billing: Billing; selected?: boolean }) {
  const { t } = useLang();
  // Der Scan-Kontext reiste bis hierher (`?audit_id=` aus dem Bericht, oder
  // die Sitzung aus /onboarding) und ging genau an dieser Karte verloren:
  // `tier.cta.href` kommt aus der Config und kannte ihn nicht. Der Checkout
  // und der Claim nach der Anmeldung brauchen ihn aber. Ergänzen, nicht neu
  // zusammensetzen — `source` und `interval` bleiben erhalten.
  const [params] = useSearchParams();
  const auditContext = resolveAuditContext(params, params.get('audit') ?? undefined);
  const ctaHref = tier.cta.href.startsWith('http')
    ? tier.cta.href
    : withAuditContext(tier.cta.href, auditContext);
  // COMMERCIAL-SSOT: temporary production hotfix.
  // Canonical source migration tracked in Phase 2.
  // Plaene ohne oeffentlich zugesicherten Festpreis duerfen keinen Betrag
  // ausweisen — sonst steht dort ein Angebot, das der Checkout nicht erfuellt.
  const yearlyEur = planById(tier.plan.id).price.yearlyEur;
  // Jahresbetrag nur zeigen, wenn es ihn gibt; buchbar ist er nicht
  // (`yearlyCheckoutUnavailable`), die Karte sagt das ausdrücklich.
  const showYearly = billing === 'yearly' && !tier.priceOnRequest && yearlyEur !== null;
  const yearlyBookable = showYearly && tier.plan.yearlyCheckoutUnavailable !== true;
  const priceDisplay = tier.priceOnRequest
    ? t('onRequest')
    : formatPriceEur(showYearly && yearlyEur !== null ? yearlyEur : tier.priceEur);
  const suffix = tier.priceOnRequest ? tier.priceSuffix : showYearly ? t('perYear') : t('perMonth');
  const filled = tier.highlight || selected;
  const go = () => {
    if (ctaHref.startsWith('http')) window.open(ctaHref, '_blank', 'noopener');
    else window.location.href = ctaHref;
  };

  return (
    <div
      id={`plan-${tier.id}`}
      className={`rs-price-card${tier.highlight ? ' rs-price-card--popular' : ''}${selected ? ' rs-price-card--selected' : ''}`}
      data-testid={`pricing-card-${tier.id}`}
      data-billing={billing}
    >
      <div className="rs-price-card__head">
        <h2 className="rs-price-card__name">{tier.name}</h2>
        {selected ? (
          <span className="rs-pill rs-pill--cyan">{t('selected')} ✓</span>
        ) : tier.highlight ? (
          <span className="rs-pill rs-pill--primary">{t('popularBadge')}</span>
        ) : null}
      </div>

      <div className="rs-price-card__price">
        <span className={`rs-price-card__amount${tier.priceOnRequest ? ' rs-price-card__amount--text' : ''}`}>{priceDisplay}</span>
        <span className="rs-price-card__suffix">{suffix}</span>
      </div>
      {showYearly && !yearlyBookable && (
        <span className="rs-pill rs-pill--muted" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
          {t('yearlyComingSoon')}
        </span>
      )}

      <p className="rs-price-card__tagline">{tier.tagline}</p>
      <FeatureList items={tier.bullets.slice(0, 5)} />

      <div className="rs-price-card__cta">
        {showYearly && !yearlyBookable ? (
          <>
            <button type="button" className="rs-btn rs-btn--outline rs-btn--h40" disabled aria-disabled="true">
              {t('yearlyComingSoon')}
            </button>
            <button
              type="button"
              onClick={go}
              className="rs-price-card__more"
              data-testid={`pricing-book-${tier.id}`}
            >
              {t('bookMonthly')} →
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={go}
            className={`rs-btn ${filled ? 'rs-btn--solid' : 'rs-btn--outline'} rs-btn--h40`}
            data-testid={`pricing-book-${tier.id}`}
          >
            {tier.cta.label}
          </button>
        )}
        <Link to={`/pricing/${tier.id}`} className="rs-price-card__more" data-testid={`pricing-info-${tier.id}`}>
          {t('moreInfo')}
        </Link>
      </div>
    </div>
  );
}
