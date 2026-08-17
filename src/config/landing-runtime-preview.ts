/**
 * Die Beispielansicht der Governance Runtime im Hero.
 *
 * ## Warum das hier steht und nicht inline
 *
 * Das Panel im Hero sah aus wie ein Live-Messwert: Kopfzeile „GOVERNANCE
 * RUNTIME · LIVE", grüner Punkt, „ACTIVE", darunter `87/100`, `1,248`,
 * `94.2%`. Nichts davon war gemessen — es waren hartkodierte Zahlen.
 *
 * Für einen anonymen Besucher gibt es dort auch nichts zu messen: Er hat
 * keinen Tenant, also keine Assets, keine Runs, keine Nachweise. Der Truth
 * Layer (`docs/architecture/target-architecture.md` §3.1) sagt dazu
 * unmissverständlich: Was nicht belegbar ist, wird nicht behauptet.
 *
 * Eine Seite, die zwei Abschnitte weiter unten „Evidence statt Behauptung"
 * schreibt, darf im Hero keine Behauptung als Messwert ausgeben. Deshalb
 * bleibt das Panel — es zeigt, wie das Produkt aussieht — aber es ist als
 * Beispiel gekennzeichnet, nicht als Zustand.
 *
 * ## Regeln
 *
 * - Diese Werte sind **Beispielwerte**. Sie dürfen nie ohne den Marker
 *   `RUNTIME_PREVIEW_LABEL` gerendert werden.
 * - Die Zeilen benennen nur Module, die in Produktion laufen
 *   (`src/config/platform-capabilities.ts`, `status: 'live'`). Ein Beispiel
 *   für ein Modul, das es nicht gibt, ist auch nur eine Behauptung.
 * - Echte Werte gehören hinter die Anmeldung, wo ein Tenant existiert.
 *   `test/landing/platform-capabilities.test.ts` hält das fest.
 */

/** Kopfzeile des Panels. Ersetzt das frühere „LIVE" — das war unzutreffend. */
export const RUNTIME_PREVIEW_LABEL = 'GOVERNANCE RUNTIME · BEISPIELANSICHT';

/** Fußnote unter dem Panel. Sagt, woher echte Werte kommen. */
export const RUNTIME_PREVIEW_NOTE =
  'Beispielansicht des Dashboards. Ihre Werte entstehen mit dem ersten Scan.';

export interface RuntimePreviewMetric {
  label: string;
  value: string;
}

/** Kacheln im Panel — illustrativ, nicht gemessen. */
export const RUNTIME_PREVIEW_METRICS: readonly RuntimePreviewMetric[] = [
  { label: 'RISK SCORE', value: '87/100' },
  { label: 'EVIDENCE', value: '1,248' },
  { label: 'AI SYSTEMS', value: '04' },
  { label: 'CODE READY', value: '94.2%' },
];

export interface RuntimePreviewRow {
  label: string;
  state: string;
  /** 'ok' → grün, 'info' → cyan. Keine eigenen Farbwerte in der Komponente. */
  tone: 'ok' | 'info';
}

/**
 * Statuszeilen. Bewusst nur Module mit deploytem Backend — die frühere Zeile
 * „EVIDENCE CHAIN · VERIFIED" gehörte zum Evidence Vault, der nicht in
 * Produktion läuft.
 */
export const RUNTIME_PREVIEW_ROWS: readonly RuntimePreviewRow[] = [
  { label: 'DSGVO / CONSENT', state: 'PASS', tone: 'ok' },
  { label: 'EU AI ACT', state: 'READY', tone: 'ok' },
  { label: 'WHATSAPP / VOICE', state: 'GOVERNED', tone: 'info' },
  { label: 'NACHWEIS-EXPORT', state: 'BEREIT', tone: 'info' },
];
