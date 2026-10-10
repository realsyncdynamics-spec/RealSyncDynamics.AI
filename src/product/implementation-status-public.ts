/**
 * Customer-facing copy for the public landing roadmap (#roadmap on Landing v4).
 *
 * Internal `name` / `description` / `evidence` in implementation-status.ts stay
 * for registry, docs, and tests. Public markup must render ONLY these fields.
 */
import type { ImplementationItem, ImplementationStatus } from './implementation-status';

export type PublicLang = 'de' | 'en';

export interface PublicRoadmapCopy {
  name: string;
  description: string;
}

/** Honest status labels for the public landing (not internal PREVIEW chrome). */
export const PUBLIC_STATUS_LABEL: Record<
  PublicLang,
  Record<ImplementationStatus, string>
> = {
  de: {
    live: 'Live',
    preview: 'In Arbeit',
    'coming-soon': 'Geplant',
  },
  en: {
    live: 'Live',
    preview: 'In progress',
    'coming-soon': 'Planned',
  },
};

export const PUBLIC_ROADMAP_GROUP: Record<
  PublicLang,
  Record<ImplementationStatus, { title: string; eyebrow: string }>
> = {
  de: {
    live: { title: 'Live', eyebrow: 'ERREICHBAR HEUTE' },
    preview: { title: 'In Arbeit', eyebrow: 'TEILWEISE VERFÜGBAR' },
    'coming-soon': { title: 'Geplant', eyebrow: 'ALS NÄCHSTES' },
  },
  en: {
    live: { title: 'Live', eyebrow: 'AVAILABLE TODAY' },
    preview: { title: 'In progress', eyebrow: 'PARTIALLY AVAILABLE' },
    'coming-soon': { title: 'Planned', eyebrow: 'NEXT UP' },
  },
};

/**
 * Public roadmap strings keyed by implementation id.
 * Keep benefit-first; no component names, PR numbers, measurement dates,
 * person names, or process notes.
 */
export const PUBLIC_ROADMAP_COPY: Record<
  string,
  Record<PublicLang, PublicRoadmapCopy>
> = {
  'free-audit': {
    de: {
      name: 'Governance-Scan',
      description:
        'Kostenloser Website-Scan auf DSGVO- und Governance-Aspekte — mit klarem Befund zum Einstieg.',
    },
    en: {
      name: 'Governance scan',
      description:
        'Free website scan for GDPR and governance aspects — with a clear findings report to start.',
    },
  },
  'app-shell': {
    de: {
      name: 'Governance OS Workspace',
      description:
        'Geschützter Arbeitsbereich nach Login: Dashboard, Module und Nachweise an einem Ort.',
    },
    en: {
      name: 'Governance OS workspace',
      description:
        'Protected workspace after sign-in: dashboard, modules, and evidence in one place.',
    },
  },
  'command-center': {
    de: {
      name: 'Compliance Command Center',
      description:
        'Live: Mandantenlage, offene Findings und nächste Schritte im Command Center — Steuerung statt Statusfolie.',
    },
    en: {
      name: 'Compliance Command Center',
      description:
        'Live: tenant posture, open findings, and next steps in the Command Center — control, not a status slide.',
    },
  },
  'evidence-surfaces': {
    de: {
      name: 'Nachweis-Export',
      description:
        'Prüfungen und Entscheidungen als auditfähiger Export — für interne Kontrollen und externe Prüfer.',
    },
    en: {
      name: 'Evidence export',
      description:
        'Checks and decisions as an audit-ready export — for internal controls and external auditors.',
    },
  },
  'ai-act-classify': {
    de: {
      name: 'EU-AI-Act-Klassifizierung',
      description:
        'KI-Systeme öffentlich nach Annex III / Risikoklasse einordnen und Anforderungen ableiten.',
    },
    en: {
      name: 'EU AI Act classification',
      description:
        'Classify AI systems publicly by Annex III / risk class and derive the requirements.',
    },
  },
  'gdpr-audit-module': {
    de: {
      name: 'DSGVO- & Tracking-Audit',
      description:
        'Cookie- und Tracker-Scan mit Bericht.',
    },
    en: {
      name: 'GDPR & tracking audit',
      description: 'Cookie and tracker scan with report.',
    },
  },
  'governance-runtime-core': {
    de: {
      name: 'Governance Runtime',
      description:
        'Risiko, Vorfälle, Betroffenenanfragen, DSFA, Dienstleister und Freigaben in einer laufenden Kontrollschicht.',
    },
    en: {
      name: 'Governance Runtime',
      description:
        'Risk, incidents, data-subject requests, DPIA, vendors, and approvals in one running control layer.',
    },
  },
  'ai-gateway': {
    de: {
      name: 'AI Gateway',
      description:
        'Jeder Modellaufruf über eine kontrollierte Schicht mit Protokollierung und Kostenerfassung.',
    },
    en: {
      name: 'AI Gateway',
      description:
        'Every model call through a controlled layer with logging and cost tracking.',
    },
  },
  'policy-engine': {
    de: {
      name: 'Policy Engine',
      description:
        'Governance-Regeln nicht nur dokumentieren, sondern als ausführbare Kontrollen durchsetzen.',
    },
    en: {
      name: 'Policy Engine',
      description:
        'Not just document governance rules — enforce them as executable controls.',
    },
  },
  provenance: {
    de: {
      name: 'Herkunftsnachweis (C2PA)',
      description: 'Inhalte signieren und Herkunft überprüfbar machen.',
    },
    en: {
      name: 'Origin proof (C2PA)',
      description: 'Sign content and make origin verifiable.',
    },
  },
  'pricing-monthly': {
    de: {
      name: 'Monatspläne Starter / Growth / Agency',
      description: 'Self-Service-Monatspreise mit Checkout — jederzeit monatlich kündbar.',
    },
    en: {
      name: 'Monthly plans Starter / Growth / Agency',
      description: 'Self-service monthly prices with checkout — cancel month to month.',
    },
  },
  'governance-activation': {
    de: {
      name: 'Governance Activation',
      description:
        'Organisation und Scope aktivieren — nach dem Login geht es direkt im Workspace weiter.',
    },
    en: {
      name: 'Governance Activation',
      description:
        'Activate organisation and scope — after sign-in you continue straight in the workspace.',
    },
  },
  'ai-act-inventory-persist': {
    de: {
      name: 'EU-AI-Act-Inventar',
      description:
        'In Arbeit: Klassifikationen dauerhaft im Tenant-Inventar speichern — Oberfläche vorhanden, Speichern noch nicht freigeschaltet.',
    },
    en: {
      name: 'EU AI Act inventory',
      description:
        'In progress: persist classifications in the tenant inventory — UI exists, saving is not unlocked yet.',
    },
  },
  'channel-bots': {
    de: {
      name: 'Bot-Laufzeit — Chat, WhatsApp, Telefon',
      description:
        'In Arbeit: Bots anlegen und speichern geht; die produktive Laufzeit, die Nachrichten beantwortet, folgt.',
    },
    en: {
      name: 'Bot runtime — chat, WhatsApp, phone',
      description:
        'In progress: create and save bots today; the production runtime that answers messages is next.',
    },
  },
  'automation-n8n': {
    de: {
      name: 'Automationen',
      description:
        'In Arbeit: Automatisierungs-Katalog sichtbar; produktive Workflow-Ausführung noch nicht erreichbar.',
    },
    en: {
      name: 'Automations',
      description:
        'In progress: automation catalogue visible; productive workflow execution is not reachable yet.',
    },
  },
  'web-builder': {
    de: {
      name: 'DSGVO Web App Builder',
      description:
        'In Arbeit: Studio zum Bauen von Web-Apps — Erstellen planabhängig; öffentliches Deploy und Domain folgen.',
    },
    en: {
      name: 'GDPR web app builder',
      description:
        'In progress: studio to build web apps — create depends on plan; public deploy and domain follow.',
    },
  },
  'builder-entitlement-gate': {
    de: {
      name: 'Builder-Plan-Freischaltung',
      description:
        'In Arbeit: Studio prüft Plan-Rechte ehrlich — ohne Fake-Abo und ohne vorgetäuschte Freischaltung.',
    },
    en: {
      name: 'Builder plan unlock',
      description:
        'In progress: the studio checks plan rights honestly — no fake subscription, no pretend unlock.',
    },
  },
  'frontend-modernize-wizard': {
    de: {
      name: 'Frontend-Modernisierung',
      description:
        'In Arbeit: Bestehende Frontends modernisieren — für Enterprise-Pläne, schrittweise und mit Persistenz.',
    },
    en: {
      name: 'Frontend modernisation',
      description:
        'In progress: modernise existing frontends — for Enterprise plans, stepwise and with persistence.',
    },
  },
  'tenant-custom-domain': {
    de: {
      name: 'Eigene Domain am Dashboard',
      description:
        'In Arbeit: Domain am Workspace verwalten — automatische Bereitstellung folgt.',
    },
    en: {
      name: 'Custom domain on the dashboard',
      description:
        'In progress: manage a domain on the workspace — automated provisioning follows.',
    },
  },
  'agent-governance': {
    de: {
      name: 'Agent Governance',
      description:
        'In Arbeit: Anfragen steuern über Policy, Risiko, Freigabe und Nachweis — Kernpfad teilweise live.',
    },
    en: {
      name: 'Agent governance',
      description:
        'In progress: steer requests through policy, risk, approval, and evidence — core path partly live.',
    },
  },
  'agent-os-command-center': {
    de: {
      name: 'Agent OS — Intent & Steuerung',
      description:
        'In Arbeit: Intent-Steuerung für Agenten mit Review-Pflicht — noch nicht im Live-Dashboard verdrahtet.',
    },
    en: {
      name: 'Agent OS — intent & control',
      description:
        'In progress: intent control for agents with mandatory review — not wired into the live dashboard yet.',
    },
  },
  'agent-os-mesh-compliance': {
    de: {
      name: 'Agent OS — Compliance-Spezialist',
      description:
        'In Arbeit: Spezialisierter Compliance-Agent — Ausführung bleibt freigabepflichtig.',
    },
    en: {
      name: 'Agent OS — compliance specialist',
      description:
        'In progress: specialised compliance agent — execution stays approval-gated.',
    },
  },
  'agent-os-product-evolution': {
    de: {
      name: 'Agent OS — Produktintegrität',
      description:
        'In Arbeit: Read-only Integritätsblick auf Preise und Rechte — noch nicht im Live-Dashboard.',
    },
    en: {
      name: 'Agent OS — product integrity',
      description:
        'In progress: read-only integrity view of pricing and entitlements — not on the live dashboard yet.',
    },
  },
  'activation-blueprint': {
    de: {
      name: 'Auto-Blueprint',
      description: 'Geplant: Automatische Blueprint-Erzeugung bei der Activation.',
    },
    en: {
      name: 'Auto blueprint',
      description: 'Planned: automatic blueprint generation during activation.',
    },
  },
  'activation-doc-extract': {
    de: {
      name: 'Dokument-Extraktion',
      description: 'Geplant: Dokumente auslesen und für die Activation zuordnen.',
    },
    en: {
      name: 'Document extraction',
      description: 'Planned: extract documents and map them for activation.',
    },
  },
  'activation-expert-review': {
    de: {
      name: 'Experten-Review',
      description: 'Geplant: Warteschlange für menschliche Experten-Reviews.',
    },
    en: {
      name: 'Expert review',
      description: 'Planned: queue for human expert reviews.',
    },
  },
  'pricing-yearly': {
    de: {
      name: 'Jahresabrechnung',
      description: 'Geplant: Jahrespreise — derzeit nur Monatsabrechnung im Checkout.',
    },
    en: {
      name: 'Annual billing',
      description: 'Planned: annual prices — checkout is monthly-only today.',
    },
  },
  'continuous-domain-monitoring': {
    de: {
      name: 'Dauerhafte Domain-Überwachung',
      description:
        'Geplant: Domain nach dem Scan fortlaufend überwachen — öffentlicher Einstieg folgt.',
    },
    en: {
      name: 'Continuous domain monitoring',
      description:
        'Planned: keep monitoring a domain after the scan — public entry follows.',
    },
  },
  'framework-tisax-dora': {
    de: {
      name: 'TISAX- und DORA-Rahmenwerke',
      description:
        'Geplant: Eigene Rahmenwerke für TISAX und DORA — heute klar als Roadmap markiert, nicht als live.',
    },
    en: {
      name: 'TISAX and DORA frameworks',
      description:
        'Planned: dedicated TISAX and DORA frameworks — clearly marked as roadmap today, not live.',
    },
  },
  'agent-os-mesh-specialists': {
    de: {
      name: 'Agent OS — Spezialisten-Netz',
      description:
        'Geplant: Weitere Fach-Agenten (Produkt, Marketing, Security, …) — sichtbar im Roster, noch nicht ausführbar.',
    },
    en: {
      name: 'Agent OS — specialist mesh',
      description:
        'Planned: further specialist agents (product, marketing, security, …) — visible in the roster, not executable yet.',
    },
  },
  'agent-os-chrome-side-panel': {
    de: {
      name: 'Agent OS — Browser-Seitenleiste',
      description:
        'Geplant: Seite analysieren zu DSGVO, AI Act und Evidence — Spec vorhanden, keine Fake-Extension.',
    },
    en: {
      name: 'Agent OS — browser side panel',
      description:
        'Planned: analyse a page for GDPR, AI Act, and evidence — spec only, no fake extension.',
    },
  },
  'agent-os-hostinger-workers': {
    de: {
      name: 'Agent OS — Worker-Runtime',
      description: 'Geplant: Zusätzliche Worker-Runtime für Agenten-Aufgaben.',
    },
    en: {
      name: 'Agent OS — worker runtime',
      description: 'Planned: additional worker runtime for agent tasks.',
    },
  },
};

/**
 * Resolve customer-facing name + description for a public roadmap card.
 * Never falls back to internal `description` (may contain PRs, components, notes).
 *
 * Returns `undefined` when an item has no public copy yet — the landing then
 * simply omits that card (never throws during render). Missing copy for
 * roadmap-visible items is caught in CI by test/product/implementation-status.test.ts.
 */
export function getPublicRoadmapCopy(
  item: ImplementationItem,
  lang: PublicLang = 'de',
): PublicRoadmapCopy | undefined {
  const entry = PUBLIC_ROADMAP_COPY[item.id];
  if (!entry) return undefined;
  return entry[lang] ?? entry.de;
}

/**
 * Customer-safe routes shown under public roadmap cards.
 * Internal tooling paths (e.g. /claude-code-optimizer, /chatbot/start,
 * /app/siteos/…) stay off the public markup.
 */
export const PUBLIC_ROADMAP_ROUTE_ALLOWLIST = new Set([
  '/audit',
  '/pricing',
  '/#pricing',
  '/governance-runtime',
  '/ai-act-klassifikator',
  '/app',
  '/app/dashboard',
  '/app/evidence',
  '/app/activation',
  '/build',
  '/frontend-builder',
  '/agent-governance',
  '/policy-engine',
  '/evidence',
  '/evidence-vault',
  '/kontakt',
  '/contact-sales',
]);

/** Public route label for a roadmap card, or undefined when the route is internal. */
export function getPublicRoadmapRoute(item: ImplementationItem): string | undefined {
  const route = item.route;
  if (!route || !PUBLIC_ROADMAP_ROUTE_ALLOWLIST.has(route)) return undefined;
  return route === '/#pricing' ? '/pricing' : route;
}
