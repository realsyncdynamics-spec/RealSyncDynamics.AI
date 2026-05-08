import { Building2, Workflow, FileBarChart } from 'lucide-react';
import { NicheLanding, type NicheConfig } from './NicheLanding';

const AGENTUREN_CONFIG: NicheConfig = {
  segment: 'Agentur',
  sourceTag: 'fuer-agenturen',
  eyebrow: 'Für Agenturen + Web-Studios',
  headline: 'DSGVO + AI-Act Compliance für 50 Kundenseiten — ohne 50 Consent-Tools.',
  subline:
    'Sie betreuen Marketing-Sites, Lead-Funnels und KI-Kampagnen für viele Mandanten parallel. Wir liefern den technischen Compliance-Überblick pro Domain — und ein Dashboard, das Ihre Projektleiter und Account-Manager gemeinsam lesen können.',
  primaryCtaHref: '/audit?source=fuer-agenturen',
  painCards: [
    {
      Icon: Building2,
      title: '20+ Mandantenseiten, alle anders konfiguriert',
      body: 'Jede Site hat anderen CMP, anderes Tracking-Stack, eigene Plugin-Historie. Manueller Audit pro Domain frisst Stunden, automatisierter Reaudit fehlt.',
    },
    {
      Icon: Workflow,
      title: 'GenAI-Kampagnen ohne AI-Act-Doku',
      body: 'Sie produzieren GPT-Texte, Midjourney-Visuals, AI-Voiceover für Kunden — Markierungspflicht (Art. 50 Abs. 2) ist meist nicht umgesetzt, Mandant trägt Risiko.',
    },
    {
      Icon: FileBarChart,
      title: 'Kunde fragt: „Sind wir DSGVO-sicher?"',
      body: 'Ohne strukturierten Befund-Report keine belastbare Antwort. Sie brauchen schwarz-auf-weiß-Befunde, die Sie an den Kunden weitergeben können.',
    },
  ],
  checksTitle: 'Was wir konkret für Web-/KI-Agenturen prüfen',
  checks: [
    {
      title: 'Tracking-Stack-Audit pro Domain',
      body: 'GA4, Meta, LinkedIn, TikTok, Hotjar, Clarity, Matomo — wir erkennen alle Pixel + bewerten ob Pre-Consent-Loading aktiv ist. Output: Befundsheet pro Mandant.',
    },
    {
      title: 'AI-Workflow-Inventar je Kunde',
      body: 'Chatbots, Recommendation-Engines, GenAI-Texte — wir mappen alles auf Annex III + Art. 5 / Art. 50. Mit Markierungs-Snippets für GenAI-Outputs.',
    },
    {
      title: 'White-Label-Reports + Wiedervorlage',
      body: 'Strukturierter Befund-PDF mit Ihrem Logo (Pro+), Wiedervorlage-Cadence (monatlich / quartalsweise), Mandanten-Kommunikations-Template.',
    },
  ],
  faqs: [
    {
      q: 'Können wir das Tool unter unserem Logo verkaufen?',
      a: 'White-Label-Reports und Multi-Mandanten-Dashboards sind im Pro/Business-Plan vorgesehen. Aktuell im Beta-Programm — Sales-Termin liefert die genaue Roadmap.',
    },
    {
      q: 'Wie sieht das Pricing für Agenturen aus?',
      a: 'Die finalen Tier-Preise (Starter / Business / Enterprise) folgen sobald die Stripe-Anbindung steht. Bis dahin bieten wir Pilot-Verträge mit 5-50 Mandanten-Domains.',
    },
    {
      q: 'Wer haftet, wenn ein Mandant trotzdem abgemahnt wird?',
      a: 'Wir liefern technische Compliance-Härtung, keine Rechtsberatung. Anwaltliche Bewertung der Befunde übernimmt Ihr Mandant oder dessen DPO. Unser Befund ist dokumentierte technische Sorgfalt — bessere Ausgangslage als „nichts geprüft".',
    },
  ],
};

export function AgenturenLanding() {
  return <NicheLanding config={AGENTUREN_CONFIG} />;
}
