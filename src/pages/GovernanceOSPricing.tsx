import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Check, Shield, Zap, Building2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { GovernancePricingMatrix } from '../components/pricing/GovernancePricingMatrix';
import { PLAN_CONFIG } from '../core/billing/plan-config';

export function GovernanceOSPricing() {
  const governancePlans = [
    {
      key: 'starter_governance',
      icon: Shield,
      highlight: false,
    },
    {
      key: 'professional_governance',
      icon: Zap,
      highlight: true,
    },
    {
      key: 'governance_os',
      icon: Building2,
      highlight: false,
    },
  ];

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* Top bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-silver-700">
        <Link to="/" className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50">
          <Sparkles className="h-3.5 w-3.5 text-titanium-100" />
          <span className="font-display font-bold tracking-tight text-titanium-50">RealSyncDynamics.AI</span>
        </Link>
        <Link
          to="/audit?source=gov-pricing-top"
          className="surface-mono inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold"
        >
          Kostenlos auditen <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-7 flex flex-col items-center gap-3">
            <div className="logo-pulse">
              <Logo size={48} iconOnly />
            </div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100">
              Governance OS · Preise
            </div>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05] mb-5">
            Governance-Komplexität sichtbar machen
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto mb-8">
            RealSyncDynamics.AI ist dein <strong>Governance OS</strong> für laufende DSGVO- und EU-AI-Act-Compliance.
            Von Website-Audit über Policy-Engine bis zu Branchen-Agenten — skalierbar für jede Komplexität.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/audit?source=gov-pricing-hero"
              className="surface-mono px-6 py-3 font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              Kostenlos starten <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact-sales?context=governance-enterprise"
              className="border border-silver-400 px-6 py-3 font-bold text-sm text-silver-300 hover:text-titanium-50 hover:border-titanium-50 transition"
            >
              Enterprise anfragen
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {['starter_governance', 'professional_governance', 'governance_os', 'enterprise_regulated'].map((planKey) => {
            const plan = PLAN_CONFIG[planKey as keyof typeof PLAN_CONFIG];
            const metadata = plan.metadata;
            const iconIndex = ['starter_governance', 'professional_governance', 'governance_os', 'enterprise_regulated'].indexOf(planKey);
            const icons = [Shield, Zap, Building2, Building2];
            const Icon = icons[iconIndex] || Shield;
            const isHighlight = planKey === 'professional_governance';

            return (
              <div
                key={planKey}
                className={`border rounded-none p-6 transition ${
                  isHighlight
                    ? 'border-security-500 bg-obsidian-850 ring-2 ring-security-500 ring-opacity-20'
                    : 'border-silver-700 bg-obsidian-900 hover:border-silver-500'
                }`}
              >
                {isHighlight && (
                  <div className="inline-block px-3 py-1 bg-security-500 text-obsidian-900 text-xs font-bold rounded-none mb-4">
                    Empfohlen
                  </div>
                )}
                <div className="mb-4">
                  <Icon className="h-8 w-8 text-security-500 mb-3" />
                  <h3 className="text-lg font-bold text-titanium-50">{metadata?.displayName}</h3>
                  <p className="text-xs text-silver-400 mt-2">{metadata?.description}</p>
                </div>

                <div className="mb-6 py-4 border-y border-silver-700">
                  <div className="font-display font-bold text-2xl text-titanium-50">
                    {metadata?.monthlyPrice ? `€${metadata.monthlyPrice}` : 'Individuell'}
                  </div>
                  {metadata?.monthlyPrice && (
                    <p className="text-sm text-silver-400">/Monat · jederzeit kündbar</p>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  {([
                    planKey === 'starter_governance' && ['Website DSGVO-Scan', '1 Domain', 'Basic-Report'],
                    planKey === 'professional_governance' && ['Alles aus Starter', 'bis 10 Domains', 'AI-Act-Check', 'Team-Zugang'],
                    planKey === 'governance_os' && ['Alles aus Professional', 'bis 50+ Assets', 'Policy Engine', 'Automatisierung', 'Evidence Vault'],
                    planKey === 'enterprise_regulated' && ['Alles aus Governance OS', 'Unbegrenzte Assets', 'Branchen-Agenten', 'High-Risk-AI-Tiefe', 'SLA & Dedicated Support'],
                  ].flat() as string[]).map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-security-500 flex-shrink-0 mt-0.5" />
                      <span className="text-silver-300">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  className={`w-full py-2.5 font-bold text-sm transition ${
                    isHighlight
                      ? 'bg-security-500 text-obsidian-900 hover:bg-security-600'
                      : 'border border-silver-600 text-silver-300 hover:border-silver-400 hover:text-titanium-50'
                  }`}
                >
                  {planKey === 'enterprise_regulated' ? 'Kontakt' : 'Ausprobieren'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature Matrix */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 mb-3">
              Feature-Matrix
            </h2>
            <p className="text-silver-300 max-w-2xl mx-auto">
              Vergleich aller Governance-Features pro Paket
            </p>
          </div>
          <GovernancePricingMatrix />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-8 text-center">
            Häufig gefragt
          </h2>
          <div className="space-y-6">
            {[
              {
                q: 'Welches Paket passt zu mir?',
                a: 'Starter: kleine Website, niedrige DSGVO-Komplexität. Professional: mehrere Websites, Monitoring nötig. Governance OS: umfassende KI-Governance und Automatisierung. Enterprise: regulierte Branche, Branchen-Agenten.',
              },
              {
                q: 'Kann ich jederzeit upgraden oder downgraden?',
                a: 'Ja. Upgrades werden sofort wirksam, Downgrades am Ende des Abonnementzeitraums.',
              },
              {
                q: 'Gibt es versteckte Kosten?',
                a: 'Nein. Alle Preise sind All-In. Keine Setup-Gebühren, keine API-Kosten extra, keine Pro-Nutzer-Gebühren (nur bei Governance OS ab Basis-Teamgröße).',
              },
              {
                q: 'Können wir die Preise verhandeln?',
                a: 'Bei Governance OS und Enterprise: ja. Nutze Enterprise anfragen oder schreib uns eine Nachricht über das Kontaktformular.',
              },
            ].map((faq, i) => (
              <div key={i} className="border border-silver-700 p-6">
                <h3 className="font-bold text-titanium-50 mb-2">{faq.q}</h3>
                <p className="text-silver-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-xl text-titanium-50 mb-4">
            Bereit für laufende Governance?
          </h2>
          <p className="text-silver-300 mb-6">
            Starte kostenlos mit dem Website-Audit. Oder sprich mit unserem Team über deine Governance-Anforderungen.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/audit?source=gov-pricing-footer"
              className="surface-mono px-6 py-3 font-bold text-sm"
            >
              Kostenlos auditen
            </Link>
            <Link
              to="/contact-sales?context=governance-enterprise"
              className="border border-silver-400 px-6 py-3 font-bold text-sm text-silver-300 hover:text-titanium-50"
            >
              Enterprise anfragen
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
