import { useEffect, useRef } from 'react';

/**
 * Leichter Parallax auf dem Hero-Hintergrund.
 *
 * Das Bild wandert beim Scrollen langsamer als die Seite. Der Effekt soll
 * spürbar, aber nicht benennbar sein — wer ihn bemerkt, ist er zu stark.
 *
 * ## Warum `scale` dazugehört
 *
 * Das Bild liegt `object-cover` formatfüllend. Verschiebt man es nach oben,
 * läuft die Unterkante ins Bild. Ein leichter Maßstab über 1 legt Reserve an
 * beiden Kanten an, die die Verschiebung aufbraucht.
 *
 * ## Warum requestAnimationFrame
 *
 * `scroll` feuert häufiger als der Bildschirm zeichnet. Ohne Drosselung
 * würde je Ereignis ein Layout erzwungen. Ein `rAF`-Fenster je Frame ist
 * genau die Rate, in der das Ergebnis überhaupt sichtbar wird.
 *
 * Bei `prefers-reduced-motion: reduce` wird kein Zuhörer registriert.
 *
 * @param strength Anteil des Scrollwegs, den das Bild mitgeht (0 = starr).
 * @param maxShiftPx Obergrenze in Pixeln, damit lange Seiten nichts aufreißen.
 */
export function useHeroParallax<T extends HTMLElement>(strength = 0.18, maxShiftPx = 90) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    // Die Reserve muss zur Obergrenze passen: Wird stärker verschoben als
    // der Maßstab hergibt, erscheint eine harte Kante. 900 px Bildhöhe als
    // Bezug ist bewusst konservativ gewählt.
    const scale = 1 + (maxShiftPx * 2) / 900;
    let frame = 0;

    const apply = () => {
      frame = 0;
      const offset = Math.min(window.scrollY * strength, maxShiftPx);
      element.style.transform = `translate3d(0, ${-offset}px, 0) scale(${scale})`;
    };

    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(apply);
    };

    element.style.willChange = 'transform';
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      element.style.transform = '';
      element.style.willChange = '';
    };
  }, [strength, maxShiftPx]);

  return ref;
}
