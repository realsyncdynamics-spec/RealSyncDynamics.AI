/**
 * Legacy-Pfade des Enterprise-OS-Prototyps (`/os/app/*`) → kanonische Runtime (`/app/*`).
 *
 * Der Prototyp unter `/os/app/*` war ein Klick-Prototyp mit Mockdaten ohne
 * Backend-Zugriff. Zwei Oberflächen für dieselbe Funktion bedeuten zwangsläufig,
 * dass eine davon Ergebnisse nur behauptet. Deshalb gibt es ab 2026-09-14 nur
 * noch eine Runtime: die kanonischen `/app/*`-Routen inklusive ihrer Guards
 * (AppGate, RequireAal2, Entitlements).
 *
 * Die alten Pfade bleiben als Redirect erhalten — Lesezeichen und Links aus den
 * `/os`-Public-Pages laufen weiter, landen aber auf der echten Funktion.
 *
 * Reihenfolge = Routen-Reihenfolge in `src/App.tsx`; der Splat steht zuletzt.
 */
export const LEGACY_OS_APP_ROUTES: ReadonlyArray<readonly [legacyPath: string, canonicalPath: string]> = [
  ['/os/app', '/app/dashboard'],
  ['/os/app/websites', '/app/websites'],
  ['/os/app/risks', '/app/risks'],
  ['/os/app/compliance', '/app/compliance'],
  ['/os/app/evidence', '/app/evidence'],
  ['/os/app/monitoring', '/app/monitoring'],
  ['/os/app/ai-usecases', '/app/ai-systems'],
  ['/os/app/agents', '/app/agents'],
  ['/os/app/reports', '/app/reports'],
  ['/os/app/team', '/app/team'],
  ['/os/app/billing', '/app/billing'],
  ['/os/app/settings', '/app/settings'],
  // Alles, was es im Prototyp nie gab, landet auf dem echten Dashboard statt im 404.
  ['/os/app/*', '/app/dashboard'],
];
