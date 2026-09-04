/**
 * Ablageort des angemeldeten Browser-Zustands der E2E-Auth-Suite.
 *
 * Bewusst ein eigenes Modul ohne `test()`-Aufruf: `playwright.config.ts`
 * importiert diesen Pfad, und der Config-Loader führt jede importierte Datei
 * aus. Läge die Konstante in `auth.setup.ts`, würde beim Laden der Config der
 * dortige `setup(...)`-Aufruf ausgelöst — Playwright bricht das mit
 * „did not expect test() to be called here" ab.
 *
 * Der Zustand enthält ein gültiges Supabase-Access-Token und ist in
 * `.gitignore` ausgeschlossen.
 */
export const AUTH_STATE_PATH = 'e2e/.auth/user.json';
