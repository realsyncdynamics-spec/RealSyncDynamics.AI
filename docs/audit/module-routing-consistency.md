# Audit: Modul- & Routing-Konsistenz (`/app/*`)

Stand: 2026-06-15 · Nur Recherche, keine Code-Änderungen.

## Teil A — Landing-Versprechen vs. `governanceModules.ts`

Landing (`src/pages/Landing.tsx`, GovernanceOsBrowser-Block, Z. 362–400) listet 6 Module:

| Landing-Modul (Z.) | Icon | Entsprechung in `governanceModules.ts` | Befund |
|---|---|---|---|
| Scanner (365) | ScanSearch | — | **fehlt** (vermutlich `/app/scans`, aber nicht im Modul-Array) |
| Evidence Vault (366) | Archive | `evidence` → `/app/evidence` (live, free) | ✓ vorhanden |
| AI Risk Registry (367) | Scale | `risks` → `/app/risks` (beta, starter) | Label-Mismatch ("Risiken" statt "AI Risk Registry") |
| Monitoring (368) | Activity | `monitoring` → `/app/monitoring` (beta, starter) | ✓ vorhanden |
| Audit Trail (369) | ClipboardCheck | — | **fehlt** |
| Policies (370) | ShieldCheck | — | **fehlt** |

→ 3 von 6 Landing-Versprechen (Scanner, Audit Trail, Policies) haben **kein** entsprechendes
Modul in `governanceModules.ts`. Nutzer, die über die Landing-Modul-Übersicht in `/app`
gehen, finden diese Bezeichnungen in der Sidebar/Tab-Leiste nicht wieder.

## `governanceModules.ts` — vollständige Modul-Liste

| ID | Label | Route | Status | Min-Plan | Zeile |
|---|---|---|---|---|---|
| overview | Übersicht | `/app` | live | free | 14–21 |
| websites | Websites | `/app/websites` | live | free | 23–30 |
| evidence | Evidence | `/app/evidence` | live | free | 32–39 |
| ai-systems | KI-Systeme | `/app/ai-systems` | beta | starter | 41–48 |
| risks | Risiken | `/app/risks` | beta | starter | 50–57 |
| monitoring | Monitoring | `/app/monitoring` | beta | starter | 59–66 |
| vendors | Vendors | `/app/vendors` | beta | growth | 68–75 |
| reports | Reports | `/app/reports` | beta | growth | 77–84 |
| dpia | DSFA | `/app/dpia` | roadmap | growth | 86–93 |
| remediation | Remediation | `/app/remediation` | roadmap | agency | 95–102 |
| team | Team | `/app/team` | live | starter | 104–111 |
| settings | Einstellungen | `/app/settings` | live | free | 113–120 |

## Teil B — Routing-Audit `/app/*`

### B1: Duplikat `/app/compliance` vs. `/app/reports`

Beide Routen (App.tsx Z. 434 und 438) rendern dieselbe Komponente
`GovernanceComplianceReportView` (`src/features/governance/ComplianceReportView.tsx`),
die vollständig implementiert ist (Asset-Fetching, Policy-Aggregation, JSON-Export mit
SHA256-Hash).

- `/app/reports` ist in `governanceModules.ts` als Modul `reports` (beta, growth) gelistet.
- `/app/compliance` ist **nicht** in `governanceModules.ts` gelistet → verwaiste Route, die
  zufällig auf dieselbe View zeigt wie `reports`.

→ Entweder ist `/app/compliance` ein Alias, der absichtlich für ältere Links/Bookmarks
existiert, oder eine vergessene Route aus einer früheren Konsolidierung
(`refactor(routing): consolidate /governance/* → /app/*`, #vorheriger Commit).

### B2: `/app/remediation` — Status-Mismatch

- `governanceModules.ts` (Z. 95–102): `remediation` ist als `status: 'roadmap'`,
  `minPlan: 'agency'` deklariert.
- App.tsx (Z. 442–443): `/app/remediation` und `/app/remediation/:planId` rendern
  `RemediationPlansView` bzw. `RemediationPlanDetailView`
  (`src/features/governance/remediation/`) — **vollständig implementierte Views**, kein
  Placeholder. Sie laden echte Daten via `listRemediationPlans(activeTenantId)`.
- `src/components/governance-os/RemediationPlaceholder.tsx` existiert (zeigt "Roadmap"-Badge,
  "Verfügbar im Enterprise Plan"), wird aber **nirgends gerendert**.

→ Nutzer mit Zugriff auf `/app/remediation` sehen eine voll funktionsfähige Ansicht, obwohl
das Modul-Verzeichnis sie als "Roadmap" (= noch nicht verfügbar) ausweist. Je nachdem, ob
`governanceModules.ts` die Sichtbarkeit/das Gating der Tab-Leiste steuert, ist das Feature
entweder (a) unsichtbar aber per direkter URL erreichbar, oder (b) korrekt sichtbar und nur
die Status-Annotation ist veraltet.

### B3: Verwaiste Routes (in App.tsx, nicht in `governanceModules.ts`)

Folgende `/app/*`-Routen existieren mit vollständig implementierten Views, tauchen aber nicht
im Modul-Array auf (daher potenziell nicht in der Governance-Browser-Tab-Leiste sichtbar):

- `/app/scans`, `/app/scans/:scanId` (Z. 456–457) — `GovernanceScansListView` /
  `GovernanceScanDetailView`
- `/app/dsr` (Z. 440) — `GovernanceDsrTrackerView` (Data Subject Requests)
- `/app/incidents` (Z. 441) — `GovernanceIncidentsView` (Hinweis: `/app/risks`, Z. 433,
  rendert ebenfalls `GovernanceIncidentsView` — möglicherweise dieselbe View unter zwei
  Routen/Namen)
- `/app/connectors` (Z. 454) — `GovernanceConnectorsView`
- `/app/costs` (Z. 455) — `GovernanceCostTrackingView`
- `/app/keys` (Z. 444) — `GovernanceKeysView`
- `/app/vvt` (Z. 445) — `RuntimeVvtView`
- `/app/webhooks` (Z. 446) — `GovernanceWebhooksView`
- (+ weitere, insgesamt ca. 19 verwaiste Routen laut Vollscan von App.tsx)

→ Diese Routen sind funktional, aber für Nutzer ohne direkten Link/Bookmark praktisch
unsichtbar, da die Tab-Navigation aus `governanceModules.ts` gespeist wird.

## Teil C — Automation Skills CTA-Routing

| Skill-ID | CTA-Label | CTA-Href | Zeile | Query-Handler? |
|---|---|---|---|---|
| `dsgvo-audit` | Skill aktivieren | `/audit` | 65 | — (öffentliches Tool) |
| `dokumenten-skill` | Skill aktivieren | `/dokumente-bundle` | 81 | — |
| `meeting-compliance` | Workflow ansehen | `/app/automations?skill=meeting` | 98 | ja, aber Mismatch |
| `screenshot-feedback` | Workflow ansehen | `/app/automations?skill=feedback` | 116 | ja, aber Mismatch |
| `lead-risk` | Skill aktivieren | `/audit` | 133 | — |
| `support-skill` | Im Dashboard öffnen | `/assistant` | 150 | — |

`AutomationSkillsView.tsx` (Z. 26–27) liest `searchParams.get('skill')` und vergleicht ihn
gegen `skill.id` (Z. 128–131), um die Karte zu highlighten (`ring-ai-cyan-500/60`).

**Mismatch:** Die CTA-Query-Werte sind Kurzformen (`meeting`, `feedback`), die Skill-IDs sind
`meeting-compliance` und `screenshot-feedback`. `highlightId === skill.id` ist daher für
beide CTAs immer `false` → das Highlight-Feature greift nie, ist aber funktional folgenlos
(Navigation zu `/app/automations` funktioniert, nur ohne visuelles Highlight).

## Zusammenfassung Schweregrade

| Befund | Schwere | Auswirkung |
|---|---|---|
| B1: `/app/compliance` = `/app/reports` (Duplikat, eine Route verwaist) | MEDIUM | Redundanz, unklare kanonische URL |
| B2: `/app/remediation` voll funktional, aber als "roadmap" deklariert | HIGH | Falsche Status-Kommunikation (Modul wirkt nach außen "nicht verfügbar", ist es aber) |
| A: 3 Landing-Modul-Versprechen (Scanner, Audit Trail, Policies) ohne Entsprechung | MEDIUM | Erwartungs-/Vertrauensbruch zwischen Marketing und Produkt |
| A: Label-Mismatch "AI Risk Registry" vs. "Risiken" | LOW | Begriffsverwirrung |
| B3: ~19 verwaiste, aber funktionale `/app/*`-Routen | MEDIUM | Features sind gebaut, aber nicht auffindbar/navigierbar |
| C: Query-Param-Mismatch bei 2 Automation-Skill-CTAs | LOW | Highlight-Feature wirkungslos, Navigation funktioniert |

## Offene Fragen für Entscheidung

1. `/app/compliance` vs. `/app/reports` — welche Route ist kanonisch? Soll die andere als
   Redirect erhalten bleiben (Altlinks) oder entfernt werden?
2. `/app/remediation` — ist das Feature tatsächlich schon "live" (dann `governanceModules.ts`
   Status korrigieren und in Tab-Leiste aufnehmen) oder soll der Zugriff noch gesperrt werden
   (dann `RemediationPlaceholder` tatsächlich verwenden)?
3. Die ~19 verwaisten Routes (`/app/scans`, `/app/dsr`, `/app/incidents`, `/app/connectors`,
   `/app/costs`, `/app/keys`, `/app/vvt`, `/app/webhooks`, ...) — sind das interne/Power-User-
   Tools, die bewusst nicht in der Haupt-Navigation sind, oder fehlen sie in
   `governanceModules.ts` versehentlich?
4. Landing-Versprechen "Scanner", "Audit Trail", "Policies" — welches existierende Modul
   deckt diese ab (z. B. Scanner = `/app/scans`, Audit Trail = Teil von `evidence`)? Oder
   müssen diese Begriffe aus der Landing entfernt/umbenannt werden?
