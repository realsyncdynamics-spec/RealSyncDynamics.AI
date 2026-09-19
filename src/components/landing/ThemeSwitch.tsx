import { useRef, type KeyboardEvent } from 'react';
import { GA_THEMES, GA_THEME_LABEL, type GaTheme } from './use-ga-theme';
import { GA_LINE_SOFT, GA_MONO, GA_TEXT, GA_TITAN } from './governance-ai-theme';

/**
 * Umschalter zwischen den beiden Varianten der Startseite.
 *
 * Sitzt in der Statusleiste über dem Header — dort, wo auch der Prototyp ihn
 * hatte: weit genug oben, um auffindbar zu sein, klein genug, um dem Hero
 * nicht die Aufmerksamkeit zu nehmen.
 *
 * ## Radiogroup heisst auch Radiogroup-Bedienung
 *
 * Als `radiogroup` ausgezeichnet, nicht als Button-Paar: Es ist eine Wahl
 * zwischen sich ausschliessenden Zuständen, und Screenreader sollen den
 * aktiven Zustand mitbekommen, nicht nur zwei anklickbare Wörter.
 *
 * Die Auszeichnung allein reichte dafür aber nicht. Vorher hingen an den
 * Knöpfen nur Klick-Handler: Pfeiltasten änderten nichts, und Tab hielt auf
 * beiden Knöpfen, obwohl eine Radiogroup genau EIN Tabstopp ist. Die Ansage
 * versprach Hilfstechnologie ein Bedienmuster, das es nicht gab.
 *
 * Deshalb jetzt vollständig:
 *
 *   - **Roving Tabindex** — nur die aktive Option ist `tabbable`, die andere
 *     steht auf `-1`. Die Gruppe ist ein Tabstopp, nicht zwei.
 *   - **Pfeiltasten** wechseln die Wahl und wandern zyklisch.
 *   - **Pos1/Ende** springen auf die erste bzw. letzte Option.
 *   - Der Fokus zieht mit der Wahl mit, sonst stünde er auf einem Knopf,
 *     der nicht mehr der gewählte ist.
 *
 * Leertaste und Enter kommen von `<button>` selbst, der Klickpfad ist
 * unverändert.
 */
export function ThemeSwitch({
  theme,
  onChange,
}: {
  theme: GaTheme;
  onChange: (next: GaTheme) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const bounded = (index + GA_THEMES.length) % GA_THEMES.length;
    onChange(GA_THEMES[bounded]);
    buttons.current[bounded]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        select(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        select(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        select(0);
        break;
      case 'End':
        event.preventDefault();
        select(GA_THEMES.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <span
      className="inline-flex gap-0.5 rounded-full border p-0.5"
      style={{ borderColor: GA_LINE_SOFT }}
      role="radiogroup"
      aria-label="Design-Variante"
    >
      {GA_THEMES.map((option, index) => {
        const active = option === theme;
        return (
          <button
            key={option}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option)}
            onKeyDown={(event) => onKeyDown(event, index)}
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
