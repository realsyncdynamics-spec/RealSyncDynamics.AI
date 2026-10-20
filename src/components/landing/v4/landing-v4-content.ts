import { PRICING_TAX_NOTE, checkoutHrefForPlan, formatLimit, planById } from '@/shared/pricing';

/**
 * Landing v4 „Klassisch" — Inhalte 1:1 aus der Design-Referenz
 * (`The Governance AI v4.html`, Datenblöcke Z. 1215–1670). Der Wortlaut
 * stammt aus runtimeVocab.ts, shared/pricing.ts, platform-capabilities.ts und
 * LandingChannelTools.tsx (Stand Handoff) und wird hier bewusst eingefroren,
 * damit die Design-Route deckungsgleich mit der Referenz bleibt.
 *
 * Ausnahme: Loop- und Plattform-Copy werden für die öffentliche Landing gestrafft;
 * die öffentliche #roadmap-Sektion liest Status/Route aus
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

export const HERO_PROOF = ['KOSTENLOSER CHECK', 'KLARER BERICHT', 'PARAGRAPHENBEZUG'] as const;

export const HERO_KPIS = [
  ['90s', 'BIS ZUM ERGEBNIS'],
  ['EU', 'HOSTING'],
  ['0 €', 'FÜR DEN ERSTEN CHECK'],
] as const;

export const HERO_FRAMEWORKS: ReadonlyArray<readonly [string, boolean]> = [
  ['DSGVO', false],
  ['EU AI ACT', false],
  ['ISO 27001', false],
  ['NIS2', false],
  ['TISAX', true],
  ['DORA', true],
];

/**
 * Zeile über den Rahmenwerk-Chips — aus HERO_FRAMEWORKS abgeleitet, damit Zahl und
 * Status nicht auseinanderlaufen. Vorher „SECHS POLICY PACKS“ bei vier live;
 * TISAX/DORA sind `framework-tisax-dora` (coming-soon). Freigabe Dominik, 13.10.2026.
 */
export const HERO_PACKS_LINE = (() => {
  const live = HERO_FRAMEWORKS.filter(([, next]) => !next).length;
  const next = HERO_FRAMEWORKS.filter(([, isNext]) => isNext).map(([name]) => name);
  return next.length
    ? `${live} POLICY PACKS LIVE · ${next.join('/')} COMING SOON`
    : `${live} POLICY PACKS · EIN PRÜFPFAD`;
})();

export const LOOP_NODES = [
  ['01 · PRÜFEN', 'Scan', 'Cookies, Tracker und KI-Einbindung Ihrer Website erfassen — in unter 90 Sekunden.'],
  ['02 · VERSTEHEN', 'Einordnen', 'Risiken mit Paragraphenbezug (DSGVO, TTDSG, EU AI Act) klar benennen.'],
  ['03 · HANDELN', 'Beheben', 'Konkrete Hinweise, was Sie ändern müssen — ohne Berater und ohne Fachchinesisch.'],
  ['04 · NACHWEISEN', 'Dokumentieren', 'Alles nachvollziehbar festhalten, damit Sie es einem Prüfer vorlegen können.'],
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

/**
 * Evidence-Ledger im Dashboard-Mock (Beispielansicht): Ereignisarten der Nachweiskette.
 * Die Referenz zeigte Städte als „Knoten“ (Berlin · Brüssel · Frankfurt · Stockholm) —
 * das suggerierte eine verteilte Infrastruktur. Real: eine Kette, Datenhaltung Supabase
 * Frankfurt (siehe Footer „BETRIEB“). Freigabe Dominik, 13.10.2026.
 */
export const LEDGER_NODES = [
  ['SCAN', 'Website-Audit'],
  ['RISIKO', 'AI-Act-Einordnung'],
  ['FREIGABE', 'Entscheidung durch Menschen'],
  ['EXPORT', 'Prüfbericht'],
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
  ['DSGVO- & Tracking-Audit', 'Cookies, Tracker und Drittanbieter prüfen, Einwilligungspflichten erkennen — mit PDF-Bericht.', ''],
  ['EU-AI-Act-Klassifizierung', 'Risikoklasse nach Annex III einordnen, Anforderungen ableiten — im öffentlichen Klassifikator, ohne Speichern ins Inventar.', '/ai-act-klassifikator'],
  ['Governance Runtime', 'Risikobewertung, Vorfälle, Betroffenenanfragen, DSFA, Dienstleister und Freigaben in einer laufenden Kontrollschicht.', ''],
  ['Nachweis-Export', 'Prüfungen, Entscheidungen und Änderungen exportieren — für interne Kontrollen und externe Prüfer.', ''],
  ['AI Gateway', 'Modellaufrufe kontrollieren, protokollieren und Kosten erfassen — mit EU-Option.', ''],
  ['Evidence Vault', 'Hash-verkettete Nachweiskette mit Aufbewahrung, Compliance-Hold und Integritätsprüfung.', '/evidence-vault'],
  ['Policy Engine', 'Governance-Regeln als ausführbare Kontrollen durchsetzen — statt nur dokumentieren.', '/policy-engine'],
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
  ['01', 'PRÜFEN', 'Website, Cookies, Tracker und KI-Einbindung erfassen.'],
  ['02', 'EINORDNEN', 'Risiken mit Paragraphenbezug klar benennen.'],
  ['03', 'HANDELN', 'Konkrete Schritte, was Sie ändern müssen.'],
  ['04', 'NACHWEISEN', 'Alles dokumentieren, damit Sie es vorlegen können.'],
  ['05', 'BEOBACHTEN', 'Laufend prüfen, wenn sich etwas ändert.'],
  ['06', 'AUSWERTEN', 'Klare Übersicht für Sie, den Datenschutzbeauftragten oder den Prüfer.'],
] as const;

// ---- 04 Evidence & Trust (MainLanding.tsx TrustItem) — Lucide-Pfade wie in der Referenz ----
export type TrustIcon = 'shield' | 'lock' | 'file' | 'code';

export const TRUST: ReadonlyArray<readonly [TrustIcon, string, string]> = [
  ['shield', 'DSGVO', 'Cookies, Tracker und Einwilligungen prüfen und dokumentieren.'],
  ['lock', 'EU AI Act', 'KI-Einbindung und Transparenzpflichten klar benennen.'],
  ['file', 'Nachweis-Export', 'Prüfungen und Entscheidungen als Bericht für Prüfer exportieren.'],
  ['code', 'Code Compliance', 'Technische Hinweise, was auf der Website angepasst werden sollte.'],
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

export const CLOSING_PILLS = ['DSGVO', 'EU AI ACT', 'KOSTENLOSER CHECK', 'KLARER BERICHT', 'NACHWEIS-EXPORT', 'EU-HOSTING'] as const;
