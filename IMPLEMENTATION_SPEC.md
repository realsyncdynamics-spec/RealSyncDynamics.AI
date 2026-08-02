# IMPLEMENTATION_SPEC — PR-Konsolidierung

**Stand**: 2026-08-02 · **Basis**: `origin/main` = `656c28e`
**Zweck**: Arbeitsgrundlage für die Abarbeitung der 32 offenen Pull Requests. Jede Aussage in diesem Dokument ist gegen den Repo-Stand verifiziert (Test-Merge, Migrations-Diff, Testlauf) — keine Schätzungen.

---

## 1. Verifizierte Baseline

| Prüfung | Kommando | Ergebnis |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **grün**, 0 Fehler |
| Unit-Tests | `npm test` | **grün** — 200 Test-Dateien passed, 19 skipped; 2512 Tests passed, 95 skipped, 96 todo |
| Letzte Migration in `main` | `ls supabase/migrations/ \| tail -1` | `20260723000000_enable_rls_critical_tables.sql` |
| Offene TODO/FIXME im Produktivcode | `grep -rn "TODO\|FIXME" src supabase services connectors` | 9 (siehe §5) |

**Korrektur zu CLAUDE.md**: Dort steht „TypeScript 5.8.2 (⚠️ strict: false)" und „Phase 3: TypeScript strict-Migration". Tatsächlich ist in `tsconfig.json` bereits `"strict": true` gesetzt und `tsc --noEmit` läuft fehlerfrei durch. Die strict-Migration ist erledigt — der Roadmap-Punkt ist veraltet. Ausgenommen sind die in `tsconfig.json` unter `exclude` gelisteten Pfade (u. a. `supabase/functions`, `worker`, `scripts`, mehrere `services/*`); dort greift die Prüfung nicht.

---

## 2. P0-Blocker — vor jedem Merge klären

### 2.1 PR #945 darf nicht gemerged werden (`claude/preise-wjbt73`)

Der Branch hat **keinen gemeinsamen Vorfahren** mit `main` (`git merge-base origin/main origin/claude/preise-wjbt73` liefert leer). Kennzahlen:

- 1615 Commits „ahead", 76 Commits „behind"
- Diff gegen `main`: **360 Dateien, +5049 / −45962 Zeilen**

Ein Merge würde ~46.000 Zeilen aus `main` entfernen. Der Titel („Phase 3: Governance Views + Social Orchestrator Infrastructure") legt nahe, dass hier eine unabhängige Historie aufgebaut wurde.

**Vorgehen**: PR schließen. Falls Inhalte gebraucht werden, gezielt per `git cherry-pick` oder `git checkout origin/claude/preise-wjbt73 -- <pfad>` auf einen frischen Branch von `main` übernehmen — niemals als Ganzes mergen.

### 2.2 PR #932 enthält doppelte Migrationen gegen sich selbst

`claude/offene-branches-prs-plan-j009ft` liefert dieselben drei Schema-Migrationen zweimal unter verschiedenen Timestamps:

| Vormittag | Abend | Inhalt identisch? |
|---|---|---|
| `20260628121531_bots_foundation.sql` | `20260628193744_bots_foundation.sql` | **nein** (md5 `85cede5b…` vs. `a0f3bbce…`) |
| `20260628121551_bots_entitlements.sql` | `20260628193759_bots_entitlements.sql` | **nein** (`405bef23…` vs. `bee103b9…`) |
| `20260628121603_bots_ai_tool.sql` | `20260628193820_bots_ai_tool.sql` | **nein** (`3cc72715…` vs. `06f507b8…`) |

Da die Dateien inhaltlich abweichen, ist unklar, welche Variante gilt. Beide anzuwenden erzeugt je nach `CREATE TABLE`-Idempotenz entweder einen Fehler oder ein halbmigriertes Schema.

**Vorgehen**: Im PR die jeweils gewollte Variante behalten, die andere löschen. Vorher Diff der Paare prüfen.

### 2.3 PR #904 und PR #932 kollidieren im Dateinamen

Beide fügen `supabase/migrations/20260728000000_siteos_core.sql` hinzu — **byte-identisch** (md5 `f66707cb…`). PR #932 ist als „Hybrid Merge — 3 Major Features (SiteOS, C2PA, AI Builder)" beschrieben und enthält SiteOS bereits vollständig.

**Vorgehen**: Genau einen der beiden Wege wählen. Empfehlung: #932 als Sammel-PR aufgeben (113 Dateien, +12963 — zu groß für Review) und stattdessen #904 einzeln mergen; die übrigen Bestandteile von #932 laufen ohnehin über #929 (C2PA) und #901 (AI Builder).

### 2.4 Migrations-Timestamps liegen vor dem Stand von `main`

`main` hat zuletzt `20260723000000` angewendet. Diese offenen PRs bringen ältere Timestamps mit:

| PR | Älteste Migration | Delta zu `main` |
|---|---|---|
| #941 | `20260608000001_user_consents.sql` | ~6 Wochen davor |
| #942 | `20260705180000_autonomous_agents_core.sql` | ~2 Wochen davor |
| #930 | `20260719000000_logistics_os_core_tables.sql` | 4 Tage davor |
| #932 | `20260628121531_bots_foundation.sql` u. a. | bis zu 4 Wochen davor |

Die Supabase-CLI wendet beim `db push` standardmäßig nur Migrationen an, deren Version **über** der zuletzt in `supabase_migrations.schema_migrations` eingetragenen liegt; ältere Dateien werden übersprungen (Nachziehen nur mit `--include-all`). Ein grüner Merge bedeutet hier also nicht, dass das Schema in der Zieldatenbank ankommt.

**Vorgehen**: Vor dem Merge die betroffenen Migrationsdateien auf einen Timestamp **nach** `20260723000000` umbenennen und Referenzen in Tests/Docs mitziehen. Migrationen müssen zusätzlich idempotent bleiben (`IF NOT EXISTS`, `CREATE OR REPLACE`), damit ein Nachziehen mit `--include-all` gefahrlos ist.

### 2.5 PR #939 ist ein No-Op

`claude/test-fix-verification-908-e2c6u9` besteht aus zwei Commits, von denen der zweite den ersten zurücknimmt:

```
aa0af43f fix(e2e): update main hero heading regex for #908 design refresh
27c0bf28 fix(e2e): revert hero heading regex to current headline
```

Der Diff gegen den eigenen Merge-Base ist leer (0 Dateien). Der scheinbare Diff gegen `main` (−10088 Zeilen) entsteht nur, weil der Branch weit zurückliegt.

**Vorgehen**: Schließen. Der E2E-Fix zu #908 muss, falls noch nötig, neu auf aktuellem `main` aufgesetzt werden.

---

## 3. Merge-Status aller offenen PRs

Test-Merge via `git merge-tree --write-tree origin/main <branch>`. „+LOC" = Zeilen gegen den jeweiligen Merge-Base.

| PR | Merge | Dateien | +LOC | Migr. | Titel |
|---|---|---|---|---|---|
| 886 | clean | 6 | 183 | – | Playwright-Prerendering für SEO (Cloudflare) |
| 887 | **CONFLICT** | 14 | 2441 | – | Docker-Stack mit Traefik & AI-Services |
| 892 | clean | 23 | 1654 | 1 | DSGVO: Consent-Mode, Widerruf, Versionierung |
| 893 | clean | 3 | 131 | – | Dynamic-Import-Fehler `/pricing`, `/healthtech` |
| 894 | clean | 3 | 418 | – | WhatsApp-Pricing-Page |
| 895 | **CONFLICT** | 8 | 734 | – | Mobile Governance-Menü & Dashboard-Polish |
| 898 | clean | 3 | 65 | – | Startseite Feature-Kommunikation + VPS-Workflows |
| 901 | clean | 90 | 10993 | – | AI-App-Builder + Governance-Backend Monorepo |
| 903 | clean | 2 | 274 | – | Docs: Agenten- & Manager-Roadmap |
| 904 | clean | 34 | 6942 | 1 | SiteOS — AI-native Website-Ebene |
| 905 | clean | 7 | 1081 | – | Docs: Phase-5 Release-Roadmap |
| 908 | **CONFLICT** | 2 | 37 | – | Landing-Copy: Discover → Classify → Enforce → Prove |
| 909 | clean | 3 | 130 | – | Hostinger MCP-Server-Konfiguration |
| 910 | clean | 1 | 347 | – | Docs: CLAUDE.md an Architektur ausrichten |
| 911 | **CONFLICT** | 8 | 232 | – | Positioning: Self-Service-First auf `/about` |
| 929 | clean | 5 | 306 | – | Provenance/C2PA: externe Verifikation |
| 930 | **CONFLICT** | 30 | 11851 | 3 | Logistics OS — Phase 1-8 |
| 931 | clean | 7 | 1702 | – | VPS-Deployment: Skripte, Workflows, Doku |
| 932 | clean | 113 | 12963 | 12 | Hybrid Merge: SiteOS + C2PA + AI Builder |
| 933 | clean | 3 | 69 | – | Agent Center: monatlich abgerechnete Läufe |
| 934 | clean | 5 | 326 | – | Billing-Seite hängt nach MFA auf „Lade…" |
| 935 | clean | 7 | 96 | – | Impressum-Auffindbarkeit + Prerender |
| 936 | clean | 3 | 250 | 1 | Free-Tier-Feature-Locks & Entitlements |
| 938 | **CONFLICT** | 8 | 306 | – | Dashboard: Free-Tier-Sperren, Scan-Fehler, Umlaute |
| 939 | clean | 0 | 0 | – | **No-Op — schließen (§2.5)** |
| 940 | clean | 2 | 734 | – | Docs: Google Cloud Billing Analyse |
| 941 | clean | 11 | 663 | 1 | Hotfix: Edge-Function-Deploy + idempotente Migration |
| 942 | clean | 2 | 118 | 1 | Hotfix: `autonomous_agents`-Namenskollision |
| 943 | clean | 1 | 85 | – | Audit-Modul → `runtime_events` |
| 944 | clean | 4 | 346 | 1 | Risk-Gate Auto-Eskalation |
| 945 | **unrelated history** | 360 | +5049/−45962 | – | **Nicht mergen — schließen (§2.1)** |
| 946 | clean | 4 | 262 | – | Evidence Vault: Audit-Export-Bundle in Advanced UI |

**Kollisionsdateien** (von ≥3 offenen PRs berührt): `src/App.tsx` (4×), `src/features/governance/dashboard/FreeTierDashboard.tsx` (3×), `index.html` (3×), `CLAUDE.md` (3×). Diese Dateien bestimmen die Reihenfolge innerhalb der Stufen.

---

## 4. Stufenplan

Regel für jede Stufe: nach dem Merge `npm run lint && npm test` gegen `main` grün, erst dann die nächste Stufe. Nach jeder Stufe die noch offenen Branches der Folgestufen auf `main` rebasen — die Konfliktliste aus §3 verschiebt sich dadurch.

### Stufe 0 — Aufräumen (kein Code-Risiko)
1. #945 schließen (§2.1), Begründung im PR vermerken
2. #939 schließen (§2.5)
3. Entscheidung #904 vs. #932 treffen (§2.3) — der unterlegene PR wird geschlossen

### Stufe 1 — Hotfixes, konfliktfrei, klein
Reihenfolge nach Abhängigkeit: **#942 → #941 → #943 → #946 → #929 → #944**

- #942 zuerst: benennt Tabellen um und beseitigt die Namenskollision mit `agent_os_substrate`; alle späteren Agent-PRs bauen darauf auf. Migrations-Timestamp vorher nach §2.4 anheben.
- #941 entsperrt den Edge-Function-Deploy — Voraussetzung dafür, dass die Funktionen aus #943/#946/#929 überhaupt ausgerollt werden. Timestamp der eigenen Migration (`20260608000001_user_consents.sql`) nach §2.4 anheben. Der PR bringt zusätzlich `scripts/check-migration-drift.mjs` samt Workflow `migration-drift.yml` mit — genau die Prüfung, die die Timestamp-Probleme aus §2.4 künftig automatisch abfängt. Das ist ein Argument, ihn früh zu mergen und die restlichen Migrations-PRs danach gegen den neuen Check laufen zu lassen.
- #943, #946, #929, #944 sind je ≤5 Dateien und berühren keine der Kollisionsdateien.

### Stufe 2 — Billing / Entitlements
**#936 → #934 → #938 → #933**

#936 und #938 fassen beide `FreeTierDashboard.tsx` an, #938 ist bereits konfliktbehaftet. #936 zuerst mergen, dann #938 rebasen — der Konflikt löst sich dabei voraussichtlich auf, weil beide dieselbe Free-Tier-Logik betreffen. Migrations-Timestamp von #936 (`20260802000000`) ist bereits nach `main` und braucht keine Änderung.

### Stufe 3 — Public Pages / SEO / Copy
**#893 → #886 → #935 → #908 → #911 → #898 → #894**

Alle berühren `src/App.tsx` oder `index.html`. #908 und #911 sind konfliktbehaftet und werden nach den konfliktfreien PRs rebased. #894 (WhatsApp-Pricing) zuletzt, weil es eine neue Route in `src/App.tsx` einhängt.

**Achtung Design-Lock**: `src/pages/MainLanding.tsx` ist laut CLAUDE.md auf Commit `3b972f3` eingefroren. #908 (Landing-Copy) und #898 (Feature-Kommunikation Startseite) sind nur zulässig, soweit sie **ausschließlich Strings und Link-Ziele** ändern. Beide PRs vor dem Merge gegen diese Regel prüfen; jede Layout-, Farb- oder Komponentenänderung braucht ausdrückliche Freigabe.

### Stufe 4 — DSGVO
**#892** — 23 Dateien, eine Migration (`20260727000000`, Timestamp bereits nach `main`). Eigenständige Stufe, weil Consent-Versionierung sowohl Tracking als auch die Landing-Pages betrifft und nach den Copy-PRs aus Stufe 3 sauber getestet werden muss.

### Stufe 5 — Große Feature-Merges
**#904 (SiteOS) → #929 falls noch offen → #901 (AI Builder) → #930 (Logistics OS)**

- #904: 34 Dateien, +6942 — vor dem Merge in reviewbare Teile schneiden oder gezielt durchgehen.
- #901: 90 Dateien, +10993 — Monorepo-Umbau; erst mergen, wenn Stufen 1-4 stabil sind, da er die Projektstruktur verändert.
- #930: konfliktbehaftet, 3 Migrationen mit zu alten Timestamps (§2.4), +11851 — größtes Risiko, zuletzt.

### Stufe 6 — Infrastruktur & Doku
**#887 (rebasen, Konflikt) → #931 → #909 → #903 → #905 → #940 → #910**

#910 („CLAUDE.md an Architektur ausrichten") zuletzt, damit es den Endstand nach allen Merges beschreibt — und die in §1 belegte `strict`-Korrektur mitnimmt.

---

## 5. Offene TODOs im Produktivcode

Vollständige Liste (`grep -rn "TODO\|FIXME" src supabase services connectors`), 9 Treffer:

| Datei:Zeile | Inhalt |
|---|---|
| `src/config/pricing.ts:533` | Add-ons in Checkout-Payload (`answerQuota`, `channels`, `addons[]`) weben |
| `src/features/governance/Iso42001EvidenceVaultView.tsx:549` | Archive-API-Call implementieren |
| `src/pages/optimizer/OptimizerOptimizing.tsx:15` | Backend für Optimizer-Plan fehlt |
| `src/pages/optimizer/OptimizerComplete.tsx:13` | Backend für Optimizer-Abschluss fehlt |
| `src/pages/Blog.tsx:10` | Platzhalter-Posts durch echte ersetzen |
| `supabase/functions/rebuild-website/index.ts:300` | Upload zu Storage + Cloudflare-Pages-Deploy |
| `supabase/functions/social-publisher-worker/index.ts:104` | Publisher für `instagram.reel`, `tiktok.fast`, `x.alert` |
| `supabase/functions/social-publisher-worker/index.ts:406` | dito (zweite Stelle) |
| `supabase/functions/tenant-audit/index.ts:29` | `runtime_events`-Verdrahtung — **wird von PR #943 erledigt** |

Die in CLAUDE.md genannten „Social-Orchestrator (14 TODOs)" sind nicht mehr zutreffend: im gesamten `src/core/social-orchestrator/` stehen noch 2 TODO-Marker, die offenen Punkte liegen in `supabase/functions/social-publisher-worker/` (2 Marker, beide zu fehlenden Kanal-Publishern).

---

## 6. Definition of Done je Merge

1. Branch auf aktuellem `origin/main` rebased, Test-Merge konfliktfrei
2. Migrations-Timestamps nach der zuletzt in `main` liegenden Migration; Migration idempotent
3. `npx tsc --noEmit` grün
4. `npm test` grün — keine Regression gegen die Baseline aus §1 (200 Dateien / 2512 Tests)
5. Bei Änderungen an öffentlichen Routen: `npm run e2e` grün
6. Bei Änderungen an `src/pages/MainLanding.tsx`: nur Strings/Link-Ziele, sonst Freigabe einholen
7. Neue Tabellen mit RLS-Policy und `tenant_id`-Isolation
