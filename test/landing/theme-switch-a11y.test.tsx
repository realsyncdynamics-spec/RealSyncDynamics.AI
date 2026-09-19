/**
 * `ThemeSwitch` sagt `role="radiogroup"` an — und muss das Muster auch
 * bedienen können.
 *
 * Vorher hingen an den Knöpfen nur Klick-Handler. Die Auszeichnung versprach
 * Hilfstechnologie damit ein Verhalten, das es nicht gab: Pfeiltasten taten
 * nichts, und Tab hielt auf beiden Knöpfen statt auf der Gruppe.
 *
 * Diese Datei prüft das Verhalten, nicht den Quelltext — die Komponente ist
 * rein präsentational (kein Router, kein localStorage), also lässt sie sich
 * direkt rendern und mit Tastendrücken bedienen.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeSwitch } from '../../src/components/landing/ThemeSwitch';
import { GA_THEMES, GA_THEME_LABEL } from '../../src/components/landing/use-ga-theme';

const [FIRST, SECOND] = GA_THEMES;

function radios() {
  return screen.getAllByRole('radio');
}

describe('ThemeSwitch — Radiogroup-Auszeichnung', () => {
  it('ist eine Radiogroup mit einer Option je Variante', () => {
    render(<ThemeSwitch theme={FIRST} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(radios()).toHaveLength(GA_THEMES.length);
    for (const option of GA_THEMES) {
      expect(screen.getByText(GA_THEME_LABEL[option].toUpperCase())).toBeTruthy();
    }
  });

  it('markiert genau die aktive Option als gewählt', () => {
    render(<ThemeSwitch theme={SECOND} onChange={() => {}} />);
    const checked = radios().filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent).toBe(GA_THEME_LABEL[SECOND].toUpperCase());
  });
});

describe('ThemeSwitch — Roving Tabindex', () => {
  it('die Gruppe ist EIN Tabstopp, nicht zwei', () => {
    render(<ThemeSwitch theme={FIRST} onChange={() => {}} />);
    const tabbable = radios().filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabbable, 'genau eine Option darf tabbable sein').toHaveLength(1);
    expect(tabbable[0].getAttribute('aria-checked')).toBe('true');
    for (const other of radios().filter((r) => r !== tabbable[0])) {
      expect(other.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('der Tabstopp wandert mit der Wahl', () => {
    const { rerender } = render(<ThemeSwitch theme={FIRST} onChange={() => {}} />);
    expect(radios()[0].getAttribute('tabindex')).toBe('0');
    rerender(<ThemeSwitch theme={SECOND} onChange={() => {}} />);
    expect(radios()[0].getAttribute('tabindex')).toBe('-1');
    expect(radios()[1].getAttribute('tabindex')).toBe('0');
  });
});

describe('ThemeSwitch — Tastaturbedienung', () => {
  it('Pfeil rechts und runter wählen die nächste Option', () => {
    for (const key of ['ArrowRight', 'ArrowDown']) {
      const onChange = vi.fn();
      const { unmount } = render(<ThemeSwitch theme={FIRST} onChange={onChange} />);
      fireEvent.keyDown(radios()[0], { key });
      expect(onChange, key).toHaveBeenCalledWith(SECOND);
      unmount();
    }
  });

  it('Pfeil links und hoch wählen die vorige Option — zyklisch', () => {
    for (const key of ['ArrowLeft', 'ArrowUp']) {
      const onChange = vi.fn();
      const { unmount } = render(<ThemeSwitch theme={FIRST} onChange={onChange} />);
      // Von der ersten Option nach links: umlaufend auf die letzte.
      fireEvent.keyDown(radios()[0], { key });
      expect(onChange, key).toHaveBeenCalledWith(GA_THEMES[GA_THEMES.length - 1]);
      unmount();
    }
  });

  it('Pos1 und Ende springen an die Ränder', () => {
    const onChange = vi.fn();
    render(<ThemeSwitch theme={SECOND} onChange={onChange} />);
    fireEvent.keyDown(radios()[1], { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(FIRST);
    fireEvent.keyDown(radios()[1], { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(GA_THEMES[GA_THEMES.length - 1]);
  });

  it('der Fokus zieht mit der Wahl mit', () => {
    render(<ThemeSwitch theme={FIRST} onChange={() => {}} />);
    radios()[0].focus();
    fireEvent.keyDown(radios()[0], { key: 'ArrowRight' });
    // Sonst stünde der Fokus auf einem Knopf, der nicht mehr der gewählte ist.
    expect(document.activeElement).toBe(radios()[1]);
  });

  it('unbeteiligte Tasten lösen nichts aus', () => {
    const onChange = vi.fn();
    render(<ThemeSwitch theme={FIRST} onChange={onChange} />);
    for (const key of ['a', 'Escape', 'Tab', 'PageDown']) {
      fireEvent.keyDown(radios()[0], { key });
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it('der Klickpfad bleibt unverändert', () => {
    const onChange = vi.fn();
    render(<ThemeSwitch theme={FIRST} onChange={onChange} />);
    fireEvent.click(radios()[1]);
    expect(onChange).toHaveBeenCalledWith(SECOND);
  });
});
