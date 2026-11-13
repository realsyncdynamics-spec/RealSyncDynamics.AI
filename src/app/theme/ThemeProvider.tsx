/**
 * Hängt das Theme des aktiven Mandanten an die Hülle.
 * Die drei Modi kommen aus tokens.css. Ein Override darf nur semantische
 * Variablen setzen und lässt primitives und component unberührt.
 */
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { useTenant } from '../../core/access/TenantProvider';
import { dnaOverlayStyle, isDnaMode } from './dna';
import { splitMotionStyle } from './motionStyle';
import { semanticOverrideStyle, type SemanticOverride } from './overrides';
import { DEFAULT_THEME_MODE, isThemeMode } from './schema';

const ThemeOverrideContext = createContext<SemanticOverride | undefined>(undefined);

/**
 * Liefert Modus und gesetzte Overrides. Die Hülle selbst trägt
 * `.app-shell` und `data-theme` genau einmal.
 */
export function useTenantTheme(overrides?: SemanticOverride): { mode: string; style?: CSSProperties; motionCss: string } {
  const { themeId } = useTenant();
  const fromContext = useContext(ThemeOverrideContext);
  const merged = { ...fromContext, ...overrides };
  const extra = Object.keys(merged).length > 0 ? semanticOverrideStyle(merged) : undefined;
  const mode = isDnaMode(themeId) || isThemeMode(themeId) ? themeId : DEFAULT_THEME_MODE;
  const raw = isDnaMode(themeId) ? { ...dnaOverlayStyle(themeId), ...extra } : extra;
  const split = splitMotionStyle(raw, mode);
  return { mode, style: split.style, motionCss: split.motionCss };
}

export function ThemeProvider({
  overrides,
  children,
}: {
  overrides?: SemanticOverride;
  children: ReactNode;
}) {
  return <ThemeOverrideContext.Provider value={overrides}>{children}</ThemeOverrideContext.Provider>;
}
