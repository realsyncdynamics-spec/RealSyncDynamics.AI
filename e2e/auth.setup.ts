import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  PRODUCTION_SUPABASE_URL,
  PRODUCTION_SUPABASE_ANON_KEY,
} from '../src/lib/supabaseUrl';
import { AUTH_STATE_PATH } from './auth-state';

/**
 * Auth-Setup für die App-Suite (./e2e).
 *
 * Warum programmatisch statt über das Login-Formular:
 * Der Produktions-Login ist Magic-Link (`Welcome.tsx` → `signInWithOtp`).
 * Ein Passwort-Formular existiert im UI nicht, und ein E2E-Lauf kann kein
 * Postfach abrufen. Wir holen die Tokens deshalb per Passwort-Grant und
 * übergeben sie der App auf exakt dem Weg, den der Magic-Link-Rücksprung
 * nimmt: als URL-Fragment. Der App-eigene Client hat `detectSessionInUrl:
 * true` (`src/lib/supabase.ts`) und schreibt die Session selbst weg.
 *
 * Der Umweg über die App ist Absicht: Er hält das Setup unabhängig vom
 * internen Storage-Format von supabase-js. Würden wir den localStorage-Key
 * selbst zusammenbauen, bräche das Setup bei jedem Format-Wechsel der
 * Bibliothek — und zwar stumm, weil die Session dann einfach fehlt.
 *
 * Voraussetzung ist ein Supabase-Testkonto **mit Passwort**:
 *   E2E_TEST_EMAIL   · E-Mail des Testkontos
 *   E2E_TEST_PASSWORD · zugehöriges Passwort
 *
 * Fehlt eines von beiden, wird dieses Setup übersprungen — und mit ihm das
 * gesamte Projekt `chromium-auth` (siehe `playwright.config.ts`). Ohne
 * Session sind die `/app/*`-Specs nicht aussagekräftig: Sie liefen dann
 * gegen die Login-Weiterleitung und meldeten Timeouts, die wie Produktfehler
 * aussehen, aber keine sind.
 */

// Gleiche Auflösungsreihenfolge wie `src/lib/supabaseUrl.ts` — dort über
// `import.meta.env`, hier über `process.env`, weil das Setup in Node läuft.
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL?.trim() || PRODUCTION_SUPABASE_URL).replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY?.trim() || PRODUCTION_SUPABASE_ANON_KEY;

setup('authenticate', async ({ page, baseURL }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  setup.skip(
    !email || !password,
    'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nicht gesetzt — Auth-Suite wird übersprungen.',
  );

  const { data, error } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    // Der Node-Client dient nur der Token-Beschaffung. Persistenz und Refresh
    // übernimmt der App-Client im Browser.
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email: email as string, password: password as string });

  if (error || !data?.session) {
    throw new Error(
      `Supabase-Login für ${email} fehlgeschlagen: ${error?.message ?? 'Antwort ohne Session'}. ` +
        'Existiert das Testkonto und ist ein Passwort gesetzt?',
    );
  }

  const { access_token, refresh_token, expires_in, token_type } = data.session;

  // Form des Fragments entspricht dem Supabase-Redirect nach Magic-Link-Klick.
  const fragment = new URLSearchParams({
    access_token,
    refresh_token,
    expires_in: String(expires_in ?? 3600),
    token_type: token_type ?? 'bearer',
    type: 'magiclink',
  }).toString();

  await page.goto(`/welcome#${fragment}`);

  // Der App-Client übernimmt die Session asynchron. Erst wenn sein
  // Storage-Eintrag steht, ist der Zustand sicherungswürdig.
  await page.waitForFunction(
    () => Object.keys(window.localStorage).some((key) => /^sb-.+-auth-token$/.test(key)),
    undefined,
    { timeout: 30_000 },
  );

  // Gegenprobe auf der echten Zielfläche: Wer nicht angemeldet ist, wird von
  // `AppGate` nach /welcome umgeleitet. Bleibt die URL auf /app/*, trägt die
  // Session. Ohne diese Prüfung würde ein leerer Zustand gespeichert und alle
  // Specs schlügen später mit irreführenden Timeouts fehl.
  await page.goto('/app/dashboard');
  await expect(page).toHaveURL(/\/app\//, { timeout: 30_000 });

  mkdirSync(dirname(AUTH_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: AUTH_STATE_PATH });

  // eslint-disable-next-line no-console -- Lauf-Protokoll, kein Produktionspfad
  console.log(`[auth.setup] Session für ${email} gespeichert unter ${AUTH_STATE_PATH} (Basis: ${baseURL})`);
});
