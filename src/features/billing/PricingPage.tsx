import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, Sparkles, Award, Building2, Cookie, ShieldCheck, Zap, Globe, Briefcase,
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import { PRICING_TIERS, PRICING_TRUST_NOTE, type PricingTier, type TierId } from '../../config/pricing';

/**
 * /pricing — public Pricing-Page mit 4 Paketen.
 *
 * Tier-Daten kommen ausschliesslich aus src/config/pricing.ts
 * (Single Source of Truth, geteilt mit PricingTeaserSection + index.html JSON-LD).
 *
 * 4-Tier-Struktur (Stand 2026-05):
 *   Free Audit  0 €         Lead-Funnel
 *   Starter     79 €/Monat  Einzeldomain
 *   Growth    249 €/Monat  Monitoring + Auto-Fix (HIGHLIGHT)
 *   Agency    699 €/Monat  White-Label, 10 Kunden-Sites, API
 *   Enterprise ab 1.500 €/Monat — SLA, AI Act, Evidence Vault
 *   Enterprise individuell  SLA / AI-Act / DSB / Evidence Vault
 */

const TIER_ICONS: Record<TierId, typeof Cookie> = {
  free: Cookie,
  starter: ShieldCheck,
  growth: Zap,
  agency: Globe,
  scale: Briefcase,
  enterprise: Building2,
};

export function PricingPage() {
  return (
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
              Preise · Public
            </div>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05] mb-4">
            Welcher Plan passt zu Ihrem Setup?
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto">
            Vom kostenlosen Erst-Scan bis zur kompletten Governance-Runtime — alle Pläne sind EU-gehostet,
            alle Pläne enthalten den AVV. Wählen Sie nach Anzahl der Domains und nach Tiefe der gewünschten
            Continuous-Compliance-Schicht.
          </p>
        </div>
      </section>

      {/* Tier-Cards — 4-spaltig auf Desktop */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 items-stretch">
            {PRICING_TIERS.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
              {PRICING_TRUST_NOTE}
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
                q: 'Wie kündige ich?',
                a: 'Monatlich, formlos per E-Mail. Keine Mindestlaufzeit. Daten und Reports bleiben Ihnen 90 Tage exportierbar erhalten.',
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
            <Link to="/legal/sub-processors" className="hover:text-titanium-50">Sub-Processors</Link>
            <Link to="/legal/methodology" className="hover:text-titanium-50">Methodik</Link>
            <Link to="/security" className="hover:text-titanium-50">Security</Link>
            <Link to="/status" className="hover:text-titanium-50">Status</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TierCard({ tier }: { tier: PricingTier }) {
  const TierIcon = TIER_ICONS[tier.id];
  const priceDisplay =
    tier.priceEur > 0 ? `${tier.priceEur} €` : (tier.id === 'free' ? '0 €' : 'Anfrage');

  return (
    <div
      className={`relative flex flex-col p-6 sm:p-7 bg-obsidian-900/60 border rounded-none transition-colors ${
        tier.highlight
          ? 'border-titanium-200/80 shadow-[0_0_0_1px_rgba(229,231,235,0.25)]'
          : 'border-silver-700/30 hover:border-titanium-200/60'
      }`}
    >
      {tier.highlight && (
        <div className="absolute -top-3 left-5 px-2 py-0.5 bg-titanium-50 text-obsidian-950 font-mono uppercase tracking-wider text-[10px] font-bold">
          Empfohlen
        </div>
      )}

      <div className="flex items-center gap-2 mb-2 mt-1">
        <TierIcon className="h-4 w-4 text-titanium-100" />
        <div className="font-display font-bold text-titanium-50 text-lg tracking-tight">{tier.name}</div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1.5">
        <div className="text-3xl font-display font-bold text-titanium-100 tabular-nums">{priceDisplay}</div>
        <div className="text-xs font-mono uppercase tracking-wider text-silver-400">{tier.priceSuffix}</div>
      </div>

      <div className="text-[11px] font-mono uppercase tracking-wider text-silver-400 mb-4">{tier.tagline}</div>

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

      <ul className="space-y-2 text-sm text-silver-200 mb-6 flex-1">
        {tier.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 leading-relaxed">
            <Check className="h-3.5 w-3.5 text-titanium-100 shrink-0 mt-1" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <Link
        to={tier.cta.href}
        className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-none transition-colors ${
          tier.highlight
            ? 'surface-mono'
            : 'border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50'
        }`}
      >
        {tier.cta.label} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
