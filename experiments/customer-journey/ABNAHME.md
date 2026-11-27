# Kundenreise / Dashboard — technische Abnahme

## Umfang und Grenzen

Diese Änderung ergänzt ausschließlich Playwright-Smoke-Tests für:
- Die vier Produktlinks unter dem Startseiten-Hero.
- Den direkten Aufruf jeder Produkt-Route (Vite/React SPA).
- Viewport-Breiten 390, 768 und 1440 Pixel ohne horizontales Überlaufen.
- Anonyme Weiterleitung bei /app/dashboard und /app/activation mit sicherem next-Parameter.
- Die Login-E-Mail-Eingabe.

**Nicht durch diese Tests belegt:** visuelle Designqualität, echtes Login, OTP-Zustellung, Registrierung, Tenant-Anlage, Zugriff auf echte Dashboard-Daten, CRUD, Einwilligungsnachweise, E-Mail-Zustellung oder Produktionsrouting per CDN. Ein erfolgreicher lokaler SPA-Test allein beweist keinen funktionierenden Cloudflare-Deep-Link.

## CI-Einbindung und Prüfstand (27.11.2026)

`npm run test:e2e` verwendet `playwright.catalog.config.ts` mit `testDir: './tests/e2e'`.
Die Datei lag zuvor unter `e2e/` und wurde dadurch vom grünen CI-Lauf nicht erfasst.
Sie liegt jetzt unter `tests/e2e/customer-journey-critical.spec.ts`; der bestehende
Workflow führt sie ohne Workflow- oder Dependency-Änderung aus. Direkte Produktaufrufe
prüfen zusätzlich den HTTP-Erfolg, bevor URL und produktspezifischer Inhalt geprüft werden.

Der frühere Lauf [45835500979](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/runs/45835500979)
am PR-Head `ee75143` meldete 47 bestandene und vier übersprungene Katalogtests.
Er enthält keinen Kundenreise-Test und ist daher keine Abnahme dieser neuen Suite.
Die elf Kundenreise-Fälle benötigen einen neuen CI-Nachweis am korrigierten Head.

Diese Prüfung deckt die vier aktuell verlinkten Produkte ab. Sie belegt nicht die
vollständige Umsetzung der verbindlichen sechs Produktpfade: `/voice-agent`,
`/software-factory`, `/automation-os` und `/creative-studio` fehlen als exakte
Routen im geprüften `main@a53dce7`. Die Architekturvorgabe bleibt bestehen;
fehlende Routen werden durch diese Testkorrektur nicht als umgesetzt ausgewiesen.

## Befund aus Repository / öffentlichem Abruf (26.11.2026)
- Produkt-Routen sind in `src/App.tsx` definiert.
- Der Hero-Katalog verweist auf vier eigenständige Ziele in `landingV3Data.ts`.
- `AppGate` schützt das Dashboard auf Auth-Ebene; ein durchgesetzter Tenant-/Onboarding-Status gehört noch nicht zur Auth-Schranke.
- `e2e/onboarding.spec.ts` prüft hauptsächlich anonyme Weiterleitungen; eine authentifizierte Ende-zu-Ende-Reise fehlt.
- Beim öffentlichen textbasierten Abruf waren /ki-bots, /app-builder und /governance-os nicht auslesbar, während / und /claude-code-optimizer Inhalte lieferten. Das allein belegt **keinen** Browserfehler: Browser/Netzwerk/Prerender getrennt prüfen.

## Ausführung

Nach bestehendem Repo-Workflow (keine selbstständige Dependency-Installation):

```sh
npm run build
npm run test:e2e -- tests/e2e/customer-journey-critical.spec.ts
```

Für einen kontrollierten Live-Smoke ohne Formular-Submit:
```sh
TEST_BASE_URL=https://realsyncdynamicsai.de npm run test:e2e -- tests/e2e/customer-journey-critical.spec.ts
```

## Notwendige Freigabe-/Abnahmestufe danach

1. Separates Testkonto und Test-Tenant in einer isolierten Testumgebung provisionieren; keine produktiven Fremdkonten verwenden.
2. Registrieren → OTP/Magic Link in Testpostfach empfangen → Anmeldung → Tenant zugeordnet.
3. Produktaktivierung und Dashboard neu laden, inklusive Empty-State und Rechteprüfung Owner/Viewer.
4. Ein Testobjekt erstellen, lesen, bearbeiten, löschen; keine echten Kundendaten.
5. Audit-Abschluss → E-Mail-Versandauftrag → Provider-ID → Zustell-Webhook → Empfang im Testpostfach; Fehler/Bounce/Retry.
6. Mobile Screenshots und manuelle visuelle Abnahme der Start- und Produktseiten.
7. Alle Abweichungen mit Screenshot, Trace, Revision und reproduzierbarem Befehlsaufruf dokumentieren.

**Freigabe:** keine Migration, Secrets-Änderung, bezahlten Calls, Merges oder Deployments ohne Owner-Zustimmung.
