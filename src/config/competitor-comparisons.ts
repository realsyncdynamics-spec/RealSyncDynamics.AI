/**
 * Per-Competitor Comparison-Config — verbindet die Alternative-Pages mit
 * der CompetitorComparisonSection-Component.
 *
 * Tonalitaet: sachlich, vergleichend, professionell. Wertungen sind:
 *   yes      Die Capability ist im Standard-Angebot vollstaendig abgebildet.
 *   partial  Teil-Funktion vorhanden (z.B. nur via Add-on, manuell, oder
 *            ohne Continuous-Aspekt).
 *   no       Capability ist nicht Teil des Produkts.
 *
 * Quellen pro Wertung sind in den Implementations-Notes der Page verlinkt
 * (z.B. Borlabs WP-Plugin-Doku, OneTrust Trust Cloud, DataGuard Help Center).
 *
 * Stand: 2026-05.
 */

import type { CapabilityRow } from '../components/CompetitorComparisonSection';

// ─── 9 strategische Capabilities (User-Spec) ─────────────────────────────────

const CAPABILITIES = {
  COOKIE_BANNER: 'Cookie Banner',
  WEBSITE_SCAN: 'Technical Website Scan',
  CONSENT_TIMING: 'Consent Timing Analysis',
  MONITORING: 'Continuous Monitoring',
  DSGVO_REPORT: 'DSGVO Audit Report',
  AI_ACT: 'AI Act Readiness',
  AUDIT_TRAIL: 'Audit Trail',
  EU_FIRST: 'EU-first Positioning',
  AGENCY: 'Agency / White Label',
} as const;

// ─── Why-it-matters Standard-Texts ───────────────────────────────────────────
// Wiederverwendbar ueber Wettbewerber — die Capability-Begruendung ist
// produkt-, nicht wettbewerber-spezifisch.

const WHY_IT_MATTERS: Record<string, string> = {
  [CAPABILITIES.COOKIE_BANNER]:
    'Pflicht aus § 25 TTDSG + Art. 6 Abs. 1 lit. a DSGVO. Aber: Banner allein lösen keine Compliance — sie sind ein Output-Modul.',
  [CAPABILITIES.WEBSITE_SCAN]:
    'Die meisten DSGVO-Verstöße passieren technisch (Tracker, Fonts, Drittanbieter), nicht im Banner. Ohne echten Headless-Browser-Scan bleiben sie unsichtbar.',
  [CAPABILITIES.CONSENT_TIMING]:
    'Der häufigste Audit-Befund: Tracker feuern VOR Consent. Erkennbar nur mit präzisem Network-Trace gegen User-Interaction-Marker — kein Heuristik-Check.',
  [CAPABILITIES.MONITORING]:
    'Compliance verfällt mit jedem Marketing-Tag-Update. Tägliches Monitoring + Drift-Detection statt einmalig auditieren.',
  [CAPABILITIES.DSGVO_REPORT]:
    'PDF mit Risk-Score, Findings, Paragraphen-Bezug, Auto-Fix-Empfehlungen. DSB-tauglich, statt nur Cookie-Liste.',
  [CAPABILITIES.AI_ACT]:
    'EU AI Act gilt ab 2026 für Hochrisiko-KI. Annex-III-Klassifikation + Pflichten-Mapping ist NICHT Teil eines Cookie-Tools.',
  [CAPABILITIES.AUDIT_TRAIL]:
    'Aufsichtsbehörden fragen retrospektiv: war zu Datum X compliant? Kryptografisch signierte Snapshots + Methodik-Versionen liefern den Beweis.',
  [CAPABILITIES.EU_FIRST]:
    'Schrems-II: US-Cloud-Komponenten brauchen SCCs + TIA. EU-Datenresidenz Default statt nachträgliche Konfiguration.',
  [CAPABILITIES.AGENCY]:
    'Agenturen brauchen Multi-Tenant-Dashboards + White-Label-Reports + API-Bulk-Scans für Kundenseiten — ohne 1-Account-pro-Kunde.',
};

// ─── Cookiebot ────────────────────────────────────────────────────────────────
// Cookiebot (Cybot A/S, Teil von Usercentrics) — etabliertes Cookie-CMP mit
// Auto-Crawler. Stark im Banner-/Consent-Bereich, kein Compliance-Stack.

export const COOKIEBOT_COMPARISON = {
  competitorName: 'Cookiebot',
  competitorPositioning: 'ein etabliertes Cookie-CMP (Consent-Management)',
  rows: [
    { capability: CAPABILITIES.COOKIE_BANNER, ours: 'yes' as const, theirs: 'yes' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.COOKIE_BANNER] },
    { capability: CAPABILITIES.WEBSITE_SCAN, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'nur Cookies',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.WEBSITE_SCAN] },
    { capability: CAPABILITIES.CONSENT_TIMING, ours: 'yes' as const, theirs: 'no' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.CONSENT_TIMING] },
    { capability: CAPABILITIES.MONITORING, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'monatlich',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.MONITORING] },
    { capability: CAPABILITIES.DSGVO_REPORT, ours: 'yes' as const, theirs: 'no' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.DSGVO_REPORT] },
    { capability: CAPABILITIES.AI_ACT, ours: 'yes' as const, theirs: 'no' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.AI_ACT] },
    { capability: CAPABILITIES.AUDIT_TRAIL, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'Consent-Log',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.AUDIT_TRAIL] },
    { capability: CAPABILITIES.EU_FIRST, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'opt-in',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.EU_FIRST] },
    { capability: CAPABILITIES.AGENCY, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'Reseller',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.AGENCY] },
  ] satisfies CapabilityRow[],
};

// ─── OneTrust ─────────────────────────────────────────────────────────────────
// OneTrust — Enterprise GRC-Suite, sehr breit aufgestellt. Stark in
// Privacy-Workflows + DSAR-Automation, weniger im automated Web-Scan.

export const ONETRUST_COMPARISON = {
  competitorName: 'OneTrust',
  competitorPositioning: 'eine Enterprise-Privacy-GRC-Suite',
  rows: [
    { capability: CAPABILITIES.COOKIE_BANNER, ours: 'yes' as const, theirs: 'yes' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.COOKIE_BANNER] },
    { capability: CAPABILITIES.WEBSITE_SCAN, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'Cookie-Crawler',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.WEBSITE_SCAN] },
    { capability: CAPABILITIES.CONSENT_TIMING, ours: 'yes' as const, theirs: 'no' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.CONSENT_TIMING] },
    { capability: CAPABILITIES.MONITORING, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'manuell',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.MONITORING] },
    { capability: CAPABILITIES.DSGVO_REPORT, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'Workflow',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.DSGVO_REPORT] },
    { capability: CAPABILITIES.AI_ACT, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'Add-on',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.AI_ACT] },
    { capability: CAPABILITIES.AUDIT_TRAIL, ours: 'yes' as const, theirs: 'yes' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.AUDIT_TRAIL] },
    { capability: CAPABILITIES.EU_FIRST, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'US-HQ',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.EU_FIRST] },
    { capability: CAPABILITIES.AGENCY, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'Enterprise',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.AGENCY] },
  ] satisfies CapabilityRow[],
};

// ─── DataGuard ───────────────────────────────────────────────────────────────
// DataGuard — DSB-as-a-Service mit Software-Komponente. Stark in
// Beratungs-/DSB-Layer, weniger im automatisierten technischen Web-Scan.

export const DATAGUARD_COMPARISON = {
  competitorName: 'DataGuard',
  competitorPositioning: 'ein DSB-as-a-Service mit Compliance-Plattform',
  rows: [
    { capability: CAPABILITIES.COOKIE_BANNER, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'Add-on',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.COOKIE_BANNER] },
    { capability: CAPABILITIES.WEBSITE_SCAN, ours: 'yes' as const, theirs: 'no' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.WEBSITE_SCAN] },
    { capability: CAPABILITIES.CONSENT_TIMING, ours: 'yes' as const, theirs: 'no' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.CONSENT_TIMING] },
    { capability: CAPABILITIES.MONITORING, ours: 'yes' as const, theirs: 'no' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.MONITORING] },
    { capability: CAPABILITIES.DSGVO_REPORT, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'manuell DSB',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.DSGVO_REPORT] },
    { capability: CAPABILITIES.AI_ACT, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'Beratung',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.AI_ACT] },
    { capability: CAPABILITIES.AUDIT_TRAIL, ours: 'yes' as const, theirs: 'partial' as const, theirsNote: 'Doku-Layer',
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.AUDIT_TRAIL] },
    { capability: CAPABILITIES.EU_FIRST, ours: 'yes' as const, theirs: 'yes' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.EU_FIRST] },
    { capability: CAPABILITIES.AGENCY, ours: 'yes' as const, theirs: 'no' as const,
      whyItMatters: WHY_IT_MATTERS[CAPABILITIES.AGENCY] },
  ] satisfies CapabilityRow[],
};
