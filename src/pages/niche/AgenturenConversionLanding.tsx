import { Users, Repeat, FileCheck } from 'lucide-react';
import { NicheLanding, type NicheConfig } from './NicheLanding';

const CONFIG: NicheConfig = {
  segment: 'Agentur',
  sourceTag: 'agenturen',
  eyebrow: 'Für Marketing-Agenturen & Web-Studios',
  headline: '1 Agentur. 50 Kunden. 0 manuelle DSGVO-Audits.',
  subline:
    'Jede Ihrer Kunden-Websites ist ein eigenes Compliance-Risiko — und jedes Plugin-Update, jeder neue Tracker kann den Status kippen. Mit RealSyncDynamics.AI überwachen Sie alle Mandanten-Domains zentral, erhalten sofort Drift-Alerts und liefern strukturierte Befunde, die Sie direkt an den Kunden weitergeben.',
  primaryCtaHref: '/audit?source=agenturen',
  primaryCtaLabel: 'Jetzt Agentur-Paket starten',
  painCards: [
    {
      Icon: Users,
      title: '1 Agentur = bis zu 200 Websites mit Compliance-Risiko',
      body: 'Sie betreuen 20, 50, 200 Kunden-Domains. Manueller Audit pro Site frisst Tage — und ist nach dem nächsten WordPress-Update bereits veraltet. Automatisiertes Re-Audit fehlt in fast jeder Agentur.',
    },
    {
      Icon: Repeat,
      title: 'Plugin-Update → Compliance-Drift → Abmahnung',
      body: 'Ein Kunden-Webdesigner aktualisiert ein Plugin. Google Analytics lädt plötzlich vor Consent. Sie erfahren es erst, wenn der Anwalt schreibt. Ohne Monitoring gibt es keinen Frühwarnindikator.',
    },
    {
      Icon: FileCheck,
      title: 'Kunde fragt nach Nachweis — Sie haben keinen',
      body: 'Unternehmen und Behörden fordern zunehmend DSGVO-Compliance-Nachweise von ihren Dienstleistern. Ohne strukturierten Befund-Report und Evidence-Trail sind Sie angreifbar.',
    },
  ],
  checksTitle: 'Was wir für Agenturen konkret prüfen',
  checks: [
    {
      title: 'Multi-Domain-Monitoring für alle Mandanten',
      body: 'Alle Kunden-Websites in einem Dashboard. GA4, Meta-Pixel, LinkedIn, TikTok, Hotjar — wir erkennen jeden Tracker und prüfen, ob Pre-Consent-Loading aktiv ist. Drift-Alert per E-Mail oder Webhook.',
    },
    {
      title: 'Strukturierter Befund-Report pro Mandant',
      body: 'Automatisch generierter PDF-Befund mit konkreten Fundstellen (URL, Cookie-Name, Drittland-Transfer, Rechtsgrundlage). Direkt an den Kunden weiterleitbar. Optional mit Ihrem Logo (Pro/Business).',
    },
    {
      title: 'GenAI-Kampagnen-Inventar + AI-Act-Prüfung',
      body: 'ChatGPT-Texte, Midjourney-Visuals, AI-Voiceover für Kunden — Markierungspflicht nach Art. 50 Abs. 2 EU AI Act ist meist nicht umgesetzt. Wir mappen KI-Einsatz auf Annex III und liefern Markierungs-Snippets.',
    },
  ],
  faqs: [
    {
      q: 'Wie viele Mandanten-Domains kann ich einbinden?',
      a: 'Das Starter-Paket umfasst 5 Domains, Business 25, Enterprise unbegrenzt. Für Pilot-Agenturen bieten wir individuelle Pakete mit 10–200 Domains — der AI Agent liefert auf Anfrage ein konkretes Angebot.',
    },
    {
      q: 'Können wir die Reports unter unserem Logo ausliefern?',
      a: 'White-Label-Reports sind im Pro- und Business-Plan vorgesehen (Ihr Logo, Ihre Farben, Ihr Kontakt). Aktuell im Beta-Programm — melden Sie sich für die Pilot-Warteliste.',
    },
    {
      q: 'Wer haftet bei einem Compliance-Vorfall beim Kunden?',
      a: 'Wir liefern technische Compliance-Härtung, keine Rechtsberatung. Der Mandant trägt die datenschutzrechtliche Verantwortung. Unser technischer Befund ist dokumentierte Sorgfalt — erheblich bessere Ausgangslage als „nichts geprüft".',
    },
    {
      q: 'Gibt es einen API-Zugang für unser eigenes Dashboard?',
      a: 'Ja — REST-API und Webhooks sind geplant. Enterprise-Kunden können Audit-Ergebnisse in eigene Reporting-Tools pushen. Aktuell auf Anfrage verfügbar.',
    },
  ],
};

export function AgenturenConversionLanding() {
  return <NicheLanding config={CONFIG} />;
}
