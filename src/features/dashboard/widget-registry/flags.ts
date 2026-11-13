/**
 * Feature-Flags der Widget-Registry.
 *
 * `gmail_restricted_scopes` bleibt false, bis Google CASA verifiziert ist
 * (Blueprint H17). Gmail Restricted Scopes dürfen bis dahin nicht beworben
 * oder automatisch eingebunden werden.
 *
 * `social_channel_connect` bleibt false, bis der serverseitige
 * LinkedIn-OAuth steht. Die Fläche hängt nicht am Auto-Layout.
 */
export const WIDGET_FEATURE_FLAGS: {
  readonly gmail_restricted_scopes: boolean;
  readonly social_channel_connect: boolean;
} = {
  gmail_restricted_scopes: false,
  social_channel_connect: false,
};

export type WidgetFeatureFlagName = keyof typeof WIDGET_FEATURE_FLAGS;

export function isWidgetFeatureEnabled(flag: WidgetFeatureFlagName): boolean {
  return WIDGET_FEATURE_FLAGS[flag] === true;
}
