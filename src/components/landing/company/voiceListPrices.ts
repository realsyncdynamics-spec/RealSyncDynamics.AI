/**
 * Listenpreise des Vertical Voice Agent, Stand 24.10.2026.
 *
 * Quelle: die bereits veröffentlichte Produktseite
 * `voice.realsyncdynamicsai.de` (Pakete, Produktmappe, Anleitung) —
 * nicht `shared/pricing.ts` und kein Stripe-Checkout. Beträge hier sind
 * Anzeige, kein Angebot zum Abschluss. Verbindlich bleibt nur ein
 * schriftliches Angebot, wie in der Produktmappe festgehalten.
 *
 * Telefonie folgt `voice-telephony` (coming-soon): Option nach
 * ausdrücklicher Freischaltung, nicht als laufende Leistung.
 */

export interface VoiceListPackage {
  id: 'starter' | 'professional' | 'kanzlei';
  name: string;
  /** Netto pro Monat, Euro. */
  netEur: number;
  /** Bereits veröffentlichter Bruttobetrag bei 19 % MwSt. */
  grossLabel: string;
  includedMinutes: number;
  /** Weitere Minute, netto. */
  overageNetLabel: string;
  channel: string;
}

export const VOICE_LIST_PACKAGES: readonly VoiceListPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    netEur: 89,
    grossLabel: '105,91 € brutto',
    includedMinutes: 500,
    overageNetLabel: '0,18 €',
    channel: 'Web',
  },
  {
    id: 'professional',
    name: 'Professional',
    netEur: 199,
    grossLabel: '236,81 € brutto',
    includedMinutes: 1500,
    overageNetLabel: '0,15 €',
    channel: 'Web + Telefonie-Option nach Freischaltung',
  },
  {
    id: 'kanzlei',
    name: 'Kanzlei / Praxis',
    netEur: 349,
    grossLabel: '415,31 € brutto',
    includedMinutes: 1200,
    overageNetLabel: '0,18 €',
    channel: 'Web + Telefonie-Option nach Freischaltung',
  },
];

/** Wortlaut aus der Produktmappe, nicht neu formulierte Vertragsbedingung. */
export const VOICE_PRICE_BINDING_NOTE =
  'Verbindlich sind ausschließlich die Konditionen eines schriftlichen Angebots. Telefonie ist in Vorbereitung und keine allgemein gebuchte Leistung.';
