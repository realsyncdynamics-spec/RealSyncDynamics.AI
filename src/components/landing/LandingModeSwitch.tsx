/**
 * Umschalter zwischen den beiden Farbmodi der Startseite.
 *
 * Sitzt im Kopf, links neben der Primär-Pill: weit genug oben, um
 * auffindbar zu sein, klein genug, um dem Hero nicht die Aufmerksamkeit zu
 * nehmen.
 *
 * Als `radiogroup` ausgezeichnet, nicht als Button-Paar: Es ist eine Wahl
 * zwischen sich ausschliessenden Zuständen, und Screenreader sollen den
 * aktiven Zustand mitbekommen, nicht nur zwei anklickbare Wörter.
 */
import { LANDING_MODES, LANDING_MODE_LABEL, MODE_ACCENT, MODE_BUTTON_INK, MODE_LINE, type LandingMode } from './landing-mode';
import { LANDING_MONO, LANDING_MUTED } from './landing-theme';

export function LandingModeSwitch({
  mode,
  onChange,
}: {
  mode: LandingMode;
  onChange: (next: LandingMode) => void;
}) {
  return (
    <span
      className="inline-flex shrink-0 gap-0.5 rounded-full border p-0.5"
      style={{ borderColor: MODE_LINE }}
      role="radiogroup"
      aria-label="Farbmodus der Startseite"
    >
      {LANDING_MODES.map((option) => {
        const active = option === mode;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className="rounded-full px-2.5 py-[3px] text-[10px] tracking-[.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsd-accent-soft,#e8c98a)]"
            style={{
              fontFamily: LANDING_MONO,
              color: active ? MODE_BUTTON_INK : LANDING_MUTED,
              backgroundColor: active ? MODE_ACCENT : 'transparent',
            }}
          >
            {LANDING_MODE_LABEL[option].toUpperCase()}
          </button>
        );
      })}
    </span>
  );
}
