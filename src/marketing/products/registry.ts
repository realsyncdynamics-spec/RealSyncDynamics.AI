import type { MarketingFeature, ProductArea, SolutionLink } from './types';

/**
 * Fünf Produktbereiche der Landing v8.
 *
 * Festgelegt für den Relaunch, nicht aus dem Repo abgeleitet:
 * A Governance · B Agent Studio · C Creative Studio · D Website Builder · E Operations.
 * Zugeordnet werden nur Flächen, die es im Repo schon gibt.
 * Fehlt eine Fläche, steht der Status auf `in-entwicklung`.
 */
export const PRODUCT_AREAS: readonly ProductArea[] = [
  {
    letter: 'A',
    slug: 'governance',
    name: 'AI Governance & Compliance',
    role: 'Grundlage',
    summary:
      'Die Governance Runtime prüft Systeme, Policies und Nachweise. Sie ist die Kontrollschicht unter den anderen Bereichen.',
    features: [
      {
        id: 'governance-runtime',
        name: 'Governance Runtime',
        summary:
          'Öffentliche Produktseite mit dem Ablauf von Erfassen bis Bericht. Der eingebettete Ausschnitt verwendet Beispieldaten.',
        status: 'vorhanden',
        demo: true,
        href: '/governance-runtime',
        showcase: { kind: 'live', component: 'governance-runtime' },
        evidence: 'src/pages/GovernanceRuntimePage.tsx',
      },
      {
        id: 'policy-engine',
        name: 'Policy Engine',
        summary: 'Regeln als Kontrolllogik. Öffentliche Fachseite, Arbeitsbereich nach Anmeldung.',
        status: 'vorhanden',
        demo: false,
        href: '/policy-engine',
        showcase: { kind: 'none' },
        evidence: 'src/product/implementation-status.ts#policy-engine',
      },
      {
        id: 'evidence',
        name: 'Evidence',
        summary: 'Nachweise und Prüfpfad. Öffentliche Fachseite, Speicher nach Anmeldung.',
        status: 'vorhanden',
        demo: false,
        href: '/evidence-vault',
        showcase: { kind: 'none' },
        evidence: 'src/config/platform-capabilities.ts#evidence-vault',
      },
      {
        id: 'governance-scan',
        name: 'Governance Scan',
        summary: 'Kostenloser Einstieg über den öffentlichen Scan einer Domain.',
        status: 'vorhanden',
        demo: false,
        href: '/audit',
        showcase: { kind: 'none' },
        evidence: 'src/pages/AuditLanding.tsx',
      },
    ],
  },
  {
    letter: 'B',
    slug: 'agent-studio',
    name: 'AI Agent Studio',
    role: 'Kanäle',
    summary:
      'Voice, Chat und weitere Kanäle. Voice ist ein Add-on und kein Tarif. Telefonie ist nicht produktiv angebunden.',
    features: [
      {
        id: 'voice-agent',
        name: 'Voice Agent',
        summary:
          'Startseite für den Telefon-Assistenten. Der Kanal ist Add-on. Eine Rufnummer ist nicht angebunden.',
        status: 'vorschau',
        demo: true,
        href: '/phonebot/start',
        showcase: {
          kind: 'screenshot',
          src: '/marketing/v8/phonebot.png',
          alt: 'Öffentliche Startseite des Telefon-Assistenten, als Vorschau gekennzeichnet.',
        },
        evidence: 'src/pages/product-entry-points/PhonebotStartPage.tsx',
      },
      {
        id: 'website-chat',
        name: 'Website-Chat',
        summary: 'Startseite für den Chat auf der eigenen Website. Die Bot-Laufzeit ist eine Vorschau.',
        status: 'vorschau',
        demo: true,
        href: '/chatbot/start',
        showcase: {
          kind: 'screenshot',
          src: '/marketing/v8/chatbot.png',
          alt: 'Öffentliche Startseite des Website-Chats, als Vorschau gekennzeichnet.',
        },
        evidence: 'src/pages/product-entry-points/ChatbotStartPage.tsx',
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp',
        summary: 'Im Preismodell als Modul und Add-on geführt. Keine angebundene WhatsApp-Laufzeit auf dieser Seite.',
        status: 'in-entwicklung',
        demo: false,
        showcase: { kind: 'none' },
        evidence: 'shared/pricing.ts#whatsapp',
      },
      {
        id: 'service-agents',
        name: 'Service, Vertrieb, Terminwunsch',
        summary:
          'Richtung: Anfrage, Kontakt und Terminwunsch aufnehmen und an einen Menschen übergeben. Kein durchgängiger Ablauf in dieser Vorschau.',
        status: 'in-entwicklung',
        demo: false,
        showcase: { kind: 'none' },
        evidence: 'docs/PRODUCT_PRIORITIZATION.md#K4',
      },
    ],
  },
  {
    letter: 'C',
    slug: 'creative-studio',
    name: 'AI Creative Studio',
    role: 'Inhalte',
    summary:
      'Text, Bild und Video sind noch kein Studio. Vorhanden ist eine Sprachdemo im Browser, die aus freigegebenen Unternehmensinfos antwortet.',
    features: [
      {
        id: 'browser-voice',
        name: 'Sprachdemo',
        summary:
          'Bestehende Demo-Komponente. Textantworten nur aus freigegebenen Infos. Die Mikrofon-Verbindung hängt von der Server-Konfiguration ab.',
        status: 'vorschau',
        demo: true,
        showcase: { kind: 'live', component: 'company-voice' },
        evidence: 'src/components/landing/v6/CompanyVoiceWidget.tsx',
      },
      {
        id: 'creative-text',
        name: 'Text',
        summary: 'Kein öffentliches Studio für freie Texterzeugung.',
        status: 'in-entwicklung',
        demo: false,
        showcase: { kind: 'none' },
        evidence: 'src/marketing/products/registry.ts',
      },
      {
        id: 'creative-image',
        name: 'Bild',
        summary: 'Keine Bildbearbeitung und keine Bilderzeugung als Produktfläche.',
        status: 'in-entwicklung',
        demo: false,
        showcase: { kind: 'none' },
        evidence: 'src/marketing/products/registry.ts',
      },
      {
        id: 'creative-video',
        name: 'Video',
        summary: 'Keine Videoerzeugung als Produktfläche.',
        status: 'in-entwicklung',
        demo: false,
        showcase: { kind: 'none' },
        evidence: 'src/marketing/products/registry.ts',
      },
    ],
  },
  {
    letter: 'D',
    slug: 'website-builder',
    name: 'AI Website & Business Builder',
    role: 'Auftritt',
    summary:
      'SiteOS baut Entwürfe nach Anmeldung. Öffentlich erreichbar ist der Anfrage-Funnel. Ein CRM gibt es nicht.',
    features: [
      {
        id: 'siteos',
        name: 'Website Builder',
        summary:
          'Studio unter /build nach Anmeldung und Freischaltung. Publish bleibt Vorschau. Die Abbildung zeigt den öffentlichen Funnel.',
        status: 'vorschau',
        demo: true,
        href: '/frontend-builder',
        showcase: {
          kind: 'screenshot',
          src: '/marketing/v8/frontend-builder.png',
          alt: 'Öffentlicher Frontend-Builder, Anfrage statt Selbst-Veröffentlichung.',
        },
        evidence: 'src/product/implementation-status.ts#web-builder',
      },
      {
        id: 'lead-form',
        name: 'Anfrageformular',
        summary: 'Kontaktformular der bestehenden Seite.',
        status: 'vorhanden',
        demo: false,
        href: '/kontakt',
        showcase: { kind: 'none' },
        evidence: 'src/pages/KontaktPage.tsx',
      },
      {
        id: 'crm',
        name: 'CRM',
        summary: 'Kein eigenes CRM. Der Begriff kommt nur als Anschluss-Option vor, nicht als Oberfläche.',
        status: 'in-entwicklung',
        demo: false,
        showcase: { kind: 'none' },
        evidence: 'src/features/api/components/ApiPurposeStep.tsx',
      },
    ],
  },
  {
    letter: 'E',
    slug: 'operations',
    name: 'AI Operations & Automation',
    role: 'Betrieb',
    summary:
      'Skills, Workflows und der Arbeitsbereich. Verbrauch und Kosten haben keine öffentliche Selbstbedienungsseite.',
    features: [
      {
        id: 'automations',
        name: 'Automatisierung',
        summary: 'Öffentliche Übersicht der Skills. Eine produktive Ausführung ist damit nicht zugesagt.',
        status: 'vorschau',
        demo: true,
        href: '/automations',
        showcase: {
          kind: 'screenshot',
          src: '/marketing/v8/automations.png',
          alt: 'Öffentliche Übersicht der Automatisierungs-Skills.',
        },
        evidence: 'src/pages/AutomationsLanding.tsx',
      },
      {
        id: 'agent-admin',
        name: 'Agentenverwaltung',
        summary: 'Command Center liegt hinter der Anmeldung und ist eine Vorschau, kein öffentliches Leitstand-Bild.',
        status: 'in-entwicklung',
        demo: false,
        href: '/welcome?next=/app/command-center',
        showcase: { kind: 'none' },
        evidence: 'src/product/implementation-status.ts#agent-registry-command-center',
      },
      {
        id: 'usage',
        name: 'Verbrauch und Kosten',
        summary: 'Kein öffentliches Verbrauchs-Dashboard auf dieser Landing.',
        status: 'in-entwicklung',
        demo: false,
        showcase: { kind: 'none' },
        evidence: 'src/features/command-center/monitoring.ts',
      },
      {
        id: 'workspace',
        name: 'Arbeitsbereich',
        summary: 'Dashboard, Rollen und Mandantentrennung nach Anmeldung. Der Einstieg ist die bestehende Willkommensseite.',
        status: 'vorhanden',
        demo: false,
        href: '/welcome?next=/app/dashboard',
        showcase: { kind: 'none' },
        evidence: 'src/product/implementation-status.ts#app-shell',
      },
    ],
  },
];

/** Genau diese drei Branchen. Keine Kundenzahlen. */
export const SOLUTIONS: readonly SolutionLink[] = [
  {
    id: 'handwerk',
    name: 'Handwerk',
    href: '/handwerk-website',
    summary: 'Bestehende Branchenseite. Der beschriebene Ablauf ist die Richtung, kein fertiger Lauf.',
  },
  {
    id: 'praxis',
    name: 'Praxis',
    href: '/fuer-praxen',
    summary: 'Bestehende Branchenseite für Praxen.',
  },
  {
    id: 'kanzlei',
    name: 'Kanzlei',
    href: '/kanzleien',
    summary: 'Bestehende Branchenseite für Kanzleien.',
  },
];

export function productBySlug(slug: string | undefined): ProductArea | undefined {
  return PRODUCT_AREAS.find((area) => area.slug === slug);
}

export function productPath(area: ProductArea): string {
  return `/v8/produkte/${area.slug}`;
}

export function primaryShowcase(area: ProductArea): MarketingFeature | undefined {
  return area.features.find((feature) => feature.showcase.kind !== 'none');
}

export function allFeatures(): MarketingFeature[] {
  return PRODUCT_AREAS.flatMap((area) => [...area.features]);
}
