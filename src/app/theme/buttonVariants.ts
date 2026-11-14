/**
 * Primary-Button der Light Experience.
 * Fläche ist color/text/primary, Label ist color/text/inverse.
 * color/accent/primary ist keine Button-Fläche.
 * Die Component-Aliase in tokens.json zeigen auf dieselben semantischen Namen.
 */
export const PRIMARY_BUTTON = {
  backgroundToken: 'color/text/primary',
  labelToken: 'color/text/inverse',
  backgroundVar: '--color-text-primary',
  labelVar: '--color-text-inverse',
  componentBackground: '--button-bg-primary',
  componentLabel: '--button-text-primary',
  notBackgroundToken: 'color/accent/primary',
} as const;
