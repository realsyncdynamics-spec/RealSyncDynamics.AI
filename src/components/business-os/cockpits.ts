/**
 * AI Business OS — Branchen-Cockpits für die Vorschau auf `/ai-business-os`.
 *
 * Reine Darstellungsdaten: Alle Zahlen und Einträge sind illustrativ und
 * stammen nicht aus Kundensystemen. Jede Branche nennt eine menschliche
 * Kontrollgrenze (`guardrail`), damit die Vorschau nicht mehr verspricht,
 * als die Agenten eigenständig tun dürfen.
 */

export type AgentStatus = 'active' | 'approval';

export interface CockpitAgent {
  name: string;
  task: string;
  status: AgentStatus;
}

export interface CockpitKpi {
  label: string;
  value: string;
}

export interface Cockpit {
  id: string;
  /** Kurzname im Umschalter */
  tab: string;
  title: string;
  audience: string;
  kpis: readonly [CockpitKpi, CockpitKpi, CockpitKpi, CockpitKpi];
  agents: readonly CockpitAgent[];
  today: readonly string[];
  guardrail: string;
}

export const COCKPITS: readonly Cockpit[] = [
  {
    id: 'handwerk',
    tab: 'Handwerk',
    title: 'Handwerks-Cockpit',
    audience: 'Elektro, Sanitär, Dach, Heizung',
    kpis: [
      { label: 'Neue Anfragen', value: '28' },
      { label: 'Baustellen heute', value: '6' },
      { label: 'Offene Angebote', value: '11' },
      { label: 'Offene Rechnungen', value: '9' },
    ],
    agents: [
      { name: 'Telefon-Assistent', task: 'nimmt Anfragen an und legt Rückrufe an', status: 'active' },
      { name: 'Angebots-Agent', task: 'erstellt Angebotsentwürfe aus Anfragen', status: 'active' },
      { name: 'Termin-Agent', task: 'plant Einsätze und informiert Kunden', status: 'approval' },
    ],
    today: [
      'Heizungsausfall bei Familie Berger: Rückruf vom Telefon-Assistenten angelegt',
      'Angebotsentwurf Badsanierung wartet auf Ihre Prüfung',
      'Baustelle Lindenstraße: drei Materialpositionen fehlen',
    ],
    guardrail: 'Angebote und Termine gehen erst nach Ihrer Freigabe an Kunden.',
  },
  {
    id: 'praxis',
    tab: 'Arztpraxis',
    title: 'Praxis-Cockpit',
    audience: 'Hausärzte, Fachärzte, MVZ',
    kpis: [
      { label: 'Termine heute', value: '64' },
      { label: 'Terminwünsche', value: '19' },
      { label: 'Offene Rückrufe', value: '12' },
      { label: 'Auslastung', value: '87 %' },
    ],
    agents: [
      { name: 'Telefon-Assistent', task: 'nimmt Terminwünsche und Rezeptanfragen auf', status: 'active' },
      { name: 'Erinnerungs-Workflow', task: 'erinnert an Termine und Vorsorge', status: 'active' },
      { name: 'Dokumenten-Vorbereitung', task: 'bereitet Verwaltungsunterlagen vor', status: 'approval' },
    ],
    today: [
      'Sieben Terminwünsche telefonisch aufgenommen',
      'Erinnerungen für Donnerstag vorbereitet',
      'Überweisungsunterlagen warten auf Prüfung durch das Praxisteam',
    ],
    guardrail: 'Medizinische Entscheidungen bleiben beim Fachpersonal.',
  },
  {
    id: 'kanzlei',
    tab: 'Kanzlei',
    title: 'Kanzlei-Cockpit',
    audience: 'Einzelanwälte, Kanzleien, Rechtsabteilungen',
    kpis: [
      { label: 'Mandatsanfragen', value: '9' },
      { label: 'Fristen diese Woche', value: '14' },
      { label: 'Wiedervorlagen', value: '23' },
      { label: 'Offene Freigaben', value: '4' },
    ],
    agents: [
      { name: 'Intake-Bot', task: 'erfasst Mandatsanfragen und Eckdaten', status: 'active' },
      { name: 'Dokumenten-Klassifizierung', task: 'ordnet Eingänge den Akten zu', status: 'active' },
      { name: 'Schriftsatz-Entwurf', task: 'erstellt Entwürfe aus Aktenlage', status: 'approval' },
    ],
    today: [
      'Neue Anfrage Arbeitsrecht: Kollisionsprüfung vorbereitet',
      'Frist Berufungsbegründung am Freitag',
      'Zwölf Eingänge klassifiziert und Akten zugeordnet',
    ],
    guardrail: 'Fristen und juristische Inhalte prüft immer ein Mensch.',
  },
  {
    id: 'gastro',
    tab: 'Gastronomie',
    title: 'Gastro-Cockpit',
    audience: 'Restaurants, Lieferdienste, Cafés',
    kpis: [
      { label: 'Bestellungen heute', value: '142' },
      { label: 'Reservierungen', value: '38' },
      { label: 'In der Küche', value: '7' },
      { label: 'Umsatz heute', value: '4.380 €' },
    ],
    agents: [
      { name: 'Bestellassistent', task: 'nimmt Bestellungen über Website und Telefon an', status: 'active' },
      { name: 'FAQ-Bot', task: 'beantwortet Fragen zu Karte, Allergenen und Öffnungszeiten', status: 'active' },
      { name: 'Reservierungs-Workflow', task: 'bestätigt Tische und Gruppen', status: 'approval' },
    ],
    today: [
      'Gruppe mit zwölf Personen für Samstag angefragt',
      'Lasagne ausverkauft: Speisekarte anpassen?',
      '18 Abholbenachrichtigungen versendet',
    ],
    guardrail: 'Änderungen an Karte und Preisen bestätigen Sie selbst.',
  },
  {
    id: 'industrie',
    tab: 'Industrie',
    title: 'Operations-Cockpit',
    audience: 'Fertigung, Maschinenbau, Produktion',
    kpis: [
      { label: 'Anlagen in Betrieb', value: '24 / 26' },
      { label: 'Gesamtanlageneffektivität', value: '81 %' },
      { label: 'Wartungsaufträge', value: '5' },
      { label: 'Qualitätsmeldungen', value: '2' },
    ],
    agents: [
      { name: 'Wartungs-Agent', task: 'plant Wartungen aus Maschinendaten', status: 'active' },
      { name: 'Dokumentations-Agent', task: 'schreibt Schicht- und Prüfberichte', status: 'active' },
      { name: 'Anomalie-Erkennung', task: 'meldet Abweichungen an Anlagen', status: 'approval' },
    ],
    today: [
      'Presse 3 vibriert über dem Normalwert: Wartung vorgeschlagen',
      'Schichtbericht der Frühschicht erstellt',
      'Prüfprotokoll Charge 2291 wartet auf Freigabe',
    ],
    guardrail: 'In Steuerungen greift kein Agent ohne Freigabe ein.',
  },
];

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  active: 'Aktiv',
  approval: 'Wartet auf Freigabe',
};
