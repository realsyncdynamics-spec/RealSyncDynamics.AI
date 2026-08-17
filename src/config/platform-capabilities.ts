/**
 * Single Source of Truth für das, was die Plattform öffentlich verspricht.
 *
 * ## Warum diese Datei existiert
 *
 * Am 2026-08-17 wurde der Produktionsstand gegen das Live-Projekt gemessen
 * (`RealSyncDynamicsLive`, eu-central-1, `supabase functions list`). Ergebnis:
 * Von 180 Edge Functions im Repository laufen **100** in Produktion.
 *
 * Ein Compliance-Produkt, das Nachweisbarkeit verkauft, darf auf seiner eigenen
 * Startseite keine Fähigkeit behaupten, die es nicht erbringt. Deshalb steht
 * hier, was jedes Modul trägt — und die Landing rendert daraus, statt eine
 * separate Marketingliste zu pflegen, die auseinanderläuft.
 *
 * ## Warum diese Datei zweimal an einem Tag korrigiert wurde
 *
 * Die erste Fassung stützte sich auf eine Messung vom Vormittag und stellte
 * `evidence-vault`, `policy-packs` und `provenance` auf `'building'`. Die zweite
 * Messung am selben Tag zeigte sie als deployt — dazwischen lief ein Deploy.
 *
 * Gleichzeitig fiel der umgekehrte, schwerere Fehler auf: „WhatsApp- &
 * Telefonbot" stand auf `'live'`, obwohl **keine** der vier tragenden Functions
 * in Produktion ist. Der Test hatte das nicht gefunden, weil er Existenz im
 * Repository prüft, nicht Deployment — das kann er ohne Live-Zugriff auch nicht.
 *
 * Daraus die eigentliche Lehre: `status` ist eine **Momentaufnahme mit
 * Verfallsdatum**, kein Attribut. Wer sie liest, ohne neu zu messen, liest
 * Geschichte.
 *
 * ## Regeln
 *
 * - `status: 'live'` setzt voraus, dass **jede** Function unter `backedBy` in
 *   Produktion deployt ist. Im Zweifel `'building'` — lieber untertrieben.
 * - `status` ändert man nicht nach Gefühl, sondern nach einer Messung gegen
 *   `supabase functions list` bzw. die Live-DB. `measuredAt` mitziehen.
 * - Was hier `'building'` ist, darf die Oberfläche nicht als verfügbar
 *   darstellen. Die Landing setzt das durch, `test/landing/
 *   platform-capabilities.test.ts` prüft es.
 */

export type CapabilityStatus =
  /** Backend in Produktion deployt und über die Oberfläche erreichbar. */
  | 'live'
  /** Code vorhanden, Backend nicht in Produktion. Nicht als verfügbar zeigen. */
  | 'building';

export interface PlatformCapability {
  id: string;
  name: string;
  /** Was der Kunde davon hat — kein Feature-Sprech. */
  description: string;
  status: CapabilityStatus;
  /** Edge Functions, ohne die das Modul nicht arbeitet. */
  backedBy: readonly string[];
  /** Nur bei 'building': warum, in einem Satz, für die Oberfläche. */
  note?: string;
}

/** Datum der letzten Messung gegen Produktion. Bei Statuswechsel mitziehen. */
export const CAPABILITIES_MEASURED_AT = '2026-08-17';

export const PLATFORM_CAPABILITIES: readonly PlatformCapability[] = [
  {
    id: 'gdpr-audit',
    name: 'DSGVO- & Tracking-Audit',
    description:
      'Website-Scan auf Cookies, Tracker, Drittanbieter und Einwilligungspflicht — mit Bericht als PDF und wiederkehrender Nachprüfung.',
    status: 'live',
    backedBy: ['gdpr-audit', 'cookie-scan', 'cookie-scan-deep', 'audit-report-pdf', 'audit-monitor-cron'],
  },
  {
    id: 'ai-act',
    name: 'EU-AI-Act-Klassifizierung',
    description:
      'KI-Systeme nach Risikoklasse einordnen, Anforderungen ableiten und den Bestand als Inventar führen.',
    status: 'live',
    // `ai-act-auto-classify` gehört bewusst nicht dazu: nicht in Produktion.
    // Die Klassifizierung arbeitet ohne sie, die Automatik ist der Aufsatz.
    backedBy: ['ai-act-classify', 'ai-act-risk-inventory'],
  },
  {
    id: 'governance-runtime',
    name: 'Governance Runtime',
    description:
      'Risikobewertung, Vorfälle, Betroffenenanfragen, DSFA, Dienstleister und Freigaben in einer laufenden Kontrollschicht.',
    status: 'live',
    backedBy: [
      'governance-risk-score', 'governance-incidents', 'governance-dsr',
      'governance-dpias', 'governance-vendors', 'governance-approvals',
    ],
  },
  {
    id: 'evidence-export',
    name: 'Nachweis-Export',
    description:
      'Prüfungen, Entscheidungen und Änderungen als auditfähigen Export — für interne Kontrollen und externe Prüfer.',
    status: 'live',
    backedBy: ['evidence-export', 'evidence-vault-export'],
  },
  {
    id: 'bots',
    name: 'WhatsApp- & Telefonbot',
    description:
      'Kundenkommunikation über Chat und Sprache auf derselben Governance-Ebene — mit Prüfpfad je Gespräch.',
    status: 'building',
    backedBy: ['bot-chat', 'bot-voice-webhook', 'appointment-book', 'order-intake'],
    note: 'Keine der vier tragenden Functions ist in Produktion (Messung 2026-08-17).',
  },
  {
    id: 'ai-gateway',
    name: 'AI Gateway',
    description:
      'Jeder Modellaufruf läuft über eine kontrollierte Schicht mit Protokollierung, Kostenerfassung und EU-Option.',
    status: 'live',
    backedBy: ['ai-gateway', 'ai-invoke', 'telemetry-ai-event'],
  },
  {
    id: 'evidence-vault',
    name: 'Evidence Vault',
    description:
      'Hash-verkettete Nachweiskette mit Aufbewahrung, Compliance-Hold und Integritätsprüfung.',
    status: 'live',
    backedBy: ['evidence-vault'],
  },
  {
    id: 'policy-engine',
    name: 'Policy Engine',
    description:
      'Governance-Regeln nicht nur dokumentieren, sondern als ausführbare Kontrolllogik durchsetzen.',
    status: 'live',
    backedBy: ['policy-packs'],
  },
  {
    id: 'provenance',
    name: 'Herkunftsnachweis (C2PA)',
    description:
      'Inhalte signieren und ihre Herkunft überprüfbar machen — Ed25519, C2PA Content Credentials.',
    status: 'building',
    backedBy: ['provenance', 'c2pa-manifest-generate'],
    note: 'Signaturdienst läuft, die C2PA-Manifest-Erzeugung noch nicht in Produktion.',
  },
];

/** Module, die öffentlich als verfügbar dargestellt werden dürfen. */
export const LIVE_CAPABILITIES = PLATFORM_CAPABILITIES.filter((c) => c.status === 'live');

/** Module in Arbeit — als solche kennzeichnen, nicht verschweigen. */
export const BUILDING_CAPABILITIES = PLATFORM_CAPABILITIES.filter((c) => c.status === 'building');
