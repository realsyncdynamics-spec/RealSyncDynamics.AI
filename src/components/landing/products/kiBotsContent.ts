/**
 * Inhalte der Produkt-Landingpage KI-Bots & Voice-Agenten (`/ki-bots`, Entwurf).
 *
 * Kernbotschaft (Owner, 19.11.2026): erreichbar bleiben und Kundenanfragen
 * intelligent bearbeiten. Kundeneinstieg: „KI-Empfang kennenlernen“.
 *
 * Grenzen aus dem Bestand:
 *   - Chat-Assistent: Registry `channel-bots` (Preview).
 *   - Telefonie: Registry `voice-telephony` (In Vorbereitung) → kein Telefon-Versprechen.
 *   - Übergabe an Menschen: Modul `human_handoff` in shared/pricing.ts „Coming Soon“
 *     → der Ablauf heißt „geplant“.
 *   - Der Gesprächsablauf ist simuliert und als Beispiel gekennzeichnet; Name und
 *     Nummer sind Platzhalter, keine Kundendaten.
 *   - Die Anwendungsbeispiele sind Beispiele, keine Referenzen.
 */
import { RECEPTIONIST } from '../v3/landingV3Data';

export const KI_BOTS_SOURCE = 'ki-bots';

export const KI_BOTS = {
  name: 'Persönlicher Telefonassistent',
  audience: 'Für Betriebe mit Kundenkontakt, zuerst im Handwerk',
  h1: ['Persönlicher Telefonassistent.', 'Für KMU mit Kundenkontakt.'],
  lead:
    'Der Telefonassistent soll Anrufe entgegennehmen, das Anliegen und einen Rückruf- oder Terminwunsch erfassen und an Ihr Team übergeben. Telefonie ist aktuell noch in Vorbereitung; der Chat-Assistent kann separat ausprobiert werden.',
  primaryCta: 'Ablauf ansehen',
  stageTag: 'Telefonassistent · in Vorbereitung',
  stageCaption: 'Anruf → Anliegen → Rückrufwunsch → Team',
  waitlistHref: `/warteliste?interest=bots&source=${KI_BOTS_SOURCE}`,
  waitlistCta: 'Auf die Warteliste',
  tryHref: `/chatbot/start?source=${KI_BOTS_SOURCE}`,
  tryCta: 'Chat-Assistent ausprobieren',
} as const;

/** Konkretes Produktversprechen: drei Punkte, jeweils mit Grenze. */
export const PROMISES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Anrufe sollen nicht unbeantwortet bleiben',
    body: 'Der geplante Telefonassistent nimmt Anliegen auf, während Ihr Team arbeitet. Telefonie ist noch nicht live.',
  },
  {
    title: 'Alles Wichtige auf einen Blick',
    body: 'Name, Rückrufnummer, Anliegen und Terminwunsch sollen geordnet an Ihr Team übergeben werden.',
  },
  {
    title: 'Ihr Team behält die Entscheidung',
    body: 'Zusagen, Preise und Termine bestätigt ein Mensch. Der Assistent soll die Informationen übergeben.',
  },
];

export type DemoSpeaker = 'kunde' | 'empfang' | 'system';

export interface DemoStep {
  /** Index in RECEPTIONIST.steps, der in diesem Schritt aktiv ist. */
  phase: number;
  speaker: DemoSpeaker;
  text: string;
}

/** Simulierter Ablauf am Beispiel eines Heizungsbetriebs. */
export const DEMO_STEPS: readonly DemoStep[] = [
  { phase: 0, speaker: 'kunde', text: 'Unsere Heizung ist ausgefallen. Können Sie diese Woche vorbeikommen?' },
  {
    phase: 0,
    speaker: 'empfang',
    text: 'Das tut mir leid. Ich nehme Ihre Anfrage auf, damit sich das Team bei Ihnen meldet.',
  },
  { phase: 1, speaker: 'empfang', text: 'Wie ist Ihr Name, und unter welcher Nummer erreichen wir Sie?' },
  { phase: 1, speaker: 'kunde', text: 'Erika Mustermann, 0151 00000000.' },
  { phase: 2, speaker: 'empfang', text: 'Danke. Wann passt Ihnen ein Besuch am besten?' },
  { phase: 2, speaker: 'kunde', text: 'Donnerstag am Vormittag.' },
  {
    phase: 3,
    speaker: 'system',
    text: 'An das Team übergeben: Heizungsausfall · Rückruf 0151 00000000 · Wunsch Donnerstag vormittags. Zusage folgt durch einen Menschen.',
  },
];

export const RECEPTION_PHASES = RECEPTIONIST.steps;

/** Anwendungsbeispiele. Beispiele, keine Kundenreferenzen. */
export const USE_CASES: ReadonlyArray<{ trade: string; situation: string; result: string }> = [
  {
    trade: 'Heizung & Sanitär',
    situation: 'Während des Kundentermins ruft jemand wegen eines Heizungsausfalls an.',
    result: 'Das geplante System erfasst Anliegen und Rückrufwunsch zur späteren Übergabe.',
  },
  {
    trade: 'Elektro',
    situation: 'Während das Team arbeitet, gehen mehrere Anrufe ein.',
    result: 'Der geplante Ablauf sammelt Anliegen und Kontaktdaten für das Team.',
  },
  {
    trade: 'Dach & Fassade',
    situation: 'Nach einem Sturm rufen mehrere Kunden mit Terminwünschen an.',
    result: 'Die Wünsche sollen erfasst und von Ihrem Team bestätigt werden.',
  },
];

/** Verständlicher Einstieg in drei Schritten. */
export const START_STEPS: ReadonlyArray<{ title: string; body: string }> = [
  { title: 'Ablauf ansehen', body: 'Das markierte Beispiel zeigt, welche Informationen das Team erhalten soll.' },
  { title: 'Chat testen', body: 'Den verfügbaren Chat-Assistenten separat im Browser ausprobieren.' },
  { title: 'Vormerken lassen', body: 'Interesse am Telefonassistenten für KMU hinterlegen.' },
];
