import type { CSSProperties } from 'react';

/** Duration-Variablen. Inline schlagen sie die Reduce-Media-Query. */
export const MOTION_DURATION_VARS = [
  '--motion-duration-fast',
  '--motion-duration-base',
  '--motion-duration-slow',
] as const;

function cssIdent(value: string): string {
  return /^[a-z0-9-]+$/i.test(value) ? value : 'generated';
}

/**
 * Nimmt Motion-Dauern aus dem Inline-Style und legt sie in eine
 * `no-preference`-Regel. Unter `prefers-reduced-motion: reduce` bleibt
 * die Stylesheet-Regel mit 0 ms wirksam.
 */
export function splitMotionStyle(
  style: CSSProperties | undefined,
  themeId: string,
): { style?: CSSProperties; motionCss: string } {
  if (!style) return { motionCss: '' };
  const record = { ...(style as Record<string, string>) };
  const lines: string[] = [];
  for (const name of MOTION_DURATION_VARS) {
    const value = record[name];
    delete record[name];
    if (value && /^\d+ms$/.test(value)) lines.push(`${name}: ${value};`);
  }
  const motionCss = lines.length === 0
    ? ''
    : `@media (prefers-reduced-motion: no-preference) {\n  .app-shell[data-theme="${cssIdent(themeId)}"] {\n    ${lines.join('\n    ')}\n  }\n}`;
  const inline = Object.keys(record).length > 0 ? record as CSSProperties : undefined;
  return { style: inline, motionCss };
}
