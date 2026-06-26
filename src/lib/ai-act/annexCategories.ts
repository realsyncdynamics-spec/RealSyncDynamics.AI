/**
 * EU-AI-Act Annex-III-Kategorien + AI-Act-Rollen.
 *
 * Quelle der Wahrheit für die Kategorie-IDs ist src/rules/annex-iii.json
 * (`categories`). Diese Liste hält die menschenlesbaren deutschen Labels und
 * die Annex-III-Punktnummern; ein Test (test/annex-iii-categories.test.ts)
 * erzwingt Parität mit der Registry.
 */

export type AnnexIIICategory =
  | 'biometrics'
  | 'critical_infrastructure'
  | 'education'
  | 'employment'
  | 'essential_services'
  | 'law_enforcement'
  | 'migration'
  | 'justice_democracy';

export interface AnnexIIICategoryMeta {
  id: AnnexIIICategory;
  /** Annex-III-Punkt (Anhang III Verordnung 2024/1689). */
  annexPoint: string;
  label: string;
}

export const ANNEX_III_CATEGORIES: AnnexIIICategoryMeta[] = [
  { id: 'biometrics',              annexPoint: 'III.1', label: 'Biometrie' },
  { id: 'critical_infrastructure', annexPoint: 'III.2', label: 'Kritische Infrastruktur' },
  { id: 'education',               annexPoint: 'III.3', label: 'Bildung & Berufsbildung' },
  { id: 'employment',             annexPoint: 'III.4', label: 'Beschäftigung & Personalmanagement' },
  { id: 'essential_services',      annexPoint: 'III.5', label: 'Wesentliche private & öffentliche Dienste' },
  { id: 'law_enforcement',         annexPoint: 'III.6', label: 'Strafverfolgung' },
  { id: 'migration',              annexPoint: 'III.7', label: 'Migration, Asyl & Grenzkontrolle' },
  { id: 'justice_democracy',       annexPoint: 'III.8', label: 'Justiz & demokratische Prozesse' },
];

export const ANNEX_III_CATEGORY_LABEL: Record<AnnexIIICategory, string> =
  Object.fromEntries(ANNEX_III_CATEGORIES.map((c) => [c.id, c.label])) as Record<AnnexIIICategory, string>;

// ── AI-Act-Rollen (Art. 3) ───────────────────────────────────────────────────

export type ProviderRole =
  | 'provider'
  | 'importer'
  | 'distributor'
  | 'deployer'
  | 'authorized_representative';

export const PROVIDER_ROLE_LABEL: Record<ProviderRole, string> = {
  provider:                  'Anbieter (Provider)',
  importer:                  'Einführer (Importer)',
  distributor:               'Händler (Distributor)',
  deployer:                  'Betreiber (Deployer)',
  authorized_representative: 'Bevollmächtigter',
};

export const PROVIDER_ROLES = Object.keys(PROVIDER_ROLE_LABEL) as ProviderRole[];
