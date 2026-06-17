// officeAreas.ts — Registry der Office-OS-Bereiche (Phase 6).
//
// Office OS ist keine Microsoft-Office-Kopie, sondern eine governance-fähige
// Dokumenten- und Arbeitsumgebung direkt im Governance OS. Jeder Bereich ist
// als eigene Route unter /app/office/<id> erreichbar und teilt sich die
// OfficeShell (Sub-Navigation + Prüfpfad-Leiste).
//
// Status (UI-first Scaffold): die Bereiche liefern aktuell Mock-Daten; die
// Persistenz (Supabase + RLS + Prüfpfad) folgt in einer Folge-Iteration.

export type OfficeAreaId =
  | 'documents'
  | 'sheets'
  | 'presentations'
  | 'templates'
  | 'meetings'
  | 'contracts'
  | 'policies';

export type OfficeAreaStatus = 'live' | 'beta' | 'roadmap';

export interface OfficeArea {
  id: OfficeAreaId;
  /** Anzeigename in der Sub-Navigation (Deutsch). */
  label: string;
  /** lucide-react Icon-Name. */
  icon: string;
  /** Vollständige Route (/app/office/<id>). */
  route: string;
  /** Kurzbeschreibung für Hub-Karten und Tooltips. */
  description: string;
  status: OfficeAreaStatus;
}

export const OFFICE_BASE_ROUTE = '/app/office';

export const OFFICE_AREAS: OfficeArea[] = [
  {
    id: 'documents',
    label: 'Dokumente',
    icon: 'FileText',
    route: `${OFFICE_BASE_ROUTE}/documents`,
    description: 'Governance-fähige Dokumente mit Versionierung und Prüfpfad',
    status: 'beta',
  },
  {
    id: 'sheets',
    label: 'Tabellen',
    icon: 'Table2',
    route: `${OFFICE_BASE_ROUTE}/sheets`,
    description: 'Strukturierte Daten, Register und Berechnungen',
    status: 'beta',
  },
  {
    id: 'presentations',
    label: 'Präsentationen',
    icon: 'Presentation',
    route: `${OFFICE_BASE_ROUTE}/presentations`,
    description: 'Decks für Audits, Reviews und Board-Reporting',
    status: 'roadmap',
  },
  {
    id: 'templates',
    label: 'Vorlagen',
    icon: 'LayoutTemplate',
    route: `${OFFICE_BASE_ROUTE}/templates`,
    description: 'Geprüfte Vorlagen für Dokumente, Verträge und Policies',
    status: 'beta',
  },
  {
    id: 'meetings',
    label: 'Meetings',
    icon: 'CalendarClock',
    route: `${OFFICE_BASE_ROUTE}/meetings`,
    description: 'Protokolle, Beschlüsse und Maßnahmen mit Nachweis',
    status: 'roadmap',
  },
  {
    id: 'contracts',
    label: 'Verträge',
    icon: 'FileSignature',
    route: `${OFFICE_BASE_ROUTE}/contracts`,
    description: 'Vertrags-Lebenszyklus mit Fristen und Freigaben',
    status: 'beta',
  },
  {
    id: 'policies',
    label: 'Policies',
    icon: 'ShieldCheck',
    route: `${OFFICE_BASE_ROUTE}/policies`,
    description: 'Richtlinien-Register mit Geltungsbereich und Review-Zyklus',
    status: 'beta',
  },
];

/** Findet einen Office-Bereich anhand der Route-Section (z. B. "documents"). */
export function findOfficeArea(sectionId: string | undefined): OfficeArea | undefined {
  return OFFICE_AREAS.find((area) => area.id === sectionId);
}
