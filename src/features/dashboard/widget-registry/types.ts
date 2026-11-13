/**
 * Widget-Registry-Typen für das automatische Cockpit (Produktbereich E).
 *
 * Keine neuen Entitlement-Keys. `requiredEntitlements` darf nur Werte aus
 * `ENTITLEMENT_KEYS` in `shared/pricing.ts` enthalten.
 *
 * `status: 'proposed'` = noch keine produktive Datenquelle oder Komponente;
 * solche Widgets dürfen von `selectWidgetsForEntitlements` nicht gewählt werden.
 *
 * Bestehende UI-IDs aus `dashboard_user_preferences.visible_widgets`
 * (Migration 20260705300000): score_card, risk_summary, incidents, insights.
 */

import type { EntitlementKey } from '../../../../shared/pricing';

/** Status eines Registry-Eintrags. `proposed` nie automatisch einbinden. */
export type WidgetStatus = 'available' | 'proposed';

/**
 * Herkunft der Widget-Fläche. `legacy-prefs` = ID bereits in
 * `dashboard_user_preferences.visible_widgets`. `command-center` = Fläche
 * von `/app/dashboard` (CommandCenterDashboard). `proposed` = Spezifikation,
 * noch nicht gebaut.
 */
export type WidgetOrigin = 'legacy-prefs' | 'command-center' | 'governance-cockpit' | 'proposed';

export interface WidgetDefinition {
  /** Stabile ID. Legacy-IDs unverändert übernehmen, keine Synonyme. */
  id: string;
  title: string;
  description: string;
  /**
   * Repo-Pfad der bestehenden Komponente, oder `null` wenn proposed.
   * Ausnahme: `connector_social` hat eine Fläche und bleibt proposed,
   * solange der LinkedIn-OAuth-Code-Tausch fehlt. Keine erfundenen Modulpfade.
   */
  componentPath: string | null;
  /** Alle Keys müssen im Tenant-Entitlement-Satz „an“ sein (`value !== 0`). */
  requiredEntitlements: readonly EntitlementKey[];
  origin: WidgetOrigin;
  status: WidgetStatus;
  /** Teil des automatischen Default-Layouts, sofern Entitlements passen. */
  defaultOn: boolean;
  /**
   * Optionales Feature-Flag. Ist der Flag-Wert false, darf das Widget
   * nicht ins Auto-Layout, auch nicht über preferredVisibleIds.
   */
  featureFlag?: WidgetFeatureFlag;
  /** Start-Set der Kontoanbindungen (Kalender, Graph-Mail, Social). */
  startConnector?: boolean;
}

/** Siehe WIDGET_FEATURE_FLAGS in flags.ts. */
export type WidgetFeatureFlag = 'gmail_restricted_scopes';


/** Kanonische Auswertung: 0 = aus, sonst an (1, Kontingent oder -1). */
export type EntitlementValueMap = Readonly<Partial<Record<EntitlementKey, number>>>;
