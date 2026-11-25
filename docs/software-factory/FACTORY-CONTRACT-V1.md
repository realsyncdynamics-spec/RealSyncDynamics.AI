# Kanonischer FactoryJob-Vertrag v1

**Stand: 25.11.2026 · Bezug: Issue #2357, Abnahmekriterium 1 (und Adapterteil von 3).**
Reiner Vertrag: keine Datenbank, kein Netzwerk, keine Secrets, kein Worker-Start, keine Migration.
Ein gültiger Vertrag ist **keine Autorisierung**. Jede Ausgabe trägt `NO_AUTHORITY`
(`canStartWorker`, `canCreatePullRequest`, `canMerge`, `canDeploy` = `false`,
`humanReviewStillRequired` = `true`).

Code: `packages/factory-contract/src/` · Tests: `test/factory-contract/`

## Warum ein eigenes Paket

Die Linien A (`factory/sf-006` / SF-000) und B (Draft-PR #2346/#2347) nutzen gleichnamige
Dateien in `packages/factory-core/` mit abweichender Semantik. Ein „ours/theirs“-Merge
wäre stilles Umdeuten. `@realsync/factory-contract` ist deshalb eine bewusste
Neuimplementierung unter eigenem Pfad, ohne Dateikonflikt mit einem der Branches.
Beide Linien werden über explizite, fail-closed Importfunktionen angebunden.

## Vertrag

| Feld | Regel |
|---|---|
| `contractVersion` | genau `1` |
| `tenantId` | UUID, Pflicht |
| `repository` | nur `realsyncdynamics-spec/RealSyncDynamics.AI` |
| `branch` | `^sf-[a-z0-9][a-z0-9-]{0,99}$` (kompatibel zu Linie B), nie `main` |
| `baseCommitSha` | 40 Hex-Zeichen, getrennt vom Branch |
| `specSha256`, `scopeId` | Pflicht |
| `version` | Compare-and-swap, +1 je Transition |
| `leaseEpoch` | Fencing-Epoche, +1 bei jedem `queued → running` |
| `budget` | `{ currency: 'EUR', maxCents, spentCents }`, nur ganze Cent |
| `attempts` | Eintritte in Phase `implementation`, begrenzt |
| `evidence` | Referenzen mit SHA-256; Behauptung des Absenders, nicht geprüft |
| `provenance` | `canonical`, `legacy-sf006` oder `legacy-pr2346`, mit Legacy-Status |

Eingaben gelten als untrusted: nur eigene Daten-Properties, keine Zusatzfelder, keine Getter.
Mitgelieferte Actor- oder Freigabe-Objekte (`actor`, `trustedActor`, `isOperator`, `aal`, …)
werden abgelehnt.

## Job-State-Machine

```
draft → specified → queued → running ⇄ validating → review_required
queued | running            → paused  → queued
running | validating        → blocked → queued
running | validating        → failed
jeder nicht-terminale Zustand → cancelled
```

- `running` hat die Phasen `analysis → planning → implementation`, nur vorwärts.
- `validating → running` nur zurück in `implementation` (neuer Versuch).
- Übergänge eines Workers aus `running`/`validating` verlangen `fencingEpoch === leaseEpoch`.
  Nach Pause und Neustart wird ein alter Worker mit `stale_lease` abgewiesen.
- `review_required` verlangt Nachweise der Arten `checkout`, `typecheck`, `tests`, `security`.
- `review_required` ist der letzte Zustand der Factory. Freigabe, Merge und Release
  liegen außerhalb des Vertrags und brauchen eigene, menschliche Freigaben.
- Budget- oder Versuchsüberschreitung bricht den Schritt ab, ohne zu kappen.

## Goal-Loop (SF-005) ist getrennt

Die Loop-Zustände `ready`, `awaiting_verification`, `retry_required`, `review_required`,
`blocked` gelten nur, solange der Job in `running/implementation` oder `validating` steht
(`isLoopCompatibleWithJob`). Ein Loop-Status ändert nie den Job-Status. Loop-`review_required`
ist nur ein Hinweis; der Job wechselt ausschließlich über eine eigene Transition mit Nachweisen.

## Abbildung der Legacy-Linien

| Linie A (SF-006) | Linie B (PR #2346) | Kanonisch |
|---|---|---|
| – | `draft` | `draft` |
| – | `specified` | `specified` |
| `queued` | `queued` | `queued` |
| `analyzing` / `planning` / `implementing` | `running` | `running` + Phase (*aktiv, kein Import*) |
| `validating` | `validating` | `validating` (*aktiv, kein Import*) |
| – | `paused` | `paused` |
| `blocked` | – | `blocked` |
| `draft_pr_ready` | `pr_ready` | `review_required` (nur mit Nachweisen) |
| `failed` | `failed` | `failed` |
| `cancelled` | `canceled` | `cancelled` |

Importregeln:

- Tenant, Basis-SHA, Spec-Hash und Scope kommen nur aus einer ausdrücklichen Bindung des Aufrufers.
- Abweichungen zwischen Snapshot und Bindung (Basis-SHA, Branch, Budget) brechen ab.
- Linie B: keine EUR→Cent-Konvertierung. Cent-Werte müssen gebunden sein und exakt zu den
  EUR-Zahlen passen; Bruchteile von Cent gelten als Abweichung.
- `scopeApproved` (Linie B) wird nicht übernommen, nur auf Widerspruch geprüft.
- Aktive Jobs werden nicht importiert (`legacy_job_active_pause_first`); erst pausieren.
- Legacy-Events sind unauthentifiziert und werden nur gezählt (`legacyEventCount`).
- Linie C (`completed` aus dem SF-003-Mock) hat keine Abbildung und wird abgelehnt.

## Prüfung

```bash
npx vitest run test/factory-contract
```

## Was dieser Schritt NICHT erfüllt (Issue #2357 bleibt offen)

- Kriterium 2: Anbindung an AI-OS `authorizeAction()` und Tenant-RLS. Es gibt bisher keine
  registrierten Factory-Aktionen im Gateway; deren Aufnahme ist eine Berechtigungsänderung
  und braucht eine eigene Freigabe.
- Kriterium 4: PostgreSQL-Transaktionen für Job und Event, Worker-Lease, RLS auf isolierter DB.
  Dieser Vertrag legt nur die Felder (`version`, `leaseEpoch`) und Regeln fest.
- Kriterium 5: rootless Worker-E2E mit SHA-Attestierung.
- Kriterien 6 und 7: vollständige CI am Integrations-Head, menschlicher Code-Review,
  keine automatischen Merge-/Migrations-/Deploy-Rechte.
- Die Branches der Linien A und B sind nicht verändert. Ob sie auf diesen Vertrag umgestellt
  oder durch ihn ersetzt werden, ist eine eigene Entscheidung.
