/**
 * Der öffentliche Scan-Trichter an einer Stelle.
 *
 * Landingpage → `/scan` → `/scan/ergebnis` → Konto → Dashboard.
 *
 * Hier stehen nur Dinge, die **mehrere** Seiten des Trichters brauchen.
 * Alles andere gehört in die jeweilige Seite. `src/config/*` ist laut
 * `CLAUDE.md` §6 die einzige Quelle für geteilte Konfiguration — Preise
 * ausgenommen, die stehen in `shared/pricing.ts`.
 */

/**
 * Edge Functions, ohne die der Trichter nicht arbeitet.
 *
 * Wird von `EdgeFunctionAvailabilityNotice` gelesen: Solange eine davon
 * nicht in Produktion gemessen ist, zeigen die Seiten den Hinweis — und er
 * verschwindet durch das Deployment, nicht durch einen weiteren Commit.
 */
export const SCAN_FUNCTIONS: readonly string[] = ['public-site-scan'];

/** Einstieg des Trichters. */
export const SCAN_ENTRY_PATH = '/scan';

/** Ergebnisseite. Trägt die Scan-Kennung als `?scan=`. */
export const SCAN_RESULT_PATH = '/scan/ergebnis';

/**
 * Wohin die Ergebnisseite für „Analyse speichern" führt.
 *
 * Bewusst der bestehende Registrierungsschritt des Trichters
 * (`/unified-entry/register`) statt einer zweiten Anmeldemaske: Der Weg
 * Registrierung → Onboarding → Dashboard existiert bereits vollständig und
 * wird hier wiederverwendet, nicht nachgebaut.
 */
export const SCAN_REGISTER_PATH = '/unified-entry/register';

/**
 * Beschriftung der Hauptaktion nach dem Scan. Steht hier, weil sie auf der
 * Ergebnisseite und im Dashboard-Hinweis identisch lauten muss.
 */
export const SCAN_SAVE_CTA = 'Analyse speichern & Dashboard öffnen';
