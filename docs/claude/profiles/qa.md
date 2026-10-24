# Profil: QA (Tests, Regressionen, E2E, Sicherheitsnachweise)

Ebene 3. Gilt zusätzlich zu `AGENTS.md`, lockert nichts davon.

## Pfade

`test/**`, `tests/e2e/**`, `apps/*/test/**`, Test-Konfigurationen.

## Teststufen

| Stufe | Befehl | Belegt |
|---|---|---|
| Syntax | `npm run check:edge-syntax` | Edge Functions parsen |
| Typecheck | `npm run lint`, App: `npm run typecheck` | Typen des ganzen Projekts |
| Unit | `npm test`, App: `npm test` | Logik |
| Integration/DB | `npm run test:db` | RLS, Migrationen gegen Test-DB |
| Security-Regression | Negativtests im betroffenen Paket | Lücke bleibt geschlossen |
| E2E | `npm run test:e2e` | Nutzerfluss im Browser |
| Deploy-Smoke | Job `smoke-test` in `deploy-cloudflare-pages.yml` | Nur Pages nach Deploy |

## Regeln

- Ein gefilterter Typecheck ist kein Typecheck-Erfolg. Stubs, fehlende Pakete oder andere
  Versionen → `TEILWEISE`.
- Fehlende Abhängigkeiten nicht selbst installieren; Setup der Cloud-Umgebung oder CI nutzen
  (`docs/claude/CONTEXT_POLICY.md`).
- Nie Tests überspringen, deaktivieren oder in Quarantäne setzen, um grün zu werden.
- „Flaky“ ist keine Ursache. Höchstens ein Re-Run zur Bestätigung.
- Für Fixes: Fehler zuerst reproduzieren, dann denselben Check grün zeigen.
- Cloudflare-Preview belegt nicht die Runtime; Runtime-Nachweis nur über `Backend Services CI`.
