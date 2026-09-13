/**
 * Bewegungsreduktion abfragen, ohne `matchMedia` vorauszusetzen.
 *
 * `window.matchMedia` ist nicht überall vorhanden: Der Prerender-Lauf
 * (`scripts/prerender.mjs`) und die Testumgebung rendern ohne, ältere
 * WebViews ebenfalls. Ein ungeschütztes
 * `window.matchMedia(…).matches` wirft dort und reißt den gesamten
 * Effekt-Commit mit — die Seite bleibt dann ohne die Interaktion stehen, die
 * der Effekt eigentlich aufsetzen sollte.
 *
 * Fehlt die API, gilt „keine Reduktion gewünscht": Die Animationen sind
 * durchweg dekorativ und zusätzlich per CSS-Media-Query abgesichert, dort
 * greift die Nutzerpräferenz auch ohne JavaScript.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
