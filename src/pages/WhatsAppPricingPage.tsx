import { Link } from 'react-router-dom';
import { LandingNavbar } from '../components/LandingNavbar';
import { PublicFooter } from '../enterprise-os/layout/PublicFooter';
import { Check, MessageCircle, Users, Shield, Zap } from 'lucide-react';
import { CapabilityAvailabilityNotice } from '../components/landing/CapabilityAvailabilityNotice';

/**
 * Dedicated WhatsApp Pricing Page
 * Showcases governance-bot pricing for WhatsApp Business API integration
 * Includes channel-specific features, tier-based quotas, and add-ons
 */

interface WhatsAppPricingTier {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  description: string;
  botLimit: number;
  answersPerMonth: number;
  features: string[];
  recommended?: boolean;
  cta: { label: string; href: string };
}

const WHATSAPP_TIERS: WhatsAppPricingTier[] = [
  {
    id: 'starter-wa',
    name: 'Starter WhatsApp',
    monthlyPrice: 79,
    yearlyPrice: 790,
    description: 'Einzelner WhatsApp-Bot mit grundlegenden Governance-Features',
    botLimit: 1,
    answersPerMonth: 500,
    features: [
      '1 produktiver WhatsApp-Bot',
      'bis zu 500 Antworten/Monat',
      'AI-Act-Transparenzhinweis',
      'Basis-Logging & Audit-Trail',
      'Media-Support (Bilder, Dokumente)',
      'Standard Setup (4 Stunden)',
      'Email-Support',
    ],
    cta: { label: 'Starten', href: '/checkout/starter?channel=whatsapp&source=pricing' },
  },
  {
    id: 'growth-wa',
    name: 'Growth WhatsApp',
    monthlyPrice: 249,
    yearlyPrice: 2490,
    description: 'Bis zu 2 WhatsApp-Bots mit erweiterten Governance-Features',
    botLimit: 2,
    answersPerMonth: 2000,
    features: [
      'bis zu 2 produktive WhatsApp-Bots',
      'bis zu 2.000 Antworten/Monat',
      'Risiko-Tags & Compliance-Flagging',
      'Terminbuchung & Bestellannahme',
      'Erweiterte Audit-Trail',
      'Evidence-Export & PDF-Reports',
      'Priority-Setup (2 Stunden)',
      'Standard-Support (24h Response)',
    ],
    recommended: true,
    cta: { label: 'Kostenlos testen', href: '/checkout/growth?channel=whatsapp&source=pricing&pilot=true' },
  },
  {
    id: 'agency-wa',
    name: 'Agency WhatsApp',
    monthlyPrice: 699,
    yearlyPrice: 6900,
    description: 'Bis zu 10 WhatsApp-Bots mit vollständiger White-Label-Lösung',
    botLimit: 10,
    answersPerMonth: 25000,
    features: [
      'bis zu 10 produktive WhatsApp-Bots',
      'bis zu 25.000 Antworten/Monat',
      'White-Label mit eigenem Branding',
      'Custom Intent-Matching & Fallbearbeitung',
      'Human Handoff mit Eskalation',
      'Advanced Analytics & Sentiment-Analyse',
      'Vollständiger Audit-Trail & Compliance-Logging',
      'Priority-Setup (1 Stunde, 24/7)',
      'Dedicated Support (4h Response)',
      'Branchenbibliothek integriert',
    ],
    cta: { label: 'Testen', href: '/checkout/agency?channel=whatsapp&source=pricing&pilot=true' },
  },
  {
    id: 'enterprise-wa',
    name: 'Enterprise WhatsApp',
    monthlyPrice: 1249,
    description: 'Bis zu 20 WhatsApp-Bots mit Multi-Tenant-Support',
    botLimit: 20,
    answersPerMonth: 50000,
    features: [
      'bis zu 20 produktive WhatsApp-Bots',
      'bis zu 50.000 Antworten/Monat',
      'Multi-Tenant-Dashboard (bis 5 Organisationen)',
      'Zentrale Benutzerverwaltung & Rollen/Rechte',
      'API Premium + Webhooks',
      'White-Label Light (Branding, Logo, Farben)',
      'Advanced Analytics & Risk-Scoring',
      'Priority Support (4h Response-Zeit)',
      'SLA 99,5% Verfügbarkeit',
      'Audit Center Pro + Evidence Vault Enterprise',
    ],
    cta: { label: 'Kontakt', href: '/contact-sales?tier=enterprise&channel=whatsapp&source=pricing' },
  },
];

const ADDONS = [
  {
    id: 'response-addon',
    name: 'Response Pack +5K',
    price: 49,
    description: 'Zusätzliche 5.000 Antworten pro Monat',
    features: ['Weitere 5.000 Antworten/Monat', 'Alle verfügbaren Tiers', 'Automatische Abrechnung'],
  },
  {
    id: 'compliance-addon',
    name: 'Compliance Pack',
    price: 149,
    description: 'Erweitertes Logging & Compliance-Features',
    features: [
      'DSGVO-Audit-Trail',
      'EU AI Act Risk-Tagging',
      'Quarterly Compliance-Report',
      'Human-Review Workflow',
    ],
  },
  {
    id: 'analytics-addon',
    name: 'Analytics Pro',
    price: 99,
    description: 'Erweiterte Analytik & Reporting',
    features: [
      'Advanced Sentiment-Analysis',
      'Custom Dashboard',
      'API-Access für Reports',
      'Monthly Insights-Report',
    ],
  },
];

const FEATURES = [
  {
    icon: MessageCircle,
    title: 'WhatsApp Business API',
    description: 'Vollständige Integration mit der offiziellen WhatsApp Business API für sichere, skalierbare Kommunikation.',
  },
  {
    icon: Shield,
    title: 'DSGVO & Compliance',
    description: 'Alle Nachrichten automatisch audit-geloggt. EU AI Act Transparenzhinweis und Risk-Tagging.',
  },
  {
    icon: Users,
    title: 'Multi-Bot Management',
    description: 'Verwaltung mehrerer WhatsApp-Bots über ein Dashboard. White-Label für Kundenprojekte.',
  },
  {
    icon: Zap,
    title: 'Smart Features',
    description: 'Terminbuchung, Bestellannahme, Risk-Tags, Human Handoff, Custom Intent-Matching.',
  },
];

export function WhatsAppPricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-obsidian-950 to-obsidian-900 text-titanium-50 flex flex-col">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="px-4 py-16 md:py-24 text-center max-w-6xl mx-auto w-full">
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ai-cyan-500/30 bg-ai-cyan-500/10">
          <MessageCircle className="w-4 h-4 text-ai-cyan-400" />
          <span className="text-sm font-medium text-ai-cyan-400">WhatsApp Business API</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">
          Governance-Bots für <span className="text-ai-cyan-400">WhatsApp</span>
        </h1>

        <p className="text-lg md:text-xl text-titanium-300 mb-8 max-w-3xl mx-auto leading-relaxed">
          DSGVO- und EU AI Act-konform. Automatisierte Compliance-Kommunikation über WhatsApp Business.
          Von Audit-Assistenten bis zur Fallbearbeitung — alles audit-geloggt.
        </p>

        {/* Steht vor den Kauf-CTAs, nicht darunter: hier fällt der Entscheid. */}
        <CapabilityAvailabilityNotice capabilityId="bots" className="mx-auto mb-8 max-w-2xl text-left" />

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/checkout/growth?channel=whatsapp&source=pricing&pilot=true"
            className="px-8 py-3 bg-security-600 hover:bg-security-700 text-white font-semibold rounded-lg transition-colors inline-block text-center"
          >
            14 Tage kostenlos testen
          </Link>
          <Link
            to="/contact-sales?channel=whatsapp&source=pricing"
            className="px-8 py-3 bg-obsidian-800 border border-titanium-600 hover:bg-obsidian-700 text-titanium-100 font-semibold rounded-lg transition-colors inline-block text-center"
          >
            Enterprise-Demo
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 py-16 max-w-6xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-12 text-center">Was Sie erhalten</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="p-6 rounded-lg border border-titanium-700 bg-obsidian-900/50 hover:bg-obsidian-800/50 transition-colors"
            >
              <Icon className="w-8 h-8 text-ai-cyan-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-titanium-400 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="px-4 py-16 max-w-7xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-2 text-center">Transparente Preise</h2>
        <p className="text-titanium-400 text-center mb-12">
          Alle Tiers beinhalten WhatsApp-Integration. Monatlich kündbar. 14 Tage kostenlos testen.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {WHATSAPP_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-lg border transition-all ${
                tier.recommended
                  ? 'border-ai-cyan-500 bg-gradient-to-b from-ai-cyan-500/10 to-obsidian-900 ring-2 ring-ai-cyan-500/20'
                  : 'border-titanium-700 bg-obsidian-900/50 hover:bg-obsidian-800/50'
              }`}
            >
              {tier.recommended && (
                <div className="px-4 py-2 text-center border-b border-ai-cyan-500/30 bg-ai-cyan-500/10">
                  <span className="text-xs font-semibold text-ai-cyan-400 uppercase tracking-wider">
                    Empfohlen
                  </span>
                </div>
              )}

              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                <p className="text-sm text-titanium-400 mb-4">{tier.description}</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-bold">{tier.monthlyPrice}€</span>
                    <span className="text-titanium-400 text-sm">/Monat</span>
                  </div>
                  {tier.yearlyPrice && (
                    <p className="text-xs text-titanium-500">
                      oder {tier.yearlyPrice}€/Jahr (2-Monate-Rabatt)
                    </p>
                  )}
                </div>

                <div className="mb-6 p-3 rounded bg-obsidian-800/50 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="w-4 h-4 text-ai-cyan-400" />
                    <span className="font-semibold">{tier.botLimit} WhatsApp-Bot(s)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-ai-cyan-400" />
                    <span>{tier.answersPerMonth.toLocaleString()} Antworten/Monat</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-6 text-sm">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-ai-cyan-400 flex-shrink-0 mt-0.5" />
                      <span className="text-titanium-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={tier.cta.href}
                  className={`block px-4 py-2 rounded-lg font-semibold transition-colors text-center text-sm ${
                    tier.recommended
                      ? 'bg-security-600 hover:bg-security-700 text-white'
                      : 'bg-obsidian-800 border border-titanium-600 hover:bg-obsidian-700 text-titanium-100'
                  }`}
                >
                  {tier.cta.label}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add-ons */}
      <section className="px-4 py-16 max-w-6xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-12 text-center">Optional: Add-ons</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ADDONS.map((addon) => (
            <div
              key={addon.id}
              className="p-6 rounded-lg border border-titanium-700 bg-obsidian-900/50"
            >
              <h3 className="text-lg font-semibold mb-2">{addon.name}</h3>
              <p className="text-sm text-titanium-400 mb-4">{addon.description}</p>
              <div className="mb-4">
                <span className="text-2xl font-bold text-ai-cyan-400">{addon.price}€</span>
                <span className="text-titanium-400 text-sm ml-2">/Monat</span>
              </div>
              <ul className="space-y-2 text-xs">
                {addon.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-3 h-3 text-ai-cyan-400 flex-shrink-0 mt-0.5" />
                    <span className="text-titanium-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-16 max-w-4xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-12 text-center">Häufige Fragen</h2>
        <div className="space-y-4">
          {[
            {
              q: 'Ist WhatsApp-Integration in allen Tiers enthalten?',
              a: 'Ja. Alle Tiers ab Starter unterstützen WhatsApp-Bots. Die Limits unterscheiden sich je nach Tier (maxBots, answersPerMonth).',
            },
            {
              q: 'Wird jede Nachricht audit-geloggt?',
              a: 'Ja. Jede Nachricht, jede Benutzerinteraktion und jede AI-Entscheidung wird vollständig audit-geloggt und ist DSGVO-konform exportierbar.',
            },
            {
              q: 'Können mehrere WhatsApp-Nummern verwendet werden?',
              a: 'Ja. Je nach Tier können Sie 1–20 produktive WhatsApp-Bots mit unterschiedlichen Nummern betreiben. Jeder Bot kann auf die gleiche Knowledge Base zugreifen.',
            },
            {
              q: 'Wie lange dauert das Setup?',
              a: 'Abhängig vom Tier: Starter/Growth ~2–4 Stunden. Agency/Enterprise: Dedicated Onboarding im Rahmen des Contracts.',
            },
            {
              q: 'Welche Zahlungsarten werden akzeptiert?',
              a: 'Stripe: Kreditkarte (VISA/Mastercard/AmEx), SEPA-Lastschrift, Apple Pay, Google Pay.',
            },
          ].map(({ q, a }, idx) => (
            <details
              key={idx}
              className="group p-4 rounded-lg border border-titanium-700 bg-obsidian-900/50 cursor-pointer hover:bg-obsidian-800/50 transition-colors"
            >
              <summary className="flex items-center gap-3 font-semibold text-titanium-100 list-none">
                <span className="text-ai-cyan-400 font-bold">+</span>
                <span>{q}</span>
              </summary>
              <p className="mt-3 ml-7 text-titanium-400 text-sm leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="px-4 py-16 max-w-4xl mx-auto w-full text-center">
        <h2 className="text-3xl font-bold mb-4">Bereit anzufangen?</h2>
        <p className="text-titanium-400 mb-8">
          14 Tage kostenlos testen. Keine Kreditkarte erforderlich. Monatlich kündbar.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/checkout/growth?channel=whatsapp&source=pricing&pilot=true"
            className="px-8 py-3 bg-security-600 hover:bg-security-700 text-white font-semibold rounded-lg transition-colors inline-block text-center"
          >
            Kostenlos starten
          </Link>
          <Link
            to="/contact-sales?channel=whatsapp&source=pricing"
            className="px-8 py-3 bg-obsidian-800 border border-titanium-600 hover:bg-obsidian-700 text-titanium-100 font-semibold rounded-lg transition-colors inline-block text-center"
          >
            Mit Sales Team sprechen
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
