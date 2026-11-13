/**
 * Zugang zum Social-Design-Editor.
 *
 * Flag `creative_studio_editor` (Default aus). Kein Eintrag in
 * `ENTITLEMENT_KEYS` beschreibt diese Fläche, deshalb kein zusätzlicher Key.
 * Während Entitlements laden, bleibt der Zugang zu — auch bei gesetztem Flag.
 */
import { isCreativeStudioEditorEnabled } from '../../config/featureFlags';

export const CREATIVE_STUDIO_MODULE_ID = 'creative-studio';

export type CreativeStudioGate = 'closed' | 'loading' | 'open';

export function creativeStudioGate(input: {
  flagEnabled: boolean;
  entitlementsLoading: boolean;
}): CreativeStudioGate {
  if (!input.flagEnabled) return 'closed';
  if (input.entitlementsLoading) return 'loading';
  return 'open';
}

export function isCreativeStudioVisible(entitlementsLoading: boolean): boolean {
  return creativeStudioGate({
    flagEnabled: isCreativeStudioEditorEnabled(),
    entitlementsLoading,
  }) === 'open';
}
