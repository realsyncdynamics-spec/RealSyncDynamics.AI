import { useEffect, useState } from 'react';

/**
 * Liefert `true`, wenn das Gerät für aufwendiges WebGL geeignet erscheint:
 * großer Viewport (≥1024px) UND keine reduzierte Bewegung gewünscht.
 *
 * SSR-/Prerender-/jsdom-sicher: ohne `window.matchMedia` (Node, Tests,
 * `scripts/prerender.mjs`) wird `false` zurückgegeben, sodass nie Three.js
 * serverseitig oder im Test geladen wird.
 */
const DESKTOP = '(min-width: 1024px)';
const MOTION_OK = '(prefers-reduced-motion: no-preference)';

function evaluate(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DESKTOP).matches && window.matchMedia(MOTION_OK).matches;
}

export function useHighEndViewport(): boolean {
  const [highEnd, setHighEnd] = useState<boolean>(evaluate);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia(DESKTOP);
    const motion = window.matchMedia(MOTION_OK);
    const update = () => setHighEnd(desktop.matches && motion.matches);
    update();
    desktop.addEventListener('change', update);
    motion.addEventListener('change', update);
    return () => {
      desktop.removeEventListener('change', update);
      motion.removeEventListener('change', update);
    };
  }, []);

  return highEnd;
}
