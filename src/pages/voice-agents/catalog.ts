/** Public product concepts, not runtime grants or approved offers.
 * Execution permissions stay in the existing server-side policy layer.
 */
export interface VoiceIndustry {
  slug: string;
  name: string;
  headline: string;
  description: string;
  tasks: readonly string[];
  knowledge: readonly string[];
  integration: string;
  boundary: string;
  exampleRequest: string;
  exampleReply: string;
}

export const VOICE_CATALOG_VERSION = '0.1.0';
export const VOICE_STUDIO_RELEASE = 'planned' as const;

export const VOICE_INDUSTRIES = [
  {
    slug: 'handwerk', name: 'Handwerk', headline: 'Auf der Baustelle. Für Kunden erreichbar.',
    description: 'Anfragen strukturieren, Rückrufe vorbereiten und Terminwünsche aufnehmen, während dein Team unterwegs ist.',
    tasks: ['Kundenanfragen aufnehmen', 'Rückrufwünsche erfassen', 'Termine vormerken'],
    knowledge: ['Leistungen und Einsatzgebiet', 'Geschäfts- und Notdienstzeiten', 'Freigegebene Kontaktwege'],
    integration: 'Kalender und Auftragsverwaltung nach erfolgreicher Anbindung',
    boundary: 'Keine verbindliche Zusage zu Ankunft, Preis oder Notdiensteinsatz ohne bestätigte Daten. Gefährliche Situationen an den festgelegten Notfallweg verweisen.',
    exampleRequest: 'Ich möchte nächste Woche meine Heizung warten lassen.',
    exampleReply: 'Gern nehme ich Ihren Terminwunsch auf. Welche Tage passen Ihnen? Der Termin gilt erst nach Bestätigung durch den Betrieb.',
  },
  {
    slug: 'arztpraxen', name: 'Arztpraxen', headline: 'Mehr Ruhe für das Praxisteam.',
    description: 'Praxisinformationen, Terminwünsche und Rückrufe in einem klar begrenzten administrativen Ablauf.',
    tasks: ['Praxisinformationen geben', 'Terminwünsche erfassen', 'Rückrufe organisieren'],
    knowledge: ['Sprechzeiten', 'Administrative Leistungen', 'Freigegebener Weg für dringende Anliegen'],
    integration: 'Praxis- oder Terminsystem über eine freigegebene Schnittstelle',
    boundary: 'Keine Diagnose, Behandlungsempfehlung oder eigenständige medizinische Triage. Gesundheitsdaten nur im freigegebenen Verfahren; dringende Anliegen nach fachlich geprüfter Regel weiterleiten.',
    exampleRequest: 'Ich möchte einen Termin in der Praxis vereinbaren.',
    exampleReply: 'Gern nehme ich Ihren Terminwunsch auf. Bitte nennen Sie keine medizinischen Einzelheiten. Das Praxisteam bestätigt den Termin.',
  },
  {
    slug: 'zahnaerzte', name: 'Zahnärzte', headline: 'Die Rezeption bekommt Unterstützung.',
    description: 'Routineanfragen vorbereiten und dem Praxisteam Zeit für die Menschen vor Ort lassen.',
    tasks: ['Terminwünsche erfassen', 'Freigegebene Leistungen erklären', 'Rückrufe aufnehmen'],
    knowledge: ['Sprechzeiten', 'Leistungsübersicht', 'Administrative Terminregeln'],
    integration: 'Praxissoftware nach Prüfung der verfügbaren API',
    boundary: 'Keine Diagnose oder individuelle Behandlungs- und Kostenzusage. Dringende Anliegen werden nach einer fachlich freigegebenen Regel weitergegeben.',
    exampleRequest: 'Ich möchte einen Termin zur Kontrolle anfragen.',
    exampleReply: 'Gern. Welcher Zeitraum passt Ihnen? Ich kann einen Terminwunsch vorbereiten; eine Bestätigung erfolgt durch die Praxis.',
  },
  {
    slug: 'hotels', name: 'Hotels', headline: 'Gastfreundschaft beginnt am Telefon.',
    description: 'Zimmeranfragen und Gästewünsche erfassen, auch wenn an der Rezeption gerade viel los ist.',
    tasks: ['Zimmeranfragen aufnehmen', 'Reservierungswünsche erfassen', 'Hotelinformationen geben'],
    knowledge: ['Anreise und Check-in', 'Ausstattung', 'Freigegebene Buchungsbedingungen'],
    integration: 'Property-Management-System mit aktueller Verfügbarkeit',
    boundary: 'Zimmerpreise und Verfügbarkeiten ausschließlich aus dem Buchungssystem. Eine Anfrage ist noch keine Reservierungsbestätigung.',
    exampleRequest: 'Haben Sie nächstes Wochenende ein Doppelzimmer?',
    exampleReply: 'Dafür brauche ich die aktuelle Verfügbarkeit. Ohne Verbindung zum Buchungssystem kann ich Ihre Anfrage für das Hotelteam vorbereiten.',
  },
  {
    slug: 'immobilien', name: 'Immobilien', headline: 'Aus Interesse wird ein geordneter Kontakt.',
    description: 'Objektanfragen zuordnen und Besichtigungswünsche für dein Team vorbereiten.',
    tasks: ['Objektanfragen zuordnen', 'Kontaktwünsche erfassen', 'Besichtigungen vormerken'],
    knowledge: ['Freigegebene Exposés', 'Objektkennungen', 'Besichtigungsregeln'],
    integration: 'Immobilien-CRM und Besichtigungskalender',
    boundary: 'Keine erfundenen Objektmerkmale, Verfügbarkeiten oder Zusagen zur Vergabe. Keine Auswahl anhand sensibler persönlicher Merkmale.',
    exampleRequest: 'Ich würde gern die Wohnung mit der Objektnummer besichtigen.',
    exampleReply: 'Bitte nennen Sie die Objektnummer. Ich kann den Besichtigungswunsch aufnehmen; das Team bestätigt die Verfügbarkeit und den Termin.',
  },
  {
    slug: 'e-commerce', name: 'E-Commerce', headline: 'Bestellfragen. Mit verlässlichen Antworten.',
    description: 'Produktfragen und Serviceanliegen mit den freigegebenen Daten deines Shops bearbeiten.',
    tasks: ['Produktinformationen geben', 'Bestellstatus nach Prüfung abrufen', 'Retourenanfragen aufnehmen'],
    knowledge: ['Artikelnummern', 'Freigegebene Produktinformationen', 'Versand- und Retourenregeln'],
    integration: 'Shop-API mit begrenzten Rechten und Kundenverifikation',
    boundary: 'Bestellinformationen erst nach Identitätsprüfung. Keine Erstattung, Stornierung oder verbindliche Lieferzusage ohne passende Berechtigung und Bestätigung.',
    exampleRequest: 'Wo bleibt meine Bestellung?',
    exampleReply: 'Bevor ich Bestelldaten abrufen kann, ist eine Identitätsprüfung erforderlich. Ohne bestätigten Zugriff kann ich keine Auskunft zum Bestellstatus geben.',
  },
  {
    slug: 'restaurants', name: 'Restaurants', headline: 'Für Gäste da. Auch während des Service.',
    description: 'Tischanfragen und freigegebene Informationen in einem abgegrenzten Branchenmodul.',
    tasks: ['Tischwünsche aufnehmen', 'Öffnungszeiten nennen', 'Speisekarteninformationen geben'],
    knowledge: ['Freigegebene Speisekarte', 'Öffnungszeiten', 'Reservierungsregeln'],
    integration: 'Reservierungssystem mit aktueller Kapazität',
    boundary: 'Keine Tischbestätigung ohne bestätigte Kapazität. Allergene nur aus gepflegten Quellen; bei Unsicherheit an Mitarbeitende übergeben.',
    exampleRequest: 'Ich möchte für vier Personen reservieren.',
    exampleReply: 'Für welchen Tag und welche Uhrzeit? Ohne bestätigte Verfügbarkeit kann ich zunächst nur Ihren Reservierungswunsch aufnehmen.',
  },
  {
    slug: 'kanzleien', name: 'Kanzleien', headline: 'Ein strukturierter erster Kontakt.',
    description: 'Anliegen und Rückrufwünsche aufnehmen, damit die Kanzlei den nächsten Schritt entscheiden kann.',
    tasks: ['Erstkontakt strukturieren', 'Terminwünsche erfassen', 'Rückrufe organisieren'],
    knowledge: ['Tätigkeitsgebiete', 'Kontakt- und Sprechzeiten', 'Freigegebene Erstkontaktregeln'],
    integration: 'Kanzleikalender oder freigegebenes Mandatsmanagement',
    boundary: 'Keine individuelle Rechtsberatung, Fristberechnung oder Zusage einer Mandatsannahme. Vertrauliche Details auf das erforderliche Minimum begrenzen.',
    exampleRequest: 'Ich brauche einen Rückruf zu einer rechtlichen Frage.',
    exampleReply: 'Gern nehme ich Ihren Rückrufwunsch auf. Ich gebe keine Rechtsberatung. Die Kanzlei prüft Ihr Anliegen und eine mögliche Mandatsannahme.',
  },
  {
    slug: 'autohaeuser', name: 'Autohäuser', headline: 'Von der Anfrage zum nächsten Werkstattkontakt.',
    description: 'Werkstatt- und Fahrzeuganfragen ordnen und passende Ansprechpartner entlasten.',
    tasks: ['Werkstatttermine anfragen', 'Probefahrten vormerken', 'Fahrzeuganfragen zuordnen'],
    knowledge: ['Serviceleistungen', 'Fahrzeugkennungen', 'Werkstatt- und Verkaufszeiten'],
    integration: 'Werkstattkalender und Fahrzeugbestandssystem',
    boundary: 'Fahrzeugbestand, Preise und Werkstattkapazität nur aus aktuellen Systemen. Keine technische Sicherheitsdiagnose.',
    exampleRequest: 'Kann ich einen Termin für den Reifenwechsel bekommen?',
    exampleReply: 'Ich kann Ihren Terminwunsch vorbereiten. Welcher Zeitraum passt Ihnen? Den verbindlichen Termin bestätigt die Werkstatt.',
  },
  {
    slug: 'dienstleistungen', name: 'Dienstleistungen', headline: 'Jede Anfrage bekommt einen nächsten Schritt.',
    description: 'Servicefragen beantworten und Kontakte mit einem klar definierten Anliegen an dein Team geben.',
    tasks: ['Serviceanfragen aufnehmen', 'Termine vormerken', 'Interessenten qualifizieren'],
    knowledge: ['Leistungen', 'Kontakt- und Geschäftszeiten', 'Freigegebene Qualifikationsfragen'],
    integration: 'Kalender oder CRM über eine autorisierte Verbindung',
    boundary: 'Keine verbindliche Leistungs- oder Preiszusage ohne autoritative Daten. Werbliche Folgekontakte nur mit geprüftem Nachweis.',
    exampleRequest: 'Ich würde gern ein Erstgespräch vereinbaren.',
    exampleReply: 'Gern nehme ich Ihren Wunsch auf. Um welche Leistung geht es und wann sind Sie erreichbar? Das Team bestätigt den nächsten Schritt.',
  },
] as const satisfies readonly VoiceIndustry[];

export function findVoiceIndustry(slug: string | null | undefined): VoiceIndustry | undefined {
  return VOICE_INDUSTRIES.find((industry) => industry.slug === slug);
}

export const VOICE_PRODUCT_CONCEPTS = [
  { name: 'RSD Voice Receptionist', purpose: 'Anrufannahme, Informationen und Rückrufmanagement', requirement: 'Freigegebenes Wissen und menschlicher Kontaktweg' },
  { name: 'RSD Voice Booking', purpose: 'Termin- und Reservierungsmanagement', requirement: 'Angebundener Kalender, Berechtigungen und Buchungsbestätigung' },
  { name: 'RSD Voice Commerce', purpose: 'Produktfragen und Kundenservice', requirement: 'Aktuelle Shop-Daten und Identitätsprüfung' },
  { name: 'RSD Voice Sales', purpose: 'Qualifizierung berechtigter Interessenten', requirement: 'Nachweis für erlaubte Kontakte; keine automatische Kaltakquise' },
  { name: 'RSD Voice Enterprise', purpose: 'Individuelle Integrationen und erweiterte Steuerung', requirement: 'Abgestimmte Prozesse, Betrieb und Verantwortlichkeiten' },
] as const;

export const VOICE_ONBOARDING_STEPS = [
  'Branche auswählen', 'Unternehmen beschreiben', 'Wissen freigeben', 'Stimme und Stil wählen',
  'Aufgaben erlauben', 'Systeme verbinden', 'Gespräch testen', 'Telefonnummer einrichten',
  'Tarif bestätigen', 'Aktivierung prüfen',
] as const;
