/** Feste Bot-Copy. Nicht vom Modell erzeugen. */

export function furnitureFirstReply(firma: string): string {
  return `Ich bin der digitale Assistent von ${firma} — ein Programm, keine Verkäuferin in der Ausstellung. Bei Reklamationen verbinde ich mit dem Team. Wie kann ich helfen: Anfahrt, Öffnungszeiten oder ein Planungsgespräch?`;
}

export const ART50_SENTENCE_DE =
  'Ich bin ein digitaler Assistent — ein Programm, keine Person vor Ort.';

export const FURNITURE_REPLIES = {
  price:
    'Verbindliche Preise macht nur das Team nach Maß und Ausführung. Ich setze keinen Betrag fest. Soll ich einen Rückruf für die Planung notieren?',
  booking:
    'Für ein Planungsgespräch brauche ich Name, Telefon und Wunschbereich. Die Zusage kommt vom Haus, nicht von mir.',
  complaint:
    'Dafür bin ich die falsche Stelle. Ich gebe Name, Belegnummer und den Schaden an das Team.',
  safety:
    'Das darf ich nicht als Prüfung beantworten. Im Haus liegen die Herstellerangaben. Soll das Team zurückrufen?',
} as const;

export const LIVE_LINE_TEMPLATE = {
  furnitureStarter: 'Möbelhaus · Seite + Chat + Nachweis · Starter · WhatsApp später',
} as const;
