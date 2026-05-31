// Branchen-Profile (KMU Compliance Layer · Phase 0).
//
// REINE KONFIGURATION — keine Engine, keine DB. Spiegelt das Muster von
// `runtimeVocab.ts`: statische, typisierte Daten, die die KMU-Sicht
// (`/app/company`) füllen. Jede `task` verlinkt auf eine BEREITS VORHANDENE
// Route/Engine — es wird nichts Neues an Funktionalität gebaut.
//
// Branchen bewusst auf KMU-Nischen fokussiert (Handwerk, Immobilien, Agenturen,
// Pflege, lokale Dienstleister). Wording ohne Beratungs-/Sales-CTAs.

export interface IndustryTask {
  /** Kurzlabel der Aufgabe. */
  label: string;
  /** Ziel = bestehende Route/Engine (kein neues Feature). */
  href: string;
}

export interface IndustryProfile {
  key: string;
  /** Anzeigename in der KMU-Sicht. */
  label: string;
  /** Ein-Satz-Beschreibung der Branche. */
  blurb: string;
  /** Typische Compliance-Risiken dieser Branche (Checkliste). */
  risks: string[];
  /** Häufig genutzte Tools (Vorauswahl für das Profil). */
  suggestedTools: string[];
  /** Nächste Schritte — jeweils auf vorhandene Engines/Routen gemappt. */
  tasks: IndustryTask[];
}

/** Gemeinsame Basis-Aufgaben — alle zeigen auf bestehende Tools. */
const BASE_TASKS: IndustryTask[] = [
  { label: 'Website auf DSGVO prüfen', href: '/audit' },
  { label: 'Datenschutz-Dokumente erstellen', href: '/dokumente-bundle' },
  { label: 'KI-Nutzung einordnen (AI Act)', href: '/ai-act-klassifikator' },
  { label: 'Nachweise sichern', href: '/app/evidence' },
  { label: 'Laufende Überwachung aktivieren', href: '/app/monitoring' },
];

export const INDUSTRY_PROFILES: IndustryProfile[] = [
  {
    key: 'handwerk',
    label: 'Handwerk',
    blurb: 'Elektro, Sanitär, Bau & Co. — Kundendaten, Baustellenbilder, Mitarbeiterdaten.',
    risks: [
      'Kundendaten in WhatsApp ohne Auftragsverarbeitung',
      'Baustellen-/Personenfotos ohne Einwilligung',
      'Mitarbeiterdaten in Google Drive / privaten Konten',
      'Website-Cookies/Tracking ohne Consent',
    ],
    suggestedTools: ['WhatsApp', 'Google Drive', 'E-Mail', 'Website'],
    tasks: BASE_TASKS,
  },
  {
    key: 'immobilien',
    label: 'Immobilien',
    blurb: 'Makler & Verwaltung — Mieter-, Ausweis- und Vertragsdaten.',
    risks: [
      'Mieterdaten und Selbstauskünfte ohne klare Aufbewahrung',
      'Ausweiskopien (oft unzulässig oder zu lang gespeichert)',
      'Verträge und Bewerbungen unverschlüsselt geteilt',
      'Exposé-/Portal-Tracking ohne Consent',
    ],
    suggestedTools: ['Immobilienportale', 'E-Mail', 'Cloud-Speicher', 'Website'],
    tasks: BASE_TASKS,
  },
  {
    key: 'agentur',
    label: 'Agenturen',
    blurb: 'Marketing/Web — Kundenseiten, Tracking, Auftragsverarbeitung.',
    risks: [
      'Tracking/Analytics auf Kundenseiten ohne Consent',
      'Fehlende Auftragsverarbeitungsverträge mit Kunden',
      'Zugriffe auf Kundensysteme ohne Dokumentation',
      'Weitergabe an Sub-Dienstleister ohne Nachweis',
    ],
    suggestedTools: ['Analytics', 'Ad-Plattformen', 'Cloud-Speicher', 'CMS'],
    tasks: BASE_TASKS,
  },
  {
    key: 'pflege',
    label: 'Pflege & Gesundheit',
    blurb: 'Praxen & Dienste — besondere Kategorien (Gesundheitsdaten).',
    risks: [
      'Gesundheitsdaten (Art. 9) ohne erhöhten Schutz',
      'Zugriffe auf Patienten-/Klientendaten nicht protokolliert',
      'Dokumentation in unsicheren Tools',
      'Fehlende DSFA für risikoreiche Verarbeitungen',
    ],
    suggestedTools: ['Praxis-/Pflegesoftware', 'E-Mail', 'Cloud-Speicher'],
    tasks: [
      { label: 'DSFA für Hochrisiko prüfen', href: '/dsfa-wizard' },
      ...BASE_TASKS,
    ],
  },
  {
    key: 'dienstleister',
    label: 'Lokale Dienstleister',
    blurb: 'Kleine Betriebe ohne eigene Compliance-Abteilung.',
    risks: [
      'Website-Cookies/Tracking ohne Consent',
      'Kundendaten ohne strukturierte Aufbewahrung',
      'Fehlende Datenschutzerklärung / VVT',
      'Tools ohne Auftragsverarbeitung',
    ],
    suggestedTools: ['Website', 'E-Mail', 'Buchungstool', 'Cloud-Speicher'],
    tasks: BASE_TASKS,
  },
];

export function findIndustry(key: string | null | undefined): IndustryProfile | null {
  if (!key) return null;
  return INDUSTRY_PROFILES.find((p) => p.key === key) ?? null;
}
