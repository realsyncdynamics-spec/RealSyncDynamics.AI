# GOV-OS-ABNAHME-001 — Ergebnis, Durchgang 1

Belegte Abarbeitung der Abnahmeliste aus PR #1384 (`docs/GOV-OS-ABNAHME-001.md`),
in der dort vorgegebenen Reihenfolge.

- Prüfer: Claude Code (Sitzung `session_01HqdztyEbrEXEbGbzvPotRa`)
- Datum: 2026-09-15
- Geprüfter Stand: `main` @ `36c8a1f`
- Live-Projekt: `ebljyceifhnlzhjfyxup` (eu-central-1)

## Zusammenfassung

| Abschnitt | Ergebnis |
|---|---|
| A.1 Governance OS Functional Pass | **FAIL** — PR #1372 baut nicht |
| A.2 Gate-Prüfung | **BLOCKED** — Positiv-/Negativfall nicht ausführbar |
| A.3 Frontend-Monetarisierung | **TEILWEISE** — Preise belegt, Checkout-Kette blockiert |
| B.4 Entitlements | **PASS** (Teilumfang) |
| B.5 Plan Catalog / SSoT | **PASS mit Auflage** — 19 bekannte Divergenzen |
| B.6 Multi-Tenancy | **TEILWEISE** — RLS lückenlos, Negativfall offen |
| C.7 / C.8 Builder, Publish | **BLOCKED** |
| D.9 Checkout E2E | **BLOCKED** |
| E.10 Cloudflare Production | **PASS** |
| E.11 Supabase Production | **PASS** |
| E.12 Stripe Testmode | **BLOCKED** |
| F–H | **offen** (Durchgang 2) |

**Gesamt: BLOCKED.** A.1 ist FAIL, und Block E.12 ist nicht verifiziert.
Nach dem Grundsatz der Liste ist damit kein Gesamt-PASS möglich.

---

## A.1 Governance OS Functional Pass — **FAIL**

Geprüfte Sitzung/Arbeit: PR #1372 „feat: make Governance OS legacy surfaces
functional", Head `8066a99`, 2 Dateien, +77 Zeilen.

**Behauptung des PRs:** sechs Legacy-Routen unter `/os/app/*` rendern statt des
Platzhalters die echten Implementierungen (AI System Registry, Agents Center,
Audit Export, Tenant Admin, Billing, Settings), „adds a regression test".

**Befund: Der PR baut nicht.** Alle sechs Importe sind unauflösbar.

Einzelbeleg, unabhängig von der lokalen Umgebung:

| | |
|---|---|
| Alias in `vite.config.ts:17`, `vitest.config.ts:19`, `tsconfig.json:20` | `'@'` → Repo-Wurzel |
| Import im PR | `@/features/billing/BillingView` |
| ergibt Pfad | `<root>/features/billing/BillingView` |
| `ls <root>/features` | `No such file or directory` |
| tatsächlicher Pfad | `<root>/src/features/billing/BillingView.tsx` (vorhanden) |

Der korrekte Präfix in diesem Repo ist `@/src/…` (so die einzige bestehende
Verwendung, `src/flow/index.ts:4`) oder ein relativer Pfad. `@/shared/…`
funktioniert nur deshalb, weil `shared/` tatsächlich in der Wurzel liegt.
`@/features` kommt auf `main` **null**-mal vor — der Präfixfehler entsteht
ausschließlich in diesem PR.

**CI bestätigt es unabhängig.** Job `build` (Run 34842933896, 2026-09-14):

```
> tsc --noEmit
src/enterprise-os/pages/PlaceholderPage.tsx(8,38): error TS2307: Cannot find module
  '@/features/governance/ai-registry/AiSystemRegistryView' …
… (sechs Meldungen, je eine pro Import)
Process completed with exit code 2
```

Rote Checks auf `8066a99`: `build`, `Build SPA`, `Playwright E2E`,
`Cloudflare Pages`. Der Fehlschlag besteht aus **genau diesen sechs Meldungen
und keinen weiteren**.

**Der beigelegte Test belegt die Behauptung nicht.**
`test/legacySurfaceRouting.test.ts` prüft ausschließlich `isLiveLegacySurface()`
— eine Zugehörigkeitsprüfung auf einer Zeichenkettenliste. Er rendert
`PlaceholderPage` nie, prüft nie, dass `FunctionalSurface` die erwartete
Komponente liefert, und kann einen kaputten Import nicht sehen. Die erste
Zusicherung vergleicht `LIVE_SURFACES` mit einer wörtlichen Kopie ihrer selbst.

Der Test lief in dieser Prüfung gar nicht erst an:

```
Error: Failed to resolve import "@/features/governance/ai-registry/AiSystemRegistryView"
Test Files  1 failed (1)
      Tests  no tests
```

Das ist der Fall, den §H der Liste ausschließt („Keine Tests, die nur
HTTP-Status prüfen", hier sinngemäß: nur das Etikett, nicht das Verhalten).

**Zweiter Befund, unabhängig vom Importfehler:** Die Zuordnung hängt am
**deutschen Anzeigetitel** (`title === 'Einstellungen'`). Wird eine
Navigationsbeschriftung umbenannt, fällt die Fläche still auf den Platzhalter
zurück — und der Test bleibt grün, weil er dieselbe Liste gegen sich selbst
prüft.

**Dritter Befund, Koordination:** PR #1373 legt `/os/app/*` auf die kanonische
`/app/*`-Runtime um. Beide PRs sind offen und lösen dasselbe Problem
unvereinbar. Landet #1373, ist der Code aus #1372 tot.

**Empfehlung:** Präfix auf `@/src/features/…` korrigieren, den Test auf das
gerenderte Ergebnis statt auf die Titelliste stellen — und vorher entscheiden,
ob #1372 oder #1373 der Weg ist.

---

## A.2 Gate-Prüfung — **BLOCKED**

Was belegt ist:

- `RouteEntitlementGate` existiert genau einmal und hängt ausschließlich in
  `GovernanceBrowserShell` (`src/components/governance-os/GovernanceBrowserShell.tsx:122`).
- Die zwölf `/os/app/*`-Routen laufen über `AppGate` + `EnterpriseAppShell`
  (`src/App.tsx:1085–1177`) — also **mit** Auth, **ohne** Entitlement-Gate.

**Geprüfte Vermutung, die sich nicht bestätigt hat:** Ich habe angenommen, die
sechs Flächen aus #1372 seien damit an der Bezahlschranke vorbei erreichbar.
Gegen `src/core/access/featureAccess.ts` gemessen: Das Register führt 27
Routen; von den sechs Flächen steht **keine** darin (einzig `agents` trifft auf
`/app/agents/susi`, den Telefon-Agenten — eine andere View). Der kanonische
Pfad sperrt diese Flächen also selbst nicht. **Kein Monetarisierungsleck.**

Für ein PASS fehlt, was die Liste ausdrücklich verlangt: Positiv- **und**
Negativfall je Gate, mit echtem Backend-Read, Insert und geprüftem
Response-Body. Das ist ohne Testmandant und Session nicht ausführbar.

---

## A.3 Frontend-Monetarisierung — **TEILWEISE**

Belegt aus `shared/pricing.ts`:

| Plan | `monthlyEur` |
|---|---|
| Free Audit | 0 |
| **Starter** | **79** |
| Growth | 249 |
| Agency | 699 |
| Enterprise | 1 249 |
| Partner | 1 999 |
| Governance Launch | 349 (einmalig) |

Deckungsgleich mit dem Live-Katalog aus PR #1327. „Starter €79 korrekt": **PASS**.

**Anmerkung, kein Defekt:** Die SSoT führt Jahrespreise (790, 2 490, …), in
Stripe existiert laut #1327 keine einzige Jahres-Price. Das ist über
`yearlyCheckoutUnavailable` abgefangen — bewusst behandelt, nicht offen.

Der Rest der Kette (Session → Webhook → Entitlement → Anzeige) ist blockiert,
siehe D.9.

---

## B.4 Entitlements — **PASS** (Teilumfang)

In `shared/pricing.ts` vorhanden: `siteos.builder`, `siteos.publish`,
`evidence.vault`, `limit.sites` (je acht Fundstellen — Registry und
Plan-Zuordnungen).

`npm run check:pricing` ist grün und belegt zugleich „Entitlement Registry =
Plan Catalog":

```
✓ pricing.generated.ts ist synchron mit shared/pricing.ts
✓ supabase/migrations/20260912171000_canonical_plan_catalog.sql ist synchron mit shared/pricing.ts
```

Offen für volles PASS: „Keine veralteten / unbekannten Entitlements" —
verlangt einen Abgleich Registry ↔ DB-Bestand, nicht nur Registry ↔ Generat.

---

## B.5 Plan Catalog / SSoT — **PASS mit Auflage**

Genau eine kanonische Quelle, Frontend-Projektion und Migrations-SQL daraus
erzeugt und geprüft (siehe B.4).

**Auflage:** `npm run check:limits` meldet

```
Nur auf der Preisseite (kein Entitlement): 17
Nur in der Berechtigung (kein Preisseiten-Feld): 30
OK — 19 bekannte Divergenzen, keine neue.
```

Die Ratsche hält (keine neue Divergenz), aber „Limits stimmen" ist damit
**nicht** erfüllt — 19 Paare weichen ab. Das ist der in CLAUDE.md §7
dokumentierte, bewusst gehaltene Zustand, kein neuer Befund; für eine
Abnahme muss es benannt bleiben.

---

## B.6 Multi-Tenancy — **TEILWEISE**

Gegen die Live-Datenbank gemessen:

| Prüfung | Ergebnis |
|---|---|
| Tabellen in `public` | 371 |
| davon mit RLS | **371 / 371** |

„RLS aktiv": **PASS**. „RLS funktioniert tatsächlich" und
„Cross-Tenant-Zugriff negativ getestet": offen — verlangt zwei echte Mandanten
und Sessions.

---

## C.7 / C.8 Builder und Publish — **BLOCKED**

Verlangt eine angemeldete Sitzung mit und ohne `siteos.builder` /
`siteos.publish` sowie einen echten Publish-Vorgang. In dieser Umgebung nicht
ausführbar.

---

## D.9 Checkout End-to-End — **BLOCKED**

Vorgelagerte Betreiberschritte aus PR #1327 sind offen: Vault-Secrets
`stripe_secret_key` / `stripe_webhook_secret` und der Webhook-Endpunkt im
Stripe-Dashboard. Ohne sie entsteht keine Hosted-Checkout-Session und kein
signierter Webhook.

Zusätzlich: Der Stripe-Connector dieser Sitzung ist **nicht autorisiert** —
ich kann Stripe nicht abfragen. Freigabe über die Connector-Einstellungen auf
claude.ai.

---

## E.10 Cloudflare Production — **PASS**

| Prüfung | Beleg |
|---|---|
| Production SHA | `36c8a1fd86ab093f0fe54e63dd185ebc1eeed79b` |
| = aktueller HEAD | ja (`main` @ `36c8a1f`) |
| Deployment | Run 34957811824, `success`, 2026-09-15 10:27:55 UTC |
| URL erreichbar | `/` · `/audit` · `/pricing` → je HTTP 200 |

---

## E.11 Supabase Production — **PASS**

Pflichtmigrationen, gegen `supabase_migrations.schema_migrations` gemessen:

| Version | verbucht |
|---|---|
| `20260912170000_siteos_builder_entitlements` | **ja** |
| `20260912171000_canonical_plan_catalog` | **ja** |

Schemastand:

| Prüfung | Ergebnis |
|---|---|
| Migrationen verbucht | 338 (neueste `20260912180000`) |
| Migrationen im Repo | 338 |
| `comm -23` (Repo ∖ Prod) | leer |
| `comm -13` (Prod ∖ Repo) | leer |
| Tabellen `public` / davon RLS | 371 / **371** |
| Billing-Tabellen vorhanden | 6 / 6 |
| Funktion `tenant_entitlements` | vorhanden |

Die Mengen sind **in beide Richtungen** verglichen, nicht nur die Zahlen —
CLAUDE.md §5 hält ausdrücklich fest, dass Zahlengleichheit kein Beleg ist.

---

## E.12 Stripe Testmode — **NICHT VERIFIZIERT**

Siehe D.9. Kein Schritt der Kette ist nachgewiesen. Ein Nachweis ohne echten
Webhook und echten Grant wäre nach dem Grundsatz der Liste ohnehin unzulässig.

---

## Methodischer Hinweis: eine eigene Fehlmessung

Mein erster lokaler `npm run lint` meldete **11 Fehler auf `main`** (SiteOS-Puck-Editor,
u. a. „Cannot find module `@puckeditor/core`"). Das wäre ein schwerer Befund
gewesen — er ist **falsch**. `@puckeditor/core` steht in `package.json`, war in
diesem Container aber nicht installiert; `node_modules` ist älter als die
`package.json`. `npm ci` ist hier per Deny-Regel gesperrt, ein sauberer lokaler
Baseline also nicht herstellbar.

Maßgeblich ist CI: Dort scheitert `build` auf #1372 an **genau sechs**
Meldungen — den sechs Importen. Wären die SiteOS-Fehler echt, stünden sie im
selben Protokoll. `main` ist in CI grün.

Festgehalten, weil die Liste genau das verlangt: kein Befund ohne belastbare
Messung — auch dann nicht, wenn er plausibel aussieht.

---

## Nächster Durchgang

1. A.1 nach Entscheid #1372 vs. #1373 erneut prüfen
2. F.13 / F.14 (Dashboard, Landing) — am gerenderten Bild, nicht am Code
3. G (Sicherheit) und H (Tests) vollständig
4. A.2, B.6, C.7, C.8 mit Testmandant
5. D.9 / E.12, sobald die Vault-Secrets gesetzt sind

Reviewer: Claude Code / 2026-09-15 / `36c8a1f`
Owner: offen
