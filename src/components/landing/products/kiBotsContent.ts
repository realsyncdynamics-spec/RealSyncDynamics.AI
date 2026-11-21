/**
 * Inhalte der Produkt-Landingpage Telefonassistent (`/telefonassistent`, Entwurf).
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

export const KI_BOTS_SOURCE = 'telefonassistent';

export const KI_BOTS = {
  name: 'Telefonassistent',
  audience: 'Für Betriebe mit Kundenkontakt, zuerst im Handwerk',
  h1: ['Keine Anfrage verpassen.', 'Auch wenn Sie im Einsatz sind.'],
  lead:
    'Der persönliche Telefonassistent soll Anrufe annehmen, Anliegen und Rückrufwünsche aufnehmen und an Ihr Team übergeben. Telefonie ist derzeit noch in Vorbereitung.',
  primaryCta: 'Telefonassistent vormerken',
  stageTag: 'KI-Empfang · Entwurf',
  stageCaption: 'Anruf → Anliegen → Rückrufwunsch → Team',
  waitlistHref: `/warteliste?interest=bots&source=${KI_BOTS_SOURCE}`,
  waitlistCta: 'Auf die Warteliste',
  tryHref: `/chatbot/start?source=${KI_BOTS_SOURCE}`,
  tryCta: 'Chat-Assistent ausprobieren',
} as const;

/** Konkretes Produktversprechen: drei Punkte, jeweils mit Grenze. */
export const PROMISES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Keine Anfrage bleibt liegen',
    body: 'Der Assistent antwortet, während Ihr Team arbeitet, und hält das Anliegen fest.',
  },
  {
    title: 'Alles Wichtige auf einen Blick',
    body: 'Name, Rückrufnummer, Anliegen und Terminwunsch kommen geordnet bei Ihnen an.',
  },
  {
    title: 'Ein Mensch entscheidet',
    body: 'Zusagen, Preise und Termine bestätigt Ihr Team. Der Assistent übergibt.',
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
    situation: 'Während das Team arbeitet, ruft jemand wegen eines Heizungsausfalls an.',
    result: 'Anliegen, Adresse und Rückrufnummer liegen morgens geordnet vor.',
  },
  {
    trade: 'Elektro',
    situation: 'Mehrere Angebotsanfragen kommen gleichzeitig herein.',
    result: 'Jede Anfrage ist mit Umfang und Kontakt erfasst und wartet auf Ihr Angebot.',
  },
  {
    trade: 'Dach & Fassade',
    situation: 'Nach einem Sturm fragen viele Kunden nach einem Termin.',
    result: 'Terminwünsche sind gesammelt, Ihr Team plant die Reihenfolge.',
  },
];

/** Verständlicher Einstieg in drei Schritten. */
export const START_STEPS: ReadonlyArray<{ title: string; body: string }> = [
  { title: 'Vormerken', body: 'Auf die Warteliste für den Telefonassistenten setzen lassen.' },
  { title: 'Vorgaben festlegen', body: 'Bestimmen, welche Fragen er beantwortet und was er an Ihr Team gibt.' },
  { title: 'Chat testen', body: 'Den separaten Website-Chat ausprobieren, solange Telefonie noch vorbereitet wird.' },
];
