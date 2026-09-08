# Entitlement-Matrix (Phase 0)

**Gemessen am 2026-09-08** gegen `shared/pricing.ts` und
`src/core/access/featureAccess.ts` auf `main` @ `9587905`.

> **§36 gilt**: Keine Entitlement-Werte erfinden. Was nicht gemessen ist, steht
> als `UNKNOWN`.

---

## 1. Die Quelle ist eindeutig — und das ist die gute Nachricht

`shared/pricing.ts` ist die einzige Quelle für Plan-Namen, Preise,
Runtime-Limits, Module, Berechtigungen, Feature-Listen und Add-ons.
`src/config/pricing.ts` ist nur eine Projektion; `npm run check:pricing` prüft
den Deno-Zwilling und den DB-Katalog gegen die Quelle.

**§18 des Auftrags („kein zweites Entitlement-System") ist im Ist-Zustand
erfüllt.** Es gibt kein zweites.

---

## 2. Zugriff läuft nicht über Plan-Namen

Verbindlich nach CLAUDE.md §7: Zugriff **nie** über `if (plan === 'agency')`,
sondern über `hasPermission()`, `hasModule()`, `limitOf()`.

Dashboard-Gates kommen aus **einem** Register:
`src/core/access/featureAccess.ts` — 150 Zeilen, **26 Route-Einträge**, geprüft
von `RouteEntitlementGate` in der `GovernanceBrowserShell`.
`test/core/feature-access.test.ts` hält Register, `App.tsx` und Navigation
zusammen.

**Ein Missverhältnis, das auffällt**: 26 Einträge im Gate-Register stehen 480
Routen und 138 `/app/*`-Routen gegenüber. Das ist nicht zwingend ein Fehler —
nicht jede Route ist bezahlte Fläche. Aber **welche** der 138 `/app/*`-Routen
bezahlte Fläche ohne Gate sind, ist `UNKNOWN` und in Phase 0 nicht aufgelöst.
Das ist der lohnendste nächste Messschritt in diesem Bereich.

PR #1243 baut eine Ratsche gegen Zugriffsprüfungen auf Plan-Namen — sie stützt
genau diese Regel und ist unabhängig von der Konsolidierung mergefähig.

---

## 3. Die bekannte Divergenz

CLAUDE.md §7: `plan.limits.*` (Preisseite) und `PLAN_ENTITLEMENTS['limit.*']`
weichen in **18 von 38 Paaren** ab. `npm run check:limits` ist eine Ratsche
gegen **neue** Divergenzen; die bestehenden sind nicht aufgelöst.

**Kanonisch ist seit dem 2026-08-25 die Planart:**

| Planart | Kanonische Quelle |
|---|---|
| Self-Service (Free, Starter, Growth) | `plan.limits.*` — die Preisseite |
| Vertrag (`availability: 'contract'`, heute Enterprise) | **der Vertrag** |

Auf Vertragsplänen bedeutet `-1` seit dem 2026-08-31 (Option A) **„das System
begrenzt hier nicht, der Vertrag tut es"** — nicht „unbegrenzt". Auf diesen
acht Feldern ist **kein Gate erlaubt**.

**Regel, die für jeden Umbau gilt**: Kein neues Enforcement gegen einen
divergierenden Wert, solange er nicht bereinigt ist — und keine stillschweigende
Kürzung bei Bestandskunden.

---

## 4. Matrix

| Dimension | Free | Starter €79 | Growth €249 | Agency €699 | Enterprise €1.249 | Partner |
|---|---|---|---|---|---|---|
| `availability` | self_service | self_service | self_service | **legacy** | **contract** | **legacy** |
| `trialDays` | 0 | **14** | **14** | 0 | 0 | 0 |
| `domains` | 1 | 1 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `seats` | 1 | 1 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `tenants` | 1 | 1 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `bots` | 0 | 1 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `answersPerMonth` | 0 | 500 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `automationRunsPerMonth` | 0 | 25 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `apiCallsPerMonth` | 0 | 0 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `evidenceStorageGb` | 0 | 2 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `auditReportsPerMonth` | 1 | 2 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `remediationPlans` | 0 | 5 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `bulkJobsPerMonth` | 0 | 0 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `apiKeys` | 0 | 0 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| `industrialOtSystems` | 1 | 5 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

**Warum so viele `UNKNOWN`**: Die Werte für Growth, Agency, Enterprise und
Partner wurden in Phase 0 nicht vollständig ausgelesen. Sie stehen in
`shared/pricing.ts` und sind jederzeit messbar — sie hier zu raten wäre der
Fehler, den §36 ausdrücklich verbietet. Die Ergänzung ist Fleißarbeit für
Phase 5, kein Erkenntnisproblem.

---

## 5. Bekannte Modul-Schwellen (aus CLAUDE.md §10, Freigabe 2026-08-30)

| Berechtigung | ab Plan |
|---|---|
| `policy.packs` | Starter (seit AP2) |
| `provenance.advanced`, `bulk.jobs`, `scheduler.enabled`, `evidence.advanced` | Growth |
| `whitelabel.reports` | Agency, Enterprise, Partner — **verkäuflich nur Enterprise** |
| `ai.tool.vps_*` (Kodee) | Agency — **verkäuflich erst Enterprise** |

Die letzten beiden Zeilen sind der Grund, warum die €699-Frage aus
`docs/product/pricing-v2.md` §2 nicht nur eine Preisfrage ist: An Agency hängen
Berechtigungen, die heute niemand self-service erwerben kann.
