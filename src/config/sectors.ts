/**
 * Branchen (Unternehmenstypen) des Onboardings — Single Source of Truth.
 *
 * Vorher stand diese Liste dreifach im Code: in `PostRegisterOnboardingPage`,
 * in `GovernanceOnboarding` und — als Wertebereich — in der Edge Function
 * `save-company-profile` sowie im CHECK-Constraint `company_profiles_sector_check`.
 * Migration und Edge Function schreiben sich gegenseitig vor, synchron zu
 * bleiben; durchgesetzt wurde das bisher von niemandem. Diese Datei ist die
 * Quelle für das Frontend, und `test/config/sectors-parity.test.ts` prüft
 * Edge Function und Migration dagegen.
 *
 * **Regel bei Änderungen**: Ein neuer Wert muss an drei Stellen ankommen —
 * hier, in `VALID_SECTORS` der Edge Function und im CHECK der Migration.
 * Der Paritäts-Test schlägt sonst fehl.
 *
 * **Werte niemals entfernen.** `company_profiles.sector` speichert die ID von
 * Bestandsmandanten; ein entfernter Wert macht deren Zeile ungültig und den
 * Prüfpfad unlesbar. Soll ein Typ nicht mehr wählbar sein, gehört er
 * ausgeblendet, nicht gelöscht (vgl. `availability` bei den Plänen).
 */

export type SectorId =
  | 'small_business'
  | 'retail'
  | 'furniture_retail'
  | 'manufacturing'
  | 'services'
  | 'agency'
  | 'industrial'
  | 'saas'
  | 'healthcare'
  | 'public_sector'
  | 'generic';

export interface SectorOption {
  id: SectorId;
  /** Anzeigename in der Auswahl und in Zusammenfassungen. */
  label: string;
  /** Ein Satz, der den Typ von seinen Nachbarn abgrenzt. */
  description: string;
}

/**
 * Reihenfolge = Anzeigereihenfolge. Zuerst die allgemeinen Unternehmenstypen
 * aus der Onboarding-Erklärung (/onboarding-erklaert), danach die spezialisierten
 * Branchen, zuletzt der Auffangwert.
 */
export const SECTORS: readonly SectorOption[] = [
  {
    id: 'small_business',
    label: 'Kleinunternehmen',
    description: 'Kleiner Betrieb mit wenigen Anwendungen, oft ohne eigene IT',
  },
  {
    id: 'retail',
    label: 'Handel',
    description: 'Einzel- und Grosshandel, Filialen, Online-Shop',
  },
  {
    id: 'furniture_retail',
    label: 'Möbelhaus',
    description: 'Möbel- und Einrichtungshandel mit Warenwirtschaft und Kasse',
  },
  {
    id: 'manufacturing',
    label: 'Produktionsunternehmen',
    description: 'Fertigung mit ERP, MES und Qualitätsmanagement',
  },
  {
    id: 'services',
    label: 'Dienstleister',
    description: 'Dienstleistung und Beratung, projekt- oder mandatsbezogen',
  },
  {
    id: 'agency',
    label: 'Agentur',
    description: 'Marketing-, Web- oder Digitalagentur, auch White-Label',
  },
  {
    id: 'industrial',
    label: 'Industrieunternehmen',
    description: 'Industrieller Betrieb mit Maschinen-, Anlagen- und Lieferantensystemen',
  },
  {
    id: 'saas',
    label: 'SaaS / Tech',
    description: 'Software-as-a-Service, Cloud-Plattformen, KI-Produkte',
  },
  {
    id: 'healthcare',
    label: 'Healthcare / Medizin',
    description: 'Kliniken, Praxen, Telemedizin, Medizinprodukte',
  },
  {
    id: 'public_sector',
    label: 'Öffentliche Einrichtung',
    description: 'Behörden, Gemeinden, öffentliche Organisationen',
  },
  {
    id: 'generic',
    label: 'Anderes Unternehmen',
    description: 'Passt in keine der Kategorien oben',
  },
] as const;

/** Nur die IDs — für Wertebereichs-Prüfungen und den Paritäts-Test. */
export const SECTOR_IDS: readonly SectorId[] = SECTORS.map((s) => s.id);

const LABEL_BY_ID = new Map<string, string>(SECTORS.map((s) => [s.id, s.label]));

/**
 * Anzeigename zu einer gespeicherten ID. Fällt auf die ID zurück, damit ein
 * Bestandswert aus der Datenbank angezeigt wird statt zu verschwinden — auch
 * dann, wenn er hier (noch) nicht steht.
 */
export function sectorLabel(id: string): string {
  return LABEL_BY_ID.get(id) ?? id;
}

export function isSectorId(value: string): value is SectorId {
  return LABEL_BY_ID.has(value);
}
