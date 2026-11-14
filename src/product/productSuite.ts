/**
 * Produkt-Suite — drei Produkte, eine Plattform (Build · Automate · Govern).
 *
 * Eine Quelle für Startseite, Produktseiten und die Capability-Matrix in
 * `docs/product/three-products/`. Der Status jeder Fähigkeit kommt, wo
 * möglich, aus `implementation-status.ts` (fail-closed: fehlt ein Eintrag,
 * gilt „NOT IMPLEMENTED“). Nur wo die Registry keinen Eintrag hat, steht der
 * Status hier explizit — immer mit Belegpfad.
 *
 * Diese Datei verspricht nichts Neues: Sie bündelt bestehende Routen, Backends
 * und Freischaltungen (`shared/pricing.ts`) zu drei Produkt-Einstiegen.
 * Preise stehen hier bewusst nicht — die Produktseiten zeigen Freischaltungen
 * aus `PLAN_ENTITLEMENTS` und verlinken für Beträge auf `/pricing`.
 */
import type { EntitlementKey } from '@/shared/pricing';
import { getImplementation, type ImplementationStatus } from './implementation-status';

export type ProductId = 'build' | 'automate' | 'govern';

/** LIVE | PREVIEW | BLOCKED | NOT IMPLEMENTED — Begriffe aus dem Auftrag. */
export type CapabilityStatus = 'live' | 'preview' | 'blocked' | 'not-implemented';

export const CAPABILITY_STATUS_LABEL: Record<CapabilityStatus, string> = {
  live: 'LIVE',
  preview: 'PREVIEW',
  blocked: 'BLOCKED',
  'not-implemented': 'NOT IMPLEMENTED',
};

export interface Capability {
  id: string;
  label: string;
  status: CapabilityStatus;
  /** Ehrliche Kurzbeschreibung des heutigen Stands. */
  note: string;
  /** Erreichbare Route (öffentlich oder App), falls vorhanden. */
  route?: string;
  /** Datei-, Funktions- oder Registry-Belege. */
  evidence: readonly string[];
}

export interface ProductLink {
  label: string;
  to: string;
}

export interface ProductDefinition {
  id: ProductId;
  /** Großbuchstaben-Verb für Hero und Karten. */
  verb: 'BUILD' | 'AUTOMATE' | 'GOVERN';
  name: string;
  /** Öffentliche Produktseite. */
  pageRoute: string;
  tagline: string;
  description: string;
  primaryCta: ProductLink;
  secondaryCta: ProductLink;
  /** Einstiege in vorhandene App-Oberflächen (nach Login). */
  appSurfaces: readonly ProductLink[];
  /** Freischaltungs-Keys aus `shared/pricing.ts`, die die Produktseite je Tarif zeigt. */
  entitlementKeys: readonly EntitlementKey[];
  capabilities: readonly Capability[];
}

const IMPL_TO_CAPABILITY: Record<ImplementationStatus, CapabilityStatus> = {
  live: 'live',
  preview: 'preview',
  'coming-soon': 'not-implemented',
};

/** Status aus der Registry übernehmen; fehlt der Eintrag → NOT IMPLEMENTED. */
function fromRegistry(implId: string): CapabilityStatus {
  const item = getImplementation(implId);
  return item ? IMPL_TO_CAPABILITY[item.status] : 'not-implemented';
}

function reg(
  implId: string,
  c: Omit<Capability, 'status' | 'evidence'> & { evidence?: readonly string[] },
): Capability {
  return {
    ...c,
    status: fromRegistry(implId),
    evidence: [`src/product/implementation-status.ts#${implId}`, ...(c.evidence ?? [])],
  };
}

/** Deep-Link in die App über den kanonischen Login-Einstieg (`?next=`). */
export function appDeepLink(path: string): string {
  return `/welcome?next=${encodeURIComponent(path)}`;
}

// ── BUILD ────────────────────────────────────────────────────────────────

const BUILD: ProductDefinition = {
  id: 'build',
  verb: 'BUILD',
  name: 'RealSync Build Studio',
  pageRoute: '/produkte/build-studio',
  tagline: 'Landingpages, Websites und Web-Apps mit KI-Unterstützung.',
  description:
    'Erstellen, modernisieren und verwalten Sie Landingpages, Websites und Web-Anwendungen mit KI-Unterstützung.',
  primaryCta: { label: 'Website erstellen', to: '/build' },
  secondaryCta: { label: 'Bestehende Website analysieren', to: '/audit?source=portal-build' },
  appSurfaces: [
    { label: 'Studio (Beschreibung → Vorschau)', to: '/build' },
    { label: 'Meine Websites', to: appDeepLink('/app/siteos') },
    { label: 'Website-Governance', to: appDeepLink('/app/websites') },
  ],
  entitlementKeys: ['siteos.builder', 'siteos.publish', 'limit.sites'],
  capabilities: [
    reg('web-builder', {
      id: 'build-studio',
      label: 'Studio-Einstieg: Projekt beschreiben, Vorschau erzeugen',
      note: 'Zwei-Bereich-Studio unter /build (App Builder + Frontend Designer); Anlage plan-gesteuert über limit.sites / siteos.builder.',
      route: '/build',
      evidence: ['src/unified-entry/pages/BuildStudioPage.tsx'],
    }),
    reg('web-builder', {
      id: 'build-visual-editor',
      label: 'Visueller Editor mit Seiten, Komponenten, Medien und Versionen',
      note: 'Puck-Workspace unter /builder/:slug: Seitenoperationen legen serverseitig geprüfte Versionen an, Medien-Tab, KI-Assistent, Publish-Gate-Bewertung je Version.',
      route: '/builder/:slug',
      evidence: [
        'src/features/siteos/workspace/AppBuilderWorkspacePage.tsx',
        'src/features/siteos/workspace/panels.tsx',
      ],
    }),
    reg('web-builder', {
      id: 'build-code-workbench',
      label: 'Engineering-Oberfläche (Dateien, Code, Vorschau)',
      note: 'Code-Workbench additiv unter /builder/:slug/code — dasselbe Projekt, kein zweites Backend.',
      route: '/builder/:slug/code',
      evidence: ['src/features/app-builder/BoltCodeBuilderPage.tsx'],
    }),
    reg('builder-entitlement-gate', {
      id: 'build-entitlements',
      label: 'Freischaltung siteos.builder · siteos.publish · limit.sites',
      note: 'Studio liest die Keys über useEntitlements; serverseitig prüft supabase/functions/siteos/site-entitlements.ts.',
      evidence: ['src/features/siteos/builderEntitlements.ts', 'supabase/functions/siteos/site-entitlements.ts'],
    }),
    reg('free-audit', {
      id: 'build-analyse',
      label: 'Bestehende Website analysieren',
      note: 'Öffentlicher Website-Scan unter /audit — derselbe Einstieg, den das Studio für URL-Analysen verlinkt.',
      route: '/audit',
    }),
    reg('frontend-modernize-wizard', {
      id: 'build-modernize',
      label: 'Redesign bestehender Websites (Modernisierungs-Assistent)',
      note: 'FmtModernizeWizard unter /app/siteos/modernize, nur mit Entitlement frontend.modernization (Enterprise).',
      route: '/app/siteos/modernize',
    }),
    {
      id: 'build-publish',
      label: 'Veröffentlichung in die Vorschau-Umgebung nach Freigabe',
      status: 'preview',
      note: 'Publish Controller: Gate → Cloudflare-Vorschau; Produktion nur mit Owner/Admin-GO. Kein Self-Service-Livegang.',
      evidence: ['src/product/implementation-status.ts#web-builder', 'supabase/functions/siteos'],
    },
    reg('tenant-custom-domain', {
      id: 'build-domain',
      label: 'Eigene Domain zuordnen (DNS-Automatik und Rollback fehlen)',
      note: 'Domain-Zuordnung im Dashboard als Preview; DNS-Automatik und Rollback fehlen laut Registry (web-builder).',
      route: '/app/websites',
    }),
    reg('public-frontend-builder', {
      id: 'build-custom-design',
      label: 'Individuelles Webdesign auf Anfrage',
      note: 'Anfrage-Assistent unter /frontend-builder, sendet an sales-lead — kein Self-Service-Deploy.',
      route: '/frontend-builder',
    }),
    {
      id: 'build-chatbot-embed',
      label: 'Website-Chatbot direkt im Builder-Projekt aktivieren',
      status: 'not-implemented',
      note: 'Bots und Builder-Projekte sind getrennte Objekte; eine Projekt-Verknüpfung im Builder-Integrations-Tab ist nicht nachgewiesen. Integrationsanforderung.',
      evidence: ['src/features/siteos/workspace/panels.tsx#integrations', 'src/features/bots/BotsView.tsx'],
    },
  ],
};

// ── AUTOMATE ─────────────────────────────────────────────────────────────

const AUTOMATE: ProductDefinition = {
  id: 'automate',
  verb: 'AUTOMATE',
  name: 'RealSync Agent Studio',
  pageRoute: '/produkte/agent-studio',
  tagline: 'KI-Assistenten für Website, WhatsApp und Telefon.',
  description:
    'KI-Assistenten für Website, WhatsApp und Telefon. Automatisieren Sie Kundenanfragen, Terminwünsche und Geschäftsprozesse.',
  primaryCta: { label: 'KI-Agent erstellen', to: '/chatbot/start' },
  secondaryCta: { label: 'Agent Studio entdecken', to: '/produkte/agent-studio' },
  appSurfaces: [
    { label: 'Meine Agenten', to: appDeepLink('/app/bots') },
    { label: 'Anfragen-Posteingang', to: appDeepLink('/app/bots/inbox') },
    { label: 'WhatsApp-Kanäle', to: appDeepLink('/app/bots/whatsapp') },
    { label: 'Sprach-Sessions', to: appDeepLink('/app/voice') },
    { label: 'Workflows', to: appDeepLink('/app/automations') },
  ],
  entitlementKeys: [
    'bots.enabled',
    'limit.bots',
    'limit.bot_messages_monthly',
    'bots.whatsapp',
    'bots.voice',
    'limit.bot_voice_minutes_monthly',
  ],
  capabilities: [
    reg('channel-bots', {
      id: 'automate-web-chat',
      label: 'Website-Chatbot: Persona, Wissensbasis, Gesprächsregeln',
      note: 'Bot-Builder unter /app/bots/:botId; Antworten über Edge Function bot-chat mit Budget-Reservierung. Provider-Laufzeit als Preview gekennzeichnet.',
      route: '/app/bots',
      evidence: ['src/features/bots/BotsView.tsx', 'src/features/bots/BotBuilderView.tsx', 'supabase/functions/bot-chat'],
    }),
    reg('channel-bots', {
      id: 'automate-inbox',
      label: 'Anfragen-Posteingang (Leads, Kontakt, Terminwunsch)',
      note: 'Posteingang unter /app/bots/inbox. Terminwünsche werden erfasst, nicht automatisch gebucht.',
      route: '/app/bots/inbox',
      evidence: ['src/features/bots/BotInboxView.tsx'],
    }),
    {
      id: 'automate-handoff',
      label: 'Übergabe an einen Menschen (Human Handoff)',
      status: 'not-implemented',
      note: 'Entitlement bots.human_handoff existiert, die Bot-Oberflächen enthalten aber keinen Übergabe-Ablauf; Modul human_handoff steht auf Roadmap.',
      evidence: ['shared/pricing.ts#ENGAGE_MODULES.human_handoff', 'docs/PRODUCT_PRIORITIZATION.md#K4 (PR C)'],
    },
    reg('channel-bots', {
      id: 'automate-whatsapp-config',
      label: 'WhatsApp-Kanal konfigurieren',
      note: 'Kanalverwaltung unter /app/bots/whatsapp, eingehende Nachrichten über whatsapp-webhook (Signaturprüfung fail-closed).',
      route: '/app/bots/whatsapp',
      evidence: ['src/features/bots/WhatsAppChannelsView.tsx', 'supabase/functions/whatsapp-webhook'],
    }),
    {
      id: 'automate-whatsapp-prod',
      label: 'WhatsApp-Produktivbetrieb (verifizierte Business-Nummer)',
      status: 'blocked',
      note: 'Meta-Business-Verifizierung, Rufnummer und Webhook-Registrierung sind aus dem Repository nicht nachweisbar. Ohne diesen Nachweis kein Live-Kanal.',
      evidence: ['supabase/functions/whatsapp-webhook'],
    },
    reg('voice-agent-onboarding', {
      id: 'automate-voice-config',
      label: 'Telefonagent konfigurieren (Branche, Begrüßung, Stimme, Freigaben)',
      note: 'Branchen-Onboarding auf voice.realsyncdynamicsai.de erzeugt einen Konfigurationsdatensatz; kein Checkout, keine Telefonie.',
      evidence: ['https://voice.realsyncdynamicsai.de/onboarding.html', 'src/pages/product-entry-points/PhonebotStartPage.tsx'],
    }),
    {
      id: 'automate-voice-runtime',
      label: 'Telefonie: echte Anrufe, persistente Voice-Sessions',
      status: 'blocked',
      note: 'Code für apps/agent-runtime und bot-voice-webhook liegt vor; Deploy-Pfad fehlgeschlagen und keine produktiv angebundene Rufnummer. /app/voice zeigt nur eine Session-Liste.',
      route: '/app/voice',
      evidence: [
        'src/product/implementation-status.ts#voice-telephony',
        'apps/agent-runtime/README.md',
        '.github/workflows/deploy-agent-runtime-vps.yml',
        'supabase/functions/bot-voice-webhook',
      ],
    },
    reg('automation-n8n', {
      id: 'automate-workflows',
      label: 'Workflows und Automationen',
      note: 'Skill-Katalog und automation-trigger/-callback vorhanden; Runtime-Host nicht erreichbar, keine produktive Ausführung.',
      route: '/app/automations',
    }),
    {
      id: 'automate-templates',
      label: 'Branchenvorlagen (Handwerk, Praxis, Hotel, Kanzlei …)',
      status: 'preview',
      note: 'Branchenwahl im Voice-Onboarding; für Chat- und WhatsApp-Bots ist keine Vorlagenbibliothek nachgewiesen. Vorlagen enthalten keine medizinische oder rechtliche Fachberatung.',
      evidence: ['https://voice.realsyncdynamicsai.de/onboarding.html', 'src/pages/Branchen.tsx'],
    },
    {
      id: 'automate-quality-lab',
      label: 'Qualitätslabor (Testgespräche, Bewertung)',
      status: 'not-implemented',
      note: 'Keine Oberfläche im Repository. Integrationsanforderung.',
      evidence: [],
    },
  ],
};

// ── GOVERN ───────────────────────────────────────────────────────────────

const GOVERN: ProductDefinition = {
  id: 'govern',
  verb: 'GOVERN',
  name: 'RealSync Governance OS',
  pageRoute: '/produkte/governance-os',
  tagline: 'KI- und Datenschutzrisiken erkennen, bewerten und kontrollieren.',
  description:
    'Erkennen, bewerten und kontrollieren Sie KI- und Datenschutzrisiken durch Governance, laufende Prüfungen und dokumentierte Nachweise.',
  primaryCta: { label: 'Kostenlosen Governance-Check starten', to: '/audit?source=portal-govern' },
  secondaryCta: { label: 'Governance OS entdecken', to: '/produkte/governance-os' },
  appSurfaces: [
    { label: 'Command Center', to: appDeepLink('/app/dashboard') },
    { label: 'KI-Register', to: appDeepLink('/app/ai-systems') },
    { label: 'Risiken', to: appDeepLink('/app/risks') },
    { label: 'Policy Packs', to: appDeepLink('/app/policy-packs') },
    { label: 'Freigaben', to: appDeepLink('/app/governance/gates') },
    { label: 'Evidence', to: appDeepLink('/app/evidence') },
  ],
  entitlementKeys: [
    'dashboard.access',
    'governance.ai_register',
    'governance.risk_register',
    'evidence.basic_vault',
    'evidence.advanced',
    'limit.domains',
  ],
  capabilities: [
    reg('free-audit', {
      id: 'govern-scan',
      label: 'Discover & Scan: Website- und Tracking-Analyse',
      note: 'Kostenloser Governance-Scan unter /audit. Ein Scan ist keine Rechtszertifizierung.',
      route: '/audit',
    }),
    reg('ai-system-registry', {
      id: 'govern-ai-register',
      label: 'KI-Systeminventar',
      note: 'KI-Register unter /app/ai-systems.',
      route: '/app/ai-systems',
    }),
    reg('ai-act-classify', {
      id: 'govern-ai-act',
      label: 'EU-AI-Act-Klassifizierung',
      note: 'Klassifikator öffentlich erreichbar; die rechtliche Bewertung bleibt beim Kunden bzw. Fachpersonen.',
      route: '/ai-act-klassifikator',
    }),
    reg('policy-engine', {
      id: 'govern-policy',
      label: 'Policy Engine mit serverseitigem Enforcement',
      note: 'Bestehende Runtime — keine parallele Policy Engine.',
      route: '/policy-engine',
    }),
    {
      id: 'govern-approvals',
      label: 'Freigabeentscheidungen (Approval Gates)',
      status: 'preview',
      note: 'Oberfläche /app/governance/gates und Edge Function governance-approvals vorhanden; nicht in der Registry gemessen, daher Preview.',
      route: '/app/governance/gates',
      evidence: ['src/features/governance/ApprovalGatesView.tsx', 'supabase/functions/governance-approvals'],
    },
    reg('evidence-surfaces', {
      id: 'govern-evidence',
      label: 'Evidence: Ereignisprotokolle, Hash-Kette, Export',
      note: 'Nachweis-Export unter /app/evidence; Integritätsprüfung unter /app/governance/evidence.',
      route: '/app/evidence',
      evidence: ['src/features/governance/EvidenceIntegrityView.tsx', 'supabase/functions/evidence-export'],
    }),
    reg('command-center', {
      id: 'govern-command-center',
      label: 'Command Center: gemeinsame Governance-Übersicht',
      note: 'Dashboard unter /app/dashboard — gemeinsamer Einstieg für alle drei Produkte.',
      route: '/app/dashboard',
    }),
    reg('continuous-domain-monitoring', {
      id: 'govern-monitoring',
      label: 'Laufende Prüfungen und Drift-Erkennung',
      note: 'Dauerhafte Domain-Überwachung und tägliches Drift-Monitoring stehen auf der Roadmap.',
      route: '/app/monitoring',
    }),
    reg('agent-governance', {
      id: 'govern-agents',
      label: 'Governance für Agenten (Build- und Agent-Studio-Ereignisse)',
      note: 'Agent Governance als Preview; Builder-Publish nutzt bereits das Publish Gate.',
      route: '/agent-governance',
    }),
  ],
};

export const PRODUCTS: readonly ProductDefinition[] = [BUILD, AUTOMATE, GOVERN];

export function productById(id: ProductId): ProductDefinition {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`Unbekanntes Produkt: ${id}`);
  return p;
}

/**
 * Produktübergreifende Verbindungen (BUILD → AUTOMATE → GOVERN → APPROVE →
 * DEPLOY → MONITOR → EVIDENCE). Ehrlich je Schritt.
 */
export const PLATFORM_FLOW: readonly (Capability & { step: string })[] = [
  {
    step: 'BUILD',
    id: 'flow-build',
    label: 'Website im Build Studio anlegen',
    status: fromRegistry('web-builder'),
    note: 'Studio /build, Projekt im Mandanten gespeichert.',
    route: '/build',
    evidence: ['src/product/implementation-status.ts#web-builder'],
  },
  {
    step: 'AUTOMATE',
    id: 'flow-automate',
    label: 'Chatbot, WhatsApp- oder Telefonagent hinzufügen',
    status: fromRegistry('channel-bots'),
    note: 'Bots im selben Mandanten; Telefonie und WhatsApp-Produktivbetrieb blockiert (siehe Agent Studio).',
    route: '/app/bots',
    evidence: ['src/product/implementation-status.ts#channel-bots'],
  },
  {
    step: 'GOVERN',
    id: 'flow-govern',
    label: 'Datenschutz- und Governance-Prüfung',
    status: fromRegistry('governance-runtime-core'),
    note: 'Bestehende Governance Runtime; Publish Gate bewertet Builder-Versionen.',
    route: '/app/dashboard',
    evidence: ['src/product/implementation-status.ts#governance-runtime-core'],
  },
  {
    step: 'APPROVE',
    id: 'flow-approve',
    label: 'Freigabe durch berechtigte Person',
    status: 'preview',
    note: 'Approval Gates vorhanden; Produktion des Builders nur mit Owner/Admin-GO.',
    route: '/app/governance/gates',
    evidence: ['src/features/governance/ApprovalGatesView.tsx'],
  },
  {
    step: 'DEPLOY',
    id: 'flow-deploy',
    label: 'Website und Agenten aktivieren',
    status: 'blocked',
    note: 'Website: Cloudflare-Vorschau, eigene Domain/DNS/Rollback fehlen. Agenten: Telefonie-Deploy fehlgeschlagen, WhatsApp-Verifizierung nicht nachgewiesen.',
    evidence: ['src/product/implementation-status.ts#web-builder', 'src/product/implementation-status.ts#voice-telephony'],
  },
  {
    step: 'MONITOR',
    id: 'flow-monitor',
    label: 'Laufende Überwachung',
    status: fromRegistry('continuous-domain-monitoring'),
    note: 'Dauerhafte Überwachung auf der Roadmap; Einzelscans sind live.',
    route: '/app/monitoring',
    evidence: ['src/product/implementation-status.ts#continuous-domain-monitoring'],
  },
  {
    step: 'EVIDENCE',
    id: 'flow-evidence',
    label: 'Nachweise im gemeinsamen Dashboard',
    status: fromRegistry('evidence-surfaces'),
    note: 'Evidence-Export und Integritätsprüfung im selben Mandanten.',
    route: '/app/evidence',
    evidence: ['src/product/implementation-status.ts#evidence-surfaces'],
  },
];
