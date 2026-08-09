/**
 * Demo-Datensatz der öffentlichen Compliance-Runtime-Sektionen.
 *
 * ⚠️ WICHTIG — Claim-Disziplin (CLAUDE.md §4, §12):
 * Sämtliche Werte in dieser Datei sind **Beispielwerte für eine
 * Produktvorschau**. Sie stammen NICHT aus der Live-Runtime, aus keiner
 * Tenant-Datenbank und aus keinem Audit-Lauf. Jede Sektion, die sie rendert,
 * MUSS sie sichtbar als Demo kennzeichnen (`DEMO_BADGE`).
 *
 * Warum zentral statt in den Komponenten:
 * Solange alle erfundenen Zahlen an genau einer Stelle liegen, ist auf einen
 * Blick prüfbar, was auf der Startseite echt ist und was nicht. Echte Werte
 * kommen ausschließlich aus Hooks (heute: `useHealthStatus` → /health).
 *
 * Beim Anschluss an echte Daten: Werte hier entfernen, Quelle in der jeweiligen
 * Komponente anbinden und das Demo-Label nur dort entfernen, wo tatsächlich
 * belegte Werte stehen — nicht pauschal.
 */

/** Sichtbare Kennzeichnung. Bewusst kurz, damit sie in jede Kartenkopfzeile passt. */
export const DEMO_BADGE = 'DEMO' as const;

/** Ausgeschriebene Kennzeichnung für Sektionsköpfe und Screenreader. */
export const DEMO_LABEL = 'Produktansicht · Beispielwerte' as const;

/**
 * Erläuterung für Screenreader und Tooltips. Steht bewusst als ganzer Satz da,
 * damit die Einordnung auch ohne visuellen Kontext ankommt.
 */
export const DEMO_EXPLAINER =
  'Beispielwerte einer Produktvorschau — keine Live-Daten aus der Runtime.' as const;

/* ── Control Room ──────────────────────────────────────────────────────── */

export interface ControlRoomMetric {
  label: string;
  value: string;
  suffix?: string;
  /** Kurzer Zusatzkontext unter dem Wert (z.B. Trend oder Bezugsgröße). */
  note: string;
}

export const CONTROL_ROOM_METRICS: readonly ControlRoomMetric[] = [
  { label: 'RISK SCORE', value: '87', suffix: '/100', note: '−4 gegenüber Vorwoche' },
  { label: 'AKTIVE CONTROLS', value: '124', note: '118 bestanden · 6 in Prüfung' },
  { label: 'EVIDENZ', value: '1.248', note: 'Nachweise in der Hash-Chain' },
  { label: 'KI-SYSTEME', value: '24', note: '3 hochriskant nach EU AI Act' },
];

/** Control-Status als Balken: bestanden vs. prüfungsbedürftig. */
export const CONTROL_STATUS = {
  pass: 118,
  review: 6,
  get total() {
    return this.pass + this.review;
  },
} as const;

/* ── Risk-Breakdown (Drilldown) ────────────────────────────────────────── */

export interface RiskDomain {
  domain: string;
  score: number;
}

export const RISK_BREAKDOWN: readonly RiskDomain[] = [
  { domain: 'AI Governance', score: 91 },
  { domain: 'DSGVO', score: 84 },
  { domain: 'EU AI Act', score: 78 },
  { domain: 'Vendor Risk', score: 92 },
  { domain: 'Security', score: 89 },
];

/** Begründung des Scores — was ihn drückt. */
export const RISK_REASONS: readonly string[] = [
  '3 Controls brauchen eine Review',
  '1 Vendor mit hohem Risiko',
  '2 Evidenz-Einträge fehlen',
];

/* ── Compliance Drift ──────────────────────────────────────────────────── */

export const COMPLIANCE_DRIFT = {
  previous: 91,
  current: 87,
  reason: 'Neuer KI-Vendor erkannt',
  status: 'Review erforderlich',
} as const;

/* ── Evidence Chain ────────────────────────────────────────────────────── */

export interface EvidenceChainStep {
  /** Stufenname der Kette (Control → … → verifiziert). */
  stage: string;
  value: string;
  /** Monospace erzwingen (Hashes, IDs, Zeitstempel). */
  mono?: boolean;
}

export const EVIDENCE_CHAIN_CONTROL = {
  id: 'GDPR-ART-30',
  title: 'Verzeichnis von Verarbeitungstätigkeiten — Review',
} as const;

export const EVIDENCE_CHAIN_STEPS: readonly EvidenceChainStep[] = [
  { stage: 'Control ausgeführt', value: 'GDPR-ART-30', mono: true },
  { stage: 'Ergebnis', value: 'BESTANDEN' },
  { stage: 'Evidenz erzeugt', value: 'EV-2026-08-09-000184', mono: true },
  { stage: 'SHA-256', value: '9f83…c72a', mono: true },
  { stage: 'Zeitstempel', value: '09.08.2026 · 14:42', mono: true },
  { stage: 'Status', value: 'VERIFIZIERT' },
];

/* ── Vorher / Nachher ──────────────────────────────────────────────────── */

export const BEFORE_AFTER = {
  before: [
    'Manuelle Audits',
    'Nachweise in Tabellen',
    'Unbekannte KI-Systeme',
    'Blinde Flecken bei Vendoren',
    'Statische Compliance',
  ],
  after: [
    'Kontinuierliche Erkennung',
    'Automatisierte Controls',
    'Evidence Vault',
    'Risiko-Intelligenz',
    'Laufendes Monitoring',
  ],
} as const;
