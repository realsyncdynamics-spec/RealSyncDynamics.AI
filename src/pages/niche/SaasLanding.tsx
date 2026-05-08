import { Cookie, Database, Brain } from 'lucide-react';
import { NicheLanding, type NicheConfig } from './NicheLanding';

const SAAS_CONFIG: NicheConfig = {
  segment: 'SaaS',
  eyebrow: 'Für SaaS-Plattformen',
  headline: 'DSGVO + EU AI Act für SaaS — Plattform, Marketing-Site und KI-Features in einem Audit.',
  subline:
    'Wir prüfen Ihre Marketing-Domain, Ihre App-Domain und Ihre KI-Features (Recommendation, Lead-Scoring, GenAI-Integrationen) — von Tracker-Loading vor Consent bis Annex-III-Klassifikation. Mit klarer To-do-Liste für Produkt, Marketing und Datenschutz.',
  primaryCtaHref: '/audit?source=fuer-saas',
  painCards: [
    {
      Icon: Cookie,
      title: 'Marketing-Site mit Tracker-Wildwuchs',
      body: 'Growth-Stack mit GA4, Hubspot, Hotjar, LinkedIn Insight und Meta Pixel — meist alle vor Consent geladen. Klassischer TTDSG-§ 25-Verstoß, abmahnbar.',
    },
    {
      Icon: Database,
      title: 'Multi-Tenant-Setup ohne klare AVV',
      body: 'Sub-Processors-Liste fehlt oder ist veraltet. Customer-Data fließt zu Stripe, Intercom, OpenAI, Posthog ohne saubere AVV-Kette + Drittland-Bewertung.',
    },
    {
      Icon: Brain,
      title: 'KI-Features unter dem AI-Act-Radar',
      body: 'Recommendation-Engine, Lead-Scoring oder GenAI-Auto-Replies — bei US-Foundation-Modellen drohen Annex-III-Pflichten und Art. 50 Transparenz-Vorgaben ab 2026.',
    },
  ],
  checksTitle: 'Was wir konkret für SaaS-Unternehmen prüfen',
  checks: [
    {
      title: 'Onboarding-Forms + Embeds',
      body: 'Trial-Signup-Form, Lead-Capture-Embeds, Calendly/HubSpot-Widgets — wir checken Datenflüsse, Sub-Processor-Doku und Consent-Reihenfolge.',
    },
    {
      title: 'AVV + Sub-Processors-Kette',
      body: 'Stripe, Resend, Intercom, OpenAI, Anthropic, Vercel — alle gemappt mit Drittland-Status, AVV-Vorhandensein und Pflichthinweisen für Ihre eigene Kundendokumentation.',
    },
    {
      title: 'AI-Act Risk-Mapping pro Feature',
      body: 'Wir gehen Ihr Feature-Inventar durch und klassifizieren jedes KI-Feature nach Annex III + Art. 50. Output: Doku-Pflichten-Liste pro Feature.',
    },
  ],
  faqs: [
    {
      q: 'Müssen wir den Audit auf unsere Produktiv-Plattform laufen lassen?',
      a: 'Nein. Wir starten mit Ihrer Marketing-Domain (öffentliche Touchpoints) und ergänzen optional eine Auth-geschützte Audit-URL für Ihre App. Kein Eingriff in produktive User-Daten.',
    },
    {
      q: 'Wir nutzen OpenAI / Claude — ist das überhaupt DSGVO-konform?',
      a: 'Mit dem richtigen DPA, der korrekten Region (EU/US) und sauberer Token-Hygiene grundsätzlich ja. Wir prüfen Ihre konkrete Setup-Konstellation und liefern den Doku-Stand inklusive Sub-Processor-Eintrag.',
    },
    {
      q: 'Wir haben schon einen DPO und einen externen Datenschutzberater. Was bringt RealSyncDynamics zusätzlich?',
      a: 'Den technischen Vor-Audit als reproduzierbare Maschinen-Prüfung. Ihr DPO bekommt einen strukturierten Befund-Report, statt manuell die Site nach Trackern zu durchforsten.',
    },
  ],
};

export function SaasLanding() {
  return <NicheLanding config={SAAS_CONFIG} />;
}
