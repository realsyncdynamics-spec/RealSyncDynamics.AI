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
 * bleibt die Ansicht — sie zeigt, wie das Produkt aussieht — aber sie ist als
 * Beispiel gekennzeichnet, nicht als Zustand.
 *
 * ## Regeln
 *
 * - Diese Werte sind **Beispielwerte**. Sie dürfen nie ohne den Marker
 *   `RUNTIME_PREVIEW_LABEL` gerendert werden.
 * - Es werden nur Module gezeigt, die in Produktion laufen
 *   (`src/config/platform-capabilities.ts`, `status: 'live'`). Ein Beispiel
 *   für ein Modul, das es nicht gibt, ist auch nur eine Behauptung — nur eine
 *   bebilderte. Die frühere Karte „WHATSAPP / VOICE · GOVERNED" ist genau
 *   daran gescheitert: keine der vier Bot-Functions ist deployt.
 * - Kumulative Unternehmenskennzahlen („2,1 Mio analysierte Codezeilen",
 *   „11.350 behobene Sicherheitslücken") gehören **nicht** hierher. Das sind
 *   keine Beispielwerte eines Kunden, sondern nachprüfbare Tatsachen-
 *   behauptungen über RealSyncDynamics — belegt oder gar nicht.
 * - Echte Werte gehören hinter die Anmeldung, wo ein Tenant existiert.
 *   `test/landing/platform-capabilities.test.ts` hält das fest.
 */

/** Marker über der Kartengruppe. Ersetzt das frühere „LIVE" — das war unzutreffend. */
export const RUNTIME_PREVIEW_LABEL = 'GOVERNANCE RUNTIME · BEISPIELANSICHT';

/** Fußnote unter der Gruppe. Sagt, woher echte Werte kommen. */
export const RUNTIME_PREVIEW_NOTE =
  'Beispielansicht des Dashboards. Ihre Werte entstehen mit dem ersten Scan.';

export interface RuntimePreviewCard {
  id: string;
  /** Kopfzeile der Karte, z. B. „RISK SCORE". */
  label: string;
  /** Der angezeigte Wert — Zahl oder Zustand. */
  value: string;
  /** Optionale zweite Zeile, erklärt den Wert. */
  detail?: string;
  /** 'ok' → grün, 'info' → cyan. Keine eigenen Farbwerte in der Komponente. */
  tone: 'ok' | 'info';
  /** Anteil 0..1 für den Balken. Nur setzen, wo eine Skala sinnvoll ist. */
  ratio?: number;
  /**
   * Horizontaler Versatz im Cluster (ab `lg`). Erzeugt die gestaffelte
   * Anordnung des Entwurfs, ohne absolute Positionierung — die bricht auf
   * Zwischenbreiten und bei längeren Texten.
   */
  offset: string;
}

export const RUNTIME_PREVIEW_CARDS: readonly RuntimePreviewCard[] = [
  { id: 'gdpr',       label: 'DSGVO',          value: 'BESTANDEN', detail: 'Consent, Cookies, Drittanbieter', tone: 'ok',   offset: 'lg:ml-20' },
  { id: 'risk',       label: 'RISK SCORE',     value: '87/100',    detail: 'Governance-Risiko, gewichtet',    tone: 'info', ratio: 0.87, offset: 'lg:ml-0' },
  { id: 'evidence',   label: 'EVIDENCE VAULT', value: '1.248',     detail: 'Nachweise in der Hash-Kette',     tone: 'info', offset: 'lg:ml-28' },
  { id: 'ai-act',     label: 'EU AI ACT',      value: 'BEREIT',    detail: 'Risikoklassen zugeordnet',        tone: 'ok',   offset: 'lg:ml-8' },
  { id: 'monitoring', label: 'MONITORING',     value: 'AKTIV',     detail: 'Wiederkehrende Nachprüfung',      tone: 'info', offset: 'lg:ml-24' },
];
