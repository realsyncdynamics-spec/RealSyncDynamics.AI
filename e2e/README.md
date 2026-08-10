# E2E-Suite (`./e2e`)

App-interne Playwright-Suite. Läuft über `npm run e2e` (`playwright.config.ts`).

> Nicht zu verwechseln mit `tests/e2e` — das ist die Katalog-Suite für
> öffentliche Routen gegen eine deploybare Ziel-URL (`npm run test:e2e`,
> `playwright.catalog.config.ts`). Nur diese läuft heute in CI
> (`.github/workflows/e2e.yml`).

## Zwei Projekte

| Projekt | Inhalt | Voraussetzung |
|---|---|---|
| `chromium` | öffentliche Flächen | keine |
| `chromium-auth` | alles hinter `/app/*` | Supabase-Testkonto |

Die Trennung ist keine Kosmetik. `/app/*` liegt hinter `AppGate`
(`src/features/auth/AppGate.tsx`); ohne Session leitet der Guard auf
`/welcome?next=…` um. Specs, die das ignorieren, warten auf Elemente, die auf
der Zielseite nicht existieren können, und melden nach 15 Sekunden einen
Timeout — der wie ein Produktfehler aussieht, aber keiner ist.

## Auth-Suite aktivieren

```bash
E2E_TEST_EMAIL=… E2E_TEST_PASSWORD=… npm run e2e
```

Fehlt eine der beiden Variablen, wird das Projekt `chromium-auth` gar nicht
erst gebildet — die `/app/*`-Specs laufen dann nicht, statt reihenweise
falsch fehlzuschlagen. `e2e/auth.setup.ts` meldet sich in dem Fall als
übersprungen, damit der Grund im Report steht.

### Warum das Testkonto ein Passwort braucht

Der Produktions-Login ist Magic-Link (`Welcome.tsx` → `signInWithOtp`); ein
Passwort-Formular gibt es im UI nicht. Ein E2E-Lauf kann kein Postfach
abrufen, also holt `auth.setup.ts` die Tokens per Passwort-Grant und übergibt
sie der App als URL-Fragment — auf exakt dem Weg, den der Magic-Link-Rücksprung
nimmt. Den Rest erledigt der App-Client selbst
(`detectSessionInUrl: true` in `src/lib/supabase.ts`).

Das Konto braucht also ein gesetztes Passwort, auch wenn niemand sich damit
über die Oberfläche anmelden kann. Der gespeicherte Zustand landet in
`e2e/.auth/user.json` und ist per `.gitignore` ausgeschlossen — er enthält ein
gültiges Access-Token.

## Neue Spec hinter `/app/*`

In `playwright.config.ts` in die Liste `AUTH_SPECS` eintragen. Die Liste ist
bewusst explizit und kein Glob: Der Auth-Bedarf steckt im Inhalt der Datei,
nicht im Dateinamen. Wer den Eintrag vergisst, bekommt genau den
irreführenden Timeout zurück, den diese Trennung beseitigt hat.

**Das Kriterium ist nicht „ruft `/app/*` auf".** Die Frage lautet: Ist die
Session *Voraussetzung* der Prüfung oder ihr *Gegenstand*?

`production-acceptance.spec.ts` steuert `/app/dashboard` und `/app/evidence`
an und gehört trotzdem ins öffentliche Projekt — sie prüft, dass der Guard
Nicht-Angemeldete zu `/welcome` schickt und dass `/app/evidence` einem
anonymen Besucher keine Kennzahlen vortäuscht. Mit Session würden beide
Prüfungen fehlschlagen.

Innerhalb der Spec die `page`-Fixture verwenden — **nicht** `browser.newPage()`.
Ein selbst erzeugter Kontext erbt den `storageState` des Projekts nicht und ist
folglich nicht angemeldet.
