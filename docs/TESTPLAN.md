# Testplan – RealSyncDynamics.AI E2E Suite

## Strategie

Die E2E-Suite prüft `realsyncdynamicsai.de` auf Verfügbarkeit, Navigation, Consent-Verhalten und Governance-Funktionen.
Sie läuft lokal und in GitHub Actions gegen `TEST_BASE_URL`.

---

## ENV-Variablen

| Variable | Beschreibung | Pflicht |
|---|---|---|
| `TEST_BASE_URL` | Ziel-URL, z.B. `https://realsyncdynamicsai.de` | ✅ Ja |
| `STRIPE_TEST_MODE` | `true` = nur Stripe Testmodus erlaubt | ✅ Ja |
| `TEST_EMAIL` | Mail-Adresse für Mail-Capture-Tests | ⚪ Optional |

---

## Test-Ausführung

```bash
# Alle E2E-Tests
npm run test:e2e

# Mit UI (interaktiver Modus)
npm run test:e2e:ui

# HTML-Report öffnen
npm run test:e2e:report
```

---

## Regeln

- **Keine echten Zahlungen** – Stripe nur im Testmodus (`STRIPE_TEST_MODE=true`)
- **Keine echten Mails** – MAIL-Tests sind als `test.skip` markiert bis Mail-Capture verfügbar
- **Keine Destruktion** – App-Shell `/app`, Supabase Functions und Stripe-Webhooks werden nicht verändert
- **Fehlertolerant aber ehrlich** – Transiente Fehler: retry; echte Regressionen: sichtbar machen

---

## Teststruktur

```
tests/
  e2e/
    public-routes.spec.ts   # FE-001 bis FE-008
    navigation.spec.ts      # FE-002 Navigation + CTAs
    audit.spec.ts           # GOV-001 bis GOV-003
    ai-act.spec.ts          # GOV-004 bis GOV-005
    checkout.spec.ts        # CO-001 bis CO-003
    consent.spec.ts         # SEC-001 bis SEC-004
    legal.spec.ts           # LEGAL-001 bis LEGAL-003
  fixtures/
    test-domains.ts         # Test-Domains für Audit
    ai-act-usecases.ts      # AI-Act Usecase-Daten
```

---

## CI/CD

Der Workflow `.github/workflows/e2e.yml` läuft bei:
- Push auf `main` und `feature/**`
- Pull Requests gegen `main`

Artifakte (HTML-Report) werden 30 Tage aufbewahrt.
