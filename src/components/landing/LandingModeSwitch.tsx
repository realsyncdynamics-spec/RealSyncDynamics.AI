/**
 * Umschalter zwischen den beiden Farbmodi der Startseite.
 *
 * Sitzt im Kopf, links neben der Primär-Pill: weit genug oben, um
 * auffindbar zu sein, klein genug, um dem Hero nicht die Aufmerksamkeit zu
 * nehmen.
 *
 * ## Warum Radiogroup — und warum das Arbeit macht
 *
 * Es ist eine Wahl zwischen sich ausschliessenden Zuständen, und
 * Screenreader sollen den aktiven Zustand mitbekommen, nicht nur zwei
 * anklickbare Wörter. `role="radiogroup"` verspricht aber mehr als eine
 * Auszeichnung: Wer es ankündigt, muss auch die Tastaturbedienung des
 * Musters liefern, sonst ist die Ansage eine Lüge gegenüber
 * Hilfstechnologie.
 *
 * Deshalb hier vollständig:
 *
 *   - **Roving Tabindex** — die Gruppe ist EIN Tabstopp, nicht zwei. Nur
 *     die aktive Option ist `tabbable`, die andere steht auf `-1`.
 *   - **Pfeiltasten** wechseln die Wahl und wandern zyklisch.
 *   - **Pos1/Ende** springen auf die erste bzw. letzte Option.
 *   - Der Fokus zieht mit der Wahl mit, sonst stünde er auf einem
 *     Knopf, der nicht mehr der gewählte ist.
 *
 * Leertaste und Enter kommen von `<button>` selbst.
 */
import { useRef, type KeyboardEvent } from 'react';
import {
  LANDING_MODES,
  LANDING_MODE_LABEL,
  MODE_ACCENT,
  MODE_BUTTON_INK,
  MODE_LINE,
  type LandingMode,
} from './landing-mode';
import { LANDING_MONO, LANDING_MUTED } from './landing-theme';

export function LandingModeSwitch({
  mode,
  onChange,
}: {
  mode: LandingMode;
  onChange: (next: LandingMode) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const bounded = (index + LANDING_MODES.length) % LANDING_MODES.length;
    onChange(LANDING_MODES[bounded]);
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
        select(LANDING_MODES.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <span
      className="inline-flex shrink-0 gap-0.5 rounded-full border p-0.5"
      style={{ borderColor: MODE_LINE }}
      role="radiogroup"
      aria-label="Farbmodus der Startseite"
    >
      {LANDING_MODES.map((option, index) => {
        const active = option === mode;
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
