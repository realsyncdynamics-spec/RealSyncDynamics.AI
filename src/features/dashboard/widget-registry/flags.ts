/**
 * Feature-Flags der Widget-Registry.
 *
 * `gmail_restricted_scopes` bleibt false, bis Google CASA verifiziert ist
 * (Blueprint H17). Gmail Restricted Scopes dürfen bis dahin nicht beworben
 * oder automatisch eingebunden werden.
 */
export const WIDGET_FEATURE_FLAGS: { readonly gmail_restricted_scopes: boolean } = {
  gmail_restricted_scopes: false,
};

export type WidgetFeatureFlagName = keyof typeof WIDGET_FEATURE_FLAGS;

export function isWidgetFeatureEnabled(flag: WidgetFeatureFlagName): boolean {
  return WIDGET_FEATURE_FLAGS[flag] === true;
}
