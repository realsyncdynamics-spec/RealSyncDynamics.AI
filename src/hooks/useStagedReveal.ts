import { useLayoutEffect, useRef } from 'react';

/**
 * Gestaffeltes Einblenden beim Scrollen.
 *
 * Der Hook wird auf einen Container gelegt und kümmert sich um **alle**
 * Nachfahren mit `data-reveal`. Ein Hook je Karte wäre bei Dutzenden
 * Elementen ein Dutzend Observer — hier ist es einer.
 *
 * ## Warum die Sichtbarkeit nicht im CSS beginnt
 *
 * Die Elemente sind im Grundzustand **sichtbar**. Erst wenn dieser Hook den
 * Container mit `data-reveal-root="ready"` markiert, greift die Regel in
 * `index.css`, die sie verbirgt. Andersherum — CSS versteckt, JS zeigt —
 * wäre der prärenderte HTML-Stand (`scripts/prerender.mjs`) leer für alle,
 * bei denen das Skript nicht läuft: Suchmaschinen, abgebrochene Bundles,
 * abgeschaltetes JavaScript. Sichtbarkeit von einem Skript abhängig zu
 * machen, das erst laufen muss, ist ein SEO- und Zugänglichkeitsfehler.
 *
 * `useLayoutEffect` statt `useEffect`, damit das Markieren **vor** dem ersten
 * Anstrich passiert — sonst blitzt der Inhalt kurz auf und verschwindet wieder.
 *
 * ## Bewegungsreduktion
 *
 * Bei `prefers-reduced-motion: reduce` wird gar nicht erst markiert. Kein
 * Observer, kein Verstecken, keine Animation. Die CSS-Regel hat zusätzlich
 * einen eigenen Reduced-Motion-Zweig — zwei Schlösser, weil ein stehen
 * gebliebener, unsichtbarer Inhalt der schlimmste Ausgang wäre.
 *
 * @param staggerMs Abstand zwischen zwei benachbarten Elementen einer Gruppe.
 */
export function useStagedReveal<T extends HTMLElement>(staggerMs = 70) {
  const ref = useRef<T | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Ohne IntersectionObserver (sehr alte Browser, Prerender-Umgebung)
    // bleibt alles sichtbar. Ein nicht unterstütztes Extra darf nichts kosten.
    if (reducedMotion || typeof IntersectionObserver === 'undefined') return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (targets.length === 0) return;

    root.setAttribute('data-reveal-root', 'ready');

    // Die Staffelung zählt je Gruppe, nicht über die ganze Seite: Sonst
    // bekäme die letzte Karte weit unten eine Verzögerung von mehreren
    // Sekunden und stünde beim Hinscrollen erst einmal leer da.
    const counters = new Map<string, number>();
    for (const element of targets) {
      const group = element.dataset.revealGroup ?? 'default';
      const index = counters.get(group) ?? 0;
      counters.set(group, index + 1);
      element.style.setProperty('--reveal-delay', `${index * staggerMs}ms`);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          // Einmal sichtbar, immer sichtbar. Ein erneutes Ausblenden beim
          // Zurückscrollen wirkt auf langen Seiten nervös.
          observer.unobserve(entry.target);
        }
      },
      // Etwas vor der Unterkante auslösen, damit die Bewegung fertig ist,
      // wenn das Element wirklich im Blick liegt.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 }
    );

    for (const element of targets) observer.observe(element);

    return () => {
      observer.disconnect();
      root.removeAttribute('data-reveal-root');
    };
  }, [staggerMs]);

  return ref;
}
