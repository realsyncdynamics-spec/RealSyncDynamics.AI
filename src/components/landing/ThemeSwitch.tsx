import { GA_THEMES, GA_THEME_LABEL, type GaTheme } from './use-ga-theme';
import { GA_LINE_SOFT, GA_MONO, GA_TEXT, GA_TITAN } from './governance-ai-theme';

/**
 * Umschalter zwischen den beiden Varianten der Startseite.
 *
 * Sitzt in der Statusleiste über dem Header — dort, wo auch der Prototyp ihn
 * hatte: weit genug oben, um auffindbar zu sein, klein genug, um dem Hero
 * nicht die Aufmerksamkeit zu nehmen.
 *
 * Als `radiogroup` ausgezeichnet, nicht als Button-Paar: Es ist eine Wahl
 * zwischen sich ausschließenden Zuständen, und Screenreader sollen den
 * aktiven Zustand mitbekommen, nicht nur zwei anklickbare Wörter.
 */
export function ThemeSwitch({
  theme,
  onChange,
}: {
  theme: GaTheme;
  onChange: (next: GaTheme) => void;
}) {
  return (
    <span
      className="inline-flex gap-0.5 rounded-full border p-0.5"
      style={{ borderColor: GA_LINE_SOFT }}
      role="radiogroup"
      aria-label="Design-Variante"
    >
      {GA_THEMES.map((option) => {
        const active = option === theme;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className="rounded-full px-2.5 py-[3px] text-[11px] tracking-[.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)]"
            style={{
              fontFamily: GA_MONO,
              color: active ? GA_TEXT : GA_TITAN,
              backgroundColor: active ? 'rgba(214,220,228,.16)' : 'transparent',
            }}
          >
            {GA_THEME_LABEL[option].toUpperCase()}
          </button>
        );
      })}
    </span>
  );
}
