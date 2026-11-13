/**
 * Hängt das Theme des aktiven Mandanten an die Hülle.
 * Die drei Modi kommen aus tokens.css. Ein Override darf nur semantische
 * Variablen setzen und lässt primitives und component unberührt.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useTenant } from '../../core/access/TenantProvider';
import { dnaOverlayStyle, isDnaMode } from './dna';
import { semanticOverrideStyle, type SemanticOverride } from './overrides';
import { DEFAULT_THEME_MODE, isThemeMode } from './schema';

export function useTenantTheme(overrides?: SemanticOverride): { mode: string; style?: CSSProperties } {
  const { themeId } = useTenant();
  const extra = overrides && Object.keys(overrides).length > 0 ? semanticOverrideStyle(overrides) : undefined;
  if (isDnaMode(themeId)) {
    return { mode: themeId, style: { ...dnaOverlayStyle(themeId), ...extra } };
  }
  const mode = isThemeMode(themeId) ? themeId : DEFAULT_THEME_MODE;
  return { mode, style: extra };
}

export function ThemeProvider({
  overrides,
  children,
}: {
  overrides?: SemanticOverride;
  children: ReactNode;
}) {
  const theme = useTenantTheme(overrides);
  return (
    <div className="app-shell" data-theme={theme.mode} style={theme.style}>
      {children}
    </div>
  );
}
