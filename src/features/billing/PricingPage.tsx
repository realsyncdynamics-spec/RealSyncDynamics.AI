import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Check, Sparkles, Award, Building2, Cookie, ShieldCheck, Zap, Globe, Briefcase, Rocket,
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import { SEOHead } from '../../components/SEOHead';
import {
  SELLABLE_PRICING_TIERS, PRICING_TRUST_NOTE, PRICING_TAX_NOTE, TIER_ACCENT,
  PRODUCT_POSITIONING, ORDERED_PLANS, formatPriceEur, planById, PLANS,
  type PricingTier, type PlanId,
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
import {
  PlanFeatureGroups, PlanRuntimeLimits, PlanModuleAreas, PlanComparisonMatrix,
} from '../../components/pricing/PlanFeatureGroups';
import { GovernanceModuleMatrix } from '../../components/pricing/GovernanceModuleMatrix';

/**
 * /pricing — öffentliche Preisseite der AI Governance Runtime.
 *
 * Sämtliche Plan-Daten (Preise, Limits, Module, Berechtigungen, Features)
 * stammen aus der SSoT `shared/pricing.ts`. Diese Datei enthält KEINE
 * eigenen Preise, Limits oder Feature-Listen — sie rendert nur.
 *
 * Aufbau je Karte (verbindlich):
 *   Outcome-Headline → technische Subheadline → Preis → Runtime-Limits
 *   → Governance-Module (GOVERN/AUTOMATE/ENGAGE) → Features in vier
 *   Gruppen → CTA
 */

const PLAN_ICONS: Record<PlanId, typeof Cookie> = {
  free: Cookie,
  starter: ShieldCheck,
  growth: Zap,
  agency: Globe,
  enterprise: Building2,
  partner: Briefcase,
  governance_launch: Rocket,
};

export function PricingPage() {
  // Deep-Link von Startseite/Audit: ?plan=<id> hebt das gewählte Paket hervor
  // und scrollt es in den Blick — so bleibt der Weg zur Paket-Auswahl eindeutig.
  const [params] = useSearchParams();
  const selectedPlan = params.get('plan');
  useEffect(() => {
    if (!selectedPlan) return;
    const el = document.getElementById(`plan-${selectedPlan}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedPlan]);

  return (
    <>
      <SEOHead />
      <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* Top bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50">
          <Sparkles className="h-3.5 w-3.5 text-titanium-100" />
          <span className="font-display font-bold tracking-tight text-titanium-50">RealSyncDynamics.AI</span>
        </Link>
        <Link
          to="/audit?source=pricing-top"
          className="surface-mono inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Audit starten <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 pt-10 pb-12 sm:pt-16 sm:pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-7 flex flex-col items-center gap-3">
            <div className="logo-pulse">
              <Logo size={48} iconOnly />
            </div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100">
              {PRODUCT_POSITIONING} · Preise
            </div>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05] mb-4">
            Wie viel Governance-Runtime brauchen Sie?
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto">
            Jeder Plan enthält dieselbe Runtime: Scan, Policy Engine, Evidence Vault, Risk Engine,
            Automation und Audit Export. Der Unterschied liegt in Reichweite und Tempo — wie viele
            Rahmenwerke geprüft werden, wie oft die Runtime läuft, wie weit die Automatisierung reicht
            und für wie viele Mandanten sie arbeitet.
          </p>

          {/* Free Audit → Governance Score → automatische Planempfehlung */}
          <Link
            to="/audit?source=pricing-hero"
            className="mt-7 inline-flex items-center gap-2 surface-mono px-5 py-3 text-sm font-bold rounded-none"
          >
            Governance Score ermitteln — der Plan folgt daraus <ArrowRight className="h-4 w-4" />
          </Link>

          {/* Trial klar sichtbar — nur die Self-Service-Plaene starten mit
              ?pilot=true in den Testmodus (siehe CheckoutPage). Enterprise und
              Partner werden angefragt und haben keinen Self-Service-Trial. */}
          <p className="mt-5 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            {TRIAL_PLAN_LIST}: {TRIAL_DAYS} Tage kostenlos testen · keine Kosten bis Tag {TRIAL_DAYS + 1} · monatlich kündbar
          </p>
        </div>
      </section>

      {/* Tier-Cards — drei Stufen seit AP2 (Starter, Growth, Enterprise) */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
            {SELLABLE_PRICING_TIERS.map((tier) => (
              <TierCard key={tier.id} tier={tier} selected={tier.id === selectedPlan} />
            ))}
          </div>

          <div className="mt-8 text-center space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
              {PRICING_TRUST_NOTE}
            </p>
            <p className="text-[10px] font-mono text-titanium-600">
              Free Audit kostenlos · kein Account nötig · {TRIAL_PLAN_LIST}:{' '}
              {TRIAL_DAYS} Tage kostenlos testen — keine Kosten bis Tag {TRIAL_DAYS + 1}, monatlich kündbar ·
              {' '}Enterprise und Partner: nach Anfrage, kein Self-Service-Trial
            </p>
            <p className="text-[10px] font-mono text-titanium-600">
              Alle Preise in EUR. {PRICING_TAX_NOTE}
            </p>
          </div>

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
                title: 'Continuous Runtime-Monitoring',
                body: 'Governance ist kein einmaliger Zustand. Websites und KI-Endpunkte verändern sich. Wir messen täglich, erkennen Drift gegen den letzten Baseline-Stand und alarmieren — damit zwischen den Audits keine stillen Regressionen verschwinden.',
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
                q: 'Was passiert nach dem Kauf des Agency-Pakets?',
                a: 'Nach der Zahlung erhalten Sie innerhalb von 15 Minuten eine E-Mail mit Ihrem Account-Zugang. Im Dashboard finden Sie sofort: Ihren API-Key, das White-Label-Konfigurations-Panel (Logo, Farben, eigene Domain), und die Möglichkeit, die ersten 10 Kundenseiten hinzuzufügen. Unser Onboarding-Team meldet sich innerhalb von 24 Stunden für ein optionales Setup-Gespräch.',
              },
              {
                q: 'Was bedeutet "Priority Support" beim Agency-Paket?',
                a: 'Priority Support bedeutet: dedizierter Ansprechpartner per E-Mail mit garantierter Antwort innerhalb von 8 Stunden (Werktage). Für kritische Compliance-Fragen (aktiver Aufsichtsbehörden-Kontakt) eskalieren wir auf 4-Stunden-Response. Kontakt: support@realsyncdynamicsai.de mit Betreff [AGENCY].',
              },
              {
                q: 'Wie viele Kundenseiten kann ich im Agency-Paket verwalten?',
                a: '10 Kundenseiten (Domains) sind im Grundpreis enthalten. Weitere Domains können einzeln hinzugebucht werden. Jede Domain bekommt ihr eigenes Monitoring-Dashboard, White-Label-Report und API-Endpunkt. Die Multi-Tenant-Struktur ist vollständig isoliert — jeder Kunde sieht nur seine eigenen Daten.',
              },
              {
                q: 'Gibt es einen AVV (Auftragsverarbeitungsvertrag)?',
                a: 'Ja. Als Auftragsverarbeiter stellen wir Ihnen und Ihren Kunden einen EU-konformen AVV bereit. Er ist ab Buchung automatisch aktiv und kann unter /legal/avv eingesehen und heruntergeladen werden. Für Agency-Kunden mit eigenen Endkunden stellen wir zusätzlich eine anpassbare AVV-Vorlage bereit.',
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

function TierCard({ tier, selected = false }: { tier: PricingTier; selected?: boolean }) {
  const plan = tier.plan;
  const TierIcon = PLAN_ICONS[plan.id];
  // COMMERCIAL-SSOT: temporary production hotfix.
  // Canonical source migration tracked in Phase 2.
  // Plaene ohne oeffentlich zugesicherten Festpreis duerfen keinen Betrag
  // ausweisen — sonst steht dort ein Angebot, das der Checkout nicht erfuellt.
  const priceDisplay = tier.priceOnRequest ? 'Auf Anfrage' : formatPriceEur(tier.priceEur);
  const accent = TIER_ACCENT[tier.id];

  return (
    <div
      id={`plan-${tier.id}`}
      className={`relative flex flex-col p-6 sm:p-7 bg-obsidian-900/60 border-x border-b rounded-none border-t-4 transition-colors ${accent.border} ${
        tier.highlight
          ? 'border-titanium-200/80 shadow-[0_0_0_1px_rgba(229,231,235,0.25)]'
          : 'border-silver-700/30 hover:border-titanium-200/60'
      }${selected ? ' ring-2 ring-cyan-400/70' : ''}`}
      data-testid={`pricing-card-${tier.id}`}
    >
      {tier.highlight && (
        <div className="absolute -top-3 left-5 px-2 py-0.5 bg-titanium-50 text-obsidian-950 font-mono uppercase tracking-wider text-[10px] font-bold">
          Empfohlen
        </div>
      )}

      <div className="flex items-center gap-2 mb-2 mt-1">
        <TierIcon className={`h-4 w-4 ${accent.text}`} />
        <div className="font-display font-bold text-titanium-50 text-lg tracking-tight">{tier.name}</div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1.5">
        <div className="text-3xl font-display font-bold text-titanium-100 tabular-nums">{priceDisplay}</div>
        <div className="text-xs font-mono uppercase tracking-wider text-silver-400">{tier.priceSuffix}</div>
      </div>

      {/* Outcome-Headline — was der Kunde bekommt */}
      <p className="font-display text-sm font-semibold leading-snug text-titanium-100 mb-1.5">
        {tier.tagline}
      </p>
      {/* Technische Subheadline — wie die Runtime das leistet */}
      <p className="text-xs leading-relaxed text-silver-400 mb-4">{tier.subline}</p>

      {tier.badges && tier.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tier.badges.map((b) => (
            <span
              key={b}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-titanium-200/10 border border-titanium-200/40 text-titanium-100 rounded-none"
            >
              <Award className="h-2.5 w-2.5" /> {b}
            </span>
          ))}
        </div>
      )}

      {/* Runtime-Limits */}
      <div className="mb-4">
        <PlanRuntimeLimits plan={plan} />
      </div>

      {/* Governance-Module nach GOVERN / AUTOMATE / ENGAGE */}
      <div className="mb-4">
        <PlanModuleAreas plan={plan} />
      </div>

      {/* Features in den vier verbindlichen Gruppen */}
      <div className="mb-6 flex-1">
        <PlanFeatureGroups plan={plan} />
      </div>

      <div className="flex flex-col gap-3">
        {/* Primary CTA: Book / Start */}
        {tier.cta.href.startsWith('http') ? (
          <button
            onClick={() => window.open(tier.cta.href, '_blank')}
            className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-none transition-colors ${
              tier.highlight
                ? 'surface-mono'
                : 'border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50'
            }`}
            data-testid={`pricing-book-${tier.id}`}
          >
            {tier.cta.label} <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => window.location.href = tier.cta.href}
            className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-none transition-colors ${
              tier.highlight
                ? 'surface-mono'
                : 'border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50'
            }`}
            data-testid={`pricing-book-${tier.id}`}
          >
            {tier.cta.label} <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {/* Secondary: More Info button (links to plan detail page) */}
        <button
          onClick={() => window.location.href = `/pricing/${tier.id}`}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-none border border-titanium-200/30 text-titanium-300 hover:text-titanium-50 hover:border-titanium-200/60 transition-colors"
          data-testid={`pricing-info-${tier.id}`}
        >
          Mehr erfahren
        </button>
      </div>
    </div>
  );
}

