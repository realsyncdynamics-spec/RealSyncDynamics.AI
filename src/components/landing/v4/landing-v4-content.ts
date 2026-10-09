import { PRICING_TAX_NOTE, checkoutHrefForPlan, formatLimit, planById } from '@/shared/pricing';
import { IS_STRIPE_TEST_MODE } from '../../../config/stripeMode';

/**
 * Landing v4 „Klassisch" — Inhalte 1:1 aus der Design-Referenz
 * (`The Governance AI v4.html`, Datenblöcke Z. 1215–1670). Der Wortlaut
 * stammt aus runtimeVocab.ts, shared/pricing.ts, platform-capabilities.ts und
 * LandingChannelTools.tsx (Stand Handoff) und wird hier bewusst eingefroren,
 * damit die Design-Route deckungsgleich mit der Referenz bleibt.
 *
 * Ausnahme: die öffentliche #roadmap-Sektion liest Status/Route aus
 * `src/product/implementation-status.ts` und kundenorientierte Texte aus
 * `implementation-status-public.ts` (keine parallele Claim-Liste, keine internen Details).
 */

/** Ziel-Routen der Referenz (`wire()`-Tabelle) — relativ, damit .ai und .de funktionieren. */
export const V4_ROUTES = {
  audit: '/audit',
  /** Öffentliche Runtime-Seite (kein Demo-Tour) — wie Landing v2 nach #1744. */
  runtime: '/governance-runtime',
  login: '/login',
  pricing: '/pricing',
  contactSales: '/contact-sales',
  kontakt: '/kontakt',
  roadmap: '/roadmap',
  impressum: '/impressum',
  agb: '/agb',
  datenschutz: '/datenschutz',
  widerruf: '/widerruf',
} as const;

/** Referenz-Hash → App-Route für „Mehr erfahren"-Karten (`MAP` in der Referenz). */
const CAPABILITY_ROUTE: Record<string, string> = {
  '/ai-act-klassifikator': '/ai-act-klassifikator',
  '/evidence-vault': '/evidence',
  '/policy-engine': '/runtime',
};

export type V4Status = 'live' | 'preview' | 'next';

/**
 * Status-Semantik der Referenz (`tag()`): LIVE → live · PREVIEW / IN ARBEIT /
 * IN PROGRESS / IN ENTWICKLUNG / EMPFOHLEN → preview · COMING / NEXT / GEPLANT /
 * PLANNED → next.
 */
export function statusOf(label: string): V4Status | undefined {
  const t = label.trim().toUpperCase();
  if (t === 'LIVE') return 'live';
  if (/^(PREVIEW|IN ARBEIT|IN PROGRESS|IN ENTWICKLUNG|EMPFOHLEN)/.test(t)) return 'preview';
  if (/^(COMING|NEXT|GEPLANT|PLANNED)/.test(t)) return 'next';
  return undefined;
}

export const HUD_ORBITS = [
  { rx: 470, ry: 180, rot: -18 },
  { rx: 430, ry: 330, rot: 22 },
  { rx: 490, ry: 420, rot: -6 },
] as const;

export const HERO_PROOF = ['EVIDENCE-CHAIN', 'AI-ACT-KLASSIFIKATION', 'PROVENANCE · C2PA'] as const;

export const HERO_KPIS = [
  ['6', 'POLICY PACKS'],
  ['EU', 'DATENRESIDENZ'],
  ['LAUFEND', 'NACHWEISFÜHRUNG'],
] as const;

export const HERO_FRAMEWORKS: ReadonlyArray<readonly [string, boolean]> = [
  ['DSGVO', false],
  ['EU AI ACT', false],
  ['ISO 27001', false],
  ['NIS2', false],
  ['TISAX', true],
  ['DORA', true],
];

export const LOOP_NODES = [
  ['01 · DETECT', 'Discover', 'Headers, Cookies, Tracker, AI-Endpoints und Third-Parties in Sekunden inventarisiert.'],
  ['02 · GOVERN', 'Classify', 'Findings nach DSGVO-Artikel und AI-Act-Risikoklasse eingeordnet, ins Register überführt.'],
  ['03 · AUTOMATE', 'Enforce', 'Policies als ausführbare Kontrollen — Agenten schlagen Fixes vor, Freigaben bleiben beim Menschen.'],
  ['04 · MONITOR', 'Prove', 'Jeder Lauf in der Evidence-Chain versiegelt; Drift wird in Echtzeit erkannt und dokumentiert.'],
] as const;

export const ANCHORS = [
  ['DSGVO Art. 5', 'Grundsätze der Verarbeitung'], ['DSGVO Art. 6', 'Rechtmäßigkeit'], ['DSGVO Art. 28', 'Auftragsverarbeiter'],
  ['DSGVO Art. 30', 'Verzeichnis (VVT)'], ['DSGVO Art. 35', 'DSFA'], ['TTDSG §25', 'Endeinrichtungen · Consent'],
  ['AI Act Art. 6', 'Hochrisiko-Einstufung'], ['AI Act Art. 9', 'Risikomanagement'], ['AI Act Art. 13', 'Transparenz'],
  ['AI Act Art. 50', 'Kennzeichnungspflicht'], ['AI Act Annex III', 'Hochrisiko-Bereiche'], ['ISO 27001 A.5', 'Organisatorische Kontrollen'],
  ['ISO 27001 A.8', 'Technologische Kontrollen'], ['NIS2 Art. 21', 'Risikomanagementmaßnahmen'], ['C2PA 2.x', 'Content Credentials'],
] as const;

// ---- 01 Workspace: Dashboard-Vorschau (governanceModules.ts) ----
export const APP_NAV: ReadonlyArray<readonly [string, string, boolean]> = [
  ['Übersicht', '', true], ['Workspace', '', false], ['Module', '', false],
  ['Activation', 'BETA', false], ['Websites', '', false], ['Evidence', '', false],
  ['KI-Systeme', 'BETA', false], ['Risiken', 'BETA', false], ['Monitoring', 'BETA', false],
  ['Berichte', 'BETA', false], ['Policy Packs', '', false], ['Audit Center', '', false],
  ['Agents', '', false], ['Maßnahmen', 'ROADMAP', false], ['Einstellungen', '', false],
];

/** [Wert, Suffix (kursiv klein), Label] */
export const APP_TILES = [
  ['78', '/100', 'GOVERNANCE SCORE'],
  ['12', '', 'OFFENE FINDINGS'],
  ['1.284', '', 'EVIDENCE-EINTRÄGE'],
  ['3', '', 'KI-SYSTEME IM REGISTER'],
] as const;

export const APP_FRAMEWORKS = [
  ['DSGVO', 82, '82 %'], ['EU AI ACT', 64, '64 %'], ['ISO 27001', 55, '55 %'],
  ['NIS2', 28, '28 %'], ['TISAX', 0, 'NEXT'], ['DORA', 0, 'NEXT'],
] as const;

export const APP_FINDINGS = [
  ['HOCH', 'sev-high', 'Tracker vor Einwilligung geladen', 'Art. 6 · TTDSG §25'],
  ['HOCH', 'sev-high', 'KI-Endpoint ohne Transparenzhinweis', 'AI Act Art. 50'],
  ['MITTEL', 'sev-mid', 'Auftragsverarbeiter ohne AVV-Nachweis', 'Art. 28'],
  ['MITTEL', 'sev-mid', 'Drift: neuer Third-Party-Request', 'Runtime · Deploy'],
  ['NIEDRIG', 'sev-low', 'Security-Header unvollständig', 'ISO 27001 A.8'],
] as const;

/** Evidence-Ledger: die ersten vier Knoten aus NODES der Referenz. */
export const LEDGER_NODES = [
  ['BERLIN', 'AI Act Registry'],
  ['BRÜSSEL', 'Risk Classification'],
  ['FRANKFURT', 'EU Runtime · eu-central'],
  ['STOCKHOLM', 'Evidence Node'],
] as const;

export const INTENT_CHIPS = ['AI-Act-Klassifikation prüfen', '§13-Update draften', 'Evidence exportieren', 'Drift erklären'] as const;

// ---- 02 Tools (LandingChannelTools.tsx) ----
export const TOOLS = [
  ['AUTOMATION · WHATSAPP', 'WhatsApp Bot', 'WhatsApp-Kundenkommunikation über den echten Bot-Builder — mit Persona, Wissensbasis, Termin- und Anfrageprozessen sowie Governance und Evidence.'],
  ['VOICE · GOVERNANCE', 'Telefonbot', 'KI-Telefonassistenz über den bestehenden Bot-Builder — mit Voice-Kanal, Human Handoff, Terminannahme, Policy Enforcement und auditierbaren Gesprächen.'],
  ['AI · WEBSITE', 'DSGVO Web App Builder', 'Website zuerst prüfen, DSGVO- und Governance-Befund erfassen und anschließend in den bestehenden Web-App-Transformation-Flow übergeben.'],
  ['ENGINEERING · GOVERNANCE', 'Claude Code Optimizer', 'Repository auf DSGVO- und EU-AI-Act-Risiken prüfen, konkrete Fixes erzeugen und Prüfungen als Evidence in den Entwicklungsworkflow integrieren.'],
] as const;

// ---- 03 Plattform (platform-capabilities.ts, Messung 2026-08-17) ----
const LIVE_CAPS_RAW = [
  ['DSGVO- & Tracking-Audit', 'Website-Scan auf Cookies, Tracker, Drittanbieter und Einwilligungspflicht — mit Bericht als PDF.', ''],
  ['EU-AI-Act-Klassifizierung', 'KI-Systeme öffentlich nach Annex III / Risikoklasse einordnen und Anforderungen ableiten — über den Klassifikator, ohne Speichern ins Inventar.', '/ai-act-klassifikator'],
  ['Governance Runtime', 'Risikobewertung, Vorfälle, Betroffenenanfragen, DSFA, Dienstleister und Freigaben in einer laufenden Kontrollschicht.', ''],
  ['Nachweis-Export', 'Prüfungen, Entscheidungen und Änderungen als auditfähigen Export — für interne Kontrollen und externe Prüfer.', ''],
  ['AI Gateway', 'Jeder Modellaufruf läuft über eine kontrollierte Schicht mit Protokollierung, Kostenerfassung und EU-Option.', ''],
  ['Evidence Vault', 'Hash-verkettete Nachweiskette mit Aufbewahrung, Compliance-Hold und Integritätsprüfung.', '/evidence-vault'],
  ['Policy Engine', 'Governance-Regeln nicht nur dokumentieren, sondern als ausführbare Kontrolllogik durchsetzen.', '/policy-engine'],
] as const;

export const LIVE_CAPS = LIVE_CAPS_RAW.map(([name, desc, more]) => ({
  name,
  desc,
  route: more ? CAPABILITY_ROUTE[more] : undefined,
}));

export const BUILDING_CAPS = [
  ['Bot-Laufzeit — Chat, WhatsApp, Telefon', 'Kundenkommunikation über Chat und Sprache auf derselben Governance-Ebene — mit Prüfpfad je Gespräch.', 'Bots lassen sich anlegen und speichern; die Laufzeit, die Nachrichten beantwortet, ist noch nicht in Produktion.'],
] as const;
export const GOV_STEPS = [
  ['01', 'DISCOVER', 'KI-Systeme, Anwendungen, Datenflüsse und relevante Verarbeitungsvorgänge erfassen.'],
  ['02', 'ASSESS', 'Risiken bewerten und Systeme gegen Governance-, DSGVO- und EU-AI-Act-Kriterien prüfen.'],
  ['03', 'GOVERN', 'Verbindliche Policies, Verantwortlichkeiten und Kontrollanforderungen zentral definieren.'],
  ['04', 'ENFORCE', 'Governance-Regeln operativ durchsetzen und Abweichungen kontrolliert behandeln.'],
  ['05', 'EVIDENCE', 'Prüfungen, Entscheidungen, Änderungen und Kontrollen nachvollziehbar dokumentieren.'],
  ['06', 'AUDIT', 'Eine konsistente Governance-Historie für Management, interne Kontrollen und Audits bereitstellen.'],
] as const;

// ---- 04 Evidence & Trust (MainLanding.tsx TrustItem) — Lucide-Pfade wie in der Referenz ----
export type TrustIcon = 'shield' | 'lock' | 'file' | 'code';

export const TRUST: ReadonlyArray<readonly [TrustIcon, string, string]> = [
  ['shield', 'DSGVO', 'Verarbeitung, Risiko, Policy und Nachweis im laufenden Governance-Prozess.'],
  ['lock', 'EU AI Act', 'Risikoklassifikation, Transparenz und Dokumentation für KI-Systeme.'],
  ['file', 'Nachweis-Export', 'Prüfungen und Entscheidungen als auditfähiger Export — für interne Kontrollen und externe Prüfer.'],
  ['code', 'Code Compliance', 'Claude Code prüft und unterstützt konkrete technische Remediation.'],
];

// ---- 05 Tarife (shared/pricing.ts) ----
const V4_PLAN_IDS = ['starter', 'growth', 'agency'] as const;

export const PLANS = V4_PLAN_IDS.map((id) => {
  const plan = planById(id);
  return {
    id: plan.id,
    name: plan.name.toUpperCase(),
    displayName: plan.name,
    price: String(plan.price.monthlyEur),
    badge: plan.badges[0]?.toUpperCase() ?? '',
    featured: plan.highlight,
    tagline: plan.outcomeHeadline,
    cta: plan.ctaLabel,
    href: checkoutHrefForPlan(plan, { source: 'landing-v4' }),
    l: plan.features.audit_evidence.slice(0, 4),
  };
});

export const V4_PRICING_TAX_NOTE = PRICING_TAX_NOTE;

// ---- Beta-Testversion (Wortlaut aus config/pricing.ts, eine Quelle für alle Kaufpfade) ----
export { BETA_LABEL as V4_BETA_LABEL, BETA_CHECKOUT_NOTICE as V4_BETA_NOTICE } from '../../../config/pricing';

/** Kurzform für den Hero — Details stehen an den Kauf-CTAs (#pricing, /pricing, Checkout). */
export const V4_BETA_HERO_NOTE = IS_STRIPE_TEST_MODE
  ? 'Beta-Testversion · Zahlungen im Stripe-Testmodus, es wird nichts belastet · Paket-Freischaltungen im Dashboard werden noch verifiziert'
  : 'Beta-Testversion · Paket-Freischaltungen im Dashboard werden noch verifiziert';

// ---- 06 Roadmap ----
// Frozen handoff list removed: V4Roadmap renders from
// src/product/implementation-status.ts (ROADMAP_*_ITEMS). Do not reintroduce
// a parallel claim list here.

export const ROADMAP_FILTERS = [
  ['ALLE', ''],
  ['LIVE', 'LIVE'],
  ['IN PREVIEW', 'IN PREVIEW'],
  ['NEXT', 'NEXT'],
] as const;

// ---- 07 Enterprise ----
const ENTERPRISE_PLAN = planById('enterprise');

export const ENTERPRISE_LEDE = ENTERPRISE_PLAN.technicalSubheadline;

export const ENTERPRISE_TILES = [
  [
    'Identität & Zugriff',
    `Single Sign-On, zentrale Rechteverwaltung, ${formatLimit(ENTERPRISE_PLAN.limits.tenants)} Organisationen und ${formatLimit(ENTERPRISE_PLAN.limits.seats)} Benutzerplätze.`,
    'SSO · RBAC',
  ],
  [
    'Aktive Policy Packs + Roadmap',
    'Registry-live: DSGVO- & Tracking-Audit und EU-AI-Act-Klassifizierung. ISO 27001, NIS2, TISAX und DORA: nicht als live im Product-Registry geführt — Roadmap / auf Anfrage.',
    'POLICY ENGINE · CONTROLS',
  ],
  [
    'Evidence & Audit',
    `Evidence Vault mit ${formatLimit(ENTERPRISE_PLAN.limits.evidenceStorageGb)} GB Nachweisspeicher und bis zu ${formatLimit(ENTERPRISE_PLAN.limits.auditReportsPerMonth)} Audit-Berichten pro Monat.`,
    `${formatLimit(ENTERPRISE_PLAN.limits.evidenceStorageGb)} GB · ${formatLimit(ENTERPRISE_PLAN.limits.auditReportsPerMonth)} REPORTS / MONAT`,
  ],
  [
    'Betrieb & Support',
    `API mit ${formatLimit(ENTERPRISE_PLAN.limits.apiCallsPerMonth)} Aufrufen pro Monat, dedizierter Ansprechpartner und White-Label-Berichte. SLA nach Vereinbarung.`,
    'API · SLA NACH VEREINBARUNG · WHITE-LABEL',
  ],
] as const;

export const CLOSING_PILLS = ['DSGVO', 'EU AI ACT', 'POLICY PACKS', 'EVIDENCE VAULT', 'CLAUDE CODE', 'NACHWEIS-EXPORT'] as const;
